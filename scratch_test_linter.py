import subprocess
import os
import sys

# 1. Generate clean 10s video
clean_file = "/tmp/clean.mp4"
defective_file = "/tmp/defective.mp4"

print("1. Generating 10s synthetic baseline video...")
subprocess.run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "testsrc=duration=10:size=640x360:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=1000:duration=10",
    "-c:v", "libx264", "-c:a", "aac",
    clean_file
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# 2. Inject Black Frames (between 2s and 3.5s = 1.5s black) and Audio Dropout (between 6s and 7.5s = 1.5s silence)
print("2. Injecting known defects: Black frames (2.0s-3.5s) and Audio silence (6.0s-7.5s)...")
subprocess.run([
    "ffmpeg", "-y",
    "-i", clean_file,
    "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,2.0,3.5)'",
    "-af", "volume=enable='between(t,6.0,7.5)':volume=0",
    "-c:v", "libx264", "-c:a", "aac",
    defective_file
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

print("3. Running TakePicker Video Linter (apps/lint/lint.py)...")
sys.path.insert(0, "/app/lint")
from lint import run_lint, load_config, get_video_duration

config = load_config("/app/lint/config.yaml")
findings = run_lint(defective_file, config)

print(f"\n================ LINTER FINDINGS ({len(findings)} found) ================")
for f in findings:
    icon = "❌" if f["severity"] == "error" else "⚠️"
    print(f"{icon} [{f['check']}] {f['start']:.2f}s - {f['end']:.2f}s: {f['message']}")

print("=================================================================\n")
