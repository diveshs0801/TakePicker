import { Injectable } from '@nestjs/common';
import { StorageService, FileStat } from './storage.interface';
import { promises as fs, createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';

const MEDIA = process.env.MEDIA_DIR ?? '/media';

@Injectable()
export class LocalStorage implements StorageService {
  private getPath(key: string): string {
    return path.join(MEDIA, key);
  }

  async create(key: string, _size: number): Promise<void> {
    const fullPath = this.getPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    // Create or truncate to empty file
    await fs.writeFile(fullPath, Buffer.alloc(0));
  }

  async stat(key: string): Promise<FileStat | null> {
    try {
      const fullPath = this.getPath(key);
      const st = await fs.stat(fullPath);
      return { size: st.size };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async append(
    key: string,
    offset: number,
    stream: Readable,
    expectedSha256?: string
  ): Promise<{ bytesWritten: number; newOffset: number; checksumMatched: boolean }> {
    const fullPath = this.getPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    return new Promise((resolve, reject) => {
      // Use 'r+' with start offset so we seek directly to offset
      // or 'a' if appending at the current end
      const writeStream = createWriteStream(fullPath, {
        flags: offset === 0 ? 'w' : 'r+',
        start: offset,
      });

      const hash = crypto.createHash('sha256');
      let bytesWritten = 0;

      stream.on('data', (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (expectedSha256) {
          hash.update(chunk);
        }
      });

      stream.on('error', (err) => {
        writeStream.destroy();
        reject(err);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });

      writeStream.on('finish', async () => {
        if (expectedSha256) {
          const computedBase64 = hash.digest('base64');
          const computedHex = hash.digest('hex');

          // TUS checksum can be base64 or hex
          if (computedBase64 !== expectedSha256 && computedHex !== expectedSha256) {
            // Mismatch: truncate back to pre-chunk offset
            try {
              await fs.truncate(fullPath, offset);
            } catch (truncErr) {
              console.error('[LocalStorage] Truncate error after checksum mismatch:', truncErr);
            }
            return resolve({
              bytesWritten: 0,
              newOffset: offset,
              checksumMatched: false,
            });
          }
        }

        resolve({
          bytesWritten,
          newOffset: offset + bytesWritten,
          checksumMatched: true,
        });
      });

      // Stream body into file with backpressure
      stream.pipe(writeStream);
    });
  }

  open(key: string): Readable {
    const fullPath = this.getPath(key);
    return createReadStream(fullPath);
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const fromPath = this.getPath(fromKey);
    const toPath = this.getPath(toKey);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    try {
      await fs.rename(fromPath, toPath);
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        // Cross-device link fallback
        await fs.copyFile(fromPath, toPath);
        await fs.unlink(fromPath);
      } else {
        throw err;
      }
    }
  }

  async remove(key: string): Promise<void> {
    const fullPath = this.getPath(key);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async truncate(key: string, offset: number): Promise<void> {
    const fullPath = this.getPath(key);
    await fs.truncate(fullPath, offset);
  }
}
