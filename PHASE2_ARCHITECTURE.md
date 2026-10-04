# TakePicker Phase 2: Architecture

Phase 1 (done): upload, proxy, Whisper, retake clustering and scoring, timeline JSON, fan-out render with retries.

Phase 2 goal: turn TakePicker from a pipeline into an **editing system an agent can drive and verify**, and close the gaps in the Backend and Fullstack job descriptions.

| Phase | Name | JD / hard problem it addresses | Time box |
|---|---|---|---|
| 2A | Agent layer (MCP tools + operation log) | "agent service turning natural language into timeline operations", hard problem #4 | ~1 day |
| 2B | Video linter + incremental re-render | "progress and recovery", hard problem #9 (verification) | 1-2 days |
| 2C | Resumable upload | "huge files, flaky uploads" | ~1 day |
| 2D | WebCodecs frame stepper | "real-time editing, smooth playback, large media on the client", hard problem #1 | 2-3 days |
| 3 (optional) | Timeline diff/merge in Rust (WASM) | hard problem #10 | 3-4 days |

Rule: finish in order. Cut 2D or 3 before cutting the README and numbers for 2A-2C.

---

## 0. Target system (after Phase 2)

```
                    ┌──────────────────────────────────────────────┐
                    │ Next.js Studio                                │
                    │  - Agent chat panel         (2A)              │
                    │  - Lint report panel        (2B)              │
                    │  - tus upload client        (2C)              │
                    │  - WebCodecs player/stepper (2D, Web Worker)  │
                    └──────────┬──────────────────────▲─────────────┘
                       REST/tus│                      │ WebSocket events
                    ┌──────────▼──────────────────────┴─────────────┐
                    │ NestJS API                                     │
                    │  - Upload service (tus)            (2C)        │
                    │  - Timeline service (op log)       (2A)        │
                    │  - Agent runner (LLM tool loop)    (2A)        │
                    │  - Render orchestrator + lint gate (2B)        │
                    └───┬───────────┬───────────┬───────────────────┘
                        │           │           │
                  ┌─────▼───┐ ┌─────▼────┐ ┌────▼─────────────┐
                  │Postgres │ │Redis     │ │Storage (disk or  │
                  │         │ │BullMQ    │ │MinIO / S3 API)   │
                  └─────────┘ └────┬─────┘ └────▲─────────────┘
                                   │            │
     ┌───────────────┬─────────────┼────────────┼──────────────┐
     │               │             │            │              │
 ingest worker   analysis svc   render workers  merge worker   lint worker (2B)
 (Phase 1)       (Phase 1)      xN (Phase 1,    (Phase 1)      ffmpeg filters +
                                 segment cache                   Whisper boundary
                                 added in 2B)                    check

 MCP server (2A): exposes the same timeline tools to any MCP client
 (the in-app agent, Claude Desktop, etc.)
```

Design rules carried over from Phase 1 and extended:
- Workers and the API never share state except through Postgres, Redis and storage.
- The LLM never sees file paths or touches video. It sees ids and times, and calls tools.
- Every state change is an **operation** in an append-only log. Current state is derived from the log.
- Every stage is idempotent and writes atomically (tmp file then rename).

---

## Phase 2A: Agent layer

### Goal
Let the user type "use the first take of the intro and cut the long pauses" and have the timeline change through validated operations, with undo.

### Components
1. **Timeline service**: owns the operation log and derives current timeline state.
2. **Tool registry**: one set of typed tools (zod schemas), used by both the MCP server and the in-app agent runner.
3. **MCP server**: exposes the registry over the MCP protocol (TypeScript SDK). This lets you demo it from Claude Desktop too.
4. **Agent runner**: LLM tool-calling loop inside the API, with a step limit, streaming events to the UI.
5. **Chat panel**: shows messages, tool calls and the resulting diff.

### Data model
```
timeline_ops(
  id uuid, asset_id, seq int,            -- seq is monotonic per asset
  op_type text,                           -- select_take | remove_clip | trim_clip | split_clip | remove_range
  payload jsonb,                          -- the arguments
  inverse jsonb,                          -- what undoes it (computed at apply time)
  actor text,                             -- 'user' | 'agent'
  agent_run_id uuid null,
  created_at
)
timeline_snapshots(asset_id, seq, timeline jsonb)   -- every 20 ops, for fast load
agent_runs(id, asset_id, prompt, status, steps jsonb, created_at)
```
- State = latest snapshot + replay of later ops.
- **Undo** appends the inverse operation (it never deletes history), so undo is itself undoable.
- Optimistic concurrency: an operation includes `baseSeq`. If the log moved, the call fails with a conflict error and the agent re-reads state.

### Tools
Read tools:
- `get_timeline()`: clips with ids, in/out, group, reason
- `list_take_groups()`: groups, takes, scores, chosen take
- `search_transcript(query)`: returns matching text with time ranges and clip ids
- `get_lint_report(renderId)`: available after 2B

Write tools (all validated, all return the new state summary or a structured error):
- `select_take(groupId, segmentId)`
- `remove_clip(clipId)`
- `trim_clip(clipId, in, out)`: clamped and snapped to the frame grid
- `split_clip(clipId, at)`
- `remove_range(start, end)`: for "cut the long pauses" and similar
- `undo()` / `redo()`
- `render()`: enqueues the fan-out render

Errors are structured (`{code, message, hint}`) so the model can recover, for example `CLIP_NOT_FOUND`, `OUT_OF_RANGE`, `OVERLAP`, `STALE_BASE_SEQ`.

### Agent loop
```
user message
  -> build context: system prompt + compact timeline summary (not the full transcript)
  -> LLM call with tools
  -> if tool_use: validate -> apply op -> append result -> loop (max 8 steps)
  -> final message + list of ops applied (shown in UI as a diff, each with an Undo)
```
Context handling: keep prompts small. Send a **summary** of the timeline and let the model fetch details with read tools. This is the practical version of the "better context" hard problem.

### Evaluation (this is what makes it credible)
Write 15-20 test commands with expected outcomes in `eval/agent_cases.json`, for example:
- "remove the second clip" -> clip count decreases by 1, correct clip gone
- "use take 1 for the intro" -> chosen take of group g1 changes
- "cut every pause over 1s" -> no remaining internal pause > 1s
- an invalid request ("trim clip 99") -> graceful error, no state change

A script runs them against the real agent and reports the pass rate and the average steps and latency. Report honestly, including failures.

### Definition of done
- [ ] Ops log with undo/redo working through the API
- [ ] All tools reachable via MCP (verified from an MCP client) and via the in-app agent
- [ ] Chat panel showing tool calls and applied ops
- [ ] Eval script and pass rate in the README

---

## Phase 2B: Video linter + incremental re-render

### Goal
After every render, automatically check the output, tell the agent or user what is wrong, and re-render only what changed.

### Flow
```
render DONE -> enqueue lint job -> lint worker runs checks -> lint_report
   -> if errors: agent can read report, propose ops, re-render (max 2 repair rounds)
   -> if clean: mark render VERIFIED
```
Render states become: `QUEUED -> RENDERING -> MERGING -> LINTING -> VERIFIED | NEEDS_FIX | FAILED`.

### Checks
| Check | How | Severity |
|---|---|---|
| Black frames | `ffmpeg -vf blackdetect` | error if inside speech |
| Frozen frames | `freezedetect` | warn |
| Unexpected silence at joins | `silencedetect` around each join timestamp | warn |
| Loudness jump between segments | `ebur128`, compare per-segment integrated loudness | warn if > ~3 LU |
| Duration mismatch | ffprobe duration vs sum of clip durations | error if > 1 frame |
| A/V stream duration drift | ffprobe audio vs video duration | warn |
| **Word cut-off at boundary** | compare clip in/out with Whisper word timestamps; flag any word that straddles an edge | error |
| Codec params consistent across segments | ffprobe each segment | error (concat safety) |

Thresholds live in one config file. Every finding records `{check, severity, time, message, suggestedFix}`.

### Data model
```
lint_reports(id, render_id, status, findings jsonb, duration_ms, created_at)
segment_cache(key text primary key, storage_key, created_at)
```

### Incremental re-render (backend showpiece)
Cache key per segment: `sha256(srcAssetId + in + out + encodeParamsVersion)`.
- Before enqueueing a segment job, check `segment_cache`. If it exists and `isValidMedia`, skip.
- After an agent edit that touches 2 of 45 clips, only those 2 re-render, then merge.
- Measure and report: full render time vs incremental re-render time after a 2-clip change.

### Definition of done
- [ ] Lint worker with at least 5 working checks
- [ ] Lint report visible in the UI and available to the agent as a tool
- [ ] Repair loop capped at 2 rounds
- [ ] Segment cache with measured full vs incremental times
- [ ] A deliberately broken test (for example a bad trim that cuts a word) that the linter catches

---

## Phase 2C: Resumable upload

### Goal
Large uploads that survive dropped connections and tab reloads.

### Protocol
Use the **tus** protocol (or a minimal compatible version):
```
POST   /uploads            Upload-Length, metadata -> 201 + Location: /uploads/:id
HEAD   /uploads/:id        -> Upload-Offset (how much the server has)
PATCH  /uploads/:id        Upload-Offset, body = chunk -> 204 + new Upload-Offset
```
- Chunk size around 8-16 MB. PATCH at a given offset is idempotent: a repeated chunk at the same offset is accepted without corrupting the file.
- Per-chunk checksum header (SHA-256) verified on the server.
- On completion: verify total size (and optionally a full-file hash), create the asset, enqueue ingest.

### Storage
Introduce a `Storage` interface now: `put`, `append`, `get`, `exists`, `stat`.
Two implementations: local disk (default) and **MinIO** (S3 API, multipart upload). Mentioning S3 compatibility is useful, but only claim it if you ran it against MinIO.

### Data model
```
uploads(id, filename, size, offset, status[CREATED|UPLOADING|COMPLETE|EXPIRED],
        storage_key, created_at, updated_at, expires_at)
```
A cleanup job (BullMQ repeatable) removes uploads that were not completed within 24 hours.

### Client
`tus-js-client` with exponential backoff and automatic resume from stored upload URL. UI shows speed, ETA, and a "resuming" state.

### Test plan (record these numbers)
1. Upload a 2-4 GB file.
2. Drop the network mid-upload (browser offline mode, or a proxy such as toxiproxy) and confirm it resumes from the right offset.
3. Reload the tab mid-upload and confirm it resumes.
4. Corrupt a chunk deliberately and confirm the checksum rejects it.
5. Report throughput and peak API memory (should stay flat, since chunks are streamed to storage, not buffered).

### Definition of done
- [ ] tus-style endpoints with offset-based resume
- [ ] Checksum verification and expiry cleanup
- [ ] Tested on a multi-GB file with a simulated disconnect
- [ ] Memory stays flat during upload (measured)

---

## Phase 2D: WebCodecs frame stepper

### Goal
Frame-accurate stepping and fast scrubbing in the browser, with bounded memory.

### Pipeline
```
proxy.mp4 (keyframe every 1s, from Phase 1)
  -> fetch with range requests
  -> demux in a Web Worker (mp4box.js): samples with timestamps, keyframe flags
  -> VideoDecoder (WebCodecs) configured from the avcC description
  -> decoded VideoFrame objects -> LRU cache -> draw to <canvas>
```
All demux and decode work runs in a **Web Worker**. The main thread only draws.

### Seek algorithm
1. Map the target time to a frame index (by timestamp, not by guessing from fps).
2. Find the previous keyframe sample at or before that index.
3. Feed samples from that keyframe up to the target to the decoder.
4. Discard frames before the target, display the target frame, cache neighbors.
5. Because the proxy uses a 1-second GOP, worst-case decode distance is about 30 frames.

### Details to get right
- **B-frames**: decode order differs from presentation order. Use the frame's `timestamp`, not arrival order.
- **Memory**: every `VideoFrame` must be `close()`d. Keep an LRU of roughly 30-60 frames and measure heap use.
- **Cancel stale seeks**: when the user scrubs quickly, cancel in-flight decodes and keep only the latest target.
- **Thumbnail strip**: generate in a worker with `OffscreenCanvas`, one thumbnail per second, cached.
- **Audio**: keep it simple. Play audio from a hidden media element during playback and mute while stepping. State this limitation in the README.
- **Fallback**: if `VideoDecoder` is unavailable, fall back to `<video>` and show a notice.

### UI
Arrow keys step one frame, shift+arrow steps 10, a draggable playhead, a frame counter and timestamp, and clip boundaries from the timeline overlaid on the strip.

### Verification (do this, it is what makes it credible)
- Pick 20 random frame indices, compare your displayed timestamp against `ffprobe -show_frames` pts for the same index, and report any mismatches.
- Measure seek latency (p50 and p95) over 100 random seeks.
- Measure heap usage after 5 minutes of scrubbing to show there is no leak.

### Definition of done
- [ ] Frame-accurate stepping verified against ffprobe
- [ ] Seek latency numbers recorded
- [ ] No frame leak (heap stays flat)
- [ ] Decode and demux in a worker, main thread only draws

---

## Phase 3 (optional): Timeline diff/merge in Rust

Only start this after 2A-2C are shipped and posted.

- Represent a timeline as an ordered list of clips with stable ids.
- **Diff**: classify changes as add, remove, move, trim (edited in/out), and take-switch.
- **Three-way merge**: given base, ours, theirs, auto-merge non-overlapping changes. Conflicts are typed (both trimmed the same clip differently, one removed what the other moved) and reported with both versions.
- Property tests: merge(base, a, a) == a, and merge is symmetric for non-conflicting edits.
- Compile to WebAssembly (`wasm-bindgen`) so the same code runs in the browser and, via a Node binding, in the API.
- Use a simple UI: two timeline versions, a conflict list, and a resolve button.

This gives Rust a concrete reason to exist and speaks to hard problem #10.

---

## Build order and cut lines

1. **2A**, then publish a short update post.
2. **2B**, then update the README with lint and incremental re-render numbers.
3. **2C**, then add upload test results.
4. **2D** if targeting Fullstack.
5. **Phase 3** only if time remains.

If time runs short, cut in this order: Phase 3, MinIO, thumbnail strip, redo, Claude Desktop demo. Never cut: the eval script, the lint checks, the measured numbers, the honest limitations section.

## Honest limitations to keep in the README

- Single host; "parallel workers", not a distributed cluster.
- Retake detection is transcript-based, so it works for talking-head speech, not for visual retakes.
- Scoring is heuristic; accuracy was measured on a small set of self-made clips.
- H.264/MP4 only; no GPU encoding was run.
- The agent eval set is small and written by the author.
