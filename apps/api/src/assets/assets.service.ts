import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Timeline, TimelineClip, snapToFrame } from '../../../../packages/contracts';

const MEDIA = process.env.MEDIA_DIR ?? '/media';

@Injectable()
export class AssetsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  async createAsset(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No video file provided');
    }

    if (!file.originalname.toLowerCase().endsWith('.mp4') && file.mimetype !== 'video/mp4') {
      throw new BadRequestException('Only MP4/H.264 files are supported in v1');
    }

    const assetId = randomUUID();
    const assetDir = path.join(MEDIA, 'assets', assetId);
    await fs.mkdir(assetDir, { recursive: true });

    const sourcePath = path.join(assetDir, 'source.mp4');
    await fs.writeFile(sourcePath, file.buffer);

    const relativeKey = `assets/${assetId}/source.mp4`;

    const res = await this.db.query(
      `INSERT INTO assets (id, filename, storage_key, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'UPLOADED', NOW(), NOW())
       RETURNING *`,
      [assetId, file.originalname, relativeKey]
    );

    // Enqueue ingest job
    await this.redis.getIngestQueue().add('ingest', {
      assetId,
      srcPath: sourcePath,
    });

    return {
      id: assetId,
      filename: file.originalname,
      status: 'UPLOADED',
      storageKey: relativeKey,
    };
  }

  async getAsset(id: string) {
    const res = await this.db.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundException(`Asset ${id} not found`);
    }

    const row = res.rows[0];
    return {
      ...row,
      proxyUrl: `/media/assets/${id}/proxy.mp4`,
      audioUrl: `/media/assets/${id}/audio.wav`,
      sourceUrl: `/media/assets/${id}/source.mp4`,
    };
  }

  async listAssets() {
    const res = await this.db.query('SELECT * FROM assets ORDER BY created_at DESC LIMIT 50');
    return res.rows.map((row) => ({
      ...row,
      proxyUrl: `/media/assets/${row.id}/proxy.mp4`,
      sourceUrl: `/media/assets/${row.id}/source.mp4`,
    }));
  }

  async getTranscript(id: string) {
    const res = await this.db.query('SELECT words FROM transcripts WHERE asset_id = $1', [id]);
    if (res.rows.length === 0) {
      return { words: [] };
    }
    return { words: res.rows[0].words };
  }

  async getTakes(id: string) {
    const groupsRes = await this.db.query(
      `SELECT g.id, g.idx, g.chosen_segment_id, g.overridden
       FROM take_groups g
       WHERE g.asset_id = $1
       ORDER BY g.idx ASC`,
      [id]
    );

    const segmentsRes = await this.db.query(
      `SELECT s.id, s.idx, s.start_time, s.end_time, s.text, s.features, s.score, s.group_id
       FROM segments s
       WHERE s.asset_id = $1
       ORDER BY s.idx ASC`,
      [id]
    );

    const segmentsByGroup: Record<string, any[]> = {};
    for (const seg of segmentsRes.rows) {
      const gid = seg.group_id || 'ungrouped';
      if (!segmentsByGroup[gid]) segmentsByGroup[gid] = [];
      segmentsByGroup[gid].push({
        id: seg.id,
        idx: seg.idx,
        start: seg.start_time,
        end: seg.end_time,
        text: seg.text,
        score: seg.score,
        features: seg.features,
      });
    }

    const groups = groupsRes.rows.map((g) => {
      const takes = segmentsByGroup[g.id] || [];
      return {
        id: g.id,
        idx: g.idx,
        chosenSegmentId: g.chosen_segment_id,
        overridden: g.overridden,
        takes,
        isRetake: takes.length > 1,
      };
    });

    return { assetId: id, groups };
  }

  async updateTakeGroup(groupId: string, chosenSegmentId: string) {
    const res = await this.db.query(
      `UPDATE take_groups 
       SET chosen_segment_id = $1, overridden = true 
       WHERE id = $2 
       RETURNING *`,
      [chosenSegmentId, groupId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Take group ${groupId} not found`);
    }

    return res.rows[0];
  }

  async getTimeline(assetId: string): Promise<Timeline> {
    const assetRes = await this.db.query('SELECT fps FROM assets WHERE id = $1', [assetId]);
    if (assetRes.rows.length === 0) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    const fps = assetRes.rows[0].fps || 30.0;

    // Get chosen segments in group order
    const query = `
      SELECT g.id as group_id, g.idx as group_idx, s.id as segment_id, s.idx as segment_idx,
             s.start_time, s.end_time, s.text, s.score, s.features,
             (SELECT count(*) FROM segments WHERE group_id = g.id) as take_count
      FROM take_groups g
      JOIN segments s ON s.id = g.chosen_segment_id
      WHERE g.asset_id = $1
      ORDER BY g.idx ASC
    `;
    const res = await this.db.query(query, [assetId]);

    const pad = 0.090; // 90ms padding
    const clips: TimelineClip[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const inSnapped = Math.max(0, Math.round((row.start_time - pad) * fps) / fps);
      const outSnapped = Math.round((row.end_time + pad) * fps) / fps;

      const takeCount = Number(row.take_count);
      const reason =
        takeCount > 1
          ? `chosen take, score ${Number(row.score).toFixed(2)}`
          : 'unique segment';

      clips.push({
        id: `clip_${i + 1}`,
        segmentIdx: row.segment_idx,
        in: inSnapped,
        out: outSnapped,
        groupId: row.group_id,
        reason,
        text: row.text,
      });
    }

    // Sort chronologically and eliminate any overlaps
    clips.sort((a, b) => a.in - b.in);
    for (let i = 0; i < clips.length - 1; i++) {
      if (clips[i].out > clips[i + 1].in) {
        const mid = Math.round(((clips[i].out + clips[i + 1].in) / 2) * fps) / fps;
        clips[i].out = mid;
        clips[i + 1].in = mid;
      }
    }

    return {
      assetId,
      fps,
      clips,
    };
  }
}
