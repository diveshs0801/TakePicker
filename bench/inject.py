"""
TakePicker Defect Injector — generates clips with known defects at known positions.

This is the foundation of the benchmark. Without known ground truth,
you cannot measure precision and recall.

Usage:
  python bench/inject.py --base-dir samples/ --out-dir bench/injected/ --manifest bench/manifest.json

Each base clip gets one injected version per (defect_type, severity) combination,
plus one clean control copy. Injection positions are seeded for reproducibility.

Verify every injected file by playing it. A wrong injector invalidates the whole benchmark.
"""

import argparse
import json
import os
import random
import subprocess
import sys
from pathlib import Path


# Defect definitions: each has a type, severities, and an injection function
DEFECTS = {
    "D1": {
        "name": "black_frames",
        "severities": [0.1, 0.25, 0.5, 1.0],  # duration in seconds
        "unit": "s"
    },
    "D2": {
        "name": "frozen_video",
        "severities": [0.5, 1.0, 2.0],  # duration in seconds
        "unit": "s"
    },
    "D3": {
        "name": "audio_dropout",
        "severities": [0.1, 0.3, 1.0],  # duration in seconds
        "unit": "s"
    },
    "D4": {
        "name": "loudness_jump",
        "severities": [3, 6, 10],  # gain change in dB
        "unit": "dB"
    },
}


def get_duration(filepath: str) -> float:
    """Get video duration via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        filepath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed on {filepath}: {result.stderr}")
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def pick_injection_time(duration: float, defect_duration: float,
                        rng: random.Random) -> float:
    """
    Pick a random injection start time, avoiding the first and last 2 seconds
    (where defects would be at boundaries and harder to detect).
    """
    margin = 2.0
    safe_start = margin
    safe_end = duration - margin - defect_duration

    if safe_end <= safe_start:
        # Clip is too short, use midpoint
        return max(0, duration / 2 - defect_duration / 2)

    return round(rng.uniform(safe_start, safe_end), 3)


def inject_d1_black_frames(input_path: str, output_path: str,
                           start: float, severity: float) -> dict:
    """
    D1: Overlay black frames for `severity` seconds starting at `start`.
    Uses drawbox filter to paint all pixels black within the time range.
    """
    end = start + severity
    vf = (
        f"drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:"
        f"enable='between(t,{start},{end})'"
    )
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", vf,
        "-c:a", "copy",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"D1 injection failed: {result.stderr[-500:]}")

    return {"type": "D1", "start": start, "end": round(end, 3),
            "severity": f"{severity}s"}


def inject_d2_frozen_video(input_path: str, output_path: str,
                           start: float, severity: float, fps: float = 30) -> dict:
    """
    D2: Freeze the video at `start` for `severity` seconds.
    Uses freezeframes filter in a complex filtergraph, preserving audio.
    """
    start_frame = int(start * fps)
    end_frame = int((start + severity) * fps)

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-filter_complex", f"[0:v][0:v]freezeframes=first={start_frame}:last={end_frame}:replace={start_frame}[v]",
        "-map", "[v]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-c:a", "copy",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"D2 injection failed: {result.stderr[-500:]}")

    end = start + severity
    return {"type": "D2", "start": start, "end": round(end, 3),
            "severity": f"{severity}s"}


def inject_d3_audio_dropout(input_path: str, output_path: str,
                            start: float, severity: float) -> dict:
    """
    D3: Mute audio for `severity` seconds starting at `start`.
    Uses volume filter with enable expression.
    """
    end = start + severity
    af = f"volume=enable='between(t,{start},{end})':volume=0"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-af", af,
        "-c:v", "copy",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"D3 injection failed: {result.stderr[-500:]}")

    return {"type": "D3", "start": start, "end": round(end, 3),
            "severity": f"{severity}s"}


def inject_d4_loudness_jump(input_path: str, output_path: str,
                            start: float, severity: float) -> dict:
    """
    D4: Raise loudness by `severity` dB for a 3-second span starting at `start`.
    Uses volume filter with enable expression.
    """
    span = 3.0  # 3-second span for loudness change
    end = start + span
    af = f"volume=enable='between(t,{start},{end})':volume={severity}dB"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-af", af,
        "-c:v", "copy",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"D4 injection failed: {result.stderr[-500:]}")

    return {"type": "D4", "start": start, "end": round(end, 3),
            "severity": f"+{severity}dB"}


# Map defect type to injection function
INJECTORS = {
    "D1": inject_d1_black_frames,
    "D2": inject_d2_frozen_video,
    "D3": inject_d3_audio_dropout,
    "D4": inject_d4_loudness_jump,
}


def copy_clean_control(input_path: str, output_path: str):
    """
    D8: Clean control — just copy the file (remux to normalize container).
    Used to measure false alarms.
    """
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-c", "copy",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Clean copy failed: {result.stderr[-500:]}")


def main():
    parser = argparse.ArgumentParser(
        description="Inject known defects into base clips for benchmarking"
    )
    parser.add_argument("--base-dir", required=True,
                        help="Directory containing base clips (MP4)")
    parser.add_argument("--out-dir", required=True,
                        help="Output directory for injected clips")
    parser.add_argument("--manifest", required=True,
                        help="Output manifest JSON path")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    parser.add_argument("--defects", nargs="+", default=["D1", "D2", "D3", "D4"],
                        help="Which defect types to inject")

    args = parser.parse_args()
    rng = random.Random(args.seed)

    base_dir = Path(args.base_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Find all MP4 files in base directory
    base_clips = sorted(base_dir.glob("*.mp4"))
    if not base_clips:
        print(f"No .mp4 files found in {base_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(base_clips)} base clips in {base_dir}")

    manifest = []
    total_generated = 0

    for clip_path in base_clips:
        clip_name = clip_path.stem
        duration = get_duration(str(clip_path))
        print(f"\n--- {clip_name} ({duration:.1f}s) ---")

        # Clean control (D8)
        clean_name = f"{clip_name}_D8_clean.mp4"
        clean_path = out_dir / clean_name
        print(f"  D8 clean control: {clean_name}")
        copy_clean_control(str(clip_path), str(clean_path))
        manifest.append({
            "file": clean_name,
            "base": clip_name,
            "defects": []
        })
        total_generated += 1

        # Inject each defect type at each severity
        for defect_id in args.defects:
            if defect_id not in DEFECTS:
                print(f"  Unknown defect type: {defect_id}, skipping")
                continue

            defect_info = DEFECTS[defect_id]
            injector = INJECTORS[defect_id]

            for sev in defect_info["severities"]:
                # Pick a defect duration for position calculation
                if defect_id in ("D1", "D2", "D3"):
                    defect_dur = sev
                else:
                    defect_dur = 3.0  # D4 uses a fixed 3s span

                inject_time = pick_injection_time(duration, defect_dur, rng)

                sev_label = f"{sev}{defect_info['unit']}"
                out_name = f"{clip_name}_{defect_id}_{sev_label}_t{inject_time:.1f}.mp4"
                out_path = out_dir / out_name

                print(f"  {defect_id} ({sev_label}) at {inject_time:.2f}s: {out_name}")

                try:
                    defect_record = injector(
                        str(clip_path), str(out_path),
                        inject_time, sev
                    )
                    manifest.append({
                        "file": out_name,
                        "base": clip_name,
                        "defects": [defect_record]
                    })
                    total_generated += 1
                except RuntimeError as e:
                    print(f"    ❌ FAILED: {e}", file=sys.stderr)
                    manifest.append({
                        "file": out_name,
                        "base": clip_name,
                        "defects": [{"type": defect_id, "error": str(e)}]
                    })

    # Write manifest
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n✅ Generated {total_generated} clips")
    print(f"📄 Manifest written to {args.manifest}")
    print(f"\n⚠️  VERIFY: Play a sample of injected files to confirm defects are real.")
    print(f"   A wrong injector invalidates the whole benchmark.")


if __name__ == "__main__":
    main()
