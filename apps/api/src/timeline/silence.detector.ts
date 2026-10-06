import {
  Timeline,
  TimelineClip,
  SilenceInterval,
  SilenceDetectionOptions,
  snapToFrame,
} from '../../../../packages/contracts';

export interface WordData {
  w?: string;
  word?: string;
  start: number;
  end: number;
  confidence?: number;
}

/**
 * Detects silent intervals in a timeline based on word timestamps.
 * Evaluates dead-air before, between, and after speech within each clip.
 */
export function detectSilences(
  timeline: Timeline,
  words: WordData[],
  options?: SilenceDetectionOptions
): SilenceInterval[] {
  const minSilenceSec = options?.minSilenceSec ?? 0.6;
  const bufferSec = options?.bufferSec ?? 0.1;
  const fps = timeline.fps || 30.0;
  const silences: SilenceInterval[] = [];

  for (const clip of timeline.clips) {
    // Collect and sort words inside or overlapping this clip
    const clipWords = words
      .filter((w) => w.end > clip.in && w.start < clip.out)
      .sort((a, b) => a.start - b.start);

    // Case 1: Clip has no words at all
    if (clipWords.length === 0) {
      const duration = clip.out - clip.in;
      if (duration >= minSilenceSec) {
        silences.push({
          start: clip.in,
          end: clip.out,
          duration: snapToFrame(duration, fps),
        });
      }
      continue;
    }

    // Case 2: Silence before first word
    const firstWord = clipWords[0];
    const leadingGap = firstWord.start - clip.in;
    if (leadingGap >= minSilenceSec) {
      const sStart = clip.in;
      const sEnd = snapToFrame(Math.max(clip.in, firstWord.start - bufferSec), fps);
      if (sEnd - sStart >= 0.05) {
        silences.push({
          start: sStart,
          end: sEnd,
          duration: snapToFrame(sEnd - sStart, fps),
          followingWord: firstWord.word || firstWord.w,
        });
      }
    }

    // Case 3: Pauses between consecutive words
    for (let i = 0; i < clipWords.length - 1; i++) {
      const curr = clipWords[i];
      const next = clipWords[i + 1];
      const rawGap = next.start - curr.end;

      if (rawGap >= minSilenceSec) {
        const sStart = snapToFrame(curr.end + bufferSec, fps);
        const sEnd = snapToFrame(next.start - bufferSec, fps);

        if (sEnd - sStart >= 0.05) {
          silences.push({
            start: sStart,
            end: sEnd,
            duration: snapToFrame(sEnd - sStart, fps),
            precedingWord: curr.word || curr.w,
            followingWord: next.word || next.w,
          });
        }
      }
    }

    // Case 4: Silence after last word
    const lastWord = clipWords[clipWords.length - 1];
    const trailingGap = clip.out - lastWord.end;
    if (trailingGap >= minSilenceSec) {
      const sStart = snapToFrame(Math.min(clip.out, lastWord.end + bufferSec), fps);
      const sEnd = clip.out;
      if (sEnd - sStart >= 0.05) {
        silences.push({
          start: sStart,
          end: sEnd,
          duration: snapToFrame(sEnd - sStart, fps),
          precedingWord: lastWord.word || lastWord.w,
        });
      }
    }
  }

  return silences;
}

/**
 * Generates a jump-cut timeline by cutting out all detected silence intervals
 * within each clip, maintaining clip groups, microfade-safe boundaries,
 * and minimum 2-frame duration invariants.
 */
export function generateJumpCutTimeline(
  timeline: Timeline,
  words: WordData[],
  options?: SilenceDetectionOptions
): { newTimeline: Timeline; silences: SilenceInterval[]; timeSaved: number } {
  const fps = timeline.fps || 30.0;
  const minClipDuration = snapToFrame(2 / fps, fps);
  const silences = detectSilences(timeline, words, options);

  if (silences.length === 0) {
    return { newTimeline: timeline, silences: [], timeSaved: 0 };
  }

  const newClips: TimelineClip[] = [];
  let totalTimeSaved = 0;

  for (const clip of timeline.clips) {
    // Find silences that fall inside this clip
    const clipSilences = silences.filter(
      (s) => s.start >= clip.in - 0.001 && s.end <= clip.out + 0.001
    );

    if (clipSilences.length === 0) {
      newClips.push(clip);
      continue;
    }

    // Sort silences ascending
    clipSilences.sort((a, b) => a.start - b.start);

    // Cut clip into active speaking sub-segments
    let currentIn = clip.in;
    let subIdx = 0;

    for (const silence of clipSilences) {
      if (silence.start > currentIn) {
        const segDur = silence.start - currentIn;
        if (segDur >= minClipDuration) {
          newClips.push({
            ...clip,
            id: `${clip.id}_jc${subIdx++}`,
            in: snapToFrame(currentIn, fps),
            out: snapToFrame(silence.start, fps),
          });
        }
      }
      totalTimeSaved += silence.duration;
      currentIn = Math.max(currentIn, silence.end);
    }

    // Remaining piece after the last silence
    if (clip.out - currentIn >= minClipDuration) {
      newClips.push({
        ...clip,
        id: `${clip.id}_jc${subIdx++}`,
        in: snapToFrame(currentIn, fps),
        out: snapToFrame(clip.out, fps),
      });
    }
  }

  const newTimeline: Timeline = {
    ...timeline,
    clips: newClips,
  };

  return {
    newTimeline,
    silences,
    timeSaved: snapToFrame(totalTimeSaved, fps),
  };
}
