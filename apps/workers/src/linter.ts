import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import type { LintFinding, Word } from "../../../packages/contracts";

export interface LinterOptions {
  blackMinDuration?: number;
  blackPicTh?: number;
  freezeNoiseDb?: number;
  freezeMinDuration?: number;
  silenceNoiseDb?: number;
  silenceMinDuration?: number;
  loudnessDeltaTh?: number;
}

export interface LinterExecutionResult {
  defectCount: number;
  findings: LintFinding[];
  duration: number;
  lintTimeSec: number;
  passed: boolean;
}

/**
 * Single-Pass Video Linter
 * Executes technical defect detection across video and audio filters simultaneously in one decode pass.
 */
export async function runVideoLinter(
  videoPath: string,
  words: Word[] = [],
  options: LinterOptions = {}
): Promise<LinterExecutionResult> {
  const startTime = Date.now();

  const blackMinDur = options.blackMinDuration ?? 0.05;
  const blackPicTh = options.blackPicTh ?? 0.98;
  const freezeNoiseDb = options.freezeNoiseDb ?? -60;
  const freezeMinDur = options.freezeMinDuration ?? 0.4;
  const silenceNoiseDb = options.silenceNoiseDb ?? -50;
  const silenceMinDur = options.silenceMinDuration ?? 0.08;
  const loudnessDeltaTh = options.loudnessDeltaTh ?? 6.0;

  // 1. Probe video duration
  let duration = 0;
  try {
    const probeProc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "json",
      videoPath,
    ]);
    let probeStdout = "";
    probeProc.stdout.on("data", (d) => (probeStdout += d.toString()));
    await new Promise((res, rej) => {
      probeProc.on("close", (code) => (code === 0 ? res(null) : rej(new Error(`ffprobe failed with ${code}`))));
    });
    const parsed = JSON.parse(probeStdout);
    duration = parseFloat(parsed.format?.duration || "0");
  } catch (e) {
    duration = 0;
  }

  // 2. Chained video & audio filters in ONE decode pass
  const vf = `blackdetect=d=${blackMinDur}:pic_th=${blackPicTh},freezedetect=n=${freezeNoiseDb}dB:d=${freezeMinDur}`;
  const af = `silencedetect=n=${silenceNoiseDb}dB:d=${silenceMinDur},ebur128=peak=true`;

  const ffmpeg = spawn("ffmpeg", [
    "-v", "info",
    "-i", videoPath,
    "-vf", vf,
    "-af", af,
    "-f", "null",
    "-",
  ]);

  let stderr = "";
  ffmpeg.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  await new Promise((resolve) => {
    ffmpeg.on("close", () => resolve(null));
  });

  const findings: LintFinding[] = [];

  // --- D1: Parse Black Frames ---
  // Format: [blackdetect @ ...] black_start:10.123 black_end:10.623 black_duration:0.500
  const blackRegex = /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g;
  let match: RegExpExecArray | null;
  const blackSpans: Array<{ start: number; end: number }> = [];

  while ((match = blackRegex.exec(stderr)) !== null) {
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    const dur = parseFloat(match[3]);

    blackSpans.push({ start, end });
    findings.push({
      check: "D1_black_frames",
      severity: dur >= 0.25 ? "error" : "warn",
      start,
      end,
      message: `Black frames detected from ${start.toFixed(2)}s to ${end.toFixed(2)}s (${dur.toFixed(2)}s duration)`,
      suggestedFix: {
        action: "trim_or_cut_range",
        suggestedBoundary: start,
      },
    });
  }

  // --- D2: Parse Frozen Video ---
  // Format: [freezedetect @ ...] lavfi.freezedetect.freeze_start: 12.34 ... freeze_end: 13.56
  const freezeStartRegex = /lavfi\.freezedetect\.freeze_start:\s*([\d.]+)/g;
  const freezeEndRegex = /lavfi\.freezedetect\.freeze_end:\s*([\d.]+)/g;
  const freezeStarts: number[] = [];
  const freezeEnds: number[] = [];

  while ((match = freezeStartRegex.exec(stderr)) !== null) {
    freezeStarts.push(parseFloat(match[1]));
  }
  while ((match = freezeEndRegex.exec(stderr)) !== null) {
    freezeEnds.push(parseFloat(match[1]));
  }

  for (let i = 0; i < freezeStarts.length; i++) {
    const start = freezeStarts[i];
    const end = freezeEnds[i] ?? (i + 1 < freezeStarts.length ? freezeStarts[i + 1] : duration || start + 0.5);
    const dur = end - start;

    // Suppress freeze detections that overlap with black frames
    const overlapsBlack = blackSpans.some(
      (b) => start <= b.end + 0.15 && end >= b.start - 0.15
    );

    if (!overlapsBlack && dur >= freezeMinDur) {
      findings.push({
        check: "D2_frozen_video",
        severity: dur >= 1.0 ? "error" : "warn",
        start,
        end,
        message: `Frozen video frames detected from ${start.toFixed(2)}s to ${end.toFixed(2)}s (${dur.toFixed(2)}s duration)`,
        suggestedFix: {
          action: "replace_with_alternative_take",
        },
      });
    }
  }

  // --- D3: Parse Audio Dropout / Silence ---
  // Format: [silencedetect @ ...] silence_start: 5.123 ... silence_end: 6.456 | silence_duration: 1.333
  const silenceRegex = /silence_start:\s*([\d.]+)(?:[\s\S]*?silence_end:\s*([\d.]+))?/g;
  const silenceSpans: Array<{ start: number; end: number }> = [];

  while ((match = silenceRegex.exec(stderr)) !== null) {
    const start = parseFloat(match[1]);
    const end = match[2] ? parseFloat(match[2]) : start + 0.5;
    const dur = end - start;

    if (dur >= silenceMinDur) {
      // Context-aware speech check: distinguish natural pauses between sentences from dropouts mid-speech
      let isMidSpeech = true;
      if (words && words.length > 0) {
        // Check if silence is inside a sentence or in the natural gap between sentences
        const precedingWord = words.filter((w) => w.end <= start + 0.05).pop();
        const succeedingWord = words.find((w) => w.start >= end - 0.05);

        if (precedingWord && succeedingWord) {
          const gap = succeedingWord.start - precedingWord.end;
          // If natural gap between sentences (> 0.8s) and silence fits in the gap, consider normal
          if (gap > 0.8 && start >= precedingWord.end - 0.05 && end <= succeedingWord.start + 0.05) {
            isMidSpeech = false;
          }
        }
      }

      if (isMidSpeech) {
        silenceSpans.push({ start, end });
        findings.push({
          check: "D3_audio_dropout",
          severity: dur >= 0.4 ? "error" : "warn",
          start,
          end,
          message: `Unexpected audio dropout / silence detected from ${start.toFixed(2)}s to ${end.toFixed(2)}s (${dur.toFixed(2)}s duration)`,
          suggestedFix: {
            action: "trim_pause_or_micro_fade",
          },
        });
      }
    }
  }

  // --- D4: Parse Loudness Jumps ---
  // Format: [Parsed_ebur128_... @ ...] t: 12.345 M: -18.2 S: -20.1
  const eburRegex = /t:\s*([\d.]+)\s+M:\s*([-\d.]+)/g;
  let prevM: number | null = null;
  let prevT: number | null = null;

  while ((match = eburRegex.exec(stderr)) !== null) {
    const t = parseFloat(match[1]);
    const m = parseFloat(match[2]);

    if (prevM !== null && prevT !== null && isFinite(m) && isFinite(prevM)) {
      const delta = Math.abs(m - prevM);
      const timeDelta = t - prevT;

      // Jumps occurring within 0.3s of an audio dropout edge are secondary artifacts; suppress them
      const nearDropout = silenceSpans.some(
        (s) => Math.abs(t - s.start) < 0.35 || Math.abs(t - s.end) < 0.35
      );

      if (delta >= loudnessDeltaTh && timeDelta <= 0.4 && !nearDropout) {
        findings.push({
          check: "D4_loudness_jump",
          severity: delta >= 10 ? "error" : "warn",
          start: Math.max(0, prevT),
          end: t,
          message: `Sudden loudness jump of ${delta.toFixed(1)} LU detected at ${t.toFixed(2)}s`,
          suggestedFix: {
            action: "apply_audio_microfade_or_volume_leveling",
          },
        });
        // Cooldown so we don't repeat on adjacent ebur frames
        prevM = m;
        prevT = t + 0.5;
        continue;
      }
    }

    prevM = m;
    prevT = t;
  }

  const elapsedSec = (Date.now() - startTime) / 1000;
  const hasErrors = findings.some((f) => f.severity === "error");

  return {
    defectCount: findings.length,
    findings,
    duration,
    lintTimeSec: elapsedSec,
    passed: !hasErrors,
  };
}
