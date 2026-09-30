import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { AssetsService } from '../assets/assets.service';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Timeline, RenderSegmentJob, MergeJob } from '../../../../packages/contracts';

const MEDIA = process.env.MEDIA_DIR ?? '/media';

@Injectable()
export class RendersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly assetsService: AssetsService
  ) {}

  async createRender(assetId: string, customTimeline?: Timeline) {
    const asset = await this.assetsService.getAsset(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    if (asset.status !== 'READY') {
      throw new BadRequestException(`Asset is not ready for rendering (status: ${asset.status})`);
    }

    const timeline = customTimeline || (await this.assetsService.getTimeline(assetId));
    if (!timeline.clips || timeline.clips.length === 0) {
      throw new BadRequestException('Timeline contains no clips to render');
    }

    const renderId = randomUUID();
    const renderDir = path.join(MEDIA, 'renders', renderId);
    await fs.mkdir(renderDir, { recursive: true });

    const srcPath = path.join(MEDIA, asset.storage_key);

    // Persist to Postgres
    await this.db.query(
      `INSERT INTO renders (id, asset_id, timeline, status, progress, created_at, updated_at)
       VALUES ($1, $2, $3, 'QUEUED', 0, NOW(), NOW())`,
      [renderId, assetId, JSON.stringify(timeline)]
    );

    // Fan-out pipeline using BullMQ FlowProducer
    const flowProducer = this.redis.getFlowProducer();
    const opts = { attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 } };
    const finalPath = path.join(renderDir, 'final.mp4');

    await flowProducer.add({
      name: 'merge',
      queueName: 'merge',
      data: {
        renderId,
        assetId,
        outPath: finalPath,
      } satisfies MergeJob,
      children: timeline.clips.map((clip, idx) => ({
        name: 'render-segment',
        queueName: 'render-segment',
        opts,
        data: {
          renderId,
          assetId,
          idx,
          in: clip.in,
          out: clip.out,
          srcPath,
          outPath: path.join(renderDir, `seg_${String(idx).padStart(4, '0')}.mp4`),
        } satisfies RenderSegmentJob,
      })),
    });

    return {
      id: renderId,
      assetId,
      status: 'QUEUED',
      clipCount: timeline.clips.length,
    };
  }

  async getRender(id: string) {
    const res = await this.db.query('SELECT * FROM renders WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundException(`Render ${id} not found`);
    }

    const row = res.rows[0];
    return {
      ...row,
      outputUrl: row.output_key ? `/media/${row.output_key}` : null,
    };
  }
}
