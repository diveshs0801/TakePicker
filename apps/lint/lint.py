
"""
TakePicker Video Linter — Main CLI + orchestrator.
Runs all FFmpeg-based checks in a single decode pass and returns structured findings.

Usage:
  python apps/lint/lint.py clip.mp4 --out findings.json
  python apps/lint/lint.py clip.mp4 --timeline timeline.json --words words.json --out findings.json
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import yaml

from checks.black_frames import parse_black_frames
from checks.frozen_video import parse_frozen_video
from checks.audio_dropout import parse_audio_dropout
from checks.loudness_jump import parse_loudness_jump
from checks.av_sync import check_av_sync
from checks.word_cutoff import check_word_cutoffs


def load_config(config_path: str = None) -> dict:
    """Load detection thresholds from config.yaml."""
    if config_path is None:
        config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def get_video_duration(filepath: str) -> float:
    """Get video duration via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        filepath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def run_single_pass(filepath: str, config: dict) -> str:
    """
    Run all FFmpeg filter-based checks in ONE decode pass.
    Returns the raw stderr output for parsing.
    
    This is the key optimization: instead of decoding the video N times
    (once per check), we chain all detection filters together so the
    video is decoded exactly once.
    """
    bf = config["black_frames"]
    fv = config["frozen_video"]
    ad = config["audio_dropout"]

    # Video filters: blackdetect + freezedetect in chain
    vf = (
        f"blackdetect=d={bf['min_duration']}:pic_th={bf['pic_th']},"
        f"freezedetect=n={fv['noise_db']}dB:d={fv['min_duration']}"
    )

    # Audio filters: silencedetect + ebur128 (for loudness analysis)
    af = (
        f"silencedetect=n={ad['noise_db']}dB:d={ad['min_duration']},"
        f"ebur128=peak=true"
    )

    cmd = [
        "ffmpeg",
        "-i", filepath,
        "-vf", vf,
        "-af", af,
        "-f", "null",
        "-"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    # FFmpeg writes filter output to stderr
    return result.stderr


def load_word_timestamps(words_path: str) -> list[dict] | None:
    """Load Whisper word timestamps for context-aware checks."""
    if words_path is None or not os.path.exists(words_path):
        return None
    with open(words_path, "r") as f:
        return json.load(f)


def load_timeline(timeline_path: str) -> dict | None:
    """Load timeline JSON for join-point checks."""
    if timeline_path is None or not os.path.exists(timeline_path):
        return None
    with open(timeline_path, "r") as f:
        return json.load(f)


def is_inside_speech(start: float, end: float, words: list[dict],
                     tolerance: float = 0.3) -> bool:
    """
    Check if a time range falls inside a speech span.
    A speech span is defined as time between two words that are
    within `tolerance` seconds of each other.
    
    This is the context-aware rule that distinguishes a real defect
    (dropout inside a sentence) from a natural pause between sentences.
    """
    if not words:
        return True  # No context = assume defect (conservative)

    for i in range(len(words) - 1):
        word_end = words[i].get("end", 0)
        next_word_start = words[i + 1].get("start", 0)

        # If the gap between consecutive words is small, this is continuous speech
        if next_word_start - word_end < tolerance:
            # Check if our defect falls within this speech span
            speech_start = words[i].get("start", 0)
            speech_end = words[i + 1].get("end", 0)
            if start >= speech_start - 0.1 and end <= speech_end + 0.1:
                return True

    return False


def run_lint(filepath: str, config: dict,
             words: list[dict] | None = None,
             timeline: dict | None = None) -> list[dict]:
    """
    Run all linter checks and return structured findings.
    
    Each finding: {
        "check": "D1_black_frames",
        "severity": "error" | "warn",
        "start": float,
        "end": float,
        "message": str,
        "suggestedFix": dict | None
    }
    """
    findings = []

    # --- Single-pass FFmpeg detection ---
    stderr = run_single_pass(filepath, config)

    # D1: Black frames
    black_findings = parse_black_frames(stderr, config["black_frames"])
    findings.extend(black_findings)

    # D2: Frozen video (suppress detections that overlap with black frames)
    raw_freeze_findings = parse_frozen_video(stderr, config["frozen_video"])
    for ff in raw_freeze_findings:
        overlaps_black = any(
            (ff["start"] <= bf["end"] + 0.15 and ff["end"] >= bf["start"] - 0.15)
            for bf in black_findings
        )
        if not overlaps_black:
            findings.append(ff)

    # D3: Audio dropout (context-aware)
    silence_findings = parse_audio_dropout(
        stderr, config["audio_dropout"], words
    )
    findings.extend(silence_findings)

    # D4: Loudness jump (suppress edge jumps that coincide with audio dropout edges)
    raw_loudness_findings = parse_loudness_jump(
        stderr, config["loudness_jump"]
    )
    for lf in raw_loudness_findings:
        overlaps_dropout = any(
            abs(lf["start"] - sf["start"]) < 0.3 or abs(lf["end"] - sf["end"]) < 0.3
            for sf in silence_findings
        )
        if not overlaps_dropout:
            findings.append(lf)

    # D5: A/V Sync check
    av_sync_finding = check_av_sync(filepath)
    if av_sync_finding:
        findings.append({
            "check": "D5_av_desync",
            "severity": "warn" if av_sync_finding["offset_ms"] < 100 else "error",
            "start": 0.0,
            "end": 0.0,
            "message": av_sync_finding["message"],
            "suggestedFix": {"action": "shift_audio", "offset_ms": av_sync_finding["offset_ms"]}
        })

    # D7: Word cutoff check (if timeline and words are available)
    if timeline and words:
        segments = timeline.get("segments", timeline.get("clips", []))
        cutoff_findings = check_word_cutoffs(segments, words)
        for cf in cutoff_findings:
            findings.append({
                "check": "D7_word_cutoff",
                "severity": "error",
                "start": cf["time"],
                "end": cf["time"],
                "message": f"Boundary cut inside spoken word '{cf['word']}' at {cf['time']}s",
                "suggestedFix": {"action": "snap_to_word_boundary", "target_time": cf["word_start"]}
            })

    return findings


def main():
    parser = argparse.ArgumentParser(
        description="TakePicker Video Linter — detect technical defects"
    )
    parser.add_argument("input", help="Path to video file")
    parser.add_argument("--config", help="Path to config.yaml", default=None)
    parser.add_argument("--timeline", help="Path to timeline JSON", default=None)
    parser.add_argument("--words", help="Path to Whisper word timestamps JSON", default=None)
    parser.add_argument("--out", help="Output findings JSON path", default=None)
    parser.add_argument("--verbose", action="store_true", help="Print raw FFmpeg output")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    config = load_config(args.config)
    words = load_word_timestamps(args.words)
    timeline = load_timeline(args.timeline)

    # Get duration for runtime reporting
    duration = get_video_duration(args.input)

    print(f"Linting: {args.input} ({duration:.1f}s)")
    t0 = time.time()

    findings = run_lint(args.input, config, words, timeline)

    elapsed = time.time() - t0
    speed = elapsed / duration if duration > 0 else 0

    print(f"Done in {elapsed:.2f}s ({speed:.2f}x realtime)")
    print(f"Findings: {len(findings)}")

    for f in findings:
        severity_icon = "❌" if f["severity"] == "error" else "⚠️"
        print(f"  {severity_icon} [{f['check']}] {f['start']:.2f}s–{f['end']:.2f}s: {f['message']}")

    # Write output
    result = {
        "file": args.input,
        "duration": duration,
        "lint_time_sec": round(elapsed, 3),
        "lint_speed_x": round(speed, 3),
        "findings_count": len(findings),
        "findings": findings
    }

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Written to {args.out}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
