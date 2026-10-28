import {
  Timeline,
  TimelineClip,
  TimelinePatch,
  TimelineDiffOp,
  TimelineConflict,
  TimelineConflictType,
  ConflictResolutionStrategy,
  ThreeWayMergeResult,
  snapToFrame,
} from '../../../../packages/contracts';
import { validateTimelineInvariants, computeTimelineSpans } from './timeline.invariants';
import { createHash } from 'node:crypto';

/**
 * Computes a deterministic SHA-256 hash of a timeline state.
 */
export function computeTimelineHash(timeline: Timeline): string {
  const normalized = {
    fps: timeline.fps,
    clips: (timeline.clips || []).map((c) => ({
      id: c.id,
      in: Math.round(c.in * 1000) / 1000,
      out: Math.round(c.out * 1000) / 1000,
      trackId: c.trackId || 'V1',
      groupId: c.groupId || null,
      gain: c.gain !== undefined ? Math.round(c.gain * 100) / 100 : 1.0,
      speed: c.speed !== undefined ? Math.round(c.speed * 100) / 100 : 1.0,
      colorTag: c.colorTag || null,
    })),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Computes the Longest Increasing Subsequence (LIS) in O(N log N) time.
 * Used to find the minimum number of clip moves in timeline re-ordering.
 */
export function longestIncreasingSubsequence(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const tails: number[] = [];
  const tailIndices: number[] = [];
  const parent: number[] = new Array(arr.length).fill(-1);

  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    let left = 0;
    let right = tails.length;
    while (left < right) {
      const mid = (left + right) >> 1;
      if (tails[mid] < x) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    tails[left] = x;
    tailIndices[left] = i;
    parent[i] = left > 0 ? tailIndices[left - 1] : -1;
  }

  const lis: number[] = [];
  let curr = tailIndices[tails.length - 1];
  while (curr !== -1) {
    lis.push(arr[curr]);
    curr = parent[curr];
  }
  return lis.reverse();
}

/**
 * Computes a structured semantic diff between base and target timeline.
 */
export function diffTimelines(base: Timeline, target: Timeline): TimelinePatch {
  const operations: TimelineDiffOp[] = [];
  const baseMap = new Map<string, TimelineClip>(base.clips.map((c) => [c.id, c]));
  const targetMap = new Map<string, TimelineClip>(target.clips.map((c) => [c.id, c]));

  // 1. Detect DELETES
  for (const baseClip of base.clips) {
    if (!targetMap.has(baseClip.id)) {
      operations.push({
        opType: 'DELETE',
        clipId: baseClip.id,
        trackId: baseClip.trackId || 'V1',
        oldValues: { ...baseClip },
        reason: `Clip ${baseClip.id} deleted from timeline`,
      });
    }
  }

  // 2. Detect INSERTS
  for (let i = 0; i < target.clips.length; i++) {
    const targetClip = target.clips[i];
    if (!baseMap.has(targetClip.id)) {
      const afterClipId = i > 0 ? target.clips[i - 1].id : null;
      operations.push({
        opType: 'INSERT',
        clipId: targetClip.id,
        trackId: targetClip.trackId || 'V1',
        newValues: { ...targetClip },
        afterClipId,
        reason: `Clip ${targetClip.id} inserted after ${afterClipId || 'start'}`,
      });
    }
  }

  // 3. Detect TRIMS and FIELD_EDITS for shared clips
  const sharedIdsInTarget: string[] = [];
  for (const targetClip of target.clips) {
    const baseClip = baseMap.get(targetClip.id);
    if (!baseClip) continue;
    sharedIdsInTarget.push(targetClip.id);

    const inChanged = Math.abs(baseClip.in - targetClip.in) > 0.001;
    const outChanged = Math.abs(baseClip.out - targetClip.out) > 0.001;
    if (inChanged || outChanged) {
      operations.push({
        opType: 'TRIM',
        clipId: targetClip.id,
        trackId: targetClip.trackId || baseClip.trackId || 'V1',
        oldValues: { in: baseClip.in, out: baseClip.out },
        newValues: { in: targetClip.in, out: targetClip.out },
        reason: `Trimmed boundaries: in ${baseClip.in.toFixed(3)}s -> ${targetClip.in.toFixed(3)}s, out ${baseClip.out.toFixed(3)}s -> ${targetClip.out.toFixed(3)}s`,
      });
    }

    const baseGain = baseClip.gain ?? 1.0;
    const targetGain = targetClip.gain ?? 1.0;
    const baseSpeed = baseClip.speed ?? 1.0;
    const targetSpeed = targetClip.speed ?? 1.0;
    const baseTrack = baseClip.trackId ?? 'V1';
    const targetTrack = targetClip.trackId ?? 'V1';

    if (
      Math.abs(baseGain - targetGain) > 0.01 ||
      Math.abs(baseSpeed - targetSpeed) > 0.01 ||
      baseTrack !== targetTrack ||
      baseClip.colorTag !== targetClip.colorTag
    ) {
      operations.push({
        opType: 'FIELD_EDIT',
        clipId: targetClip.id,
        trackId: targetTrack,
        oldValues: { gain: baseGain, speed: baseSpeed, trackId: baseTrack, colorTag: baseClip.colorTag },
        newValues: { gain: targetGain, speed: targetSpeed, trackId: targetTrack, colorTag: targetClip.colorTag },
        reason: `Modified clip fields (gain, speed, trackId, or colorTag)`,
      });
    }
  }

  // 4. Detect MOVES using Longest Increasing Subsequence
  const baseSharedIndices = new Map<string, number>();
  let baseIdx = 0;
  for (const clip of base.clips) {
    if (targetMap.has(clip.id)) {
      baseSharedIndices.set(clip.id, baseIdx++);
    }
  }

  const targetMappedOrder = sharedIdsInTarget.map((id) => baseSharedIndices.get(id)!);
  const lisOrder = new Set<number>(longestIncreasingSubsequence(targetMappedOrder));

  for (let i = 0; i < sharedIdsInTarget.length; i++) {
    const baseOrder = targetMappedOrder[i];
    if (!lisOrder.has(baseOrder)) {
      const clipId = sharedIdsInTarget[i];
      const afterClipId = i > 0 ? sharedIdsInTarget[i - 1] : null;
      operations.push({
        opType: 'MOVE',
        clipId,
        afterClipId,
        reason: `Moved clip ${clipId} to follow ${afterClipId || 'start'}`,
      });
    }
  }

  return {
    baseAssetId: base.assetId,
    baseHash: computeTimelineHash(base),
    targetHash: computeTimelineHash(target),
    operations,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Applies a TimelinePatch to a base timeline to produce the target timeline.
 */
export function applyPatch(base: Timeline, patch: TimelinePatch): Timeline {
  let clips: TimelineClip[] = base.clips.map((c) => ({ ...c }));
  const fps = base.fps || 30.0;

  for (const op of patch.operations) {
    switch (op.opType) {
      case 'DELETE': {
        clips = clips.filter((c) => c.id !== op.clipId);
        break;
      }
      case 'INSERT': {
        const newClip = { ...(op.newValues as TimelineClip) };
        if (!op.afterClipId) {
          clips.unshift(newClip);
        } else {
          const idx = clips.findIndex((c) => c.id === op.afterClipId);
          if (idx >= 0) {
            clips.splice(idx + 1, 0, newClip);
          } else {
            clips.push(newClip);
          }
        }
        break;
      }
      case 'TRIM': {
        const target = clips.find((c) => c.id === op.clipId);
        if (target && op.newValues) {
          if (op.newValues.in !== undefined) target.in = snapToFrame(op.newValues.in, fps);
          if (op.newValues.out !== undefined) target.out = snapToFrame(op.newValues.out, fps);
        }
        break;
      }
      case 'FIELD_EDIT': {
        const target = clips.find((c) => c.id === op.clipId);
        if (target && op.newValues) {
          if (op.newValues.gain !== undefined) target.gain = op.newValues.gain;
          if (op.newValues.speed !== undefined) target.speed = op.newValues.speed;
          if (op.newValues.trackId !== undefined) target.trackId = op.newValues.trackId;
          if (op.newValues.colorTag !== undefined) target.colorTag = op.newValues.colorTag;
        }
        break;
      }
      case 'MOVE': {
        const clipIdx = clips.findIndex((c) => c.id === op.clipId);
        if (clipIdx >= 0) {
          const [moved] = clips.splice(clipIdx, 1);
          if (!op.afterClipId) {
            clips.unshift(moved);
          } else {
            const destIdx = clips.findIndex((c) => c.id === op.afterClipId);
            if (destIdx >= 0) {
              clips.splice(destIdx + 1, 0, moved);
            } else {
              clips.push(moved);
            }
          }
        }
        break;
      }
    }
  }

  const result: Timeline = {
    assetId: base.assetId,
    fps,
    clips,
  };
  validateTimelineInvariants(result);
  return result;
}

export interface MergeOptions {
  oursBranchName?: string;
  theirsBranchName?: string;
  defaultConflictStrategy?: ConflictResolutionStrategy;
}

/**
 * The Core Three-Way Timeline Merge Engine (Problem #10).
 * Merges base, ours, and theirs timelines.
 * Employs field-level auto-merge for orthogonal edits,
 * identifies structural conflicts, and supports non-destructive Audition Lanes.
 */
export function threeWayMerge(
  base: Timeline,
  ours: Timeline,
  theirs: Timeline,
  options?: MergeOptions
): ThreeWayMergeResult {
  const oursBranch = options?.oursBranchName || 'ours';
  const theirsBranch = options?.theirsBranchName || 'theirs';
  const defaultStrategy = options?.defaultConflictStrategy || 'SPLIT_AUDITION_LANES';
  const fps = base.fps || 30.0;

  const baseMap = new Map<string, TimelineClip>(base.clips.map((c) => [c.id, c]));
  const oursMap = new Map<string, TimelineClip>(ours.clips.map((c) => [c.id, c]));
  const theirsMap = new Map<string, TimelineClip>(theirs.clips.map((c) => [c.id, c]));

  const allClipIds = new Set<string>([
    ...base.clips.map((c) => c.id),
    ...ours.clips.map((c) => c.id),
    ...theirs.clips.map((c) => c.id),
  ]);

  const conflicts: TimelineConflict[] = [];
  const mergedClipsMap = new Map<string, TimelineClip>();
  const auditionClipsToAppend: TimelineClip[] = [];
  let autoResolvedCount = 0;
  let cleanMergesCount = 0;

  for (const clipId of allClipIds) {
    const inBase = baseMap.has(clipId);
    const inOurs = oursMap.has(clipId);
    const inTheirs = theirsMap.has(clipId);

    const b = baseMap.get(clipId);
    const o = oursMap.get(clipId);
    const t = theirsMap.get(clipId);

    // Scenario 1: Clip deleted on one or both sides
    if (inBase && !inOurs && !inTheirs) {
      cleanMergesCount++;
      continue;
    }

    if (inBase && !inOurs && inTheirs) {
      const theirsChanged =
        Math.abs(b!.in - t!.in) > 0.001 ||
        Math.abs(b!.out - t!.out) > 0.001 ||
        (t!.gain !== undefined && t!.gain !== (b!.gain ?? 1.0));

      if (!theirsChanged) {
        cleanMergesCount++;
        continue;
      } else {
        const conflict: TimelineConflict = {
          id: `conflict_del_edit_${clipId}`,
          type: 'DELETE_EDIT',
          clipId,
          description: `Clip "${clipId}" was deleted in ${oursBranch}, but modified in ${theirsBranch}.`,
          baseClip: b,
          oursClip: undefined,
          theirsClip: t,
          recommendedStrategy: 'KEEP_OURS',
        };
        conflicts.push(conflict);
        if (defaultStrategy === 'KEEP_OURS') {
          // Do not add
        } else {
          mergedClipsMap.set(clipId, { ...t! });
        }
        continue;
      }
    }

    if (inBase && inOurs && !inTheirs) {
      const oursChanged =
        Math.abs(b!.in - o!.in) > 0.001 ||
        Math.abs(b!.out - o!.out) > 0.001 ||
        (o!.gain !== undefined && o!.gain !== (b!.gain ?? 1.0));

      if (!oursChanged) {
        cleanMergesCount++;
        continue;
      } else {
        const conflict: TimelineConflict = {
          id: `conflict_del_edit_${clipId}`,
          type: 'DELETE_EDIT',
          clipId,
          description: `Clip "${clipId}" was modified in ${oursBranch}, but deleted in ${theirsBranch}.`,
          baseClip: b,
          oursClip: o,
          theirsClip: undefined,
          recommendedStrategy: 'KEEP_OURS',
        };
        conflicts.push(conflict);
        if (defaultStrategy === 'KEEP_OURS') {
          mergedClipsMap.set(clipId, { ...o! });
        }
        continue;
      }
    }

    // Scenario 2: Clip inserted on one or both sides
    if (!inBase) {
      if (inOurs && !inTheirs) {
        mergedClipsMap.set(clipId, { ...o! });
        cleanMergesCount++;
        continue;
      }
      if (!inOurs && inTheirs) {
        mergedClipsMap.set(clipId, { ...t! });
        cleanMergesCount++;
        continue;
      }
      if (inOurs && inTheirs) {
        const identical =
          Math.abs(o!.in - t!.in) < 0.001 &&
          Math.abs(o!.out - t!.out) < 0.001 &&
          (o!.trackId || 'V1') === (t!.trackId || 'V1');

        if (identical) {
          mergedClipsMap.set(clipId, { ...o! });
          cleanMergesCount++;
        } else {
          const conflict: TimelineConflict = {
            id: `conflict_occlusion_${clipId}`,
            type: 'TRACK_OCCLUSION',
            clipId,
            description: `Clip "${clipId}" was inserted in both branches with differing parameters.`,
            oursClip: o,
            theirsClip: t,
            recommendedStrategy: 'SPLIT_AUDITION_LANES',
          };
          conflicts.push(conflict);
          mergedClipsMap.set(clipId, { ...o!, trackId: 'V1', auditionGroup: `audition_${clipId}` });
          auditionClipsToAppend.push({
            ...t!,
            id: `${clipId}_theirs_alt`,
            trackId: 'V2',
            auditionGroup: `audition_${clipId}`,
          });
        }
        continue;
      }
    }

    // Scenario 3: Clip present in Base, Ours, and Theirs
    if (inBase && inOurs && inTheirs) {
      const oursTrimChanged = Math.abs(b!.in - o!.in) > 0.001 || Math.abs(b!.out - o!.out) > 0.001;
      const theirsTrimChanged = Math.abs(b!.in - t!.in) > 0.001 || Math.abs(b!.out - t!.out) > 0.001;

      const oursGainChanged = Math.abs((b!.gain ?? 1.0) - (o!.gain ?? 1.0)) > 0.01;
      const theirsGainChanged = Math.abs((b!.gain ?? 1.0) - (t!.gain ?? 1.0)) > 0.01;

      const oursChanged = oursTrimChanged || oursGainChanged;
      const theirsChanged = theirsTrimChanged || theirsGainChanged;

      // 3A: Neither changed
      if (!oursChanged && !theirsChanged) {
        mergedClipsMap.set(clipId, { ...b! });
        cleanMergesCount++;
        continue;
      }

      // 3B: Changed only in ours
      if (oursChanged && !theirsChanged) {
        mergedClipsMap.set(clipId, { ...o! });
        cleanMergesCount++;
        continue;
      }

      // 3C: Changed only in theirs
      if (!oursChanged && theirsChanged) {
        mergedClipsMap.set(clipId, { ...t! });
        cleanMergesCount++;
        continue;
      }

      // 3D: Both changed identically
      const identicalTrims = Math.abs(o!.in - t!.in) < 0.001 && Math.abs(o!.out - t!.out) < 0.001;
      const identicalGains = Math.abs((o!.gain ?? 1.0) - (t!.gain ?? 1.0)) < 0.01;
      if (identicalTrims && identicalGains) {
        mergedClipsMap.set(clipId, { ...o! });
        cleanMergesCount++;
        continue;
      }

      // 3E: Orthogonal Field-Level Merge (e.g. Ours trimmed dialogue, Theirs adjusted audio gain)
      if (oursTrimChanged && !theirsTrimChanged && !oursGainChanged && theirsGainChanged) {
        mergedClipsMap.set(clipId, {
          ...o!,
          gain: t!.gain,
        });
        autoResolvedCount++;
        continue;
      }

      if (!oursTrimChanged && theirsTrimChanged && oursGainChanged && !theirsGainChanged) {
        mergedClipsMap.set(clipId, {
          ...t!,
          gain: o!.gain,
        });
        autoResolvedCount++;
        continue;
      }

      if (!oursTrimChanged && theirsTrimChanged && oursGainChanged && !theirsGainChanged) {
        mergedClipsMap.set(clipId, {
          ...t!,
          gain: o!.gain,
        });
        autoResolvedCount++;
        continue;
      }

      // TRIM_TRIM Contradiction
      if (oursTrimChanged && theirsTrimChanged && !identicalTrims) {
        const conflict: TimelineConflict = {
          id: `conflict_trim_${clipId}`,
          type: 'TRIM_TRIM',
          clipId,
          description: `Contradictory boundary trims on "${clipId}": ${oursBranch} [${o!.in.toFixed(2)}s - ${o!.out.toFixed(2)}s] vs ${theirsBranch} [${t!.in.toFixed(2)}s - ${t!.out.toFixed(2)}s] (Base: [${b!.in.toFixed(2)}s - ${b!.out.toFixed(2)}s]).`,
          baseClip: b,
          oursClip: o,
          theirsClip: t,
          conflictingField: 'in/out bounds',
          recommendedStrategy: 'SPLIT_AUDITION_LANES',
        };
        conflicts.push(conflict);

        if (defaultStrategy === 'KEEP_OURS') {
          mergedClipsMap.set(clipId, { ...o! });
        } else if (defaultStrategy === 'KEEP_THEIRS') {
          mergedClipsMap.set(clipId, { ...t! });
        } else {
          mergedClipsMap.set(clipId, {
            ...o!,
            trackId: 'V1',
            colorTag: '#3b82f6',
            auditionGroup: `audition_${clipId}`,
          });
          auditionClipsToAppend.push({
            ...t!,
            id: `${clipId}_audition_alt`,
            trackId: 'V2',
            colorTag: '#a855f7',
            auditionGroup: `audition_${clipId}`,
          });
          autoResolvedCount++;
        }
      }
    }
  }

  // 4. Sequence & Relative Ordering
  const baseOrder = base.clips.map((c) => c.id).filter((id) => mergedClipsMap.has(id));
  const oursOrder = ours.clips.map((c) => c.id).filter((id) => mergedClipsMap.has(id));
  const theirsOrder = theirs.clips.map((c) => c.id).filter((id) => mergedClipsMap.has(id));

  const oursReordered = JSON.stringify(baseOrder) !== JSON.stringify(oursOrder);
  const theirsReordered = JSON.stringify(baseOrder) !== JSON.stringify(theirsOrder);

  let finalOrderedIds: string[] = [];
  if (oursReordered && !theirsReordered) {
    finalOrderedIds = [...oursOrder];
  } else if (!oursReordered && theirsReordered) {
    finalOrderedIds = [...theirsOrder];
  } else if (oursReordered && theirsReordered) {
    if (JSON.stringify(oursOrder) === JSON.stringify(theirsOrder)) {
      finalOrderedIds = [...oursOrder];
    } else {
      conflicts.push({
        id: 'conflict_order_ambiguity',
        type: 'MOVE_MOVE',
        clipId: 'TIMELINE_SEQUENCE',
        description: `Both ${oursBranch} and ${theirsBranch} re-ordered scenes in contradictory sequences.`,
        recommendedStrategy: 'KEEP_OURS',
      });
      finalOrderedIds = [...oursOrder];
    }
  } else {
    finalOrderedIds = [...baseOrder];
  }

  for (const id of theirs.clips.map((c) => c.id)) {
    if (mergedClipsMap.has(id) && !finalOrderedIds.includes(id)) {
      finalOrderedIds.push(id);
    }
  }
  for (const id of ours.clips.map((c) => c.id)) {
    if (mergedClipsMap.has(id) && !finalOrderedIds.includes(id)) {
      finalOrderedIds.push(id);
    }
  }

  const finalClips: TimelineClip[] = [];
  for (const id of finalOrderedIds) {
    const clip = mergedClipsMap.get(id);
    if (clip) {
      finalClips.push(clip);
    }
  }

  for (const altClip of auditionClipsToAppend) {
    finalClips.push(altClip);
  }

  // 5. Invariant Guard
  for (const clip of finalClips) {
    if (clip.in >= clip.out || clip.out - clip.in < 1 / fps) {
      conflicts.push({
        id: `conflict_invariant_${clip.id}`,
        type: 'SEMANTIC_VIOLATION',
        clipId: clip.id,
        description: `Merged clip bounds violate physical invariants (in: ${clip.in.toFixed(3)}s, out: ${clip.out.toFixed(3)}s). Clamping safely.`,
        recommendedStrategy: 'KEEP_OURS',
      });
      clip.out = snapToFrame(clip.in + 2 / fps, fps);
    }
  }

  const mergedTimeline: Timeline = {
    assetId: base.assetId,
    fps,
    clips: finalClips,
  };

  const totalDuration = finalClips.reduce((acc, c) => acc + (c.out - c.in), 0);

  return {
    oursBranch,
    theirsBranch,
    mergedTimeline,
    hasConflicts: conflicts.length > 0,
    conflicts,
    appliedOpsCount: cleanMergesCount + autoResolvedCount,
    autoResolvedCount,
    stats: {
      totalClips: finalClips.length,
      cleanMergesCount,
      conflictCount: conflicts.length,
      durationSeconds: Math.round(totalDuration * 100) / 100,
    },
  };
}
