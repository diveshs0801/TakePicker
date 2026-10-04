import { Timeline, TimelineClip, snapToFrame } from '../../../../packages/contracts';

export class TimelineInvariantViolation extends Error {
  constructor(message: string, public readonly code: string = 'INVARIANT_VIOLATION') {
    super(message);
    this.name = 'TimelineInvariantViolation';
  }
}

export function validateTimelineInvariants(timeline: Timeline, assetDuration?: number): void {
  const fps = timeline.fps || 30.0;
  const minClipDuration = snapToFrame(2 / fps, fps); // minimum 2 frames

  // 1. Clip IDs must be unique
  const seenIds = new Set<string>();
  for (const clip of timeline.clips) {
    if (!clip.id) {
      throw new TimelineInvariantViolation('Clip missing id');
    }
    if (seenIds.has(clip.id)) {
      throw new TimelineInvariantViolation(`Duplicate clip id: "${clip.id}"`);
    }
    seenIds.add(clip.id);
  }

  // 2. Each clip must have valid bounds (in < out) and meet min duration
  for (let i = 0; i < timeline.clips.length; i++) {
    const clip = timeline.clips[i];
    if (clip.in < 0) {
      throw new TimelineInvariantViolation(
        `Clip "${clip.id}" has negative in point: ${clip.in}`,
        'OUT_OF_RANGE'
      );
    }
    if (clip.in >= clip.out) {
      throw new TimelineInvariantViolation(
        `Clip "${clip.id}" has in (${clip.in}) >= out (${clip.out})`,
        'OUT_OF_RANGE'
      );
    }
    const duration = clip.out - clip.in;
    if (duration < minClipDuration - 0.001) {
      throw new TimelineInvariantViolation(
        `Clip "${clip.id}" duration (${duration.toFixed(3)}s) is shorter than minimum 2 frames (${minClipDuration.toFixed(3)}s)`,
        'TOO_SHORT'
      );
    }
    if (assetDuration !== undefined && assetDuration > 0) {
      if (clip.out > assetDuration + 0.05) {
        throw new TimelineInvariantViolation(
          `Clip "${clip.id}" out point (${clip.out}s) exceeds asset duration (${assetDuration}s)`,
          'OUT_OF_RANGE'
        );
      }
    }
  }
}

export interface TimelineClipSpan {
  clip: TimelineClip;
  timelineStart: number;
  timelineEnd: number;
  duration: number;
}

export function computeTimelineSpans(timeline: Timeline): TimelineClipSpan[] {
  const spans: TimelineClipSpan[] = [];
  let currentT = 0;
  for (const clip of timeline.clips) {
    const duration = clip.out - clip.in;
    spans.push({
      clip,
      timelineStart: currentT,
      timelineEnd: currentT + duration,
      duration,
    });
    currentT += duration;
  }
  return spans;
}

export function getTotalTimelineDuration(timeline: Timeline): number {
  return timeline.clips.reduce((acc, c) => acc + (c.out - c.in), 0);
}
