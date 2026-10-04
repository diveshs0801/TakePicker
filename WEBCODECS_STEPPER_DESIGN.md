# WebCodecs Frame Stepper and Scrubber (Phase 2D, hard problem #1)

Addresses: "real-time editing, smooth playback, and working with large media on the client" (Fullstack JD), "you notice when something feels janky and you fix it", and hard problem #1 (a real NLE in the browser).

Scope statement for the README: a frame-accurate stepping and scrubbing player for H.264 proxies using WebCodecs, with bounded memory and measured seek latency. It is a player, not an editor.

---

## 1. The question the project answers

> Can the browser show the exact requested frame quickly, step forward and backward by one frame, and scrub smoothly, without leaking memory, and how do we prove the frames are correct?

---

## 2. Why this is hard

- Video is stored as **keyframes plus dependent frames**. Showing frame N means decoding from the previous keyframe.
- With **B-frames**, decode order differs from presentation order, so the frame you want may need frames that come after it in the file.
- `VideoFrame` objects hold decoded pixel memory. If you do not `close()` them, memory climbs fast.
- Fast scrubbing creates a flood of seek requests; stale ones must be cancelled.
- The main thread must stay responsive, so decode work belongs in a worker.

---

## 3. Key design decision: the proxy is tuned for seeking

Phase 1 already generates a proxy. For this player, encode it with:
```bash
ffmpeg -i in.mp4 -vf scale=-2:480 \
  -c:v libx264 -preset veryfast -crf 26 -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p -movflags +faststart -an proxy_video.mp4
```
- `-g 30 -keyint_min 30 -sc_threshold 0`: a keyframe exactly every 30 frames, so the **maximum decode distance is 29 frames**.
- `-bf 0`: no B-frames, so decode order equals presentation order. This makes the first version far simpler.
- `-movflags +faststart`: the index (`moov`) is at the start of the file, so the demuxer can begin immediately.

**Stretch goal**: support B-frames and measure the cost of the extra complexity versus the file-size saving. That comparison makes a good write-up.

Keep audio on a separate path (section 9).

---

## 4. Architecture

```
Main thread (React)                 Worker (player.worker.ts)
┌──────────────────────┐            ┌──────────────────────────────────────┐
│ UI: timeline, keys,  │  commands  │ Demuxer (mp4box.js): sample table    │
│ playhead, counters   │──────────▶│ Seek planner                          │
│                      │            │ VideoDecoder (WebCodecs)              │
│ <canvas> transferred │            │ Frame cache (LRU, byte budget)        │
│ to the worker as an  │            │ OffscreenCanvas renderer              │
│ OffscreenCanvas      │◀──────────│ Thumbnail generator (keyframes only)  │
└──────────────────────┘   events   └──────────────────────────────────────┘
```

- The canvas is transferred with `transferControlToOffscreen()`. The **worker decodes and draws**, so decoded frames never cross to the main thread.
- Main sends commands: `load(url)`, `seek(time)`, `step(+1|-1)`, `play()`, `pause()`.
- Worker sends events: `ready(info)`, `frame(index, timestamp)`, `stats`, `error`.

---

## 5. Demuxing

Use `mp4box.js`:
1. Fetch the proxy. First version: **fetch the whole file** into an `ArrayBuffer` (a 480p proxy is small). Stretch: HTTP **Range requests** for lazy loading of large files (your server must support ranges).
2. Append to MP4Box with the right `fileStart`, and on `onReady` read the video track: codec string, width, height, timescale, and sample count.
3. Extract all samples once and build a **sample table**:
```ts
type Sample = { index: number; cts: number; dts: number; duration: number;
                isSync: boolean; offset: number; size: number; data: Uint8Array };
```
4. Build the **decoder `description`** (the `avcC` box bytes) from the track's sample description. This is a known fiddly step; test it early with a short clip.

Keep a `timeToIndex(t)` function that binary-searches `cts`, and never derive indexes from `t * fps` alone (variable timing exists in real files).

---

## 6. Decoding and seek algorithm

Decoder setup:
```ts
const config = { codec, codedWidth, codedHeight, description };
const support = await VideoDecoder.isConfigSupported(config);
if (!support.supported) fallbackToVideoElement();
decoder = new VideoDecoder({ output: onFrame, error: onError });
decoder.configure(config);
```

Chunks:
```ts
new EncodedVideoChunk({ type: s.isSync ? "key" : "delta",
                        timestamp: s.cts_us, duration: s.dur_us, data: s.data });
```

### Seek to frame T
1. `T_idx = timeToIndex(targetTime)`.
2. `K_idx` = the nearest sync sample at or before `T_idx`.
3. If a cached frame for `T_idx` exists, display it and stop.
4. If the decoder's current position is already between `K_idx` and `T_idx` (stepping forward), **continue decoding** from the current position instead of restarting.
5. Otherwise: `decoder.reset()`, `decoder.configure(config)` again, and feed samples `K_idx .. T_idx` (the first chunk must be a keyframe).
6. In the output callback, **drop frames with index < T_idx** (`frame.close()` immediately), cache and show `T_idx`, and keep a few neighbors.
7. Call `flush()` when needed so the last frame is emitted.

### Stepping
- **Forward by one**: the next frame is usually already decoded or is the next sample, so this is cheap.
- **Backward by one**: the previous frame is probably in the cache; if not, seek to `T_idx - 1`. Because the cache keeps a window of recent frames, reverse stepping is fast after the first step.

### Cancel stale seeks
Use a monotonically increasing `seekId`. Every callback checks that it still belongs to the latest `seekId`; otherwise it closes the frame and returns. Do not queue decode work for superseded seeks.

### Decoder queue pressure
Check `decoder.decodeQueueSize` and avoid pushing hundreds of chunks at once; feed in batches.

---

## 7. Frame cache and memory

- LRU keyed by frame index, with a **byte budget**, not a frame count.
- Estimate: a 480p I420 frame is about 0.6 MB (854 x 480 x 1.5). A 1080p frame is about 3 MB. A 60-frame cache at 480p is roughly 37 MB.
- On eviction, call `frame.close()`.
- Invariant: **every `VideoFrame` that leaves the decoder is either cached or closed within the same callback**. Add a debug counter of open frames and show it in a dev overlay.

Measure memory with Chrome DevTools (Performance monitor and heap snapshots), not by guessing. Note that decoded frames may live in GPU memory, so JS heap numbers alone are not enough; watch the browser's task manager as well.

---

## 8. Rendering

- 2D canvas first: `ctx.drawImage(frame, 0, 0, w, h)` from the worker's `OffscreenCanvas`.
- Draw only when the displayed frame changes.
- Stretch: WebGL/WebGPU rendering for color handling and overlays. Do this only after verification is done.

### Playback clock
- During playback, a clock decides which frame is due. Drop frames that are late rather than falling behind.
- Use the audio element's `currentTime` as the master clock when playing with sound; use `performance.now()` when audio is off.
- Show a dev overlay: dropped frames, decode fps, queue size.

---

## 9. Audio

Keep it simple and say so:
- Use a hidden `<audio>` element (or the proxy's audio track) for playback.
- Pause and mute it while stepping and scrubbing.
- Limitation: audio is not frame-locked during fast scrubbing.

---

## 10. Thumbnail strip

- In the worker, decode **only keyframes** (one per second, because of `-g 30` at 30 fps) and draw each to a small `OffscreenCanvas`, then `createImageBitmap` and cache.
- Render the strip lazily for the visible range.
- This is cheap, so scrubbing the strip feels instant.

---

## 11. UI

- Left/Right arrows: -1/+1 frame. Shift+arrows: -10/+10. Space: play/pause. Home/End.
- Draggable playhead over the thumbnail strip.
- Frame counter and timestamp (for example `frame 1342 / 9660   44.733 s`).
- Timeline clip boundaries from the TakePicker timeline drawn over the strip; clicking a clip seeks to its start.
- Dev overlay toggle: open frames, cache bytes, last seek latency.

### Fallback
If `VideoDecoder` or the config is unsupported, fall back to a normal `<video>` element with a visible notice ("frame-accurate mode unavailable").

Browser note: WebCodecs support is best in Chromium-based browsers. Check current support for other browsers before claiming anything about them.

---

## 12. Verification (what makes it credible)

### A. Frame correctness
1. Run `ffprobe -select_streams v -show_frames -show_entries frame=pts_time,pict_type -of csv proxy_video.mp4` to get the ground-truth frame list.
2. Pick 50 random frame indices. For each, seek in the player and compare:
   - the displayed timestamp with the ffprobe `pts_time` (should match exactly), and
   - the **pixels**: export frame N with FFmpeg (`-vf "select=eq(n\,N)" -frames:v 1`), read back the canvas (`getImageData`), and compare with PSNR or a perceptual hash. Expect small differences from color conversion, so use a threshold (for example PSNR above 35 dB) and report the actual values.
3. Report: N frames tested, N matching timestamp, N within the pixel threshold, and any mismatches with an explanation.

### B. Performance (run 100 random seeks, then 100 sequential steps)
- Seek latency from the command to the correct frame drawn: p50, p95, max
- Single-step latency (forward and backward)
- Sustained decode throughput (fps) at 480p and 720p
- Scrub responsiveness: frames drawn per second while dragging the playhead

### C. Memory
- Scrub continuously for 5 minutes. Record open `VideoFrame` count and browser memory at start and end. The curve should be flat.

### D. Automation
Automate A and B with Playwright. Caution: Playwright's bundled Chromium may not include H.264 decoding; run against an installed Chrome (`channel: "chrome"`) and note the browser version in the results.

---

## 12b. Expected findings to check, not claims

1. Seek latency grows with distance from the previous keyframe; the 1-second GOP bounds it.
2. Backward stepping is the slow case without a cache.
3. Forgetting `close()` on discarded frames causes visible memory growth within seconds.
4. B-frame support costs noticeably more complexity than the file-size gain justifies for a proxy.

Write what you actually measure.

---

## 13. Layout

```
apps/web/src/player/
  player.worker.ts        # demux, decode, cache, render, thumbnails
  demux.ts                # mp4box wrapper, sample table, avcC description
  seek.ts                 # planner: keyframe lookup, continue-vs-restart
  cache.ts                # LRU with byte budget, open-frame counter
  PlayerView.tsx          # canvas, controls, overlay
  fallback.tsx            # <video> fallback
bench/player/
  verify_frames.spec.ts   # Playwright: ffprobe comparison
  perf.spec.ts            # latency and memory runs
  results/
```

---

## 14. Plan (2-3 days)

**Day 1**: worker, mp4box demux, sample table, `avcC` description, decode a single frame to the canvas, then step forward and backward with a simple cache.

**Day 2**: seek planner (continue vs restart), stale-seek cancellation, byte-budgeted LRU, thumbnail strip, timeline overlay, keyboard controls.

**Day 3**: verification harness (ffprobe comparison and pixel check), performance and memory runs, dev overlay, fallback, README with numbers and a short demo clip.

---

## 15. Definition of done

- [ ] Frame-accurate stepping verified against ffprobe on 50 random frames
- [ ] p50/p95 seek latency recorded
- [ ] Flat memory after 5 minutes of scrubbing, with the open-frame counter shown
- [ ] Decode and draw run in a worker; the main thread only handles UI
- [ ] Stale seeks are cancelled
- [ ] `<video>` fallback with a notice
- [ ] Limitations section

## 16. Limitations to state

- H.264 proxy only; no other codecs
- Audio is not frame-locked while scrubbing
- Full-file fetch in v1 unless Range loading is implemented
- Tested on specific browser versions listed in the results
- No editing operations in the player itself
