#!/usr/bin/env python3
"""
Generate a 5-minute test talking-head MP4 video with authentic speech retakes
for benchmarking parallel FFmpeg worker scaling (1, 2, 4, 6 workers).
"""

import os
import urllib.parse
import urllib.request
import subprocess

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "samples"))
os.makedirs(OUT_DIR, exist_ok=True)
TMP_DIR = "/tmp/tp_benchmark_5min"
os.makedirs(TMP_DIR, exist_ok=True)

# 12 talking-head paragraphs with intentional retakes, false starts, and stumbles
# repeating across ~5 minutes (300 seconds)
script_blocks = [
    # Topic 1: Introduction
    ("Umm, hey guys, so today we're going to... wait, no, let me restart.", True),
    ("Hello everyone, welcome back to the channel. Today we're diving deep into distributed video rendering architectures.", False),
    
    # Topic 2: Problem definition
    ("Traditional video editors like Premiere and DaVinci Resolve render everything, uh, sequentially on one thread.", False),
    ("When you have a ten minute video, you wait ten to fifteen minutes just watching an export bar crawl.", False),

    # Topic 3: Retakes problem
    ("And the worst part is editing retakes. Like, whenever I stumble, sorry, take two.", True),
    ("And the worst part is editing retakes. Whenever a creator stumbles, they repeat the same sentence two or three times.", False),
    
    # Topic 4: How TakePicker works
    ("TakePicker automates this entire first pass using AI audio analysis and frame-accurate timeline cuts.", False),
    ("First, we extract a keyframe-dense proxy and clean mono audio at sixteen kilohertz for Whisper.", False),

    # Topic 5: Whisper prompt conditioning
    ("Whisper normally cleans up disfluencies, so we use an initial prompt to keep filler words intact.", False),
    ("Then a Sentence Transformer clusters sentences that convey the same intended idea.", False),

    # Topic 6: Scoring heuristics
    ("Each take is evaluated on filler word frequency, speech rate, and trailing pause length.", False),
    ("The highest scoring take is chosen automatically, and stumbles are pruned from the final cut.", False),

    # Topic 7: Distributed fan-out
    ("Uh, for the export, we use... wait, let me rephrase that cleanly.", True),
    ("For the export engine, we fan out each timeline cut into independent background jobs across a worker pool.", False),
    ("Each segment is encoded with matching parameters and fifteen millisecond audio micro-fades to eliminate clicks.", False),

    # Topic 8: Final merge & Conclusion
    ("Once all parallel segments finish rendering, a parent merge job joins them losslessly using FFmpeg stream copy.", False),
    ("This turns a ten minute export into a thirty second parallel job across multiple CPU cores.", False),
    ("Thank you for watching this benchmark demonstration, and let's inspect the performance results.", False)
]

audio_files = []
idx = 0

for text, is_retake in script_blocks:
    idx += 1
    # 1. Speech audio
    speech_file = os.path.join(TMP_DIR, f"speech_{idx:02d}.mp3")
    url = "https://translate.google.com/translate_tts?ie=UTF-8&q=" + urllib.parse.quote(text) + "&tl=en&client=tw-ob"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(speech_file, "wb") as f:
        f.write(resp.read())
    audio_files.append(speech_file)

    # 2. Add realistic conversational pause (1.2s to 1.8s)
    silence_file = os.path.join(TMP_DIR, f"silence_{idx:02d}.mp3")
    pause_dur = "2.0" if is_retake else "1.2"
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
        "-t", pause_dur, "-q:a", "9", "-acodec", "libmp3lame", silence_file
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    audio_files.append(silence_file)

# Repeat the pattern twice to make a solid ~5 minute realistic multi-take footage
all_audio = audio_files + audio_files

concat_list = os.path.join(TMP_DIR, "audio_list.txt")
with open(concat_list, "w") as f:
    for a in all_audio:
        f.write(f"file '{a}'\n")

full_audio = os.path.join(TMP_DIR, "full_audio.wav")
subprocess.run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
    "-ac", "1", "-ar", "16000", full_audio
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

out_video = os.path.join(OUT_DIR, "benchmark_5min.mp4")

print("Rendering 5-minute benchmark video canvas (1080p @ 30fps)...")
ffmpeg_cmd = [
    "ffmpeg", "-y",
    "-i", full_audio,
    "-f", "lavfi", "-i", "color=c=#090d16:s=1920x1080:r=30",
    "-filter_complex",
    "[0:a]showwaves=s=1600x260:mode=line:colors=#6366f1|#ec4899[wave];"
    "[1:v][wave]overlay=(W-w)/2:(H-h)/2+180[bg];"
    "[bg]drawtext=text='TakePicker Benchmark Footage':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=200,"
    "drawtext=text='Multi-Take Talking-Head Sample (1080p @ 30fps)':fontcolor=#94a3b8:fontsize=28:x=(w-text_w)/2:y=280,"
    "drawtext=text='%{pts\\:hms}':fontcolor=#38bdf8:fontsize=48:x=(w-text_w)/2:y=820[v]",
    "-map", "[v]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    out_video
]

subprocess.run(ffmpeg_cmd, check=True)
print("Benchmark clip successfully created at:", out_video)
