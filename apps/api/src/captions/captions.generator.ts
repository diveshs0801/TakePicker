import {
  Word,
  TimelineClip,
  TimelineWord,
  SubtitleCue,
  SubtitleStylePreset,
} from '../../../../packages/contracts';

/**
 * Convert seconds to SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const totalMs = Math.round(safeSec * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Convert seconds to WebVTT timestamp: HH:MM:SS.mmm
 */
export function formatVttTimestamp(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const totalMs = Math.round(safeSec * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Convert seconds to ASS timestamp: H:MM:SS.cc (centiseconds)
 */
export function formatAssTimestamp(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const totalCs = Math.round(safeSec * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
}

/**
 * Remap raw source-media word timestamps onto the rough-cut timeline sequence.
 * Filters out words that were cut and adjusts offsets relative to clip in-points.
 */
export function alignWordsToTimeline(
  clips: TimelineClip[],
  sourceWords: Word[]
): TimelineWord[] {
  const result: TimelineWord[] = [];
  let timelineCursor = 0;

  for (const clip of clips) {
    const clipDuration = Math.max(0, clip.out - clip.in);
    if (clipDuration <= 0) continue;

    // Find words that overlap with [clip.in, clip.out]
    const matchingWords = sourceWords.filter(
      (w) => w.end > clip.in && w.start < clip.out
    );

    for (const w of matchingWords) {
      // Clamp word start and end to clip boundaries
      const clampedStart = Math.max(clip.in, w.start);
      const clampedEnd = Math.min(clip.out, w.end);

      // Remap to timeline offset
      const timelineStart = timelineCursor + (clampedStart - clip.in);
      const timelineEnd = timelineCursor + (clampedEnd - clip.in);

      if (timelineEnd > timelineStart) {
        result.push({
          ...w,
          start: clampedStart,
          end: clampedEnd,
          timelineStart: Math.round(timelineStart * 1000) / 1000,
          timelineEnd: Math.round(timelineEnd * 1000) / 1000,
          clipId: clip.id,
        });
      }
    }

    timelineCursor += clipDuration;
  }

  // Sort chronologically
  result.sort((a, b) => a.timelineStart - b.timelineStart);
  return result;
}

/**
 * Group sequential timeline words into natural, readable subtitle phrases/cues.
 */
export function groupWordsIntoCues(
  words: TimelineWord[],
  maxWords = 6,
  maxChars = 36,
  maxPauseSec = 0.45
): SubtitleCue[] {
  if (words.length === 0) return [];

  const cues: SubtitleCue[] = [];
  let currentWords: TimelineWord[] = [];
  let cueIdx = 1;

  const flushCue = () => {
    if (currentWords.length === 0) return;
    const firstWord = currentWords[0];
    const lastWord = currentWords[currentWords.length - 1];

    cues.push({
      index: cueIdx++,
      start: firstWord.timelineStart,
      end: lastWord.timelineEnd,
      text: currentWords.map((w) => w.w.trim()).join(' '),
      words: [...currentWords],
    });
    currentWords = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = currentWords.length > 0 ? currentWords[currentWords.length - 1] : null;

    if (prevWord) {
      const pause = word.timelineStart - prevWord.timelineEnd;
      const currentChars = currentWords.reduce((acc, w) => acc + w.w.length + 1, 0);
      const prevEndedSentence = /[.!?]$/.test(prevWord.w.trim());

      const shouldBreak =
        prevEndedSentence ||
        pause > maxPauseSec ||
        currentWords.length >= maxWords ||
        currentChars + word.w.length > maxChars;

      if (shouldBreak) {
        flushCue();
      }
    }

    currentWords.push(word);
  }

  flushCue();
  return cues;
}

/**
 * Generate standard SubRip (.srt) subtitles
 */
export function generateSRT(cues: SubtitleCue[]): string {
  const blocks = cues.map((cue) => {
    const startTc = formatSrtTimestamp(cue.start);
    const endTc = formatSrtTimestamp(cue.end);
    return `${cue.index}\r\n${startTc} --> ${endTc}\r\n${cue.text}\r\n`;
  });

  return blocks.join('\r\n');
}

/**
 * Generate standard WebVTT (.vtt) subtitles
 */
export function generateVTT(cues: SubtitleCue[]): string {
  const header = 'WEBVTT\r\n\r\nNOTE Generated by TakePicker AI Subtitles Engine\r\n\r\n';
  const blocks = cues.map((cue) => {
    const startTc = formatVttTimestamp(cue.start);
    const endTc = formatVttTimestamp(cue.end);
    return `${cue.index}\r\n${startTc} --> ${endTc}\r\n${cue.text}\r\n`;
  });

  return header + blocks.join('\r\n');
}

/**
 * Generate Advanced SubStation Alpha (.ass) subtitles with Kinetic Karaoke Tags
 * Compatible with FFmpeg -vf ass=... and modern players (VLC, MPV, Aegisub).
 */
export function generateASS(
  cues: SubtitleCue[],
  options?: {
    stylePreset?: SubtitleStylePreset;
    title?: string;
  }
): string {
  const title = options?.title || 'TakePicker Kinetic Captions';
  const preset = options?.stylePreset || 'kinetic';

  // Style configurations
  // Colors in ASS are &HAABBGGRR (Hex format: Alpha, Blue, Green, Red)
  let styleLine = '';
  switch (preset) {
    case 'neon':
      // Cyan primary, Neon violet karaoke highlight, dark purple shadow
      styleLine =
        'Style: NeonGlow,Montserrat ExtraBold,70,&H00FFFF00,&H00FF00FF,&H00000000,&H80300030,-1,0,0,0,100,100,0,0,1,5,3,2,40,40,85,1';
      break;

    case 'modern':
      // Crisp white with subtle drop-shadow
      styleLine =
        'Style: ModernBold,Inter,64,&H00FFFFFF,&H00E0E0E0,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,80,1';
      break;

    case 'minimal':
      // Clean understated bottom subtitles
      styleLine =
        'Style: MinimalClean,Arial,52,&H00FFFFFF,&H00CCCCCC,&H00000000,&H60000000,0,0,0,0,100,100,0,0,1,3,1,2,40,40,75,1';
      break;

    case 'kinetic':
    default:
      // TikTok/Reels signature: Bold Arial Black, Vibrant Yellow (&H0000FFFF) active word highlight, thick dark outline
      styleLine =
        'Style: KineticKaraoke,Arial Black,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,40,40,90,1';
      break;
  }

  const styleName = styleLine.split(',')[0].replace('Style: ', '');

  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = cues.map((cue) => {
    const startTc = formatAssTimestamp(cue.start);
    const endTc = formatAssTimestamp(cue.end);

    // Build Karaoke tokens {\k<centiseconds>}Word
    let karaokeText = '';
    cue.words.forEach((w) => {
      const durCs = Math.max(5, Math.round((w.timelineEnd - w.timelineStart) * 100));
      karaokeText += `{\\k${durCs}}${w.w.trim()} `;
    });

    return `Dialogue: 0,${startTc},${endTc},${styleName},,0,0,0,,${karaokeText.trim()}`;
  });

  return header + dialogueLines.join('\r\n') + '\r\n';
}
