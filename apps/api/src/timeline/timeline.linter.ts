import {
  Timeline,
  TimelineClip,
  Word,
  snapToFrame,
  TimelineLintReport,
  LintFinding,
  LintRuleId,
} from '../../../../packages/contracts';
import { computeTimelineSpans, TimelineClipSpan } from './timeline.invariants';

export interface TimelineLinterOptions {
  words?: Word[];
  assetDuration?: number;
  fps?: number;
  optimalWpmMin?: number;
  optimalWpmMax?: number;
  maxShotDurationSec?: number;
}

export class TimelineLinter {
  /**
   * Static Sub-Millisecond AST Linter.
   * Audits timeline geometry, word-boundary acoustic cuts, audio pop hazards, and pacing cadence.
   */
  lint(timeline: Timeline, options: TimelineLinterOptions = {}): TimelineLintReport {
    const fps = timeline.fps || options.fps || 30.0;
    const words = options.words || [];
    const assetDuration = options.assetDuration;
    const maxShotDuration = options.maxShotDurationSec ?? 12.0;
    const minWpm = options.optimalWpmMin ?? 110;
    const maxWpm = options.optimalWpmMax ?? 210;

    const findings: LintFinding[] = [];
    const spans = computeTimelineSpans(timeline);
    const totalDuration = spans.length > 0 ? spans[spans.length - 1].timelineEnd : 0;

    // -------------------------------------------------------------------------
    // Tier 1: Technical Invariants (Zero-Glitch Quality Floor)
    // -------------------------------------------------------------------------

    spans.forEach((span, idx) => {
      const clip = span.clip;
      const clipDuration = clip.out - clip.in;

      // 1. Zero or Negative Duration
      if (clipDuration <= 0.001) {
        findings.push({
          id: `zero-duration-${clip.id}`,
          rule: 'ZERO_DURATION_CLIP',
          category: 'technical',
          severity: 'error',
          message: `Clip "${clip.id}" has invalid zero or negative duration (${clipDuration.toFixed(3)}s).`,
          timestamp: span.timelineStart,
          clipId: clip.id,
          sourceTimestamp: clip.in,
          suggestedRepair: {
            opType: 'remove_range',
            clipId: clip.id,
            explanation: `Remove corrupted zero-duration clip.`,
          },
        });
      }

      // 2. Out of bounds of source asset
      if (assetDuration && clip.out > assetDuration + 0.05) {
        findings.push({
          id: `oob-${clip.id}`,
          rule: 'OUT_OF_BOUNDS_CLIP',
          category: 'technical',
          severity: 'error',
          message: `Clip "${clip.id}" out point (${clip.out.toFixed(2)}s) exceeds source video duration (${assetDuration.toFixed(2)}s).`,
          timestamp: span.timelineEnd,
          clipId: clip.id,
          sourceTimestamp: clip.out,
          suggestedRepair: {
            opType: 'trim_clip',
            clipId: clip.id,
            suggestedIn: clip.in,
            suggestedOut: assetDuration,
            explanation: `Clamp clip out point to asset duration (${assetDuration.toFixed(2)}s).`,
          },
        });
      }

      // 3. Grid Snapping (Sub-frame jitter)
      const snappedIn = snapToFrame(clip.in, fps);
      const snappedOut = snapToFrame(clip.out, fps);
      if (Math.abs(clip.in - snappedIn) > 0.003 || Math.abs(clip.out - snappedOut) > 0.003) {
        findings.push({
          id: `unsnapped-${clip.id}`,
          rule: 'UNSNAPPED_FRAME_GRID',
          category: 'technical',
          severity: 'warning',
          message: `Clip "${clip.id}" boundaries (${clip.in.toFixed(4)}s - ${clip.out.toFixed(4)}s) are not aligned to the ${fps}fps grid.`,
          timestamp: span.timelineStart,
          clipId: clip.id,
          suggestedRepair: {
            opType: 'trim_clip',
            clipId: clip.id,
            suggestedIn: snappedIn,
            suggestedOut: snappedOut,
            explanation: `Snap boundaries to exact frame grid intervals.`,
          },
        });
      }

      // 4. Word Cutoff (Acoustic word amputation)
      if (words.length > 0) {
        // Check cut at start of clip (c.in)
        for (const w of words) {
          // If cut point lands strictly INSIDE a word (with 25ms tolerance margin)
          if (clip.in > w.start + 0.025 && clip.in < w.end - 0.025) {
            const snapBefore = snapToFrame(Math.max(0, w.start - 0.06), fps);
            const snapAfter = snapToFrame(w.end + 0.06, fps);

            findings.push({
              id: `cutoff-in-${clip.id}-${w.start.toFixed(2)}`,
              rule: 'WORD_CUTOFF',
              category: 'technical',
              severity: 'error',
              message: `Start cut at ${clip.in.toFixed(2)}s slices through word "${w.w}" (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s), amputating syllable.`,
              timestamp: span.timelineStart,
              clipId: clip.id,
              sourceTimestamp: clip.in,
              details: { word: w.w, wordStart: w.start, wordEnd: w.end, cutPoint: clip.in },
              suggestedRepair: {
                opType: 'trim_clip',
                clipId: clip.id,
                suggestedIn: snapBefore,
                suggestedOut: clip.out,
                explanation: `Snap cut point before word start to "${w.w}" (${snapBefore}s) to preserve speech clarity.`,
              },
            });
            break;
          }
        }

        // Check cut at end of clip (c.out)
        for (const w of words) {
          if (clip.out > w.start + 0.025 && clip.out < w.end - 0.025) {
            const snapAfter = snapToFrame(w.end + 0.06, fps);
            findings.push({
              id: `cutoff-out-${clip.id}-${w.start.toFixed(2)}`,
              rule: 'WORD_CUTOFF',
              category: 'technical',
              severity: 'error',
              message: `End cut at ${clip.out.toFixed(2)}s slices through word "${w.w}" (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s), cutting off ending consonant.`,
              timestamp: span.timelineEnd,
              clipId: clip.id,
              sourceTimestamp: clip.out,
              details: { word: w.w, wordStart: w.start, wordEnd: w.end, cutPoint: clip.out },
              suggestedRepair: {
                opType: 'trim_clip',
                clipId: clip.id,
                suggestedIn: clip.in,
                suggestedOut: snapAfter,
                explanation: `Extend cut point to silence after "${w.w}" (${snapAfter}s) to prevent clipped word.`,
              },
            });
            break;
          }
        }
      }

      // 5. Audio Pop Hazard at Junctions
      if (idx < spans.length - 1) {
        const nextSpan = spans[idx + 1];
        // If clips are from different source positions (a jump cut)
        const isDiscontinuousCut = Math.abs(clip.out - nextSpan.clip.in) > 0.08;
        if (isDiscontinuousCut) {
          // Check if there is silence padding at the junction
          let hasSpeechBoundary = false;
          if (words.length > 0) {
            const lastWordBeforeCut = words.filter((w) => w.end <= clip.out + 0.02).pop();
            const firstWordAfterCut = words.find((w) => w.start >= nextSpan.clip.in - 0.02);
            if (lastWordBeforeCut && clip.out - lastWordBeforeCut.end < 0.03) {
              hasSpeechBoundary = true;
            }
            if (firstWordAfterCut && firstWordAfterCut.start - nextSpan.clip.in < 0.03) {
              hasSpeechBoundary = true;
            }
          }

          if (hasSpeechBoundary) {
            findings.push({
              id: `pop-hazard-${clip.id}-${nextSpan.clip.id}`,
              rule: 'AUDIO_POP_RISK',
              category: 'audio',
              severity: 'warning',
              message: `Junction between clip "${clip.id}" and "${nextSpan.clip.id}" cuts tightly against speech with <30ms padding, creating audio click risk without a 15ms microfade.`,
              timestamp: span.timelineEnd,
              clipId: clip.id,
              suggestedRepair: {
                opType: 'snap_bounds',
                clipId: clip.id,
                explanation: `Apply automated 15ms raised-cosine audio crossfade during export.`,
              },
            });
          }
        }
      }
    });

    // -------------------------------------------------------------------------
    // Tier 2: Editorial & Pacing Metrics (Story & Rhythm Quality)
    // -------------------------------------------------------------------------

    let hookLatencySeconds = 0;
    let totalDeadAirSeconds = 0;
    let spokenWordCount = 0;

    // 1. Hook Latency (First 3 seconds engagement)
    if (words.length > 0 && spans.length > 0) {
      const firstClip = spans[0].clip;
      const wordsInFirstClip = words.filter(
        (w) => w.start >= firstClip.in - 0.05 && w.end <= firstClip.out + 0.05
      );
      if (wordsInFirstClip.length > 0) {
        hookLatencySeconds = Math.max(0, wordsInFirstClip[0].start - firstClip.in);
        if (hookLatencySeconds > 1.2) {
          findings.push({
            id: 'hook-dead-air',
            rule: 'HOOK_DEAD_AIR',
            category: 'pacing',
            severity: 'warning',
            message: `First spoken word begins ${hookLatencySeconds.toFixed(2)}s into the video. First 3-second hook window requires immediate energy to prevent viewer drop-off.`,
            timestamp: hookLatencySeconds,
            suggestedRepair: {
              opType: 'trim_clip',
              clipId: firstClip.id,
              suggestedIn: snapToFrame(wordsInFirstClip[0].start - 0.08, fps),
              suggestedOut: firstClip.out,
              explanation: `Trim initial silence so speech starts within 0.1s of video playback.`,
            },
          });
        }
      }
    }

    // 2. Shot Pacing Stagnation (Single shot dragging > 12s)
    spans.forEach((span) => {
      if (span.duration > maxShotDuration) {
        findings.push({
          id: `pacing-stagnant-${span.clip.id}`,
          rule: 'SHOT_PACING_STAGNATION',
          category: 'pacing',
          severity: 'info',
          message: `Clip "${span.clip.id}" runs for ${span.duration.toFixed(1)}s without a cut. Talking-head pacing stagnates beyond ${maxShotDuration}s.`,
          timestamp: span.timelineStart + span.duration / 2,
          clipId: span.clip.id,
          suggestedRepair: {
            opType: 'split_clip',
            clipId: span.clip.id,
            explanation: `Consider splitting into multiple takes or inserting B-roll / zoom punch-in.`,
          },
        });
      }
    });

    // 3. Dead Air Pauses & Speech Cadence (WPM)
    if (words.length > 0 && totalDuration > 0) {
      // Collect words that fall inside active timeline clips
      const activeWords: Word[] = [];
      for (const span of spans) {
        const clip = span.clip;
        const matching = words.filter(
          (w) => w.start >= clip.in - 0.05 && w.end <= clip.out + 0.05
        );
        activeWords.push(...matching);

        // Detect internal pauses > 0.65s inside this clip
        for (let i = 0; i < matching.length - 1; i++) {
          const gap = matching[i + 1].start - matching[i].end;
          if (gap > 0.65) {
            totalDeadAirSeconds += gap;
          }
        }
      }

      spokenWordCount = activeWords.length;
      const durationMinutes = totalDuration / 60.0;
      const wpm = durationMinutes > 0 ? Math.round(spokenWordCount / durationMinutes) : 0;

      const deadAirPercent = Math.round((totalDeadAirSeconds / totalDuration) * 100);
      if (deadAirPercent > 18) {
        findings.push({
          id: 'dead-air-density',
          rule: 'DEAD_AIR_DENSITY',
          category: 'pacing',
          severity: 'warning',
          message: `${deadAirPercent}% of timeline duration (${totalDeadAirSeconds.toFixed(1)}s) is dead air pause. Retention improves when long pauses are cut.`,
          timestamp: 0,
          details: { deadAirPercent, totalDeadAirSeconds },
          suggestedRepair: {
            opType: 'remove_range',
            explanation: `Run Smart Jump-Cut to prune silences longer than 0.5s.`,
          },
        });
      }

      if (wpm > 0 && (wpm < minWpm || wpm > maxWpm)) {
        findings.push({
          id: 'cadence-wpm',
          rule: 'SPEECH_CADENCE_WPM',
          category: 'cadence',
          severity: 'info',
          message: `Speaking cadence is ${wpm} WPM (optimal conversational range: ${minWpm}-${maxWpm} WPM).`,
          timestamp: 0,
          details: { wpm, minWpm, maxWpm },
        });
      }
    }

    // 4. Rapid-fire cut cluster (> 3 cuts in < 1.0s)
    for (let i = 0; i < spans.length - 2; i++) {
      const windowDuration = spans[i + 2].timelineEnd - spans[i].timelineStart;
      if (windowDuration < 1.0) {
        findings.push({
          id: `cut-cluster-${i}`,
          rule: 'RAPID_FIRE_CUT_CLUSTER',
          category: 'pacing',
          severity: 'warning',
          message: `3 cuts detected within ${windowDuration.toFixed(2)}s. Rapid micro-cuts cause visual flutter.`,
          timestamp: spans[i].timelineStart,
        });
        break;
      }
    }

    // -------------------------------------------------------------------------
    // Verification Score & Status Computation
    // -------------------------------------------------------------------------
    const errorCount = findings.filter((f) => f.severity === 'error').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;

    // Score deduction model:
    // Errors deduct 22 points (hard technical failure)
    // Warnings deduct 5 points (pacing/glitch hazard)
    let score = 100 - errorCount * 22 - warningCount * 5;
    score = Math.max(0, Math.min(100, score));

    const tier1Passed = errorCount === 0;
    const tier2Passed = warningCount === 0;
    const valid = tier1Passed;

    const avgClipDuration = spans.length > 0 ? totalDuration / spans.length : 0;
    const wordsPerMinute =
      totalDuration > 0 ? Math.round((spokenWordCount / totalDuration) * 60) : 0;

    // Map suggested repairs
    const suggestedRepairs = findings
      .filter((f) => f.suggestedRepair)
      .map((f) => ({
        rule: f.rule,
        clipId: f.clipId,
        repairAction: f.suggestedRepair!.explanation,
        targetBounds: {
          in: f.suggestedRepair!.suggestedIn ?? 0,
          out: f.suggestedRepair!.suggestedOut ?? 0,
        },
        explanation: f.suggestedRepair!.explanation,
      }));

    return {
      valid,
      score,
      tier1Passed,
      tier2Passed,
      findings,
      metrics: {
        totalDuration,
        clipCount: spans.length,
        avgClipDuration,
        wordsPerMinute,
        deadAirSeconds: totalDeadAirSeconds,
        deadAirPercent: totalDuration > 0 ? Math.round((totalDeadAirSeconds / totalDuration) * 100) : 0,
        hookLatencySeconds,
        errorCount,
        warningCount,
      },
      suggestedRepairs,
    };
  }
}
