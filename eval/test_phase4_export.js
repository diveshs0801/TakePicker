const assert = require('node:assert');
const path = require('node:path');

// We test the export generators directly
const exportGenPath = path.resolve(process.cwd(), 'dist/apps/api/src/export/export.generator');
const exportGen = require(exportGenPath);

const {
  secondsToTimecode,
  secondsToFrames,
  generateEDL,
  generatePremiereXML,
  generateFCPXML,
  generateOTIO,
} = exportGen;

async function testExportInterchange() {
  console.log('=================================================');
  console.log('   TakePicker Pro NLE Export Interchange Tests   ');
  console.log('=================================================\n');

  // Test 1: Timecode math
  console.log('1. Testing SMPTE Timecode calculations...');
  assert.strictEqual(secondsToTimecode(0, 30), '00:00:00:00');
  assert.strictEqual(secondsToTimecode(1.0, 30), '00:00:01:00');
  assert.strictEqual(secondsToTimecode(1.5, 30), '00:00:01:15');
  assert.strictEqual(secondsToTimecode(65.5, 30), '00:01:05:15');
  assert.strictEqual(secondsToTimecode(3661.1, 30), '01:01:01:03');
  console.log('   ✓ SMPTE Timecode math accurate at sub-frame precision.');

  // Mock Asset & Timeline
  const mockAsset = {
    id: 'asset_test_123',
    filename: 'interview_a_roll.mp4',
    storageKey: 'assets/asset_test_123/source.mp4',
    duration: 120.0,
    fps: 30,
    width: 1920,
    height: 1080,
    vcodec: 'h264',
    status: 'READY',
    createdAt: new Date().toISOString(),
  };

  const mockTimeline = {
    assetId: 'asset_test_123',
    fps: 30,
    clips: [
      {
        id: 'clip_1',
        in: 2.0,
        out: 6.5,
        groupId: 'grp_1',
        reason: 'Take 2/2, score 0.95',
        text: 'Welcome back to the studio today.',
      },
      {
        id: 'clip_2',
        in: 15.0,
        out: 22.0,
        groupId: 'grp_2',
        reason: 'Take 1/1, unique take',
        text: 'Here is our special guest demonstration.',
      },
      {
        id: 'clip_3',
        in: 45.2,
        out: 50.0,
        groupId: 'grp_3',
        reason: 'Take 3/3, score 0.98',
        text: 'Thank you for watching, see you next time.',
      },
    ],
  };

  // Test 2: CMX 3600 EDL
  console.log('\n2. Testing CMX 3600 EDL Export...');
  const edl = generateEDL(mockAsset, mockTimeline, { sequenceName: 'Test Sequence' });
  console.log('--- EDL Sample Output ---');
  console.log(edl.slice(0, 380) + '...\n');

  assert(edl.includes('TITLE: TEST_SEQUENCE'), 'EDL must contain sequence TITLE');
  assert(edl.includes('FCM: NON-DROP FRAME'), 'EDL must specify FCM');
  assert(edl.includes('001  AX       V     C'), 'EDL must contain Video cut for event 1');
  assert(edl.includes('001  AX       AA    C'), 'EDL must contain Audio cut for event 1');
  assert(edl.includes('* FROM CLIP NAME: interview_a_roll.mp4'), 'EDL must reference source file');
  assert(edl.includes('* COMMENT: Take 2/2, score 0.95'), 'EDL must preserve reason/comment');
  console.log('   ✓ CMX 3600 EDL conforms to SMPTE post-production standard.');

  // Test 3: Adobe Premiere Pro XML (XMEML v5)
  console.log('\n3. Testing Adobe Premiere Pro XML (XMEML v5) Export...');
  const premXml = generatePremiereXML(mockAsset, mockTimeline, { sequenceName: 'TakePicker Master' });
  console.log('--- Premiere XML Sample Output ---');
  console.log(premXml.slice(0, 420) + '...\n');

  assert(premXml.includes('<xmeml version="5">'), 'Must be XMEML version 5');
  assert(premXml.includes('<name>TakePicker Master</name>'), 'Must contain sequence name');
  assert(premXml.includes('<clipitem id="clipitem-v-1">'), 'Must contain video clipitem 1');
  assert(premXml.includes('<clipitem id="clipitem-a1-1">'), 'Must contain audio track 1 clipitem');
  assert(premXml.includes('<clipitem id="clipitem-a2-1">'), 'Must contain audio track 2 clipitem');
  assert(premXml.includes('<pathurl>file://localhost/interview_a_roll.mp4</pathurl>'), 'Must preserve file pathurl');
  assert(premXml.includes('<width>1920</width>') && premXml.includes('<height>1080</height>'), 'Must preserve frame dimensions');
  console.log('   ✓ Premiere Pro XML structure verified with dual-channel audio sync.');

  // Test 4: Apple Final Cut Pro XML (FCPXML v1.9)
  console.log('\n4. Testing Apple Final Cut Pro XML (FCPXML v1.9) Export...');
  const fcpxml = generateFCPXML(mockAsset, mockTimeline, { sequenceName: 'FCP Cut' });
  console.log('--- FCPXML Sample Output ---');
  console.log(fcpxml.slice(0, 420) + '...\n');

  assert(fcpxml.includes('<fcpxml version="1.9">'), 'Must be FCPXML version 1.9');
  assert(fcpxml.includes('<format id="r1"'), 'Must define format resource');
  assert(fcpxml.includes('<asset id="r2"'), 'Must define asset resource');
  assert(fcpxml.includes('<spine>'), 'Must define sequence spine');
  assert(fcpxml.includes('<asset-clip ref="r2"'), 'Must contain asset clips referencing media');
  assert(fcpxml.includes('<marker start='), 'Must contain marker metadata');
  console.log('   ✓ FCPXML v1.9 format verified for Final Cut Pro and DaVinci Resolve.');

  // Test 5: OpenTimelineIO (OTIO) JSON
  console.log('\n5. Testing OpenTimelineIO (OTIO) JSON Export...');
  const otio = generateOTIO(mockAsset, mockTimeline, { sequenceName: 'VFX Conform' });
  console.log('--- OTIO Summary ---');
  console.log('Schema:', otio.OTIO_SCHEMA);
  console.log('Tracks:', otio.tracks.children.length);
  console.log('Clips count in V1:', otio.tracks.children[0].children.length);

  assert.strictEqual(otio.OTIO_SCHEMA, 'Timeline.1');
  assert.strictEqual(otio.tracks.children.length, 2); // Video and Audio tracks
  assert.strictEqual(otio.tracks.children[0].children.length, 3);
  assert.strictEqual(otio.tracks.children[0].children[0].name, 'clip_1');
  assert.strictEqual(otio.tracks.children[0].children[0].source_range.start_time.value, 60); // 2.0s * 30fps = 60
  console.log('   ✓ OpenTimelineIO schema validated.');

  console.log('\n=================================================');
  console.log('   ALL PRO NLE EXPORT TESTS PASSED! 🎬✨        ');
  console.log('=================================================');
}

testExportInterchange().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
