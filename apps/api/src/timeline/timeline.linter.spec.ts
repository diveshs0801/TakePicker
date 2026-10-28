import assert from 'node:assert/strict';
import {
  lintTimelineAST,
  autoRepairTimelineAST,
  WordToken,
} from './timeline.linter';
import { Timeline } from '../../../../packages/contracts';

export function runTimelineLinterTests() {
  console.log('Running Cardboard AI Timeline Linter AST Invariant & Repair Tests...');

  const fps = 30.0;
  const mockWords: WordToken[] = [
    { word: 'Today', start: 1.20, end: 1.55, confidence: 0.98 },
    { word: 'is', start: 1.58, end: 1.72, confidence: 0.99 },
    { word: 'my', start: 1.75, end: 1.95, confidence: 0.98 },
    { word: 'twenty', start: 2.10, end: 2.50, confidence: 0.97 },
    { word: 'first', start: 2.52, end: 2.85, confidence: 0.99 },
    { word: 'birthday', start: 2.90, end: 3.45, confidence: 0.98 },
    { word: 'Here', start: 4.00, end: 4.25, confidence: 0.96 },
    { word: 'is', start: 4.28, end: 4.40, confidence: 0.98 },
    { word: 'what', start: 4.42, end: 4.65, confidence: 0.99 },
    { word: 'I', start: 4.70, end: 4.80, confidence: 0.99 },
    { word: 'have', start: 4.82, end: 5.00, confidence: 0.98 },
    { word: 'to', start: 5.02, end: 5.12, confidence: 0.99 },
    { word: 'say', start: 5.15, end: 5.50, confidence: 0.98 },
  ];

  // TEST 1: Clean, well-spaced timeline
  const cleanTimeline: Timeline = {
    assetId: 'test-clean',
    fps,
    clips: [
      { id: 'c1', in: 1.0, out: 3.6, groupId: 'g1' }, // Pads 200ms before 'Today' and 150ms after 'birthday'
      { id: 'c2', in: 3.8, out: 5.7, groupId: 'g2' }, // Pads before 'Here' and after 'say'
    ],
  };

  const cleanReport = lintTimelineAST(cleanTimeline, mockWords, { assetDuration: 6.0 });
  assert.equal(cleanReport.valid, true, 'Clean timeline should pass validation');
  assert.ok(cleanReport.score >= 90, `Clean timeline score should be high, got ${cleanReport.score}`);
  console.log(`  ✓ Clean Timeline passed with score ${cleanReport.score}/100`);

  // TEST 2: WORD_CUTOFF invariant detection
  const cutOffTimeline: Timeline = {
    assetId: 'test-cutoff',
    fps,
    clips: [
      // Cut ends at 3.10s, but "birthday" runs from 2.90s to 3.45s!
      { id: 'c_bad', in: 1.0, out: 3.10, groupId: 'g1' },
    ],
  };

  const cutoffReport = lintTimelineAST(cutOffTimeline, mockWords, { assetDuration: 6.0 });
  assert.equal(cutoffReport.valid, false, 'Timeline with clipped word must fail invariant validation');
  const wordCutoffFinding = cutoffReport.findings.find((f) => f.rule === 'WORD_CUTOFF');
  assert.ok(wordCutoffFinding, 'Must flag WORD_CUTOFF rule violation');
  assert.match(wordCutoffFinding!.message, /birthday/, 'Violation message must name clipped word');
  console.log(`  ✓ WORD_CUTOFF correctly detected on clipped word "birthday" (Score dropped to ${cutoffReport.score})`);

  // TEST 3: GAP_JITTER sub-frame black gap detection
  const jitterTimeline: Timeline = {
    assetId: 'test-jitter',
    fps,
    clips: [
      { id: 'c1', in: 1.0, out: 3.6, groupId: 'g1' },
      // Starts at 3.65s (50ms gap = ~1.5 frames)
      { id: 'c2', in: 3.65, out: 5.7, groupId: 'g2' },
    ],
  };

  const jitterReport = lintTimelineAST(jitterTimeline, mockWords, { assetDuration: 6.0 });
  const gapFinding = jitterReport.findings.find((f) => f.rule === 'GAP_JITTER');
  assert.ok(gapFinding, 'Must detect sub-frame gap jitter between 3.60s and 3.65s');
  console.log(`  ✓ GAP_JITTER sub-frame black gap correctly detected`);

  // TEST 4: UNSNAPPED_FRAME_GRID detection
  const unalignedTimeline: Timeline = {
    assetId: 'test-unaligned',
    fps: 30.0,
    clips: [
      { id: 'c1', in: 1.012345, out: 3.60, groupId: 'g1' },
    ],
  };

  const unalignedReport = lintTimelineAST(unalignedTimeline, mockWords, { assetDuration: 6.0 });
  const gridFinding = unalignedReport.findings.find((f) => f.rule === 'UNSNAPPED_FRAME_GRID');
  assert.ok(gridFinding, 'Must detect cut boundaries not snapped to frame grid');
  console.log(`  ✓ UNSNAPPED_FRAME_GRID cut boundary detected`);

  // TEST 5: Autonomous Auto-Repair & Verification (Closed Loop)
  console.log('Testing closed-loop autonomous repair pass...');
  const defectiveTimeline: Timeline = {
    assetId: 'test-auto-repair',
    fps,
    clips: [
      // Word cutoff on "birthday" (ends at 3.10 instead of 3.45)
      { id: 'c_defective', in: 1.0, out: 3.10, groupId: 'g1' },
    ],
  };

  const { repairedTimeline, repairedCount, initialScore, finalScore } = autoRepairTimelineAST(
    defectiveTimeline,
    mockWords,
    { assetDuration: 6.0 }
  );

  assert.ok(repairedCount > 0, 'Must apply repair ops');
  assert.ok(finalScore > initialScore, `Final score (${finalScore}) must exceed initial (${initialScore})`);
  assert.equal(finalScore, 100, `Expected 100% broadcast clean score after auto-repair, got ${finalScore}`);

  const postRepairReport = lintTimelineAST(repairedTimeline, mockWords, { assetDuration: 6.0 });
  assert.equal(postRepairReport.valid, true, 'Repaired timeline must pass validation');
  assert.equal(postRepairReport.findings.length, 0, 'Repaired timeline must have 0 findings');

  console.log(`  ✓ Closed-Loop Auto-Repair SUCCESS: Repaired ${repairedCount} defects, score jumped ${initialScore} -> ${finalScore}/100`);
  console.log('All Timeline Linter AST Invariant & Repair Tests Passed Successfully! 🎉');
}
