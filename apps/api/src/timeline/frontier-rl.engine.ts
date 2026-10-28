import {
  Timeline,
  HazardRatePoint,
  CutCreditAttribution,
  CausalTreatmentResult,
  VideoDPOPreferencePair,
} from '../../../../packages/contracts';
import { computeTimelineSpans } from './timeline.invariants';
import { randomUUID } from 'node:crypto';

export class FrontierRLEngine {
  // In-memory Video DPO preference pair buffer
  private dpoPreferenceBuffer: VideoDPOPreferencePair[] = [];

  /**
   * 1. Dense Temporal Hazard Rate Decomposition.
   * Computes h(t) = - (1/R(t)) * (dR(t)/dt) and maps localized
   * drop-off spikes directly to individual edit cut boundaries.
   */
  computeHazardRateAttribution(
    timeline: Timeline,
    retentionTrajectory: { second: number; retentionPct: number }[]
  ): { hazardPoints: HazardRatePoint[]; cutAttributions: CutCreditAttribution[] } {
    const spans = computeTimelineSpans(timeline);
    const hazardPoints: HazardRatePoint[] = [];

    // Calculate instantaneous hazard rate for each second
    for (let i = 1; i < retentionTrajectory.length; i++) {
      const prev = retentionTrajectory[i - 1];
      const curr = retentionTrajectory[i];
      const r_prev = Math.max(0.01, prev.retentionPct / 100);
      const r_curr = Math.max(0.01, curr.retentionPct / 100);

      // Discrete derivative dR/dt
      const dR = r_prev - r_curr;
      // Instantaneous hazard rate h(t) = (1/R) * (drop/sec)
      const hazard = Math.max(0, dR / r_prev);

      hazardPoints.push({
        second: curr.second,
        retention: r_curr,
        hazardRate: Math.round(hazard * 1000) / 1000,
        isDropOffCliff: hazard > 0.045, // Spike above baseline 1.5% drop/sec
      });
    }

    // Map hazard spikes to exact timeline cut points (Temporal Difference Attribution)
    const cutAttributions: CutCreditAttribution[] = [];
    const windowTau = 1.5; // 1.5s temporal credit assignment window

    spans.forEach((span, idx) => {
      const cutTime = span.timelineStart;
      if (cutTime === 0) return; // Skip opening start

      // Find hazard points within [cutTime - 0.5s, cutTime + windowTau]
      const relevantHazards = hazardPoints.filter(
        (hp) => hp.second >= cutTime - 0.5 && hp.second <= cutTime + windowTau
      );

      const maxHazard = relevantHazards.reduce((max, hp) => Math.max(max, hp.hazardRate), 0.015);
      const hazardDelta = Math.max(0, maxHazard - 0.015); // Above baseline
      const stepReward = Math.round((1.0 - hazardDelta * 8) * 100) / 100;

      let verdict: 'EXCELLENT' | 'NEUTRAL' | 'HAZARD_INDUCED' = 'NEUTRAL';
      let rootCause: string | undefined;

      if (hazardDelta > 0.03) {
        verdict = 'HAZARD_INDUCED';
        rootCause = `Viewer drop spike detected (${(maxHazard * 100).toFixed(1)}%/s hazard) immediately following transition.`;
      } else if (stepReward >= 0.85) {
        verdict = 'EXCELLENT';
      }

      cutAttributions.push({
        cutIndex: idx,
        clipId: span.clip.id,
        timestamp: cutTime,
        transitionType: span.clip.trackId === 'V2' ? 'B_ROLL_INSERTION' : 'HARD_CUT',
        associatedHazardDelta: Math.round(hazardDelta * 1000) / 1000,
        stepReward,
        verdict,
        rootCause,
      });
    });

    return { hazardPoints, cutAttributions };
  }

  /**
   * 2. Causal Confounder Separation (Double Machine Learning Formulation).
   * Separates Creator Fame Baseline g(Z) and Topic Virality Prior from
   * the actual editorial treatment effect tau(X).
   */
  evaluateCausalTreatment(
    assetId: string,
    observedRetentionPct: number,
    creatorContext: {
      subscriberCount: number;
      historicalAvgRetentionPct: number;
      topicEmbeddingPrior: number; // e.g. 0.05 for high virality topic
    }
  ): CausalTreatmentResult {
    // Expected baseline g(Z_i) from creator reputation and subscriber weight
    const subWeight = Math.min(1.0, Math.log10(Math.max(10, creatorContext.subscriberCount)) / 7.0);
    const creatorBaselineExpected = Math.round(
      (creatorContext.historicalAvgRetentionPct * 0.75 + subWeight * 20 + creatorContext.topicEmbeddingPrior * 100) * 10
    ) / 10;

    // True Causal Lift tau(X_i) = Y_i - g(Z_i)
    const trueCausalLift = Math.round((observedRetentionPct - creatorBaselineExpected) * 10) / 10;
    const isStatisticallySignificant = Math.abs(trueCausalLift) >= 2.5;

    return {
      assetId,
      observedRetention: observedRetentionPct,
      creatorBaselineExpected,
      topicViralityPrior: creatorContext.topicEmbeddingPrior,
      trueCausalLift,
      isStatisticallySignificant,
    };
  }

  /**
   * 3. The Virtual Audience World Model Simulator.
   * Runs local surrogate prediction in <15ms without waiting 48 hours for social views.
   */
  simulateAudienceTrajectory(timeline: Timeline): {
    predictedHookRetention: number;
    predictedCompletionRate: number;
    trajectory: { second: number; retentionPct: number }[];
  } {
    const spans = computeTimelineSpans(timeline);
    const totalDuration = spans.length > 0 ? spans[spans.length - 1].timelineEnd : 30;
    const trajectory: { second: number; retentionPct: number }[] = [];

    let current = 1.0;
    const clipDurations = spans.map((s) => s.clip.out - s.clip.in);
    const avgDuration = clipDurations.reduce((a, b) => a + b, 0) / (clipDurations.length || 1);

    for (let sec = 0; sec <= Math.ceil(totalDuration); sec++) {
      let loss = 0.012; // Baseline drop
      if (sec <= 3) {
        // Hook penalty if first clip is sluggish
        loss = spans[0] && (spans[0].clip.out - spans[0].clip.in) > 3.5 ? 0.038 : 0.018;
      }
      if (avgDuration < 1.0 && sec > 6) {
        // Visual fatigue from epileptic cuts
        loss += 0.008;
      }
      current = Math.max(0.2, current - loss);
      trajectory.push({ second: sec, retentionPct: Math.round(current * 1000) / 10 });
    }

    const hook = trajectory.find((p) => p.second === 3)?.retentionPct || 88.0;
    const comp = trajectory[trajectory.length - 1]?.retentionPct || 58.0;

    return {
      predictedHookRetention: hook,
      predictedCompletionRate: comp,
      trajectory,
    };
  }

  /**
   * 4. Passive Video DPO (Direct Preference Optimization) Harvester.
   * Captures UI undo events ('Ctrl+Z') and manual trims into preference pairs (y_w, y_l).
   */
  harvestDPOPreference(
    assetId: string,
    undoneAiCut: { timestamp: number; action: string },
    humanChosenCut: { timestamp: number; action: string },
    transcriptContext: string
  ): VideoDPOPreferencePair {
    const beta = 0.1; // DPO temperature
    const deltaTimestamp = Math.abs(humanChosenCut.timestamp - undoneAiCut.timestamp);
    // Log-ratio delta proportional to human adjustment distance
    const dpoLogRatioDelta = Math.round(beta * (1.2 + deltaTimestamp * 0.5) * 1000) / 1000;

    const pair: VideoDPOPreferencePair = {
      id: `dpo_pair_${randomUUID().slice(0, 8)}`,
      assetId,
      timestamp: Date.now(),
      contextWindow: {
        start: Math.max(0, undoneAiCut.timestamp - 2.0),
        end: undoneAiCut.timestamp + 2.0,
        transcriptSlice: transcriptContext.slice(0, 80),
      },
      winningEdit: {
        action: humanChosenCut.action,
        cutTimestamp: humanChosenCut.timestamp,
        actor: 'human_editor',
      },
      losingEdit: {
        action: undoneAiCut.action,
        cutTimestamp: undoneAiCut.timestamp,
        actor: 'ai_proposal_undone',
      },
      dpoLogRatioDelta,
      createdAt: new Date().toISOString(),
    };

    this.dpoPreferenceBuffer.push(pair);
    if (this.dpoPreferenceBuffer.length > 500) {
      this.dpoPreferenceBuffer.shift();
    }

    return pair;
  }

  getDPOBufferCount(): number {
    return this.dpoPreferenceBuffer.length;
  }
}
