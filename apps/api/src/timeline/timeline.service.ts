import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../ws/events.gateway';
import { AssetsService } from '../assets/assets.service';
import {
  Timeline,
  TimelineClip,
  TimelineOp,
  TimelineOpType,
  TimelineErrorCode,
  StructuredError,
  snapToFrame,
  TimeDomain,
  SilenceInterval,
  SilenceDetectionOptions,
  SilenceRemovalResult,
} from '../../../../packages/contracts';
import {
  applyOperation,
  timelineToSource,
  sourceToTimeline,
  ApplyOpResult,
} from './timeline.ops';
import {
  validateTimelineInvariants,
  computeTimelineSpans,
  TimelineInvariantViolation,
} from './timeline.invariants';
import { detectSilences, generateJumpCutTimeline } from './silence.detector';
import { randomUUID } from 'node:crypto';

export class StructuredOpException extends BadRequestException {
  constructor(public readonly errorData: StructuredError) {
    super(errorData);
  }
}

@Injectable()
export class TimelineService {
  constructor(
    private readonly db: DatabaseService,
    private readonly wsGateway: EventsGateway,
    private readonly assetsService: AssetsService
  ) {}

  /**
   * Reconstructs the timeline state at a specific seq (or latest if seq is omitted)
   * using the snapshot + replay model.
   */
  async getTimelineAt(
    assetId: string,
    targetSeq?: number
  ): Promise<{ timeline: Timeline; currentSeq: number }> {
    const asset = await this.assetsService.getAsset(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    // 1. Find the highest snapshot at or before targetSeq
    let snapshotQuery = `
      SELECT seq, timeline 
      FROM timeline_snapshots 
      WHERE asset_id = $1
    `;
    const snapshotParams: any[] = [assetId];
    if (targetSeq !== undefined) {
      snapshotQuery += ` AND seq <= $2`;
      snapshotParams.push(targetSeq);
    }
    snapshotQuery += ` ORDER BY seq DESC LIMIT 1`;

    const snapshotRes = await this.db.query(snapshotQuery, snapshotParams);

    let baseTimeline: Timeline;
    let baseSeq: number;

    if (snapshotRes.rows.length > 0) {
      baseSeq = snapshotRes.rows[0].seq;
      baseTimeline = snapshotRes.rows[0].timeline;
    } else {
      // If no snapshot exists yet, check if there's any op
      const opCountRes = await this.db.query(
        'SELECT COUNT(*) as count FROM timeline_ops WHERE asset_id = $1',
        [assetId]
      );
      const opCount = parseInt(opCountRes.rows[0]?.count || '0', 10);

      if (opCount === 0) {
        // Baseline from take groups (seq = 0)
        baseTimeline = await this.assetsService.getTimeline(assetId);
        baseSeq = 0;

        // Persist initial snapshot at seq = 0
        await this.db.query(
          `INSERT INTO timeline_snapshots (asset_id, seq, timeline, created_at)
           VALUES ($1, 0, $2, NOW())
           ON CONFLICT (asset_id, seq) DO NOTHING`,
          [assetId, JSON.stringify(baseTimeline)]
        );
      } else {
        // Snapshot is missing but ops exist (fall back to rebuilding from seq 0)
        baseTimeline = await this.assetsService.getTimeline(assetId);
        baseSeq = 0;
      }
    }

    // 2. Fetch and replay ops since baseSeq up to targetSeq
    let opsQuery = `
      SELECT id, seq, op_type, payload, inverse, actor, agent_run_id, created_at
      FROM timeline_ops
      WHERE asset_id = $1 AND seq > $2
    `;
    const opsParams: any[] = [assetId, baseSeq];
    if (targetSeq !== undefined) {
      opsQuery += ` AND seq <= $3`;
      opsParams.push(targetSeq);
    }
    opsQuery += ` ORDER BY seq ASC`;

    const opsRes = await this.db.query(opsQuery, opsParams);

    let currentTimeline = baseTimeline;
    let currentSeq = baseSeq;

    for (const row of opsRes.rows) {
      try {
        const result = applyOperation(
          currentTimeline,
          row.op_type,
          row.payload,
          asset.duration
        );
        currentTimeline = result.newTimeline;
        currentSeq = row.seq;
      } catch (err: any) {
        console.error(
          `[TimelineService] Replay error at op seq=${row.seq} (${row.op_type}):`,
          err.message
        );
      }
    }

    return { timeline: currentTimeline, currentSeq };
  }

  /**
   * Applies an operation to the timeline with optimistic concurrency and snapshotting.
   */
  async applyOp(
    assetId: string,
    opType: TimelineOpType,
    payload: any,
    actor: 'user' | 'agent' = 'user',
    agentRunId?: string,
    expectedBaseSeq?: number
  ): Promise<{ timeline: Timeline; seq: number; op: TimelineOp }> {
    const asset = await this.assetsService.getAsset(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    const { timeline: currentTimeline, currentSeq } = await this.getTimelineAt(assetId);

    // Optimistic concurrency check
    if (expectedBaseSeq !== undefined && expectedBaseSeq !== currentSeq) {
      const err: StructuredError = {
        ok: false,
        code: 'STALE_BASE_SEQ',
        message: `Expected base seq ${expectedBaseSeq}, but current seq is ${currentSeq}`,
        hint: `Refresh timeline with get_timeline() and re-apply edit.`,
      };
      throw new StructuredOpException(err);
    }

    let result: ApplyOpResult;
    try {
      result = applyOperation(currentTimeline, opType, payload, asset.duration);
    } catch (err: any) {
      const code: TimelineErrorCode = err.code || 'INVARIANT_VIOLATION';
      const structErr: StructuredError = {
        ok: false,
        code,
        message: err.message,
        hint: `Check parameters for ${opType}`,
      };
      throw new StructuredOpException(structErr);
    }

    const nextSeq = currentSeq + 1;
    const opId = randomUUID();

    // Persist to timeline_ops
    await this.db.query(
      `INSERT INTO timeline_ops (id, asset_id, seq, op_type, payload, inverse, actor, agent_run_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        opId,
        assetId,
        nextSeq,
        opType,
        JSON.stringify(payload),
        JSON.stringify(result.inverseOp),
        actor,
        agentRunId || null,
      ]
    );

    // Snapshot every 20 ops
    if (nextSeq % 20 === 0) {
      await this.db.query(
        `INSERT INTO timeline_snapshots (asset_id, seq, timeline, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (asset_id, seq) DO UPDATE SET timeline = EXCLUDED.timeline`,
        [assetId, nextSeq, JSON.stringify(result.newTimeline)]
      );
    }

    const opRecord: TimelineOp = {
      id: opId,
      assetId,
      seq: nextSeq,
      opType,
      payload,
      inverse: result.inverseOp,
      actor,
      agentRunId,
      createdAt: new Date().toISOString(),
    };

    // Emit event to subscribers
    this.wsGateway.emitToAsset(assetId, 'timeline:op_applied', {
      assetId,
      seq: nextSeq,
      op: opRecord,
      timeline: result.newTimeline,
    });

    return {
      timeline: result.newTimeline,
      seq: nextSeq,
      op: opRecord,
    };
  }

  /**
   * Appends the inverse of the most recent op to achieve undo.
   */
  async undo(
    assetId: string,
    actor: 'user' | 'agent' = 'user'
  ): Promise<{ timeline: Timeline; seq: number; op: TimelineOp }> {
    const latestRes = await this.db.query(
      `SELECT * FROM timeline_ops WHERE asset_id = $1 ORDER BY seq DESC LIMIT 1`,
      [assetId]
    );

    if (latestRes.rows.length === 0) {
      const structErr: StructuredError = {
        ok: false,
        code: 'NOTHING_TO_UNDO',
        message: 'No operations in log to undo',
        hint: 'Timeline is in its initial state',
      };
      throw new StructuredOpException(structErr);
    }

    const latestOp = latestRes.rows[0];
    const inverse = latestOp.inverse;

    if (!inverse || !inverse.opType) {
      throw new StructuredOpException({
        ok: false,
        code: 'INVARIANT_VIOLATION',
        message: 'Latest op does not contain a valid inverse',
      });
    }

    return await this.applyOp(
      assetId,
      inverse.opType,
      inverse.payload,
      actor,
      undefined,
      latestOp.seq
    );
  }

  /**
   * Gets the operations log since a given sequence number.
   */
  async getOpsLog(assetId: string, sinceSeq = 0): Promise<TimelineOp[]> {
    const res = await this.db.query(
      `SELECT id, asset_id as "assetId", seq, op_type as "opType", payload, inverse, actor, agent_run_id as "agentRunId", created_at as "createdAt"
       FROM timeline_ops
       WHERE asset_id = $1 AND seq > $2
       ORDER BY seq ASC`,
      [assetId, sinceSeq]
    );
    return res.rows;
  }

  /**
   * Removes a span of time across clips (splitting boundary clips as needed).
   */
  async removeRange(
    assetId: string,
    start: number,
    end: number,
    domain: TimeDomain = 'timeline',
    actor: 'user' | 'agent' = 'user',
    agentRunId?: string,
    baseSeq?: number
  ): Promise<{ timeline: Timeline; seq: number }> {
    const asset = await this.assetsService.getAsset(assetId);
    let { timeline, currentSeq } = await this.getTimelineAt(assetId, baseSeq);
    const fps = timeline.fps || 30.0;

    if (start >= end) {
      throw new StructuredOpException({
        ok: false,
        code: 'OUT_OF_RANGE',
        message: `start (${start}) must be less than end (${end})`,
      });
    }

    // Convert range to timeline seconds for boundary comparison
    let rangeStart = start;
    let rangeEnd = end;

    if (domain === 'source') {
      rangeStart = sourceToTimeline(timeline, timeline.clips[0].id, start);
      rangeEnd = sourceToTimeline(timeline, timeline.clips[0].id, end);
    }

    const spans = computeTimelineSpans(timeline);
    const minDur = snapToFrame(2 / fps, fps);

    // Identify clips affected
    for (const span of spans) {
      const clip = span.clip;
      const cStart = span.timelineStart;
      const cEnd = span.timelineEnd;

      // 1. Clip completely contained inside range -> delete
      if (cStart >= rangeStart - 0.001 && cEnd <= rangeEnd + 0.001) {
        const res = await this.applyOp(assetId, 'DELETE', { clipId: clip.id }, actor, agentRunId);
        timeline = res.timeline;
        currentSeq = res.seq;
      }
      // 2. Clip strictly spans the whole range (surrounds range) -> split & trim
      else if (cStart < rangeStart && cEnd > rangeEnd) {
        // Split at rangeStart
        const splitRes = await this.applyOp(
          assetId,
          'SPLIT',
          { clipId: clip.id, at: rangeStart, domain: 'timeline' },
          actor,
          agentRunId
        );
        timeline = splitRes.timeline;
        currentSeq = splitRes.seq;

        // The right clip starts at rangeStart and ends at cEnd. Now trim its in point to rangeEnd
        const rightClipId = `${clip.id}_b`;
        const trimRes = await this.applyOp(
          assetId,
          'TRIM',
          { clipId: rightClipId, in: rangeEnd, domain: 'timeline' },
          actor,
          agentRunId
        );
        timeline = trimRes.timeline;
        currentSeq = trimRes.seq;
      }
      // 3. Overlaps left side (clip ends inside range) -> trim out to rangeStart
      else if (cStart < rangeStart && cEnd > rangeStart && cEnd <= rangeEnd) {
        const res = await this.applyOp(
          assetId,
          'TRIM',
          { clipId: clip.id, out: rangeStart, domain: 'timeline' },
          actor,
          agentRunId
        );
        timeline = res.timeline;
        currentSeq = res.seq;
      }
      // 4. Overlaps right side (clip starts inside range) -> trim in to rangeEnd
      else if (cStart >= rangeStart && cStart < rangeEnd && cEnd > rangeEnd) {
        const res = await this.applyOp(
          assetId,
          'TRIM',
          { clipId: clip.id, in: rangeEnd, domain: 'timeline' },
          actor,
          agentRunId
        );
        timeline = res.timeline;
        currentSeq = res.seq;
      }
    }

    return { timeline, seq: currentSeq };
  }

  /**
   * Removes filler words (e.g. "um", "uh") with a pad.
   */
  async removeFillers(
    assetId: string,
    scope = 'all',
    actor: 'user' | 'agent' = 'user',
    agentRunId?: string
  ): Promise<{ timeline: Timeline; seq: number; removedCount: number }> {
    const transcriptRes = await this.db.query(
      'SELECT words FROM transcripts WHERE asset_id = $1',
      [assetId]
    );

    const words: Array<{ w: string; start: number; end: number }> =
      transcriptRes.rows[0]?.words || [];

    const fillerWords = new Set(['um', 'uh', 'er', 'ah', 'like', 'you know']);
    const targets = words.filter((w) =>
      fillerWords.has(w.w.toLowerCase().replace(/[^a-z]/g, ''))
    );

    let { timeline, currentSeq } = await this.getTimelineAt(assetId);
    let count = 0;
    const pad = 0.04; // 40ms safety pad

    for (const w of targets) {
      try {
        const start = Math.max(0, w.start - pad);
        const end = w.end + pad;
        const res = await this.removeRange(
          assetId,
          start,
          end,
          'source',
          actor,
          agentRunId
        );
        timeline = res.timeline;
        currentSeq = res.seq;
        count++;
      } catch (err: any) {
        // Skip words that fall on boundaries or cannot be cut without violating min duration
      }
    }

    return { timeline, seq: currentSeq, removedCount: count };
  }

  /**
   * Detects silent dead-air intervals in the timeline from Whisper transcripts.
   */
  async getSilences(
    assetId: string,
    options?: SilenceDetectionOptions
  ): Promise<{ silences: SilenceInterval[]; totalDuration: number }> {
    const { timeline } = await this.getTimelineAt(assetId);
    const transcriptRes = await this.db.query(
      'SELECT words FROM transcripts WHERE asset_id = $1',
      [assetId]
    );
    const words = transcriptRes.rows[0]?.words || [];
    const silences = detectSilences(timeline, words, options);
    const totalDuration = snapToFrame(
      silences.reduce((acc, s) => acc + s.duration, 0),
      timeline.fps || 30
    );
    return { silences, totalDuration };
  }

  /**
   * Applies smart jump-cutting to remove dead-air silences from timeline clips.
   */
  async jumpCut(
    assetId: string,
    options?: SilenceDetectionOptions,
    actor: 'user' | 'agent' = 'user',
    agentRunId?: string
  ): Promise<SilenceRemovalResult> {
    const { timeline } = await this.getTimelineAt(assetId);
    const transcriptRes = await this.db.query(
      'SELECT words FROM transcripts WHERE asset_id = $1',
      [assetId]
    );
    const words = transcriptRes.rows[0]?.words || [];

    const { newTimeline, silences, timeSaved } = generateJumpCutTimeline(
      timeline,
      words,
      options
    );

    if (silences.length === 0) {
      return {
        assetId,
        silencesDetected: 0,
        totalSilenceDuration: 0,
        timeSaved: 0,
        newClipsCount: timeline.clips.length,
        timeline,
        intervals: [],
      };
    }

    if (newTimeline.clips.length === 0) {
      throw new StructuredOpException({
        ok: false,
        code: 'OUT_OF_RANGE',
        message: 'Cannot jump-cut: entire timeline would be eliminated as silence.',
      });
    }

    const res = await this.applyOp(
      assetId,
      'JUMP_CUT',
      {
        clips: newTimeline.clips,
        removedSilenceDuration: timeSaved,
        silencesCount: silences.length,
      },
      actor,
      agentRunId
    );

    return {
      assetId,
      silencesDetected: silences.length,
      totalSilenceDuration: timeSaved,
      timeSaved,
      newClipsCount: res.timeline.clips.length,
      timeline: res.timeline,
      intervals: silences,
    };
  }
}

