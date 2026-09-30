# TakePicker

AI that finds the best take in raw talking-head footage and renders a clean cut with a parallel FFmpeg pipeline.

> Status: in progress. See the checklist at the bottom.

<!-- Demo GIF / 60s video goes here -->

## Problem
Raw footage is full of retakes: a stumble, "let me redo that", then the same line again, two or three times. Editors spend hours scrubbing to find the best take of each line. TakePicker automates that first pass.

## How it works
```
Upload -> ffprobe + proxy + audio -> Whisper (word timestamps)
-> segment -> cluster retakes -> score takes -> timeline JSON
-> fan-out FFmpeg segment render -> concat -> clean cut
```

## Architecture
```
Next.js UI --REST/WS--> NestJS API --> Postgres (state)
                              |------> Redis / BullMQ
                              |
      ingest worker | analysis service (Python) | render workers xN | merge worker
                              |
                       Storage (disk / MinIO)
```
Design rules:
- The API never touches video. Workers do the heavy work.
- Every stage is idempotent: deterministic output path, skip if it already exists.
- Outputs are written to `*.tmp` and renamed on success, so partial files never look finished.
- Postgres is the source of truth. Redis is only a queue.
- All service contracts (timeline JSON, job payloads) live in `packages/contracts`.

## Retake detection
Adjacent segments are compared with (1) sentence-embedding cosine similarity, (2) rapidfuzz token-set ratio, and (3) a false-start prefix check. Cue phrases ("let me redo that", "take two") mark the previous take as bad. Matches are merged with union-find into take groups.

## Scoring
Per take, normalized within its group: filler rate, repeated words, longest internal pause, sentence completeness, audio-level stability, speech rate, Whisper confidence, and a small bonus for later takes. Weights are in one config file and the per-feature breakdown is stored so the UI can explain each pick.

## Visual Walkthrough

![TakePicker UI](docs/screenshots/01_ui_overview.png)
*TakePicker Studio: 480p keyframe scrubbing player, automatic timeline cuts track (pruned 21% of dead air/stumbles), and AI Retake Inspector with 1-click take override.*

![Fan-Out Export Modal](docs/screenshots/02_fanout_export_modal.png)
*Distributed Fan-Out FFmpeg Export Engine: Encodes 7 segments concurrently with 15ms audio micro-fades and merges in 7 seconds.*

> **Detailed Architecture & Troubleshooting Log:** See [docs/TROUBLESHOOTING_AND_ARCHITECTURE.md](docs/TROUBLESHOOTING_AND_ARCHITECTURE.md) for full error post-mortems and hardware benchmarks.

## Fan-out render
A BullMQ Flow: one `render-segment` child job per clip, and a parent `merge` job that runs when all children finish. Each segment is re-encoded (not stream-copied) with identical parameters so the final `concat -c copy` is safe. 15 ms audio fades prevent clicks at joins.

## Results
| Metric | Value |
|---|---|
| Sample Talking-Head Footage | 38.9s (H.264 / 1080p @ 30fps) |
| Retake Detection Accuracy | 100% (Identified stumbles & apology restarts) |
| Timeline Pruned Rate | 21% (30.6s clean cut from 39.0s source) |
| Parallel Render Time | 7.0s across worker pool |

## What I learned
- Cutting off a keyframe with stream copy is not frame-accurate; re-encode segments for exact cuts.
- `concat -c copy` needs identical codec parameters across all segments.
- Whisper tends to drop "um"/"uh"; an `initial_prompt` containing fillers helps keep them.
- Without `-threads` limits, one FFmpeg process already uses every core and extra workers show no speedup.

## Run it
```bash
# Clone and start full Docker stack
git clone https://github.com/diveshs0801/TakePicker.git
cd TakePicker
docker compose up

# Scale render workers for maximum fan-out speed
docker compose up -d --scale render-worker=4
```
Access the web studio at [http://localhost:3001](http://localhost:3001).

## Checklist
- [x] Upload, probe, proxy, audio extract
- [x] Whisper word timestamps with filler preservation
- [x] Pause segmentation, AI retake clustering, multi-factor scoring
- [x] Frame-snapped timeline JSON with padding clamping
- [x] Distributed fan-out render with 15ms micro-fades and lossless concat
- [x] Dark-mode Next.js UI with proxy player, cut track, and 1-click take override
- [x] Automated benchmark script and hardware portability
- [ ] 60s demo Loom video recording

## Next steps
Resumable chunked upload, WebCodecs frame-stepper, NVENC on a GPU box, more codecs, MCP tools for "use the first take of the intro".
