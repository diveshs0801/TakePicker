import assert from 'node:assert/strict';
import {
  applyOperation,
  sourceToTimeline,
  timelineToSource,
} from './timeline.ops';
import {
  validateTimelineInvariants,
  TimelineInvariantViolation,
  computeTimelineSpans,
} from './timeline.invariants';
import { Timeline } from '../../../../packages/contracts';

export function runTimelineTests() {
  console.log('Running Timeline and Invariants property tests...');
  const fps = 30.0;
  const initialTimeline: Timeline = {
    assetId: 'test-asset-1',
    fps,
    clips: [
      { id: 'clip_1', in: 0.0, out: 5.0, groupId: 'g1', text: 'Hello world' },
      { id: 'clip_2', in: 5.0, out: 12.0, groupId: 'g2', text: 'This is a demo' },
      { id: 'clip_3', in: 12.0, out: 20.0, groupId: 'g3', text: 'Final conclusion' },
    ],
  };

  // 1. Invariants validation
  validateTimelineInvariants(initialTimeline, 30.0);
  console.log('  ✓ Invariants on valid timeline passed');

  // Duplicate clip ID
  assert.throws(
    () => {
      validateTimelineInvariants({
        ...initialTimeline,
        clips: [
          { id: 'c1', in: 0, out: 2, groupId: 'g1' },
          { id: 'c1', in: 2, out: 4, groupId: 'g2' },
        ],
      });
    },
    /Duplicate clip id/,
    'Should reject duplicate clip IDs'
  );
  console.log('  ✓ Duplicate clip ID rejection passed');

  // Too short (< 2 frames)
  assert.throws(
    () => {
      validateTimelineInvariants({
        ...initialTimeline,
        clips: [{ id: 'c1', in: 1.0, out: 1.01, groupId: 'g1' }],
      });
    },
    /shorter than minimum 2 frames/,
    'Should reject clips shorter than 2 frames'
  );
  console.log('  ✓ Minimum clip duration enforcement passed');

  // Spans calculation
  const spans = computeTimelineSpans(initialTimeline);
  assert.equal(spans.length, 3);
  assert.equal(spans[0].timelineStart, 0);
  assert.equal(spans[0].timelineEnd, 5.0);
  assert.equal(spans[1].timelineStart, 5.0);
  assert.equal(spans[1].timelineEnd, 12.0);
  console.log('  ✓ Timeline spans calculation passed');

  // Time domain conversion
  const mapped = timelineToSource(initialTimeline, 6.0);
  assert.equal(mapped.clip.id, 'clip_2');
  assert.ok(Math.abs(mapped.sourceTime - 6.0) < 0.05);

  const back = sourceToTimeline(initialTimeline, 'clip_2', 6.0);
  assert.ok(Math.abs(back - 6.0) < 0.05);
  console.log('  ✓ Time domain conversions passed');

  // 2. Round-trip property tests (apply then apply inverse == original)
  // INSERT
  const newClip = { id: 'clip_new', in: 20.0, out: 25.0, groupId: 'g4' };
  const insertRes = applyOperation(initialTimeline, 'INSERT', {
    index: 1,
    clip: newClip,
  });
  assert.equal(insertRes.newTimeline.clips.length, 4);
  const revertedInsert = applyOperation(
    insertRes.newTimeline,
    insertRes.inverseOp.opType,
    insertRes.inverseOp.payload
  );
  assert.deepEqual(revertedInsert.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ INSERT / DELETE inverse round-trip passed');

  // DELETE
  const deleteRes = applyOperation(initialTimeline, 'DELETE', { clipId: 'clip_2' });
  assert.equal(deleteRes.newTimeline.clips.length, 2);
  const revertedDelete = applyOperation(
    deleteRes.newTimeline,
    deleteRes.inverseOp.opType,
    deleteRes.inverseOp.payload
  );
  assert.deepEqual(revertedDelete.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ DELETE / INSERT inverse round-trip passed');

  // TRIM
  const trimRes = applyOperation(initialTimeline, 'TRIM', {
    clipId: 'clip_2',
    in: 6.0,
    out: 11.0,
    domain: 'source',
  });
  assert.ok(Math.abs(trimRes.newTimeline.clips[1].in - 6.0) < 0.05);
  const revertedTrim = applyOperation(
    trimRes.newTimeline,
    trimRes.inverseOp.opType,
    trimRes.inverseOp.payload
  );
  assert.deepEqual(revertedTrim.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ TRIM / TRIM inverse round-trip passed');

  // SPLIT
  const splitRes = applyOperation(initialTimeline, 'SPLIT', {
    clipId: 'clip_2',
    at: 8.0,
    domain: 'source',
  });
  assert.equal(splitRes.newTimeline.clips.length, 4);
  const revertedSplit = applyOperation(
    splitRes.newTimeline,
    splitRes.inverseOp.opType,
    splitRes.inverseOp.payload
  );
  assert.deepEqual(revertedSplit.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ SPLIT / RESTORE_CLIP inverse round-trip passed');

  // MOVE
  const moveRes = applyOperation(initialTimeline, 'MOVE', {
    clipId: 'clip_3',
    toIndex: 0,
  });
  assert.equal(moveRes.newTimeline.clips[0].id, 'clip_3');
  const revertedMove = applyOperation(
    moveRes.newTimeline,
    moveRes.inverseOp.opType,
    moveRes.inverseOp.payload
  );
  assert.deepEqual(revertedMove.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ MOVE / MOVE inverse round-trip passed');

  // SELECT_TAKE
  const selectTakeRes = applyOperation(initialTimeline, 'SELECT_TAKE', {
    groupId: 'g2',
    newSegmentId: 'seg_alt_2',
    in: 25.0,
    out: 32.0,
    text: 'Alternative take text',
    reason: 'Selected retake',
  });
  assert.ok(Math.abs(selectTakeRes.newTimeline.clips[1].in - 25.0) < 0.05);
  const revertedSelect = applyOperation(
    selectTakeRes.newTimeline,
    selectTakeRes.inverseOp.opType,
    selectTakeRes.inverseOp.payload
  );
  assert.deepEqual(revertedSelect.newTimeline.clips, initialTimeline.clips);
  console.log('  ✓ SELECT_TAKE / SELECT_TAKE inverse round-trip passed');

  console.log('ALL TIMELINE PROPERTY TESTS PASSED! (100% Round-trip recovery)\n');
}

if (require.main === module) {
  runTimelineTests();
}
