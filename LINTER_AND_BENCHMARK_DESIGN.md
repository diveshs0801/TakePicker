# Video Linter + Defect Benchmark (hard problem #9)

Cardboard's page says: "There's no linter for video. We have to build one." This project builds the **technical-defect layer** of that, and, more importantly, **measures how well it works**.

Scope statement (put this in the README): this checks objective technical defects. It does not judge taste, story or pacing.

---

## 1. The question the project answers

> For each type of technical defect, how reliably can an automated linter catch it, and where does it fail?

The deliverable is a table of **precision and recall per defect type and severity**, measured on clips where the defects were injected at known positions. That is checkable evidence, not "it works on my clip".

---

## 2. Defect taxonomy

| ID | Defect | How it is injected (ground truth) | Severities to test |
|---|---|---|---|
| D1 | Black frames | Overlay black for a time span | 0.1s, 0.25s, 0.5s, 1s |
| D2 | Frozen video | Repeat one frame for a span | 0.5s, 1s, 2s |
| D3 | Audio dropout | Mute a span | 0.1s, 0.3s, 1s |
| D4 | Loudness jump | Raise or lower a span's gain | +/-3 dB, +/-6 dB, +/-10 dB |
| D5 | A/V desync | Delay the audio track | 40ms, 100ms, 200ms, 500ms |
| D6 | Click/pop at a join | Join two clips without a fade | hard cut vs 15ms fade |
| D7 | Word cut off at a boundary | Cut inside a spoken word | cut mid-word vs cut in a gap |
| D8 | Clean control | No defect | n/a (used to measure false alarms) |

Keep D1-D7 only. Do not add more until these are measured.

### Injection commands (starting points; check against your FFmpeg version)
```bash
# D1 black frames from t=10 to 10.5
ffmpeg -i in.mp4 -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,10,10.5)'" -c:a copy out.mp4

# D2 frozen video: repeat the frame at index F for N frames (30fps: 1s = 30 frames)
ffmpeg -i in.mp4 -vf "loop=loop=30:size=1:start=300" -an out_video_only.mp4   # then remux original audio, trimming length as needed

# D3 audio dropout 10.0-10.3
ffmpeg -i in.mp4 -af "volume=enable='between(t,10,10.3)':volume=0" -c:v copy out.mp4

# D4 loudness jump +6 dB from 12 to 15
ffmpeg -i in.mp4 -af "volume=enable='between(t,12,15)':volume=6dB" -c:v copy out.mp4

# D5 audio delayed 200 ms
ffmpeg -i in.mp4 -af "adelay=200|200" -c:v copy out.mp4

# D6 join without fade vs with 15 ms fades (build two joined files from the same two segments)

# D7 cut inside a word: pick a word from the transcript, cut at its midpoint; control cuts land in the gap between words
```
Verify every injected file by playing it or by looking at a spectrogram. A wrong injector invalidates the whole benchmark.

### Dataset
- 8-10 base clips, 30-60 seconds each, talking-head, your own recordings (or clips with a permissive license). Do not commit large videos; commit the **generator script and the manifest** instead.
- For each clip: each defect at each severity at a seeded-random position, plus a clean copy.
- Manifest format:
```json
{
  "file": "clip03_D4_plus6_t12.mp4",
  "base": "clip03",
  "defects": [{"type": "D4", "start": 12.0, "end": 15.0, "severity": "+6dB"}]
}
```
- Split by **base clip**, not by file: 70% of clips for tuning thresholds (dev), 30% held out for the final numbers (test). This prevents tuning to the test set.

---

## 3. Detectors

Run all FFmpeg-based checks in **one decode pass**:
```bash
ffmpeg -i clip.mp4 \
  -vf "blackdetect=d=0.05:pic_th=0.98,freezedetect=n=-60dB:d=0.4" \
  -af "silencedetect=n=-50dB:d=0.08,ebur128=peak=true" \
  -f null - 2> lint_raw.txt
```
Parse stderr into findings. Report lint runtime as a multiple of video duration (for example "0.08x realtime").

| Defect | Detector | Notes |
|---|---|---|
| D1 | `blackdetect` | Tune `d` and `pic_th` on the dev split |
| D2 | `freezedetect` | Likely false alarms on still talking-head video; see context rules |
| D3 | `silencedetect` + transcript context | Raw silence is not a defect; silence *inside a speech span* is |
| D4 | `ebur128` momentary/short-term loudness, windowed difference | Flag a step change larger than a tuned LU threshold sustained for > 1 s |
| D5 | Cross-correlation of audio energy envelope vs frame-difference (motion) signal over lags of +/-500 ms | Crude but doable for talking head; report the smallest offset detected reliably |
| D6 | Sample discontinuity / high-frequency energy spike in a 10 ms window at each join timestamp | Needs the join timestamps from the timeline |
| D7 | Compare each clip in/out against Whisper word spans; flag if a boundary falls strictly inside a word | See "circularity" below |

### Context-aware rules (this is what makes it better than raw filters)
Use the Whisper transcript and the timeline:
- A silence is **only** a defect if it lies inside a sentence (between words of the same segment) or at a join.
- A freeze is only a defect if it is longer than natural stillness, or if audio continues while motion is exactly zero. Compare against a baseline motion level for that clip.
- Loudness is compared **between adjacent clips**, not against a global target.

### Circularity warning (state it in the README)
D7 uses Whisper word times for detection. If the ground truth also comes from Whisper, the test is circular. Mitigate by: placing cuts using a *different* method (for example hand-verified cut points on a sample of boundaries via spectrogram or listening), and reporting how many boundaries you verified manually.

---

## 4. Scoring the linter

### Matching rule
A finding matches a ground-truth defect if the type matches and the time ranges overlap within a tolerance:
- D1, D2, D3, D4: overlap, with start/end within +/-0.2 s
- D5: whole-file; compare the estimated offset to the true offset
- D6, D7: finding within +/-50 ms of the join / boundary

Count per defect type and severity:
- **True positive**: matched finding
- **False negative**: injected defect with no match
- **False positive**: finding with no matching defect (including any finding on clean controls)

### Metrics to report
- Precision, recall, F1 per type and severity (on the **test split only**)
- **False alarms per minute** on clean controls
- Localization error (median absolute start-time error) for D1-D4
- For D5: detection rate and error versus true offset, per offset size
- Runtime as a multiple of realtime

### Threshold tuning
For D1, D3, D4 sweep the main threshold on the dev split, plot precision vs recall, pick the operating point, then evaluate once on the test split. Include the curve in the README.

---

## 5. Hypotheses to test (not claims)

These are guesses. Write what you actually find, including when they are wrong.

1. Very short black spans (under about 3 frames) are missed or unreliable.
2. `freezedetect` raises false alarms on talking-head video with little motion.
3. Raw `silencedetect` flags natural pauses; transcript context cuts false alarms a lot.
4. Loudness steps under about 3 dB are hard to separate from natural speech variation.
5. A/V offsets under about 100 ms are not reliably detectable with the correlation method.
6. Boundaries that cut a word's trailing consonant are the hardest D7 cases.

A result that disproves a hypothesis is a better post than one that confirms it.

---

## 6. Repo layout

```
apps/lint/
  lint.py              # CLI + library: runs the single-pass FFmpeg checks and rules
  checks/              # one module per defect type
  config.yaml          # thresholds (tuned values saved here)
bench/
  inject.py            # builds defective clips from base clips (seeded)
  manifest.json        # ground truth
  run_bench.py         # runs the linter, matches findings, computes metrics
  results/             # results.json, tables, PR charts (committed)
docs/
  LINTER.md            # method, results, limits
```

CLI:
```bash
python apps/lint/lint.py clip.mp4 --timeline timeline.json --words words.json --out findings.json
python bench/run_bench.py --split test
```

Finding schema (also used by the agent in the next phase):
```json
{
  "check": "D3_silence_inside_speech",
  "severity": "error",
  "start": 10.02, "end": 10.31,
  "message": "Audio dropout inside sentence 'we will demonstrate how'",
  "suggestedFix": {"op": "trim_clip", "clipId": "c7", "padStart": 0.1}
}
```

---

## 7. Hardware notes (8 GB laptop)

- Clips are 30-60 s at 480p-720p for the benchmark; the checks do not need 1080p.
- Single-pass FFmpeg is light. Whisper is only needed to get word timestamps once per clip; use a small model and cache the output.
- No GPU and no large models are needed.

---

## 8. Plan (about 2 days)

**Day 1**
- Record or select 8-10 base clips
- Write `inject.py` and generate the dataset and manifest
- Spot-check injected files by ear and by spectrogram
- Implement single-pass detection and parsing for D1-D4

**Day 2**
- Implement D5, D6, D7 and the context rules
- Write the matching and metrics script
- Tune on dev, evaluate once on test
- Write `docs/LINTER.md`, charts, and the post

---

## 9. Definition of done

- [ ] Injector reproducible from a seed, manifest committed
- [ ] Linter runs in one decode pass and reports runtime vs realtime
- [ ] Precision/recall per type and severity on the held-out test split
- [ ] False alarms per minute on clean controls
- [ ] PR curves for at least two tuned detectors
- [ ] Two written failure case studies with the exact clip and why it failed
- [ ] Limitations section: synthetic defects, small dataset, circularity of D7, no subjective quality checks

---

## 10. How to present it

Post angle: **"I built a benchmark for a video linter. Here is what it catches and what it misses."**

Include:
- One results table (type x severity -> precision/recall)
- The most surprising failure (for example a detector that looked fine on average but failed at one severity)
- One honest limitation
- Link to the repo and the benchmark script

Do not say "I solved verification". Say "I measured the technical-defect layer of it".
