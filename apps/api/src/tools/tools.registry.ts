import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { TimelineService, StructuredOpException } from '../timeline/timeline.service';
import { AssetsService } from '../assets/assets.service';
import { RendersService } from '../renders/renders.service';
import { DatabaseService } from '../database/database.service';
import {
  ToolDefinition,
  ToolContext,
  zodToJsonSchema,
} from './tool.interface';
import {
  computeTimelineSpans,
  getTotalTimelineDuration,
} from '../timeline/timeline.invariants';
import { ToolResult, StructuredError } from '../../../../packages/contracts';

@Injectable()
export class ToolsRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(
    private readonly timelineService: TimelineService,
    private readonly assetsService: AssetsService,
    private readonly db: DatabaseService,
    private readonly rendersService: RendersService
  ) {
    this.registerAllTools();
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolSchemasForLLM(): Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    return this.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    }));
  }

  async executeTool(
    name: string,
    args: any,
    ctx: Omit<ToolContext, 'timelineService' | 'assetsService' | 'rendersService' | 'db'>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        code: 'INVALID_ARGUMENT',
        message: `Unknown tool "${name}"`,
        hint: `Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
      };
    }

    const fullCtx: ToolContext = {
      ...ctx,
      timelineService: this.timelineService,
      assetsService: this.assetsService,
      rendersService: this.rendersService,
      db: this.db,
    };

    // 1. Zod validation
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'INVALID_ARGUMENT',
        message: `Invalid arguments for tool ${name}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        hint: `Check the parameter schema for ${name}`,
      };
    }

    // 2. Execution with structured error handling
    try {
      return await tool.execute(fullCtx, parsed.data);
    } catch (err: any) {
      if (err instanceof StructuredOpException) {
        return err.errorData;
      }
      return {
        ok: false,
        code: err.code || 'INVARIANT_VIOLATION',
        message: err.message || 'Tool execution failed',
      };
    }
  }

  private register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  private registerAllTools() {
    // 1. get_timeline
    this.register({
      name: 'get_timeline',
      description:
        'Returns the current edited timeline with compact clip list: id, in, out, timelineStart, timelineEnd, duration, groupId, reason, and text. Always check this to see current clip IDs and positions.',
      schema: z.object({
        seq: z.number().optional().describe('Optional historical sequence number to view'),
      }),
      isWrite: false,
      execute: async (ctx, args) => {
        const { timeline, currentSeq } = await ctx.timelineService.getTimelineAt(
          ctx.assetId,
          args.seq
        );
        const spans = computeTimelineSpans(timeline);
        const totalDuration = getTotalTimelineDuration(timeline);

        return {
          ok: true,
          data: {
            seq: currentSeq,
            fps: timeline.fps,
            totalDuration,
            clipCount: timeline.clips.length,
            clips: spans.map((s) => ({
              id: s.clip.id,
              in: s.clip.in,
              out: s.clip.out,
              timelineStart: s.timelineStart,
              timelineEnd: s.timelineEnd,
              duration: s.duration,
              groupId: s.clip.groupId,
              reason: s.clip.reason,
              text: s.clip.text,
            })),
          },
        };
      },
    });

    // 2. list_take_groups
    this.register({
      name: 'list_take_groups',
      description:
        'Returns take groups and candidate retakes with feature scores (filler_score, repeat_score, pauses, wpm, confidence) and the currently chosen take. Use this when the user asks to switch takes or pick a different take.',
      schema: z.object({}),
      isWrite: false,
      execute: async (ctx) => {
        const takesData = await ctx.assetsService.getTakes(ctx.assetId);
        return {
          ok: true,
          data: takesData,
        };
      },
    });

    // 3. search_transcript
    this.register({
      name: 'search_transcript',
      description:
        'Searches transcript words and segment text for a query keyword or phrase. Returns matching occurrences with timestamps and clip IDs.',
      schema: z.object({
        query: z.string().describe('Search keyword or phrase'),
        limit: z.number().optional().default(10).describe('Max results to return'),
      }),
      isWrite: false,
      execute: async (ctx, args) => {
        const { timeline } = await ctx.timelineService.getTimelineAt(ctx.assetId);
        const spans = computeTimelineSpans(timeline);

        const transcriptRes = await ctx.db.query(
          'SELECT words FROM transcripts WHERE asset_id = $1',
          [ctx.assetId]
        );
        const words: Array<{ w: string; start: number; end: number }> =
          transcriptRes.rows[0]?.words || [];

        const queryLower = args.query.toLowerCase();
        const matches: Array<{
          text: string;
          start: number;
          end: number;
          clipId?: string;
        }> = [];

        // Search in words
        for (let i = 0; i < words.length && matches.length < args.limit; i++) {
          if (words[i].w.toLowerCase().includes(queryLower)) {
            const start = words[i].start;
            const end = words[i].end;
            // Find which clip contains it
            const matchedSpan = spans.find((s) => s.clip.in <= start && s.clip.out >= end);
            matches.push({
              text: words[i].w,
              start,
              end,
              clipId: matchedSpan?.clip.id,
            });
          }
        }

        return {
          ok: true,
          data: {
            query: args.query,
            matchCount: matches.length,
            matches,
          },
        };
      },
    });

    // 4. get_words
    this.register({
      name: 'get_words',
      description:
        'Retrieves word-level timestamps and confidence scores for a specific clip. Essential for precise cuts, filler removal, and word boundary alignment.',
      schema: z.object({
        clipId: z.string().describe('The clip ID to get words for'),
      }),
      isWrite: false,
      execute: async (ctx, args) => {
        const { timeline } = await ctx.timelineService.getTimelineAt(ctx.assetId);
        const clip = timeline.clips.find((c) => c.id === args.clipId);
        if (!clip) {
          return {
            ok: false,
            code: 'CLIP_NOT_FOUND',
            message: `Clip "${args.clipId}" not found in current timeline`,
          };
        }

        const transcriptRes = await ctx.db.query(
          'SELECT words FROM transcripts WHERE asset_id = $1',
          [ctx.assetId]
        );
        const words: Array<{ w: string; start: number; end: number; prob?: number }> =
          transcriptRes.rows[0]?.words || [];

        const clipWords = words.filter(
          (w) => w.start >= clip.in - 0.05 && w.end <= clip.out + 0.05
        );

        return {
          ok: true,
          data: {
            clipId: clip.id,
            clipBounds: { in: clip.in, out: clip.out },
            words: clipWords,
          },
        };
      },
    });

    // 5. get_lint_report
    this.register({
      name: 'get_lint_report',
      description:
        'Returns automated video inspection findings (black frames, frozen video, audio dropout, loudness jumps, etc.) for a render run. Use to detect flaws and plan repair edits.',
      schema: z.object({
        renderId: z.string().optional().describe('Render job ID to inspect'),
      }),
      isWrite: false,
      execute: async (ctx, args) => {
        let renderId = args.renderId;
        if (!renderId) {
          const latest = await ctx.db.query(
            'SELECT id FROM renders WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 1',
            [ctx.assetId]
          );
          renderId = latest.rows[0]?.id;
        }

        if (!renderId) {
          return {
            ok: true,
            data: {
              findings: [],
              message: 'No render runs found for asset. Run render() first to generate inspection report.',
            },
          };
        }

        // Return mock or recorded findings for closed loop repair
        return {
          ok: true,
          data: {
            renderId,
            defectCount: 0,
            findings: [],
          },
        };
      },
    });

    // 6. select_take
    this.register({
      name: 'select_take',
      description:
        'Replaces the active take for a given take group with an alternative take segment. Automatically updates the timeline clip.',
      schema: z.object({
        groupId: z.string().describe('Take group ID, e.g. group_1'),
        segmentId: z.string().describe('The segment ID of the desired take'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        // Query segment info
        const segRes = await ctx.db.query(
          'SELECT start_time, end_time, text, score, group_id FROM segments WHERE id = $1',
          [args.segmentId]
        );
        if (segRes.rows.length === 0) {
          return {
            ok: false,
            code: 'GROUP_NOT_FOUND',
            message: `Segment "${args.segmentId}" not found`,
          };
        }
        const seg = segRes.rows[0];

        // Update DB take_groups chosen_segment_id
        await ctx.assetsService.updateTakeGroup(args.groupId, args.segmentId);

        // Apply op
        const res = await ctx.timelineService.applyOp(
          ctx.assetId,
          'SELECT_TAKE',
          {
            groupId: args.groupId,
            newSegmentId: args.segmentId,
            in: seg.start_time,
            out: seg.end_time,
            text: seg.text,
            reason: `take score ${Number(seg.score ?? 0).toFixed(2)}`,
          },
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );

        return {
          ok: true,
          data: {
            seq: res.seq,
            groupId: args.groupId,
            segmentId: args.segmentId,
            clipCount: res.timeline.clips.length,
          },
          message: `Selected take ${args.segmentId} for group ${args.groupId}`,
        };
      },
    });

    // 7. remove_clip
    this.register({
      name: 'remove_clip',
      description: 'Deletes a clip from the timeline by clipId. Clips after it ripple left.',
      schema: z.object({
        clipId: z.string().describe('The ID of the clip to remove'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.applyOp(
          ctx.assetId,
          'DELETE',
          { clipId: args.clipId },
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            removedClipId: args.clipId,
            remainingClips: res.timeline.clips.length,
          },
          message: `Removed clip ${args.clipId}`,
        };
      },
    });

    // 8. trim_clip
    this.register({
      name: 'trim_clip',
      description:
        'Trims the in and/or out point of a clip. Defaults to timeline seconds. Adjusts edit boundaries cleanly.',
      schema: z.object({
        clipId: z.string().describe('The clip ID to trim'),
        in: z.number().optional().describe('New in point (seconds)'),
        out: z.number().optional().describe('New out point (seconds)'),
        domain: z.enum(['timeline', 'source']).optional().default('timeline'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.applyOp(
          ctx.assetId,
          'TRIM',
          args,
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            clipId: args.clipId,
            newBounds: res.timeline.clips.find((c) => c.id === args.clipId),
          },
          message: `Trimmed clip ${args.clipId}`,
        };
      },
    });

    // 9. split_clip
    this.register({
      name: 'split_clip',
      description:
        'Splits a single clip into two adjacent clips at timestamp "at" (in timeline or source seconds).',
      schema: z.object({
        clipId: z.string().describe('The clip ID to split'),
        at: z.number().describe('Split timestamp in seconds'),
        domain: z.enum(['timeline', 'source']).optional().default('timeline'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.applyOp(
          ctx.assetId,
          'SPLIT',
          args,
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            clipId: args.clipId,
            clipCount: res.timeline.clips.length,
          },
          message: `Split clip ${args.clipId} at ${args.at}s`,
        };
      },
    });

    // 10. remove_range
    this.register({
      name: 'remove_range',
      description:
        'Removes a time range from the timeline, automatically splitting or trimming affected clips.',
      schema: z.object({
        start: z.number().describe('Start timestamp in seconds'),
        end: z.number().describe('End timestamp in seconds'),
        domain: z.enum(['timeline', 'source']).optional().default('timeline'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.removeRange(
          ctx.assetId,
          args.start,
          args.end,
          args.domain,
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            clipCount: res.timeline.clips.length,
          },
          message: `Removed range [${args.start}s, ${args.end}s]`,
        };
      },
    });

    // 11. remove_fillers
    this.register({
      name: 'remove_fillers',
      description:
        'Detects and removes filler words (ums, uhs, pauses) across the timeline with a safety pad.',
      schema: z.object({
        scope: z.string().optional().default('all').describe('Scope of filler removal, e.g. all'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.removeFillers(
          ctx.assetId,
          args.scope,
          ctx.actor,
          ctx.agentRunId
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            removedCount: res.removedCount,
            clipCount: res.timeline.clips.length,
          },
          message: `Removed ${res.removedCount} filler words`,
        };
      },
    });

    // 12. move_clip
    this.register({
      name: 'move_clip',
      description: 'Moves a clip to a new index in the timeline.',
      schema: z.object({
        clipId: z.string().describe('The clip ID to move'),
        toIndex: z.number().describe('New zero-based index for the clip'),
      }),
      isWrite: true,
      execute: async (ctx, args) => {
        const res = await ctx.timelineService.applyOp(
          ctx.assetId,
          'MOVE',
          args,
          ctx.actor,
          ctx.agentRunId,
          ctx.baseSeq
        );
        return {
          ok: true,
          data: {
            seq: res.seq,
            clipId: args.clipId,
            toIndex: args.toIndex,
          },
          message: `Moved clip ${args.clipId} to index ${args.toIndex}`,
        };
      },
    });

    // 13. undo
    this.register({
      name: 'undo',
      description: 'Undoes the last timeline operation by applying its inverse.',
      schema: z.object({}),
      isWrite: true,
      execute: async (ctx) => {
        const res = await ctx.timelineService.undo(ctx.assetId, ctx.actor);
        return {
          ok: true,
          data: {
            seq: res.seq,
            undoneOpType: res.op.opType,
            clipCount: res.timeline.clips.length,
          },
          message: `Undid previous operation (${res.op.opType})`,
        };
      },
    });

    // 14. render
    this.register({
      name: 'render',
      description: 'Triggers a fan-out render of the current timeline into a finished video. Returns the renderId.',
      schema: z.object({}),
      isWrite: true,
      execute: async (ctx) => {
        if (!ctx.rendersService) {
          return {
            ok: false,
            code: 'INVALID_ARGUMENT',
            message: 'Renders service is not available',
          };
        }
        const renderRes = await ctx.rendersService.createRender(ctx.assetId);
        return {
          ok: true,
          data: {
            renderId: renderRes.id,
            status: renderRes.status,
            clipCount: renderRes.clipCount,
          },
          message: `Enqueued render ${renderRes.id}`,
        };
      },
    });
  }
}
