import type { Sample, SeekPlan } from './types';

/**
 * Binary search for sample index corresponding to time T.
 */
export function timeToIndex(samples: Sample[], targetTimeSec: number): number {
  if (samples.length === 0) return 0;
  if (targetTimeSec <= samples[0].cts) return 0;
  if (targetTimeSec >= samples[samples.length - 1].cts) return samples.length - 1;

  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = samples[mid].cts;

    if (midTime === targetTimeSec) {
      return mid;
    } else if (midTime < targetTimeSec) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Return the closest sample without exceeding
  return Math.max(0, high);
}

/**
 * Find nearest keyframe (sync sample) at or before targetIndex.
 */
export function findNearestKeyframe(samples: Sample[], targetIndex: number): number {
  for (let i = Math.min(targetIndex, samples.length - 1); i >= 0; i--) {
    if (samples[i].isSync) {
      return i;
    }
  }
  return 0;
}

/**
 * Plan seek path: determine if we can continue decoding from current position
 * or need to reset and decode from the nearest keyframe.
 */
export function planSeek(
  samples: Sample[],
  currentDecoderIndex: number,
  targetIndex: number
): SeekPlan {
  const keyframeIndex = findNearestKeyframe(samples, targetIndex);

  // If current decoder position is between keyframe and targetIndex,
  // we can decode forward from current position without a decoder reset!
  const canContinue =
    currentDecoderIndex >= keyframeIndex &&
    currentDecoderIndex <= targetIndex &&
    targetIndex - currentDecoderIndex < 35; // Maximum distance to avoid long pauses

  const startIndex = canContinue ? currentDecoderIndex + 1 : keyframeIndex;
  const samplesToDecode: number[] = [];

  for (let i = startIndex; i <= targetIndex; i++) {
    samplesToDecode.push(i);
  }

  return {
    targetIndex,
    keyframeIndex,
    canContinue,
    samplesToDecode,
  };
}
