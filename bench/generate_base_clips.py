"""
Generate synthetic base clips for the defect benchmark dataset.
Creates diverse baseline videos in samples/ to run defect injection against.
"""

import os
import subprocess
import sys
from pathlib import Path


def generate_base_clips(output_dir: str):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    clips = [
        {
            "name": "clip1_interview.mp4",
            "duration": 20,
            "vf": "testsrc=duration=20:size=640x360:rate=30",
            # Audio: continuous clean 800Hz tone
            "af": "sine=frequency=800:duration=20"
        },
        {
            "name": "clip2_presentation.mp4",
            "duration": 20,
            "vf": "smptebars=duration=20:size=640x360:rate=30,drawtext=text='PRESENTER':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2",
            # Audio: continuous clean 440Hz A tone
            "af": "sine=frequency=440:duration=20"
        },
        {
            "name": "clip3_vlog.mp4",
            "duration": 20,
            "vf": "testsrc2=duration=20:size=640x360:rate=30",
            # Audio: alternating harmonics simulating voice frequencies
            "af": "aevalsrc='0.6*sin(300*2*PI*t)+0.4*sin(600*2*PI*t)':d=20:s=44100"
        }
    ]

    for c in clips:
        dest = out / c["name"]
        print(f"Creating baseline clip: {c['name']} ({c['duration']}s)...")
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", c["vf"],
            "-f", "lavfi", "-i", c["af"],
            "-c:v", "libx264", "-preset", "ultrafast",
            "-c:a", "aac",
            str(dest)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            # Fallback if drawtext or complex filter isn't supported without font
            if "drawtext" in c["vf"]:
                c["vf"] = "smptebars=duration=20:size=640x360:rate=30"
                cmd[4] = c["vf"]
                res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                print(f"Failed to generate {c['name']}: {res.stderr[-300:]}", file=sys.stderr)
                continue
        print(f"  ✅ Saved: {dest}")


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "samples"
    generate_base_clips(out_dir)
