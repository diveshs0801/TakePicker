#!/usr/bin/env python3
"""
Generate a test talking-head MP4 video with authentic speech retakes.
Uses TTS audio combined with a visual animated waveform canvas via FFmpeg.
"""

import os
import urllib.parse
import urllib.request
import subprocess

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "samples"))
os.makedirs(OUT_DIR, exist_ok=True)
TMP_DIR = "/tmp/tp_sample"
os.makedirs(TMP_DIR, exist_ok=True)

lines = [
    # Block 1 - Take 1 (stumble + cue phrase)
    ("b1_t1.mp3", "Umm, hello everyone, like, today we are going to talk about... uh... wait, let me redo that."),
    # Silence gap
    ("silence_1.mp3", None),
    # Block 1 - Take 2 (clean winning delivery)
    ("b1_t2.mp3", "Hello everyone, welcome back. Today we are going to explore modern video editing systems."),
    # Silence gap
    ("silence_2.mp3", None),
    # Block 2 - Take 1 (false start)
    ("b2_t1.mp3", "In this tutorial, I will, uh, explain... sorry, take two."),
    # Silence gap
    ("silence_3.mp3", None),
    # Block 2 - Take 2 (clean winning delivery)
    ("b2_t2.mp3", "In this tutorial, I will demonstrate how distributed video rendering pipelines work in the cloud."),
    # Silence gap
    ("silence_4.mp3", None),
    # Block 3 - Unique clean take
    ("b3_t1.mp3", "Thank you for watching, and let's jump right into the demo."),
]

audio_files = []

for filename, text in lines:
    filepath = os.path.join(TMP_DIR, filename)
    if text is None:
        # Generate 1.2s silence
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
            "-t", "1.2", "-q:a", "9", "-acodec", "libmp3lame", filepath
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    else:
        url = "https://translate.google.com/translate_tts?ie=UTF-8&q=" + urllib.parse.quote(text) + "&tl=en&client=tw-ob"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(filepath, "wb") as f:
            f.write(resp.read())
    audio_files.append(filepath)

# Concat all audio files
concat_list = os.path.join(TMP_DIR, "audio_list.txt")
with open(concat_list, "w") as f:
    for a in audio_files:
        f.write(f"file '{a}'\n")

full_audio = os.path.join(TMP_DIR, "full_audio.wav")
subprocess.run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
    "-ac", "1", "-ar", "16000", full_audio
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

out_video = os.path.join(OUT_DIR, "sample_talking_head.mp4")

# FFmpeg: create gradient background + animated audio waveform overlay + timestamps
ffmpeg_cmd = [
    "ffmpeg", "-y",
    "-i", full_audio,
    "-f", "lavfi", "-i", "color=c=#0f172a:s=1280x720:r=30",
    "-filter_complex",
    "[0:a]showwaves=s=1100x200:mode=line:colors=#6366f1|#a855f7[wave];"
    "[1:v][wave]overlay=(W-w)/2:(H-h)/2+120[bg];"
    "[bg]drawtext=text='TakePicker Test Footage':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=140,"
    "drawtext=text='Raw Talking-Head Sample with Retakes':fontcolor=#94a3b8:fontsize=24:x=(w-text_w)/2:y=200,"
    "drawtext=text='%{pts\\:hms}':fontcolor=#38bdf8:fontsize=32:x=(w-text_w)/2:y=560[v]",
    "-map", "[v]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    out_video
]

print("Rendering sample video:", out_video)
subprocess.run(ffmpeg_cmd, check=True)
print("Done! Generated:", out_video)
