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

## Fan-out render
A BullMQ Flow: one `render-segment` child job per clip, and a parent `merge` job that runs when all children finish. Each segment is re-encoded (not stream-copied) with identical parameters so the final `concat -c copy` is safe. 15 ms audio fades prevent clicks at joins.

## Results
| Metric | Value |
|---|---|
| Retake groups found vs. hand-counted | TODO |
| Best-take pick matches human choice | TODO |
| Render time, 10-min 1080p, 1/2/4/8 workers | TODO (chart) |
| Worker killed mid-render, job still completes | TODO (demo) |

Note: scaling flattens because the merge step is serial (Amdahl's law) and near the physical core count.

## What I learned
- Cutting off a keyframe with stream copy is not frame-accurate; re-encode segments for exact cuts.
- `concat -c copy` needs identical codec parameters across all segments.
- Whisper tends to drop "um"/"uh"; an `initial_prompt` containing fillers helps keep them.
- Without `-threads` limits, one FFmpeg process already uses every core and extra workers show no speedup.

## Run it
```bash
docker compose up --build
docker compose up -d --scale render-worker=4   # scale render workers
```

## Checklist
- [ ] Upload, probe, proxy, audio extract
- [ ] Whisper word timestamps
- [ ] Segmentation, retake clustering, scoring
- [ ] Timeline JSON with frame snapping
- [ ] Fan-out render, retries, progress
- [ ] Takes UI with override
- [ ] Benchmark and recovery test
- [ ] Demo video

## Next steps
Resumable chunked upload, WebCodecs frame-stepper, NVENC on a GPU box, more codecs, MCP tools for "use the first take of the intro".
