import { Asset, Timeline, ExportOptions } from '../../../../packages/contracts';

/**
 * Utility: Convert seconds to standard SMPTE timecode (HH:MM:SS:FF)
 */
export function secondsToTimecode(seconds: number, fps: number = 30): string {
  const safeFps = fps > 0 ? fps : 30;
  const totalFrames = Math.max(0, Math.round(seconds * safeFps));
  const intFps = Math.round(safeFps);
  const ff = totalFrames % intFps;
  const totalSec = Math.floor(totalFrames / intFps);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

/**
 * Utility: Convert seconds to frame count
 */
export function secondsToFrames(seconds: number, fps: number = 30): number {
  return Math.max(0, Math.round(seconds * (fps > 0 ? fps : 30)));
}

/**
 * Utility: Escape XML special characters
 */
export function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate CMX 3600 Edit Decision List (EDL)
 * Compatible with DaVinci Resolve, Adobe Premiere Pro, Apple Final Cut Pro, Avid Media Composer.
 */
export function generateEDL(
  asset: Asset,
  timeline: Timeline,
  options?: ExportOptions
): string {
  const fps = timeline.fps || asset.fps || 30;
  const title = (options?.sequenceName || 'TAKEPICKER_ROUGH_CUT')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 32);

  const lines: string[] = [
    `TITLE: ${title}`,
    'FCM: NON-DROP FRAME',
    '',
  ];

  let currentRecordSec = 0;
  const filename = asset.filename || 'source.mp4';

  timeline.clips.forEach((clip, idx) => {
    const eventNum = String(idx + 1).padStart(3, '0');
    const clipDur = Math.max(0, clip.out - clip.in);

    const srcInTC = secondsToTimecode(clip.in, fps);
    const srcOutTC = secondsToTimecode(clip.out, fps);
    const recInTC = secondsToTimecode(currentRecordSec, fps);
    const recOutTC = secondsToTimecode(currentRecordSec + clipDur, fps);

    // Video cut line
    lines.push(`${eventNum}  AX       V     C        ${srcInTC} ${srcOutTC} ${recInTC} ${recOutTC}`);
    lines.push(`* FROM CLIP NAME: ${filename}`);
    if (clip.reason || clip.text) {
      const comment = (clip.reason || clip.text || '').replace(/\r?\n/g, ' ').slice(0, 120);
      lines.push(`* COMMENT: ${comment}`);
    }

    // Audio cuts line (AA = stereo audio)
    lines.push(`${eventNum}  AX       AA    C        ${srcInTC} ${srcOutTC} ${recInTC} ${recOutTC}`);
    lines.push(`* FROM CLIP NAME: ${filename}`);
    lines.push('');

    currentRecordSec += clipDur;
  });

  return lines.join('\r\n');
}

/**
 * Generate Apple Final Cut Pro 7 XML / Adobe Premiere Pro XML (XMEML v5)
 * Compatible with Adobe Premiere Pro CC (all versions), DaVinci Resolve, Final Cut Pro.
 */
export function generatePremiereXML(
  asset: Asset,
  timeline: Timeline,
  options?: ExportOptions
): string {
  const fps = Math.round(timeline.fps || asset.fps || 30);
  const width = asset.width || 1920;
  const height = asset.height || 1080;
  const filename = escapeXml(asset.filename || 'source.mp4');
  const seqName = escapeXml(options?.sequenceName || 'TakePicker Rough Cut');
  const isNtsc = fps === 24 || fps === 30 || fps === 60 ? 'FALSE' : 'FALSE';

  const assetDurationSec = asset.duration || 3600;
  const assetDurationFrames = secondsToFrames(assetDurationSec, fps);

  let totalTimelineFrames = 0;
  const clipitemsVideo: string[] = [];
  const clipitemsAudio1: string[] = [];
  const clipitemsAudio2: string[] = [];

  let currentTlFrame = 0;

  timeline.clips.forEach((clip, idx) => {
    const clipIndex = idx + 1;
    const clipDurationFrames = Math.max(1, secondsToFrames(clip.out - clip.in, fps));
    const srcInFrame = secondsToFrames(clip.in, fps);
    const srcOutFrame = secondsToFrames(clip.out, fps);
    const tlStartFrame = currentTlFrame;
    const tlEndFrame = currentTlFrame + clipDurationFrames;

    const clipName = escapeXml(clip.id || `Clip_${clipIndex}`);
    const note = escapeXml(clip.reason || clip.text || `Take ${clipIndex}`);

    // Video clipitem
    clipitemsVideo.push(`
            <clipitem id="clipitem-v-${clipIndex}">
              <name>${clipName}</name>
              <duration>${assetDurationFrames}</duration>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>${isNtsc}</ntsc>
              </rate>
              <start>${tlStartFrame}</start>
              <end>${tlEndFrame}</end>
              <in>${srcInFrame}</in>
              <out>${srcOutFrame}</out>
              <file id="file-1">
                <name>${filename}</name>
                <pathurl>file://localhost/${filename}</pathurl>
                <rate>
                  <timebase>${fps}</timebase>
                  <ntsc>${isNtsc}</ntsc>
                </rate>
                <duration>${assetDurationFrames}</duration>
                <media>
                  <video>
                    <samplecharacteristics>
                      <width>${width}</width>
                      <height>${height}</height>
                    </samplecharacteristics>
                  </video>
                  <audio>
                    <samplecharacteristics>
                      <depth>16</depth>
                      <samplerate>48000</samplerate>
                    </samplecharacteristics>
                    <channelcount>2</channelcount>
                  </audio>
                </media>
              </file>
              <labels>
                <label2>Iris</label2>
              </labels>
              <comments>
                <mastercomment1>${note}</mastercomment1>
              </comments>
            </clipitem>`);

    // Audio Track 1 clipitem
    clipitemsAudio1.push(`
            <clipitem id="clipitem-a1-${clipIndex}">
              <name>${clipName}</name>
              <duration>${assetDurationFrames}</duration>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>${isNtsc}</ntsc>
              </rate>
              <start>${tlStartFrame}</start>
              <end>${tlEndFrame}</end>
              <in>${srcInFrame}</in>
              <out>${srcOutFrame}</out>
              <file id="file-1" />
              <sourcetrack>
                <mediatype>audio</mediatype>
                <trackindex>1</trackindex>
              </sourcetrack>
            </clipitem>`);

    // Audio Track 2 clipitem
    clipitemsAudio2.push(`
            <clipitem id="clipitem-a2-${clipIndex}">
              <name>${clipName}</name>
              <duration>${assetDurationFrames}</duration>
              <rate>
                <timebase>${fps}</timebase>
                <ntsc>${isNtsc}</ntsc>
              </rate>
              <start>${tlStartFrame}</start>
              <end>${tlEndFrame}</end>
              <in>${srcInFrame}</in>
              <out>${srcOutFrame}</out>
              <file id="file-1" />
              <sourcetrack>
                <mediatype>audio</mediatype>
                <trackindex>2</trackindex>
              </sourcetrack>
            </clipitem>`);

    currentTlFrame = tlEndFrame;
  });

  totalTimelineFrames = currentTlFrame;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-1">
    <name>${seqName}</name>
    <duration>${totalTimelineFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>${isNtsc}</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${fps}</timebase>
        <ntsc>${isNtsc}</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>square</pixelaspectratio>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>${isNtsc}</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>${clipitemsVideo.join('')}
        </track>
      </video>
      <audio>
        <track>${clipitemsAudio1.join('')}
        </track>
        <track>${clipitemsAudio2.join('')}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
`;
}

/**
 * Generate Apple Final Cut Pro XML (FCPXML v1.9)
 * Compatible with Final Cut Pro X / 10.x, DaVinci Resolve 16/17/18/19.
 */
export function generateFCPXML(
  asset: Asset,
  timeline: Timeline,
  options?: ExportOptions
): string {
  const fps = Math.round(timeline.fps || asset.fps || 30);
  const width = asset.width || 1920;
  const height = asset.height || 1080;
  const filename = escapeXml(asset.filename || 'source.mp4');
  const seqName = escapeXml(options?.sequenceName || 'TakePicker Rough Cut');
  const frameDur = `1/${fps}s`;

  const assetDurationSec = asset.duration || 3600;

  let currentOffsetSec = 0;
  const clipElements: string[] = [];

  timeline.clips.forEach((clip, idx) => {
    const clipDurSec = Math.max(0.01, clip.out - clip.in);
    const clipInSec = clip.in;
    const clipName = escapeXml(clip.id || `Clip ${idx + 1}`);
    const note = escapeXml(clip.reason || clip.text || '');

    clipElements.push(`
            <asset-clip ref="r2" offset="${currentOffsetSec.toFixed(3)}s" name="${clipName}" duration="${clipDurSec.toFixed(3)}s" start="${clipInSec.toFixed(3)}s" format="r1">
              <note>${note}</note>
              <marker start="${clipInSec.toFixed(3)}s" duration="${frameDur}" value="Best Take" note="${note}" />
            </asset-clip>`);

    currentOffsetSec += clipDurSec;
  });

  const totalDurationSec = currentOffsetSec.toFixed(3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat${height}p${fps}" frameDuration="${frameDur}" width="${width}" height="${height}" />
    <asset id="r2" name="${filename}" src="file://localhost/${filename}" start="0s" duration="${assetDurationSec.toFixed(3)}s" hasVideo="1" hasAudio="1" format="r1" audioSources="1" audioChannels="2" audioRate="48000" />
  </resources>
  <library>
    <event name="TakePicker Cuts">
      <project name="${seqName}">
        <sequence format="r1" duration="${totalDurationSec}s" tcStart="0s" tcFormat="NDF">
          <spine>${clipElements.join('')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

/**
 * Generate OpenTimelineIO (OTIO) JSON
 * Open-source interchange for modern studios, VFX pipelines, Blender, and Unreal Engine.
 */
export function generateOTIO(
  asset: Asset,
  timeline: Timeline,
  options?: ExportOptions
): Record<string, any> {
  const fps = Math.round(timeline.fps || asset.fps || 30);
  const filename = asset.filename || 'source.mp4';
  const seqName = options?.sequenceName || 'TakePicker Rough Cut';

  const videoClips = timeline.clips.map((clip, idx) => {
    const startFrame = secondsToFrames(clip.in, fps);
    const durFrames = Math.max(1, secondsToFrames(clip.out - clip.in, fps));

    return {
      OTIO_SCHEMA: 'Clip.1',
      name: clip.id || `Clip_${idx + 1}`,
      source_range: {
        OTIO_SCHEMA: 'TimeRange.1',
        start_time: {
          OTIO_SCHEMA: 'RationalTime.1',
          value: startFrame,
          rate: fps,
        },
        duration: {
          OTIO_SCHEMA: 'RationalTime.1',
          value: durFrames,
          rate: fps,
        },
      },
      media_reference: {
        OTIO_SCHEMA: 'ExternalReference.1',
        name: filename,
        target_url: `file://localhost/${filename}`,
      },
      metadata: {
        takepicker: {
          take_reason: clip.reason || '',
          transcript_text: clip.text || '',
          group_id: clip.groupId || null,
        },
      },
    };
  });

  return {
    OTIO_SCHEMA: 'Timeline.1',
    metadata: {
      generator: 'TakePicker AI 2.0 Pro Exporter',
    },
    name: seqName,
    global_start_time: {
      OTIO_SCHEMA: 'RationalTime.1',
      value: 0,
      rate: fps,
    },
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      children: [
        {
          OTIO_SCHEMA: 'Track.1',
          name: 'Video Track',
          kind: 'Video',
          children: videoClips,
        },
        {
          OTIO_SCHEMA: 'Track.1',
          name: 'Audio Track',
          kind: 'Audio',
          children: videoClips.map((clip) => ({
            ...clip,
            name: `${clip.name} (Audio)`,
          })),
        },
      ],
    },
  };
}
