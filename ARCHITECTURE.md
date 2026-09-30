# TakePicker — Full Architecture & Build Plan

> **One-line pitch:** TakePicker takes raw talking-head footage, finds the retakes, picks the best take of each line, and renders a clean cut with a parallel FFmpeg pipeline.

---

## 1. System Architecture

```
                         ┌────────────────────────────┐
                         │  Next.js UI                │
                         │  upload · takes list ·     │
                         │  player · render progress  │
                         └───────┬─────────────▲──────┘
                        REST     │             │ WebSocket (progress)
                         ┌───────▼─────────────┴──────┐
                         │  API service (NestJS)      │
                         │  assets · jobs · timeline  │
                         │  WS gateway                │
                         └──┬─────────┬────────────┬──┘
                            │         │            │
                     ┌──────▼──┐  ┌───▼─────┐  ┌───▼───────────┐
                     │Postgres │  │ Redis   │  │ Storage       │
                     │ state   │  │ BullMQ  │  │ (disk/MinIO)  │
                     └─────────┘  └───┬─────┘  └───▲───────────┘
                                      │            │
        ┌─────────────────────────────┼────────────┼──────────────┐
        │                             │            │              │
 ┌──────▼───────┐            ┌────────▼──────┐  ┌──▼────────────┐ │
 │ ingest worker│            │ analysis      │  │ render worker │ │
 │ probe, proxy,│            │ service       │  │ x N (scaled)  │
 │ audio extract│            │ (Python)      │  │ ffmpeg segment│ │
 └──────────────┘            │ whisper,      │  │ render        │ │
                             │ cluster, score│  └───────┬───────┘ │
                             └───────────────┘          │         │
                                              ┌─────────▼───────┐ │
                                              │ merge worker    │ │
                                              │ concat + finish │ │
                                              └─────────────────┘ │
        └─────────────────────────────────────────────────────────┘
```

### Design Rules

1. **The API never touches video.** Workers do the heavy work; the API only holds state and contracts.
2. **Every worker stage is idempotent:** writes to a deterministic output path and skips if the output already exists. This makes retries and crash recovery easy.
3. **Postgres is the source of truth**, Redis is only a queue, and the browser gets progress over WebSocket.

---

## 2. Tech Choices

| Piece | Choice | Why |
|-------|--------|-----|
| API | NestJS (TypeScript) | Matches resume, production-proven |
| Queue | BullMQ (Redis) | Flows give fan-out and fan-in natively |
| Analysis | Python: faster-whisper, sentence-transformers, rapidfuzz, numpy | Best ML ecosystem |
| Media | FFmpeg + ffprobe | The core skill Cardboard wants |
| DB | PostgreSQL | State machine and JSON timeline |
| Storage | Storage interface: local volume first, MinIO if time allows | Shows S3-style thinking without setup cost |
| UI | Next.js + plain `<video>` element | Don't fight the player in 3 days |
| Run | docker-compose, with `--scale render-worker=N` | Makes the benchmark one command |

---

## 3. Data Model

```sql
-- Source video files
assets(
  id            UUID PRIMARY KEY,
  filename      TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  duration      FLOAT,
  fps           FLOAT,
  width         INT,
  height        INT,
  vcodec        TEXT,
  status        TEXT NOT NULL DEFAULT 'UPLOADED',
  -- UPLOADED → PROBING → PROXYING → TRANSCRIBING → ANALYZING → READY | FAILED
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Track every async job
jobs(
  id            UUID PRIMARY KEY,
  asset_id      UUID REFERENCES assets(id),
  type          TEXT NOT NULL,  -- 'ingest' | 'analyze' | 'render'
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  progress      FLOAT DEFAULT 0,
  error         TEXT,
  attempts      INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Word-level transcript from Whisper
transcripts(
  asset_id      UUID PRIMARY KEY REFERENCES assets(id),
  words         JSONB NOT NULL  -- [{w: "hello", start: 0.12, end: 0.45, prob: 0.98}]
);

-- Individual speech segments
segments(
  id            UUID PRIMARY KEY,
  asset_id      UUID REFERENCES assets(id),
  idx           INT NOT NULL,
  start_time    FLOAT NOT NULL,
  end_time      FLOAT NOT NULL,
  text          TEXT NOT NULL,
  features      JSONB,         -- per-feature score breakdown
  score         FLOAT,
  group_id      UUID REFERENCES take_groups(id)
);

-- Groups of segments that say the same thing (retakes)
take_groups(
  id                  UUID PRIMARY KEY,
  asset_id            UUID REFERENCES assets(id),
  idx                 INT NOT NULL,
  chosen_segment_id   UUID REFERENCES segments(id),
  overridden          BOOLEAN DEFAULT FALSE
);

-- A render job (the clean cut)
renders(
  id            UUID PRIMARY KEY,
  asset_id      UUID REFERENCES assets(id),
  timeline      JSONB NOT NULL,  -- the edit list
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  -- QUEUED → RENDERING → MERGING → DONE | FAILED
  progress      FLOAT DEFAULT 0,
  output_key    TEXT
);

-- Individual segments within a render (one per clip)
render_segments(
  id            UUID PRIMARY KEY,
  render_id     UUID REFERENCES renders(id),
  idx           INT NOT NULL,
  in_t          FLOAT NOT NULL,
  out_t         FLOAT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  attempts      INT DEFAULT 0,
  output_key    TEXT
);
```

---

## 4. State Machines

### Asset Pipeline
```
UPLOADED → PROBING → PROXYING → TRANSCRIBING → ANALYZING → READY
     ↓         ↓         ↓           ↓             ↓
   FAILED    FAILED    FAILED      FAILED        FAILED
```

### Render Pipeline
```
QUEUED → RENDERING → MERGING → DONE
   ↓         ↓          ↓
 FAILED    FAILED     FAILED
```

### Recovery Rules
- Each BullMQ job has `attempts: 3` with exponential backoff (`backoff: { type: 'exponential', delay: 2000 }`)
- A crashed worker's job is picked up again through BullMQ's stalled-job detection (`stalledInterval: 30000`)
- A render segment only counts as done if its output file exists **and** `ffprobe` reads it successfully
- Write outputs to `*.tmp` and `rename()` on success → a partial file never looks finished
- On fatal failure (3 attempts exhausted), mark the render as FAILED and notify via WebSocket

---

## 5. Pipeline — Stage by Stage

### Stage 1: Ingest

```bash
# 1. Probe — extract metadata
ffprobe -v error -show_streams -show_format -of json input.mp4

# 2. Proxy — low-res for browser playback (short GOP = fast seeking)
ffmpeg -i input.mp4 \
  -vf scale=-2:480 \
  -c:v libx264 -preset veryfast -crf 28 -g 30 \
  -c:a aac -b:a 96k \
  -movflags +faststart \
  proxy.mp4

# 3. Audio — mono WAV for Whisper
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le audio.wav
```

- Store `duration`, `fps`, `width`, `height`, `vcodec` on the asset row
- Reject non-H.264/MP4 with a clear error (scope rule: only H.264/MP4)
- `-g 30` on the proxy means a keyframe every second at 30fps → seeking never waits more than 1s

### Stage 2: Transcribe

```python
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")

segments, info = model.transcribe(
    "audio.wav",
    word_timestamps=True,
    vad_filter=True,
    initial_prompt="Umm, let me think, like, hmm... okay, so, here's what I'm, uh, thinking."
)

words = []
for segment in segments:
    for word in segment.words:
        words.append({
            "w": word.word.strip(),
            "start": round(word.start, 3),
            "end": round(word.end, 3),
            "prob": round(word.probability, 3)
        })
```

> **Whisper filler workaround:** Whisper tends to clean up "um" and "uh" from the transcript, hiding disfluencies you need for scoring. The `initial_prompt` containing fillers tells Whisper to keep them. **Mention this in the README** — it's the kind of detail that gets noticed by video engineering teams.

### Stage 3: Segment

Split the word stream into segments at:
- Pauses over ~0.7s between consecutive words
- Sentence-final punctuation (`.`, `?`, `!`)

```python
def segment_words(words, pause_threshold=0.7):
    segments = []
    current = []
    for i, w in enumerate(words):
        current.append(w)
        is_pause = (i + 1 < len(words) and
                    words[i + 1]["start"] - w["end"] > pause_threshold)
        is_sentence_end = w["w"].rstrip().endswith(('.', '?', '!'))
        if is_pause or is_sentence_end or i == len(words) - 1:
            segments.append({
                "start": current[0]["start"],
                "end": current[-1]["end"],
                "text": " ".join(x["w"] for x in current),
                "words": current
            })
            current = []
    return segments
```

### Stage 4: Retake Detection

Retakes are almost always adjacent. Only compare each segment against the **next ~6 segments** (or within a 90-second window).

**Three signals:**

| Signal | Method | Threshold |
|--------|--------|-----------|
| Semantic similarity | Cosine similarity of `all-MiniLM-L6-v2` embeddings | ≥ 0.8 |
| Lexical similarity | `rapidfuzz.fuzz.token_set_ratio` | ≥ 80 |
| False-start check | Normalized shorter segment is a prefix of the next | Mark shorter as abandoned |

**Cue phrases** ("let me redo that", "take two", "sorry, again", "one more time", "wait") → mark the segment before them as a bad take and exclude the cue phrase itself from output.

**Clustering:** Merge matches with **union-find** into `take_groups`. A segment with no match is a group of one (unique content — always kept).

```python
from sentence_transformers import SentenceTransformer
from rapidfuzz import fuzz
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')

def find_retakes(segments, sem_threshold=0.8, lex_threshold=80, window=6):
    embeddings = model.encode([s["text"] for s in segments])
    parent = list(range(len(segments)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        pa, pb = find(a), find(b)
        if pa != pb:
            parent[pa] = pb

    for i in range(len(segments)):
        for j in range(i + 1, min(i + window + 1, len(segments))):
            cos_sim = np.dot(embeddings[i], embeddings[j]) / (
                np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j])
            )
            lex_sim = fuzz.token_set_ratio(segments[i]["text"], segments[j]["text"])

            if cos_sim >= sem_threshold or lex_sim >= lex_threshold:
                union(i, j)

    # Group segments by root
    groups = {}
    for i in range(len(segments)):
        root = find(i)
        groups.setdefault(root, []).append(i)

    return groups
```

### Stage 5: Scoring

For each take in a group, compute:

| Feature | Direction | Weight |
|---------|-----------|--------|
| Filler rate (um, uh, like, you know) | lower is better | 0.20 |
| Repeated adjacent words ("the the") | lower is better | 0.10 |
| Longest internal pause | lower is better | 0.15 |
| Ends on a complete sentence | bonus | 0.10 |
| Audio level stability (std dev of frame RMS) | lower is better | 0.10 |
| Speech rate vs. clip median | closer is better | 0.10 |
| Mean word confidence from Whisper | higher is better | 0.15 |
| Position in group (later takes usually better) | small bonus | 0.10 |

- Normalize each feature to 0–1 within the group
- Weighted sum → final score
- Store per-feature breakdown in `segments.features` JSONB → UI can explain why a take won
- Weights live in a single config file (`analysis/config.yaml`)

**Audio stability via FFmpeg:**
```bash
ffmpeg -i input.mp4 -ss {start} -t {duration} \
  -af astats=metadata=1:reset=1 -f null - 2>&1 | grep RMS_level
```

### Stage 6: Timeline JSON

```json
{
  "assetId": "a1b2c3",
  "fps": 30,
  "clips": [
    {
      "id": "c1",
      "in": 0.000,
      "out": 6.433,
      "groupId": null,
      "reason": "unique segment"
    },
    {
      "id": "c2",
      "in": 21.100,
      "out": 29.867,
      "groupId": "g3",
      "reason": "take 3/3, score 0.91 — fewest fillers, strongest close"
    }
  ]
}
```

**Frame snapping:**
```
snapped_time = round(t * fps) / fps
```

**Padding:** Add ~80–100ms on each side, but clamp so clips don't overlap.

### Stage 7: Fan-Out Render (The Backend Showpiece)

**BullMQ Flow structure:**
```typescript
// Parent job: merge (runs after ALL children complete)
const flow = await flowProducer.add({
  name: 'merge',
  queueName: 'merge',
  data: { renderId, segmentCount: clips.length },
  children: clips.map((clip, idx) => ({
    name: `render-segment-${idx}`,
    queueName: 'render-segment',
    data: {
      renderId,
      idx,
      sourceKey: asset.storageKey,
      inTime: clip.in,
      outTime: clip.out,
      outputKey: `renders/${renderId}/seg_${idx}.mp4`
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }
  }))
});
```

**Render each segment** (re-encode for frame-accurate cuts):
```bash
ffmpeg -ss {in} -i source.mp4 -t {duration} \
  -c:v libx264 -preset veryfast -crf 18 -r 30 -pix_fmt yuv420p \
  -c:a aac -ar 48000 -ac 2 \
  -af "afade=t=in:d=0.015,afade=t=out:st={dur-0.015}:d=0.015" \
  -threads 2 \
  -progress pipe:1 \
  seg_{idx}.tmp.mp4

# On success:
mv seg_{idx}.tmp.mp4 seg_{idx}.mp4
```

**Merge (concat):**
```bash
# Generate list file
for f in seg_0.mp4 seg_1.mp4 ...; do
  echo "file '$f'" >> list.txt
done

ffmpeg -f concat -safe 0 -i list.txt -c copy output.tmp.mp4
mv output.tmp.mp4 output.mp4
```

**Critical notes:**
- `-c copy` concat works **only** because all segments use identical codec params
- 15ms audio fades prevent clicks at joins
- `-threads 2` per worker keeps the benchmark honest — without it, one FFmpeg saturates all cores
- Parse `-progress pipe:1` output (`out_time_us`) for per-segment progress

### Stage 8: Progress (WebSocket)

```
Workers → Redis Pub/Sub channel "render:{renderId}"
  → message: { renderId, segmentIdx, pct }

NestJS WS Gateway subscribes to "render:*"
  → forwards to browser room for that asset/render
  → browser shows per-segment progress bars
```

---

## 6. API Surface

```
POST   /assets                    Upload (multipart), returns assetId
GET    /assets/:id                Status + metadata + proxy URL
GET    /assets/:id/transcript     Word-level transcript
GET    /assets/:id/takes          Groups, segments, scores, chosen
PATCH  /take-groups/:id           Override chosen take { chosenSegmentId }
GET    /assets/:id/timeline       Current timeline JSON
POST   /assets/:id/renders        Start a render, returns renderId
GET    /renders/:id               Status, progress, download URL
WS     /ws?assetId=               Events: stage_change, progress, done, failed
```

---

## 7. UI Layout

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────────────────────────┐  ┌──────────────┐  │
│  │                              │  │  Take Groups │  │
│  │     Video Player (proxy)     │  │              │  │
│  │                              │  │  Group 1     │  │
│  │                              │  │  ▸ Take 1    │  │
│  └──────────────────────────────┘  │  ★ Take 2 ◄──── winner  │
│                                    │  ▸ Take 3    │  │
│  ┌──────────────────────────────┐  │              │  │
│  │ Timeline bar with segments   │  │  Group 2     │  │
│  │ ████ ▓▓ ████ ▓▓▓ ████       │  │  ★ Take 1    │  │
│  └──────────────────────────────┘  │              │  │
│                                    │  [Override]  │  │
│  ┌──────────────────────────────┐  └──────────────┘  │
│  │ Render Progress              │                    │
│  │ Seg 1: ████████████ 100%     │  [Render Button]   │
│  │ Seg 2: ██████░░░░░░  55%     │                    │
│  │ Seg 3: ░░░░░░░░░░░░   0%     │  [Download]       │
│  └──────────────────────────────┘                    │
└──────────────────────────────────────────────────────┘
```

---

## 8. Repo Structure

```
takepicker/
├─ docker-compose.yml           # Postgres, Redis, API, workers, analysis, web
├─ README.md
├─ ARCHITECTURE.md              # This file
├─ apps/
│  ├─ api/                      # NestJS: REST, WS gateway, BullMQ flow producers
│  │  ├─ src/
│  │  │  ├─ assets/             # upload, probe, status
│  │  │  ├─ takes/              # groups, override
│  │  │  ├─ renders/            # start render, get status
│  │  │  ├─ ws/                 # WebSocket gateway
│  │  │  └─ storage/            # storage interface (disk → MinIO)
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ workers/                  # TypeScript BullMQ workers
│  │  ├─ src/
│  │  │  ├─ ingest.worker.ts    # ffprobe, proxy, audio extract
│  │  │  ├─ render.worker.ts    # per-segment FFmpeg render
│  │  │  └─ merge.worker.ts     # concat segments
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ analysis/                 # Python service
│  │  ├─ app/
│  │  │  ├─ transcribe.py       # faster-whisper
│  │  │  ├─ segment.py          # split into segments
│  │  │  ├─ cluster.py          # retake detection
│  │  │  ├─ score.py            # take scoring
│  │  │  └─ api.py              # FastAPI endpoints
│  │  ├─ config.yaml            # scoring weights
│  │  ├─ Dockerfile
│  │  └─ requirements.txt
│  └─ web/                      # Next.js
│     ├─ src/
│     │  ├─ app/
│     │  │  └─ page.tsx         # single page: player, takes, render
│     │  ├─ components/
│     │  │  ├─ Player.tsx
│     │  │  ├─ TakesList.tsx
│     │  │  └─ RenderProgress.tsx
│     │  └─ hooks/
│     │     └─ useWebSocket.ts
│     ├─ Dockerfile
│     └─ package.json
├─ packages/
│  └─ contracts/                # Shared types (timeline, job payloads)
│     ├─ src/
│     │  ├─ timeline.ts
│     │  ├─ job.ts
│     │  └─ events.ts
│     └─ package.json
├─ scripts/
│  ├─ benchmark.sh              # Run with N=1,2,4,8 workers
│  └─ evaluate.py               # Compare detected groups vs hand-labeled
└─ samples/
   ├─ test_clip_1.mp4
   ├─ test_clip_1_labels.json   # Hand-labeled ground truth
   └─ ...
```

---

## 9. Three-Day Build Plan

### Day 1: Ingest to Transcript

| Task | Detail |
|------|--------|
| Infrastructure | `docker-compose.yml` with Postgres, Redis, API, analysis |
| Upload | `POST /assets` multipart endpoint, store to disk volume |
| Ingest worker | ffprobe → proxy → audio extract via BullMQ |
| Transcribe | Python service: Whisper → word timestamps → return JSON |
| Status tracking | Asset status transitions, WS `stage_change` events |
| **End of day** | Upload a clip, see status move through UPLOADED → ... → TRANSCRIBING → done |

### Day 2: Analysis and Timeline

| Task | Detail |
|------|--------|
| Segmentation | Split words at pauses/sentences |
| Retake clustering | Embeddings + rapidfuzz + false-start + union-find |
| Scoring | Feature extraction, weighted sum, store breakdown |
| Timeline builder | Frame snapping, padding, generate JSON |
| UI | Player, takes list with scores, override click |
| **End of day** | Upload raw clip, see grouped takes with highlighted winner |

### Day 3: Render, Benchmark, Ship

| Task | Detail |
|------|--------|
| Fan-out render | BullMQ Flow: render-segment children → merge parent |
| Recovery | Atomic writes, stalled-job detection, kill test |
| Progress | Redis pub/sub → WS → per-segment bars in UI |
| Benchmark | 1, 2, 4, 8 workers on 10-min clip, plot speedup |
| Polish | README, architecture diagram, 60-second demo video |
| **End of day** | Push to GitHub, record demo |

### If You Fall Behind — Cut In This Order:
1. ~~MinIO~~ → use disk volume
2. ~~Per-segment WS bars~~ → overall progress only
3. ~~Override UI~~ → just show the picks
4. ~~Benchmark at 8 workers~~ → do 1, 2, 4

**Never cut:** fan-out render, recovery demo, README

---

## 10. Benchmark Method

```bash
#!/bin/bash
# scripts/benchmark.sh
CLIP="samples/10min_test.mp4"
for N in 1 2 4 8; do
  echo "=== Workers: $N ==="
  docker compose up -d --scale render-worker=$N
  START=$(date +%s%N)
  # trigger render via API and wait for DONE status
  curl -s -X POST "http://localhost:3000/assets/$ASSET_ID/renders"
  # poll until done
  while [ "$(curl -s http://localhost:3000/renders/$RENDER_ID | jq -r .status)" != "DONE" ]; do
    sleep 1
  done
  END=$(date +%s%N)
  ELAPSED=$(( (END - START) / 1000000 ))
  echo "Workers=$N Time=${ELAPSED}ms"
  docker compose down
done
```

The curve will flatten because the merge step is serial (**Amdahl's law**). Note your machine's core count — scaling stops near the physical core count. **Say both things in the README.**

---

## 11. JD Coverage Map

### Backend Engineer Role

| JD Requirement | Covered? | Where |
|---------------|----------|-------|
| Proxy transcodes | ✅ | Ingest worker: 480p proxy |
| Fan-out export pipeline | ✅ | BullMQ Flow: parallel segment render + concat |
| Analysis workers that understand footage | ✅ | Whisper, retake clustering, scoring |
| Agent service → timeline operations | ✅ | MCP layer (if built) |
| Job flows, state, recovery, progress | ✅ | State machine, per-segment retry, WS progress |
| APIs and state contracts | ✅ | Timeline JSON + job types in `packages/contracts` |
| Huge files, flaky uploads | ⚠️ | Add resumable chunked upload (tus) |
| GPU workers | ⚠️ | Note NVENC (`h264_nvenc`) in README "Next steps" |
| Codec internals | ⚠️ | Test with H.265 clip, report proxy time vs. source |
| FFmpeg depth | ✅ | Proxies, audio extract, frame-accurate cuts, concat |

### Fullstack Engineer Role

| JD Requirement | Covered? | Where |
|---------------|----------|-------|
| Pixel-to-service ownership | ✅ | Next.js UI → NestJS API → workers |
| Real-time editing, smooth playback | ⚠️ | Basic `<video>` + timeline |
| Large media on client | ⚠️ | Add WebCodecs frame-stepper for bonus |
| AI editing experience | ✅ | Retake detection + optional MCP layer |
| Performance on big projects | ✅ | Benchmark with scaling workers |
| Bonus: media, LLMs, offline-first | ✅/❌ | Media ✅, LLM ✅, offline-first ❌ |
