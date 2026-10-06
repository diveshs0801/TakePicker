// Automated test suite for Milestone 13: TakeEngine Native Performance Rust Core
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

async function testRustEngine() {
  console.log('======================================================');
  console.log('   TakePicker Milestone 13: Rust Engine Verification  ');
  console.log('======================================================\n');

  // Test 1: Run native benchmark via docker
  console.log('1. Executing Native Rust Engine Benchmark...');
  const cmd = `docker run --rm -v "${process.cwd().replace(/\\/g, '/')}/crates/take-engine:/app" -w /app rust:1.80-slim ./target/release/take-engine benchmark`;
  const output = execSync(cmd, { encoding: 'utf8' });
  console.log(output);

  assert(output.includes('TAKEENGINE NATIVE RUST ENGINE ALL SYSTEMS GO!'), 'Benchmark should succeed');
  assert(output.includes('Real-Time'), 'Throughput should measure real-time factor');

  // Test 2: Smart GOP CLI Output JSON Verification
  console.log('\n2. Testing Smart GOP CLI JSON Output...');
  const gopCmd = `docker run --rm -v "${process.cwd().replace(/\\/g, '/')}/crates/take-engine:/app" -w /app rust:1.80-slim ./target/release/take-engine smart-gop 120.0 30.0 2.0 15.3 48.7`;
  const gopJsonStr = execSync(gopCmd, { encoding: 'utf8' }).trim();
  const gopPlan = JSON.parse(gopJsonStr);

  console.log('   Smart GOP Plan Output:');
  console.log(`     Requested: [${gopPlan.requested_in}s -> ${gopPlan.requested_out}s]`);
  console.log(`     Strategy : ${gopPlan.strategy}`);
  console.log(`     Stream Copy Ratio: ${(gopPlan.stream_copy_ratio * 100).toFixed(1)}%`);
  console.log(`     Sub-segments count: ${gopPlan.sub_segments.length}`);

  assert.strictEqual(gopPlan.strategy, 'SmartGopHybrid');
  assert(gopPlan.stream_copy_ratio > 0.85, 'Stream copy ratio should exceed 85%');
  assert(gopPlan.sub_segments.some(s => s.seg_type === 'body_copy' && !s.requires_reencode));
  console.log('   ✓ Smart GOP JSON schema & decision matrix validated.');

  // Test 3: Waveform Extraction on Synthetic PCM
  console.log('\n3. Testing Native Waveform Peak Extraction...');
  const tempPcmPath = path.resolve(process.cwd(), 'crates/take-engine/target/test_tone.pcm');
  // 48000 samples (1 sec) of 16-bit PCM (96000 bytes)
  const pcmBuf = Buffer.alloc(96000);
  for (let i = 0; i < 48000; i++) {
    const val = Math.round(Math.sin((i / 48000) * 440 * 2 * Math.PI) * 20000);
    pcmBuf.writeInt16LE(val, i * 2);
  }
  fs.writeFileSync(tempPcmPath, pcmBuf);

  const wfCmd = `docker run --rm -v "${process.cwd().replace(/\\/g, '/')}/crates/take-engine:/app" -w /app rust:1.80-slim ./target/release/take-engine waveform /app/target/test_tone.pcm 48000 1 50`;
  const wfJsonStr = execSync(wfCmd, { encoding: 'utf8' }).trim();
  const wfResult = JSON.parse(wfJsonStr);

  assert.strictEqual(wfResult.total_samples, 48000);
  assert.strictEqual(wfResult.bucket_count, 50);
  assert(wfResult.max_peak > 0.5 && wfResult.max_peak < 0.7, 'Peak amplitude of 20000/32768 should be ~0.61');
  console.log(`   ✓ Extracted ${wfResult.bucket_count} buckets with max peak ${wfResult.max_peak.toFixed(3)}.`);

  // Cleanup
  if (fs.existsSync(tempPcmPath)) fs.unlinkSync(tempPcmPath);

  console.log('\n======================================================');
  console.log('   ALL MILESTONE 13 RUST ENGINE TESTS PASSED! ⚡🦀    ');
  console.log('======================================================');
}

testRustEngine().catch((err) => {
  console.error('\n❌ Milestone 13 test failed:', err);
  process.exit(1);
});
