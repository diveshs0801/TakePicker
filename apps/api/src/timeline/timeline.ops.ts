import {
  Timeline,
  TimelineClip,
  TimelineOpType,
  snapToFrame,
  TimeDomain,
} from '../../../../packages/contracts';
import {
  validateTimelineInvariants,
  computeTimelineSpans,
  TimelineInvariantViolation,
} from './timeline.invariants';

export interface ApplyOpResult {
  newTimeline: Timeline;
  inverseOp: {
    opType: TimelineOpType | 'RESTORE_CLIP';
    payload: any;
  };
}

export function sourceToTimeline(
  timeline: Timeline,
  clipId: string,
  sourceTime: number
): number {
  const spans = computeTimelineSpans(timeline);
  const target = spans.find((s) => s.clip.id === clipId);
  if (!target) {
    throw new TimelineInvariantViolation(`Clip "${clipId}" not found in timeline`, 'CLIP_NOT_FOUND');
  }
  const offset = sourceTime - target.clip.in;
  return target.timelineStart + offset;
}

export function timelineToSource(
  timeline: Timeline,
  timelineTime: number
): { sourceTime: number; clip: TimelineClip; clipIndex: number } {
  const spans = computeTimelineSpans(timeline);
  if (spans.length === 0) {
    throw new TimelineInvariantViolation('Timeline is empty', 'OUT_OF_RANGE');
  }

  // Clamping or finding span
  let selected = spans[0];
  let selectedIdx = 0;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (timelineTime >= span.timelineStart && timelineTime <= span.timelineEnd) {
      selected = span;
      selectedIdx = i;
      break;
    }
  }

  // If past the end, pick the last clip
  if (timelineTime > spans[spans.length - 1].timelineEnd) {
    selected = spans[spans.length - 1];
    selectedIdx = spans.length - 1;
  }

  const offset = Math.max(0, Math.min(selected.duration, timelineTime - selected.timelineStart));
  const sourceTime = selected.clip.in + offset;

  return {
    sourceTime: snapToFrame(sourceTime, timeline.fps),
    clip: selected.clip,
    clipIndex: selectedIdx,
  };
}

export function applyOperation(
  timeline: Timeline,
  opType: TimelineOpType | 'RESTORE_CLIP',
  payload: any,
  assetDuration?: number
): ApplyOpResult {
  const fps = timeline.fps || 30.0;
  const clips = timeline.clips.map((c) => ({ ...c }));

  switch (opType) {
    case 'INSERT': {
      const { index, clip } = payload;
      if (!clip || !clip.id) {
        throw new TimelineInvariantViolation('Missing clip for INSERT', 'INVALID_ARGUMENT');
      }
      const targetIdx = Math.max(0, Math.min(clips.length, index ?? clips.length));
      const snappedClip: TimelineClip = {
        ...clip,
        in: snapToFrame(clip.in, fps),
        out: snapToFrame(clip.out, fps),
      };
      clips.splice(targetIdx, 0, snappedClip);

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'DELETE',
          payload: { clipId: snappedClip.id, index: targetIdx },
        },
      };
    }

    case 'DELETE': {
      const { clipId } = payload;
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) {
        throw new TimelineInvariantViolation(`Clip "${clipId}" not found for DELETE`, 'CLIP_NOT_FOUND');
      }
      const [deleted] = clips.splice(idx, 1);

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'INSERT',
          payload: { index: idx, clip: deleted },
        },
      };
    }

    case 'TRIM': {
      const { clipId, in: rawIn, out: rawOut, domain } = payload;
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) {
        throw new TimelineInvariantViolation(`Clip "${clipId}" not found for TRIM`, 'CLIP_NOT_FOUND');
      }
      const clip = clips[idx];
      const oldIn = clip.in;
      const oldOut = clip.out;

      let newIn = oldIn;
      let newOut = oldOut;

      const spans = computeTimelineSpans(timeline);
      const span = spans[idx];

      if (rawIn !== undefined) {
        if (domain === 'timeline') {
          // rawIn is in timeline seconds
          const offset = rawIn - span.timelineStart;
          newIn = snapToFrame(clip.in + offset, fps);
        } else {
          newIn = snapToFrame(rawIn, fps);
        }
      }

      if (rawOut !== undefined) {
        if (domain === 'timeline') {
          // rawOut is in timeline seconds
          const offset = rawOut - span.timelineStart;
          newOut = snapToFrame(clip.in + offset, fps);
        } else {
          newOut = snapToFrame(rawOut, fps);
        }
      }

      clips[idx] = { ...clip, in: newIn, out: newOut };

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'TRIM',
          payload: { clipId, in: oldIn, out: oldOut, domain: 'source' },
        },
      };
    }

    case 'SPLIT': {
      const { clipId, at, domain, leftClipId, rightClipId } = payload;
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) {
        throw new TimelineInvariantViolation(`Clip "${clipId}" not found for SPLIT`, 'CLIP_NOT_FOUND');
      }
      const clip = clips[idx];
      const spans = computeTimelineSpans(timeline);
      const span = spans[idx];

      let splitSourceTime: number;
      if (domain === 'timeline') {
        const offset = at - span.timelineStart;
        splitSourceTime = snapToFrame(clip.in + offset, fps);
      } else {
        splitSourceTime = snapToFrame(at, fps);
      }

      const minDur = snapToFrame(2 / fps, fps);
      if (splitSourceTime <= clip.in + minDur - 0.001 || splitSourceTime >= clip.out - minDur + 0.001) {
        throw new TimelineInvariantViolation(
          `Split point ${splitSourceTime.toFixed(3)}s leaves one side shorter than minimum 2 frames (${minDur}s) for clip [${clip.in}, ${clip.out}]`,
          'TOO_SHORT'
        );
      }

      const leftId = leftClipId || `${clip.id}_a`;
      const rightId = rightClipId || `${clip.id}_b`;

      const leftClip: TimelineClip = {
        ...clip,
        id: leftId,
        in: clip.in,
        out: splitSourceTime,
      };

      const rightClip: TimelineClip = {
        ...clip,
        id: rightId,
        in: splitSourceTime,
        out: clip.out,
      };

      clips.splice(idx, 1, leftClip, rightClip);

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'RESTORE_CLIP',
          payload: {
            index: idx,
            originalClip: clip,
            removeClipIds: [leftId, rightId],
          },
        },
      };
    }

    case 'RESTORE_CLIP': {
      const { index, originalClip, removeClipIds } = payload;
      // Remove all clips matching removeClipIds
      const filtered = clips.filter((c) => !removeClipIds.includes(c.id));
      const targetIdx = Math.max(0, Math.min(filtered.length, index));
      filtered.splice(targetIdx, 0, originalClip);

      const newTimeline: Timeline = { ...timeline, clips: filtered };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'SPLIT',
          payload: {
            clipId: originalClip.id,
            at: (originalClip.in + originalClip.out) / 2,
            domain: 'source',
          },
        },
      };
    }

    case 'MOVE': {
      const { clipId, toIndex } = payload;
      const fromIdx = clips.findIndex((c) => c.id === clipId);
      if (fromIdx === -1) {
        throw new TimelineInvariantViolation(`Clip "${clipId}" not found for MOVE`, 'CLIP_NOT_FOUND');
      }
      const targetIdx = Math.max(0, Math.min(clips.length - 1, toIndex));
      const [moved] = clips.splice(fromIdx, 1);
      clips.splice(targetIdx, 0, moved);

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'MOVE',
          payload: { clipId, toIndex: fromIdx },
        },
      };
    }

    case 'SELECT_TAKE': {
      const { groupId, newSegmentId, in: newIn, out: newOut, text, reason } = payload;
      const idx = clips.findIndex((c) => c.groupId === groupId);
      if (idx === -1) {
        throw new TimelineInvariantViolation(`No clip with groupId "${groupId}" found`, 'GROUP_NOT_FOUND');
      }
      const oldClip = clips[idx];
      const updatedClip: TimelineClip = {
        ...oldClip,
        in: newIn !== undefined ? snapToFrame(newIn, fps) : oldClip.in,
        out: newOut !== undefined ? snapToFrame(newOut, fps) : oldClip.out,
        text: text !== undefined ? text : oldClip.text,
        reason: 'reason' in payload ? (payload.reason ?? undefined) : (newSegmentId ? `selected take ${newSegmentId}` : oldClip.reason),
      };
      if (updatedClip.reason === undefined) {
        delete updatedClip.reason;
      }
      clips[idx] = updatedClip;

      const newTimeline: Timeline = { ...timeline, clips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'SELECT_TAKE',
          payload: {
            groupId,
            newSegmentId: String(oldClip.segmentIdx ?? ''),
            in: oldClip.in,
            out: oldClip.out,
            text: oldClip.text,
            reason: oldClip.reason ?? null,
          },
        },
      };
    }

    case 'JUMP_CUT': {
      const { clips: newClips } = payload;
      const previousClips = [...timeline.clips];
      const newTimeline: Timeline = { ...timeline, clips: newClips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'RESTORE_CLIPS',
          payload: { clips: previousClips },
        },
      };
    }

    case 'RESTORE_CLIPS': {
      const { clips: restoredClips } = payload;
      const previousClips = [...timeline.clips];
      const newTimeline: Timeline = { ...timeline, clips: restoredClips };
      validateTimelineInvariants(newTimeline, assetDuration);

      return {
        newTimeline,
        inverseOp: {
          opType: 'RESTORE_CLIPS',
          payload: { clips: previousClips },
        },
      };
    }

    default:
      throw new TimelineInvariantViolation(`Unknown opType: "${opType}"`, 'INVALID_ARGUMENT');
  }
}
