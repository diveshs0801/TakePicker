// Automated test suite for Milestone 12: One-Click Jump-Cut & Smart Silence Trimmer
const assert = require('node:assert');
const path = require('node:path');

async function testSilenceAndJumpCut() {
  console.log('======================================================');
  console.log('  TakePicker Milestone 12: Silence & Jump-Cut Tests   ');
  console.log('======================================================\n');

  // Load compiled or tsx modules
  const fs = require('node:fs');
  const detectorPathCandidates = [
    path.resolve(process.cwd(), 'dist/apps/api/src/timeline/silence.detector.js'),
    path.resolve('/app/apps/api/dist/apps/api/src/timeline/silence.detector.js'),
    path.resolve(__dirname, '../apps/api/src/timeline/silence.detector'),
  ];
  const detectorPath = detectorPathCandidates.find(p => fs.existsSync(p)) || detectorPathCandidates[0];
  const { detectSilences, generateJumpCutTimeline } = require(detectorPath);

  const invariantsPathCandidates = [
    path.resolve(process.cwd(), 'dist/apps/api/src/timeline/timeline.invariants.js'),
    path.resolve('/app/apps/api/dist/apps/api/src/timeline/timeline.invariants.js'),
    path.resolve(__dirname, '../apps/api/src/timeline/timeline.invariants'),
  ];
  const invariantsPath = invariantsPathCandidates.find(p => fs.existsSync(p)) || invariantsPathCandidates[0];
  const { validateTimelineInvariants } = require(invariantsPath);

  // Mock timeline and words with speech and silences
  const mockTimeline = {
    id: 'timeline-jumpcut-1',
    assetId: 'asset-jumpcut-test',
    fps: 30,
    clips: [
      {
        id: 'clip_intro',
        in: 0.0,
        out: 12.0, // 12 seconds clip
        groupId: 'grp_intro',
      },
      {
        id: 'clip_body',
        in: 20.0,
        out: 30.0, // 10 seconds clip
        groupId: 'grp_body',
      },
    ],
  };

  const mockWords = [
    // Clip 1: [0.0, 12.0]
    // 0.0 to 1.5 is dead air (1.5s > 0.6s) -> leading silence!
    { w: 'Welcome', start: 1.5, end: 2.0 },
    { w: 'to', start: 2.05, end: 2.2 }, // short natural pause (50ms) -> should NOT cut
    { w: 'TakePicker.', start: 2.25, end: 3.0 },
    // 3.0 to 6.0 is dead air (3.0s > 0.6s) -> middle silence!
    { w: 'Today', start: 6.0, end: 6.5 },
    { w: 'we', start: 6.55, end: 6.7 },
    { w: 'explore', start: 6.75, end: 7.2 },
    { w: 'video', start: 7.25, end: 7.6 },
    { w: 'editing.', start: 7.65, end: 8.2 },
    // 8.2 to 12.0 is dead air (3.8s > 0.6s) -> trailing silence!

    // Clip 2: [20.0, 30.0]
    // 20.0 to 20.2 (0.2s < 0.6s) -> NOT silence
    { w: 'In', start: 20.2, end: 20.5 },
    { w: 'conclusion.', start: 20.55, end: 21.5 },
    // 21.5 to 29.8 is massive dead air (8.3s > 0.6s) -> trailing silence!
    { w: 'Goodbye.', start: 29.85, end: 30.0 },
  ];

  // Test 1: Silence Detection
  console.log('1. Testing Silence Detection Algorithm...');
  const silences = detectSilences(mockTimeline, mockWords, {
    minSilenceSec: 0.6,
    bufferSec: 0.1,
  });

  console.log(`   Found ${silences.length} silence intervals:`);
  silences.forEach((s, idx) => {
    console.log(`     [#${idx + 1}] ${s.start.toFixed(2)}s -> ${s.end.toFixed(2)}s (${s.duration.toFixed(2)}s) between "${s.precedingWord || 'START'}" and "${s.followingWord || 'END'}"`);
  });

  assert(silences.length >= 4, `Expected at least 4 silences, got ${silences.length}`);
  
  // Verify leading silence in clip 1
  assert.strictEqual(silences[0].start, 0.0);
  assert(silences[0].duration >= 1.3, 'Leading dead air should be at least 1.3s');

  // Verify middle silence in clip 1
  assert(silences[1].start >= 3.0);
  assert(silences[1].end <= 6.0);
  assert.strictEqual(silences[1].precedingWord, 'TakePicker.');
  assert.strictEqual(silences[1].followingWord, 'Today');

  // Verify trailing silence in clip 1
  assert(silences[2].start >= 8.2);
  assert.strictEqual(silences[2].end, 12.0);
  assert.strictEqual(silences[2].precedingWord, 'editing.');

  console.log('   ✓ Leading, inter-word, and trailing silence intervals accurately detected with buffer margins.');

  // Test 2: Jump-Cut Timeline Generation
  console.log('\n2. Testing Jump-Cut Timeline Generation...');
  const { newTimeline, timeSaved } = generateJumpCutTimeline(mockTimeline, mockWords, {
    minSilenceSec: 0.6,
    bufferSec: 0.1,
  });

  console.log(`   Original clips: ${mockTimeline.clips.length} (total duration: ${mockTimeline.clips.reduce((a, c) => a + (c.out - c.in), 0)}s)`);
  console.log(`   New jump-cut clips: ${newTimeline.clips.length} (time saved: ${timeSaved.toFixed(2)}s)`);
  
  newTimeline.clips.forEach((c, idx) => {
    console.log(`     Clip ${idx + 1} (${c.id}): [${c.in.toFixed(2)}s -> ${c.out.toFixed(2)}s] dur=${(c.out - c.in).toFixed(2)}s`);
    assert(c.out > c.in, `Clip ${c.id} must have out > in`);
    assert(c.out - c.in >= 2 / 30, `Clip ${c.id} must be >= 2 frames`);
  });

  assert(timeSaved > 8.0, `Expected time saved > 8.0s, got ${timeSaved}`);
  assert(newTimeline.clips.length > mockTimeline.clips.length, 'Clips should be split into tight jump cuts');

  // Test 3: Validate Timeline Invariants on Resulting Timeline
  console.log('\n3. Verifying Timeline Invariants on Jump-Cut Output...');
  assert.doesNotThrow(() => {
    validateTimelineInvariants(newTimeline, 35.0);
  }, 'Jump-cut timeline must satisfy all timeline invariants without error');
  console.log('   ✓ Invariants (chronological ordering, boundary clamping, non-overlapping) 100% valid.');

  // Test 4: Undo & Replay Operation Structure
  console.log('\n4. Verifying JUMP_CUT and RESTORE_CLIPS Inverse Op Structure...');
  const opsPathCandidates = [
    path.resolve(process.cwd(), 'dist/apps/api/src/timeline/timeline.ops.js'),
    path.resolve('/app/apps/api/dist/apps/api/src/timeline/timeline.ops.js'),
    path.resolve(__dirname, '../apps/api/src/timeline/timeline.ops'),
  ];
  const opsPath = opsPathCandidates.find(p => fs.existsSync(p)) || opsPathCandidates[0];
  const { applyOperation } = require(opsPath);

  const jumpCutRes = applyOperation(
    mockTimeline,
    'JUMP_CUT',
    { clips: newTimeline.clips },
    35.0
  );

  assert.strictEqual(jumpCutRes.newTimeline.clips.length, newTimeline.clips.length);
  assert.strictEqual(jumpCutRes.inverseOp.opType, 'RESTORE_CLIPS');
  assert.strictEqual(jumpCutRes.inverseOp.payload.clips.length, mockTimeline.clips.length);

  // Undo by applying inverse
  const undoRes = applyOperation(
    jumpCutRes.newTimeline,
    jumpCutRes.inverseOp.opType,
    jumpCutRes.inverseOp.payload,
    35.0
  );

  assert.strictEqual(undoRes.newTimeline.clips.length, mockTimeline.clips.length);
  assert.deepStrictEqual(undoRes.newTimeline.clips[0], mockTimeline.clips[0]);
  console.log('   ✓ JUMP_CUT and RESTORE_CLIPS inverse operation cleanly reverts to pristine timeline.');

  console.log('\n======================================================');
  console.log('  ALL MILESTONE 12 SILENCE & JUMP-CUT TESTS PASSED!    ');
  console.log('======================================================');
}

testSilenceAndJumpCut().catch((err) => {
  console.error('\n❌ Milestone 12 test failed:', err);
  process.exit(1);
});
