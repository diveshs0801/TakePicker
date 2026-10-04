import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { LocalStorage } from './storage/local.storage';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';

export interface UploadRecord {
  id: string;
  size: number;
  offset: number;
  status: 'CREATED' | 'UPLOADING' | 'COMPLETE' | 'EXPIRED' | 'TERMINATED';
  storage_key: string;
  filename: string | null;
  mime: string | null;
  asset_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export class ChecksumMismatchException extends HttpException {
  constructor(message = 'Checksum mismatch') {
    super(message, 460); // 460 is defined in the TUS checksum extension
  }
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly storage: LocalStorage
  ) {}

  async createUpload(
    size: number,
    metadata: Record<string, string> = {}
  ): Promise<UploadRecord> {
    if (size <= 0) {
      throw new BadRequestException('Upload size must be greater than 0');
    }

    const uploadId = randomUUID();
    const storageKey = `uploads/${uploadId}.part`;
    const filename = metadata.filename || null;
    const mime = metadata.filetype || 'video/mp4';

    await this.storage.create(storageKey, size);

    const res = await this.db.query(
      `INSERT INTO uploads (id, size, "offset", status, storage_key, filename, mime, created_at, updated_at, expires_at)
       VALUES ($1, $2, 0, 'CREATED', $3, $4, $5, NOW(), NOW(), NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [uploadId, size, storageKey, filename, mime]
    );

    return res.rows[0];
  }

  async getUpload(id: string): Promise<UploadRecord & { currentOffset: number }> {
    const res = await this.db.query('SELECT * FROM uploads WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundException(`Upload "${id}" not found`);
    }

    const record: UploadRecord = res.rows[0];
    const stat = await this.storage.stat(record.storage_key);
    const currentOffset = stat ? stat.size : Number(record.offset);

    return {
      ...record,
      currentOffset,
    };
  }

  async handlePatch(
    id: string,
    clientOffset: number,
    stream: Readable,
    checksumHeader?: string
  ): Promise<{ newOffset: number; isComplete: boolean; assetId?: string }> {
    const uploadRes = await this.db.query('SELECT * FROM uploads WHERE id = $1', [id]);
    if (uploadRes.rows.length === 0) {
      throw new NotFoundException(`Upload "${id}" not found`);
    }

    const upload: UploadRecord = uploadRes.rows[0];
    if (upload.status === 'COMPLETE') {
      throw new ConflictException('Upload is already completed');
    }
    if (upload.status === 'TERMINATED' || upload.status === 'EXPIRED') {
      throw new ConflictException(`Upload is ${upload.status}`);
    }

    // 1. Check physical disk size (the source of truth)
    const diskStat = await this.storage.stat(upload.storage_key);
    const currentDiskOffset = diskStat ? diskStat.size : 0;

    if (clientOffset !== currentDiskOffset) {
      throw new ConflictException(
        `Upload-Offset mismatch: client sent ${clientOffset}, but server offset is ${currentDiskOffset}`
      );
    }

    // 2. Parse checksum header if provided (e.g. "sha256 <base64>")
    let expectedHash: string | undefined;
    if (checksumHeader) {
      const parts = checksumHeader.trim().split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'sha256') {
        expectedHash = parts[1];
      }
    }

    // 3. Stream bytes directly to disk with flat memory backpressure
    const appendResult = await this.storage.append(
      upload.storage_key,
      clientOffset,
      stream,
      expectedHash
    );

    if (!appendResult.checksumMatched) {
      throw new ChecksumMismatchException('Upload-Checksum verification failed');
    }

    const newOffset = appendResult.newOffset;

    // 4. Update offset in DB
    await this.db.query(
      `UPDATE uploads
       SET "offset" = $1, status = 'UPLOADING', updated_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
       WHERE id = $2`,
      [newOffset, id]
    );

    try {
      // 5. If offset == declared size: finalize!
      if (newOffset >= Number(upload.size)) {
        const assetId = randomUUID();
        const targetAssetKey = `assets/${assetId}/source.mp4`;

        // Move completed file to asset directory
        await this.storage.move(upload.storage_key, targetAssetKey);

        // Create asset row in Postgres
        await this.db.query(
          `INSERT INTO assets (id, filename, storage_key, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'UPLOADED', NOW(), NOW())`,
          [assetId, upload.filename || 'uploaded_video.mp4', targetAssetKey]
        );

        // Update upload row to COMPLETE
        await this.db.query(
          `UPDATE uploads SET status = 'COMPLETE', asset_id = $1, "offset" = $2, updated_at = NOW() WHERE id = $3`,
          [assetId, newOffset, id]
        );

        // Enqueue ingest job with BullMQ
        try {
          const ingestQueue = this.redis.getIngestQueue();
          await ingestQueue.add('ingest', {
            assetId,
            srcPath: path.join(process.env.MEDIA_DIR ?? '/media', targetAssetKey),
          });
        } catch (queueErr) {
          console.error('[UploadsService] Queue add error:', queueErr);
        }

        this.logger.log(`[UploadsService] Upload ${id} finalized into asset ${assetId}`);

        return {
          newOffset,
          isComplete: true,
          assetId,
        };
      }

      return {
        newOffset,
        isComplete: false,
      };
    } catch (err: any) {
      console.error('[UploadsService] Finalize error:', err);
      throw err;
    }
  }

  async terminateUpload(id: string): Promise<void> {
    const uploadRes = await this.db.query('SELECT * FROM uploads WHERE id = $1', [id]);
    if (uploadRes.rows.length === 0) {
      throw new NotFoundException(`Upload "${id}" not found`);
    }

    const upload: UploadRecord = uploadRes.rows[0];
    await this.storage.remove(upload.storage_key);

    await this.db.query(
      `UPDATE uploads SET status = 'TERMINATED', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}
