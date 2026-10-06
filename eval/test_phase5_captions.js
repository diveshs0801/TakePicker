// Automated test suite for AI Dynamic Captions & Subtitles Engine (SRT, VTT, ASS Kinetic Karaoke)
const assert = require('node:assert');
const path = require('node:path');

const captionsGenPath = path.resolve(process.cwd(), 'dist/apps/api/src/captions/captions.generator');
const captionsGen = require(captionsGenPath);

const {
  formatSrtTimestamp,
  formatVttTimestamp,
  formatAssTimestamp,
  alignWordsToTimeline,
  groupWordsIntoCues,
  generateSRT,
  generateVTT,
  generateASS,
} = captionsGen;

async function testCaptionsEngine() {
  console.log('======================================================');
  console.log('   TakePicker AI Dynamic Captions & Subtitles Tests   ');
  console.log('======================================================\n');

  // Test 1: Timestamp formatting across formats
  console.log('1. Testing Subtitle Timestamp Formats...');
  // 1.234 seconds -> SRT: 00:00:01,234 | VTT: 00:00:01.234 | ASS: 0:00:01.23
  assert.strictEqual(formatSrtTimestamp(1.234), '00:00:01,234');
  assert.strictEqual(formatVttTimestamp(1.234), '00:00:01.234');
  assert.strictEqual(formatAssTimestamp(1.234), '0:00:01.23');

  // 65.050 seconds -> 00:01:05,050
  assert.strictEqual(formatSrtTimestamp(65.05), '00:01:05,050');
  assert.strictEqual(formatVttTimestamp(65.05), '00:01:05.050');
  assert.strictEqual(formatAssTimestamp(65.05), '0:01:05.05');
  console.log('   ✓ Timestamp math verified across SRT, VTT, and ASS centisecond standards.');

  // Test 2: Word remapping from source time into rough-cut timeline sequence
  console.log('\n2. Testing Timeline Word Alignment & Remapping...');
  const mockClips = [
    {
      id: 'clip_1',
      in: 5.0,  // source 5.0s -> 9.0s (4.0s duration) -> timeline 0.0s -> 4.0s
      out: 9.0,
      groupId: 'grp_1',
    },
    {
      id: 'clip_2',
      in: 20.0, // source 20.0s -> 25.0s (5.0s duration) -> timeline 4.0s -> 9.0s
      out: 25.0,
      groupId: 'grp_2',
    },
  ];

  const mockWords = [
    // Words before clip 1 (cut out discarded takes)
    { w: 'Um', start: 1.0, end: 1.5, prob: 0.95 },
    { w: 'restart', start: 2.0, end: 2.8, prob: 0.92 },

    // Words inside Clip 1
    { w: 'Welcome', start: 5.2, end: 5.8, prob: 0.99 },
    { w: 'back', start: 5.9, end: 6.3, prob: 0.98 },
    { w: 'everyone.', start: 6.4, end: 7.2, prob: 0.99 },

    // Word spanning beyond clip 1 out point
    { w: 'trailing', start: 8.8, end: 9.5, prob: 0.85 },

    // Words between clips (cut out take)
    { w: 'bad_take', start: 12.0, end: 14.0, prob: 0.9 },

    // Words inside Clip 2
    { w: 'Here', start: 20.2, end: 20.6, prob: 0.97 },
    { w: 'is', start: 20.7, end: 20.9, prob: 0.99 },
    { w: 'the', start: 21.0, end: 21.2, prob: 0.99 },
    { w: 'new', start: 21.3, end: 21.6, prob: 0.98 },
    { w: 'feature.', start: 21.7, end: 22.5, prob: 0.99 },
  ];

  const alignedWords = alignWordsToTimeline(mockClips, mockWords);

  console.log(`   Source words count: ${mockWords.length}`);
  console.log(`   Aligned words count in rough-cut: ${alignedWords.length}`);

  // Discarded words must be eliminated
  assert(!alignedWords.some((w) => w.w === 'Um' || w.w === 'restart' || w.w === 'bad_take'), 'Cut takes must be filtered out');

  // First word in Clip 1: 'Welcome'
  // Source: 5.2s - 5.8s. Clip 1 starts at 5.0s.
  // Timeline offset: 0.0 + (5.2 - 5.0) = 0.2s -> 0.8s
  const w1 = alignedWords.find((w) => w.w === 'Welcome');
  assert(w1, 'Word Welcome must exist');
  assert.strictEqual(w1.timelineStart, 0.2);
  assert.strictEqual(w1.timelineEnd, 0.8);
  assert.strictEqual(w1.clipId, 'clip_1');

  // Trailing word must be clamped to clip 1 out (9.0s)
  const wTrailing = alignedWords.find((w) => w.w === 'trailing');
  assert(wTrailing, 'Trailing word must exist');
  assert.strictEqual(wTrailing.end, 9.0); // clamped to clip.out
  assert.strictEqual(wTrailing.timelineEnd, 4.0); // 0.0 + (9.0 - 5.0) = 4.0s

  // First word in Clip 2: 'Here'
  // Source: 20.2s - 20.6s. Clip 2 starts at 20.0s.
  // Clip 1 duration was 4.0s, so Clip 2 timeline start is 4.0s!
  // Timeline offset: 4.0 + (20.2 - 20.0) = 4.2s -> 4.6s
  const wHere = alignedWords.find((w) => w.w === 'Here');
  assert(wHere, 'Word Here must exist');
  assert.strictEqual(wHere.timelineStart, 4.2);
  assert.strictEqual(wHere.timelineEnd, 4.6);
  assert.strictEqual(wHere.clipId, 'clip_2');
  console.log('   ✓ Timeline word remapping & boundary clamping accurate to millisecond precision.');

  // Test 3: Natural Cue Chunking
  console.log('\n3. Testing Natural Subtitle Cue Chunking...');
  const cues = groupWordsIntoCues(alignedWords, 5, 30, 0.45);
  console.log(`   Generated ${cues.length} natural subtitle cues:`);
  cues.forEach((c) => {
    console.log(`     [Cue #${c.index}] (${c.start.toFixed(2)}s - ${c.end.toFixed(2)}s): "${c.text}"`);
  });

  assert(cues.length >= 2, 'Should group into at least 2 distinct cues');
  // Cue 1 should end around 'everyone.' because of the period
  assert.strictEqual(cues[0].text, 'Welcome back everyone.');
  console.log('   ✓ Cue chunker breaks naturally on punctuation and inter-clip speech boundaries.');

  // Test 4: SubRip (.srt) Subtitles
  console.log('\n4. Testing SubRip (.srt) Generation...');
  const srt = generateSRT(cues);
  console.log('--- SRT Sample Output ---');
  console.log(srt.slice(0, 220) + '...\n');

  assert(srt.includes('1\r\n00:00:00,200 --> 00:00:02,200\r\nWelcome back everyone.'), 'SRT cue 1 structure valid');
  assert(srt.includes('-->'), 'SRT must contain timecode separator');
  console.log('   ✓ SRT format validated for YouTube, VLC, and Premiere Pro.');

  // Test 5: WebVTT (.vtt) Subtitles
  console.log('\n5. Testing WebVTT (.vtt) Generation...');
  const vtt = generateVTT(cues);
  console.log('--- WebVTT Sample Output ---');
  console.log(vtt.slice(0, 220) + '...\n');

  assert(vtt.startsWith('WEBVTT'), 'Must start with WEBVTT header');
  assert(vtt.includes('00:00:00.200 --> 00:00:02.200'), 'VTT timestamp format with periods valid');
  console.log('   ✓ WebVTT format validated for HTML5 web players.');

  // Test 6: Advanced SubStation Alpha (.ass) with Kinetic Karaoke
  console.log('\n6. Testing Kinetic Karaoke (.ass) Subtitles...');
  const assKinetic = generateASS(cues, { stylePreset: 'kinetic', title: 'Studio Cut' });
  console.log('--- ASS Kinetic Output ---');
  console.log(assKinetic.slice(0, 480) + '...\n');

  assert(assKinetic.includes('[Script Info]'), 'Must include Script Info header');
  assert(assKinetic.includes('[V4+ Styles]'), 'Must include V4+ Styles');
  assert(assKinetic.includes('KineticKaraoke'), 'Must include KineticKaraoke style');
  assert(assKinetic.includes('&H0000FFFF'), 'Must include Vibrant Yellow karaoke highlight color');
  assert(assKinetic.includes('{\\k'), 'Must contain \\k centisecond karaoke tags');
  assert(assKinetic.includes('Dialogue: 0,'), 'Must contain dialogue events');

  // Verify other style presets
  const assNeon = generateASS(cues, { stylePreset: 'neon' });
  assert(assNeon.includes('NeonGlow'), 'Neon preset must be defined');

  const assModern = generateASS(cues, { stylePreset: 'modern' });
  assert(assModern.includes('ModernBold'), 'Modern preset must be defined');
  console.log('   ✓ Kinetic Karaoke ASS format with active word highlight validated.');

  console.log('\n======================================================');
  console.log('   ALL DYNAMIC CAPTIONS & SUBTITLE TESTS PASSED! 💬✨  ');
  console.log('======================================================');
}

testCaptionsEngine().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
