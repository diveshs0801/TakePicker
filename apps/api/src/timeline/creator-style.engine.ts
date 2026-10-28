import {
  Timeline,
  CreatorStyleFingerprint,
  ProtectedCreativeSpan,
  TriModalCutCandidate,
} from '../../../../packages/contracts';
import { computeTimelineSpans } from './timeline.invariants';

export class CreatorStyleEngine {
  /**
   * 1. Extracts the Creator's Style Fingerprint (Editorial DNA).
   */
  computeStyleFingerprint(
    creatorId: string,
    channelName: string,
    sampleTimelines: Timeline[],
    archetypeOverride?: CreatorStyleFingerprint['archetype']
  ): CreatorStyleFingerprint {
    let totalClips = 0;
    let totalDuration = 0;
    let brollCount = 0;

    for (const tl of sampleTimelines) {
      const spans = computeTimelineSpans(tl);
      totalClips += spans.length;
      for (const s of spans) {
        totalDuration += s.clip.out - s.clip.in;
        if (s.clip.trackId && s.clip.trackId !== 'V1') {
          brollCount++;
        }
      }
    }

    const avgShotLengthSec = totalClips > 0 ? Math.round((totalDuration / totalClips) * 100) / 100 : 3.8;
    const brollToArollRatio = totalClips > 0 ? Math.round((brollCount / totalClips) * 100) / 100 : 0.25;

    // Determine archetype based on editorial metrics if not explicitly set
    let archetype: CreatorStyleFingerprint['archetype'] = archetypeOverride || 'CINEMATIC_STORYTELLER';
    if (!archetypeOverride) {
      if (avgShotLengthSec < 2.0) {
        archetype = 'FAST_PACED_SOCIAL';
      } else if (brollToArollRatio > 0.4) {
        archetype = 'CINEMATIC_STORYTELLER';
      } else {
        archetype = 'COMEDIC_PERFORMER';
      }
    }

    const silenceToleranceSec = archetype === 'COMEDIC_PERFORMER' ? 1.6 : archetype === 'CINEMATIC_STORYTELLER' ? 1.2 : 0.35;
    const zoomPunchFrequencyPerMin = archetype === 'FAST_PACED_SOCIAL' ? 8.5 : 2.0;

    return {
      creatorId,
      channelName,
      archetype,
      metrics: {
        avgShotLengthSec,
        silenceToleranceSec,
        brollToArollRatio,
        zoomPunchFrequencyPerMin,
        colorGradePalette: ['#6366f1', '#a855f7'],
      },
      klDivergenceTolerance: 0.18, // Max permitted drift from artistic prior
      protectedSpans: [],
    };
  }

  /**
   * 2. Protected Creative Spans (Semantic Intent Guardrails).
   * Verifies if a proposed jump-cut or edit collides with an intentional
   * comedic pause, dramatic breath, or reaction beat.
   */
  isCutForbiddenByProtectedSpan(
    cutTimestamp: number,
    protectedSpans: ProtectedCreativeSpan[]
  ): { forbidden: boolean; collidingSpan?: ProtectedCreativeSpan } {
    for (const span of protectedSpans) {
      if (cutTimestamp >= span.start && cutTimestamp <= span.end) {
        return { forbidden: true, collidingSpan: span };
      }
    }
    return { forbidden: false };
  }

  /**
   * 3. KL Divergence Tethering against Creator Artistic Prior.
   * Penalizes edits that drift too far from the creator's personal cadence.
   */
  computeKLDivergencePenalty(
    proposedTimeline: Timeline,
    fingerprint: CreatorStyleFingerprint
  ): { klDivergence: number; penalty: number; isWithinTolerance: boolean } {
    const spans = computeTimelineSpans(proposedTimeline);
    const avgDuration =
      spans.length > 0
        ? spans.reduce((sum, s) => sum + (s.clip.out - s.clip.in), 0) / spans.length
        : 3.0;

    const targetASL = fingerprint.metrics.avgShotLengthSec;
    // Approximated Gaussian KL divergence between proposed shot duration and creator target ASL
    const diff = Math.abs(avgDuration - targetASL);
    const klDivergence = Math.round((Math.pow(diff, 2) / (2 * Math.pow(targetASL * 0.4, 2))) * 1000) / 1000;

    const penalty = klDivergence > fingerprint.klDivergenceTolerance ? (klDivergence - fingerprint.klDivergenceTolerance) * 0.5 : 0.0;
    const isWithinTolerance = klDivergence <= fingerprint.klDivergenceTolerance;

    return {
      klDivergence,
      penalty: Math.round(penalty * 1000) / 1000,
      isWithinTolerance,
    };
  }

  /**
   * 4. Tri-Modal Joint Manifold Optimization (Phonetic + Music Beats + Optical Flow).
   * Snaps a cut point to the harmonious intersection of the 3 rhythmic clocks.
   */
  optimizeCutToTriModalManifold(
    targetTimestamp: number,
    options: {
      searchWindowSec?: number; // Search within +/- delta (default 0.35s)
      musicBpm?: number;        // e.g. 120 BPM = 500ms beat subdivision
      phoneticPauses?: { start: number; end: number }[];
    } = {}
  ): TriModalCutCandidate {
    const searchWindow = options.searchWindowSec ?? 0.35;
    const bpm = options.musicBpm ?? 120;
    const beatIntervalSec = 60 / bpm; // 0.50s per beat

    let bestTimestamp = targetTimestamp;
    let minCost = Infinity;
    let bestPhoneticScore = 0.5;
    let bestBeatDistanceMs = 0;
    let bestOpticalFlowMinimaMs = 0;

    // Discretize search window in 10ms steps
    const startT = Math.max(0, targetTimestamp - searchWindow);
    const endT = targetTimestamp + searchWindow;

    for (let t = startT; t <= endT; t += 0.01) {
      // 1. Phonetic Energy: Lowest when falling in an acoustic silence pause
      let phoneticEnergy = 0.8; // Default active speech
      if (options.phoneticPauses) {
        const inPause = options.phoneticPauses.some((p) => t >= p.start && t <= p.end);
        if (inPause) phoneticEnergy = 0.05; // Quiet room tone
      }

      // 2. Music Beat Alignment: Distance to nearest musical downbeat
      const beatPhase = (t % beatIntervalSec);
      const beatDistSec = Math.min(beatPhase, beatIntervalSec - beatPhase);
      const musicCost = beatDistSec / (beatIntervalSec / 2); // Normalized [0, 1]

      // 3. Kinematic Minimum: Simulated optical flow minimum (e.g. eye blink/gesture settle every ~1.2s)
      const kinematicDistSec = Math.abs(t % 0.40 - 0.20);
      const kinematicCost = kinematicDistSec / 0.20;

      // Composite cost function: minimize phonetic disruption + music downbeat divergence
      const cost = phoneticEnergy * 0.5 + musicCost * 0.3 + kinematicCost * 0.2;

      if (cost < minCost) {
        minCost = cost;
        bestTimestamp = t;
        bestPhoneticScore = Math.round(phoneticEnergy * 100) / 100;
        bestBeatDistanceMs = Math.round(beatDistSec * 1000);
        bestOpticalFlowMinimaMs = Math.round(kinematicDistSec * 1000);
      }
    }

    return {
      targetTimestamp,
      optimalCutTimestamp: Math.round(bestTimestamp * 1000) / 1000,
      phoneticEnergyScore: bestPhoneticScore,
      musicBeatDistanceMs: bestBeatDistanceMs,
      opticalFlowMinimaMs: bestOpticalFlowMinimaMs,
      compositeEnergyCost: Math.round(minCost * 1000) / 1000,
    };
  }
}
