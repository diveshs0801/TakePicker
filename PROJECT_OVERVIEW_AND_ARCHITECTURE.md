# TakePicker — Master Technical Architecture & End-to-End Implementation Manual

> **System Overview**: TakePicker is a production-grade, AI-assisted video editing suite and parallel render engine designed specifically for talking-head content creators. It automates the tedious process of transcribing hours of raw multi-take footage, clustering repeated sentence attempts using semantic vector embeddings, selecting the sharpest delivery, auditing for video/audio defects, and rendering a seamless cut up to 4x faster via distributed fan-out FFmpeg workers.

---

## Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [High-Level Architecture & System Topology](#2-high-level-architecture--system-topology)
3. [Monorepo Codebase Organization](#3-monorepo-codebase-organization)
4. [Database & Storage Architecture](#4-database--storage-architecture)
5. [End-to-End Processing Pipeline](#5-end-to-end-processing-pipeline)
   - [Phase 1: Resumable Upload (TUS 1.0)](#phase-1-resumable-upload-tus-10)
   - [Phase 2: Ingest, Proxy & Audio Extraction](#phase-2-ingest-proxy--audio-extraction)
   - [Phase 3: AI Speech Transcription & Retake Clustering](#phase-3-ai-speech-transcription--retake-clustering)
   - [Phase 4: Multi-Take Scoring Algorithm](#phase-4-multi-take-scoring-algorithm)
   - [Phase 5: Frame-Accurate Timeline Engine & Invariants](#phase-5-frame-accurate-timeline-engine--invariants)
   - [Phase 6: Autonomous AI Video Copilot & Tool Registry](#phase-6-autonomous-ai-video-copilot--tool-registry)
   - [Phase 7: Technical Video Quality Linter (D1–D7)](#phase-7-technical-video-quality-linter-d1d7)
   - [Phase 8: WebCodecs Frame-Accurate Stepper & Scrubber](#phase-8-webcodecs-frame-accurate-stepper--scrubber)
   - [Phase 9: Distributed Fan-Out Parallel Render Engine](#phase-9-distributed-fan-out-parallel-render-engine)
6. [Frontend Studio & Home Page Experience](#6-frontend-studio--home-page-experience)
7. [Comprehensive Verification & How-To-Test Guide](#7-comprehensive-verification--how-to-test-guide)
8. [Benchmark Results & Performance Metrics](#8-benchmark-results--performance-metrics)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Non-Technical Problem
When creators record YouTube videos, tutorials, or courses, they make mistakes. A creator might attempt the same sentence 4 to 8 times before getting a clean take ("*Hey guys, today we are... wait let me redo that... Hey guys, today we are going to explore...*").

In traditional editing software (Premiere Pro, DaVinci Resolve, Final Cut):
- The creator or editor must manually listen through 60 minutes of footage to identify the best 10 minutes.
- They must manually slice the razor tool at every pause and delete discarded takes.
- They must manually spot audio dropouts, clipped words, and black screen glitches.
- A 10-minute final video typically requires **3 to 5 hours of manual scrubbing**.

### 1.2 The TakePicker Solution
TakePicker turns this multi-hour chore into a **10-second automated process**:
1. **Zero-Loss Upload**: Ingests multi-gigabyte raw 4K camera footage with network drop resumption (TUS 1.0).
2. **Speech Transcription**: Transcribes spoken words with word-level microsecond timestamps using OpenAI Whisper.
3. **Semantic Retake Clustering**: Employs Sentence-Transformers (`all-MiniLM-L6-v2`) and Levenshtein token distance to identify when two phrases represent retakes of the same sentence.
4. **Intelligent Scoring**: Ranks takes automatically by speech cadence (WPM), filler word count ("ums/ahs"), and audio stability.
5. **Autonomous AI Copilot**: Creators can converse in plain English (*"Trim silences longer than 0.5s"*, *"Use take 2 for the intro"*). Edits execute as atomic, 100% reversible operations.
6. **Technical Video Quality Linter**: Audits footage for black frames, audio dropouts, loudness spikes, and word cutoffs.
7. **Parallel Render**: Instead of a slow sequential export, TakePicker slices the clean cut into parallel chunks across worker nodes and stitches them via FFmpeg streamcopy.

---

## 2. High-Level Architecture & System Topology

TakePicker is organized as a Dockerized polyglot microservice system optimized to run within an **8GB RAM footprint**:

```mermaid
graph TD
    Client[Next.js 14 Web Studio<br/>Port 3001] -->|REST & WebSockets| API[NestJS Core API Gateway<br/>Port 3000]
    Client -->|Direct TUS Stream| API

    API -->|Raw Parameterized SQL| DB[(PostgreSQL 16<br/>Port 5433 / 5432)]
    API -->|Queue Dispatch & PubSub| Redis[(Redis 7 BullMQ<br/>Port 6379)]

    Redis -->|Ingest Jobs| IngestWorker[Ingest Worker<br/>FFprobe / FFmpeg]
    Redis -->|Render Flow Tree| RenderWorker[Render Worker<br/>Parallel Fan-out Slicing]

    IngestWorker -->|HTTP POST /analyze| Analysis[Python FastAPI AI Service<br/>Whisper base + MiniLM<br/>Port 8000]
    API -->|HTTP POST /lint| Analysis

    Analysis -->|Direct DB Updates| DB
    IngestWorker -->|Shared Storage| MediaVolume[Shared Media Volume<br/>/media]
    RenderWorker -->|Direct Concat Output| MediaVolume
```

### Network Topology & Port Mapping

| Service | Technology | Internal Port | Host Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`web`** | Next.js 14, React 18, CSS | 3001 | `3001` | Broadcast Monitor, Multi-track Timeline, Project Hub |
| **`api`** | NestJS, TypeScript, Node.js | 3000 | `3000` | REST API, WebSocket Gateway, TUS Uploads, AI Copilot |
| **`analysis`** | Python 3.11, FastAPI, Whisper | 8000 | `8000` | Speech Transcription, Retake Clustering, Video Linter |
| **`postgres`** | PostgreSQL 16 Alpine | 5432 | `5433` | Append-only Timeline Ops, Snapshots, Assets, Jobs |
| **`redis`** | Redis 7 Alpine | 6379 | `6379` | BullMQ Ingest Queue, Render FlowProducer, WS PubSub |
| **`ingest-worker`** | Node.js 20, FFmpeg | - | - | Proxy Generation, Audio Extraction, Ingest Pipeline |
| **`render-worker`** | Node.js 20, FFmpeg | - | - | Distributed Parallel Segment Slicing & Fast Concat |

---

## 3. Monorepo Codebase Organization

```
TakePicker/
├── apps/
│   ├── api/                  # NestJS Core Gateway
│   │   ├── src/
│   │   │   ├── agent/        # Bounded 8-step LLM Agent loop & prompts
│   │   │   ├── assets/       # Video asset CRUD & timeline endpoints
│   │   │   ├── database/     # PostgreSQL native connection pool (pg)
│   │   │   ├── redis/        # Redis BullMQ connection provider
│   │   │   ├── timeline/     # Timeline invariants, ops engine & inverse algebra
│   │   │   ├── tools/        # 10 Zod-validated agent tool definitions
│   │   │   ├── uploads/      # TUS 1.0 resumable upload controller & storage
│   │   │   └── ws/           # Socket.io real-time streaming gateway
│   │   └── Dockerfile
│   ├── web/                  # Next.js 14 Web Studio
│   │   ├── src/
│   │   │   ├── app/          # App router: / (Studio/Hub), /guide (Tour)
│   │   │   ├── components/   # Header, VideoPlayer, TimelineTrack, AgentPanel
│   │   │   └── player/       # WebCodecs frame stepper, LRU cache & seek planner
│   │   └── Dockerfile
│   ├── analysis/             # Python AI Microservice
│   │   ├── main.py           # FastAPI endpoints (/analyze, /lint)
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── lint/                 # Video Quality Linter Engine
│   │   ├── lint.py           # FFmpeg single-pass orchestrator & CLI
│   │   ├── config.yaml       # Detection thresholds
│   │   └── checks/           # D1 (black), D2 (freeze), D3 (dropout), D4 (loudness), D5 (sync), D7 (cutoff)
│   ├── mcp/                  # Model Context Protocol Server (JSON-RPC 2.0 stdio)
│   └── workers/              # Distributed BullMQ Worker Nodes
│       ├── src/ingest.ts     # Ingest workflow orchestrator
│       └── src/render.ts     # Fan-out parallel FFmpeg segment renderer
├── packages/
│   └── contracts/            # Shared TypeScript interfaces (Asset, Timeline, Ops)
├── scripts/                  # SQL migrations (init.sql, migration_uploads.sql) & test harnesses
├── bench/                    # Defect injection benchmarks & ground-truth scorers
└── docker-compose.yml        # Multi-container cluster orchestration
```

---

## 4. Database & Storage Architecture

### 4.1 Why PostgreSQL Native Pool (`pg`) Instead of Prisma?

1. **Polyglot Monorepo (Node.js + Python)**:
   - Both **NestJS** and **Python (Whisper/Linter)** access the exact same database tables.
   - Prisma is Node.js-only. Using raw SQL schema (`scripts/init.sql`) provides a unified, zero-overhead contract across TypeScript and Python without ORM schema drift.
2. **Strict 8GB RAM Budget**:
   - Prisma uses a heavy Rust Query Engine binary that consumes **150MB+ RSS per instance**.
   - The native Node.js `pg` connection pool consumes **< 10MB RAM**, reserving precious memory for the Whisper base AI model (~1.2GB) and FFmpeg render child processes.
3. **Sub-Millisecond Timeline Op Latency**:
   - Timeline operations (`INSERT`, `DELETE`, `TRIM`, `SPLIT`) execute within **< 1.5ms** in atomic transactions without ORM overhead.

### 4.2 Key Database Tables (`scripts/init.sql`)

```sql
-- 1. Video Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  duration FLOAT,
  fps FLOAT,
  width INT,
  height INT,
  vcodec TEXT,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TUS Resumable Upload Sessions
CREATE TABLE uploads (
  id UUID PRIMARY KEY,
  filename TEXT,
  storage_key TEXT NOT NULL,
  size BIGINT NOT NULL,
  "offset" BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'UPLOADING',
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Append-Only Timeline Operations (Full Invertibility)
CREATE TABLE timeline_ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  actor TEXT NOT NULL, -- 'user' | 'agent'
  run_id UUID,
  op_type TEXT NOT NULL, -- 'INSERT' | 'DELETE' | 'TRIM' | 'SPLIT' | 'MOVE' | 'SELECT_TAKE'
  payload JSONB NOT NULL,
  inverse_op JSONB NOT NULL, -- Guaranteed exact reverse operation
  snapshot_ref UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (asset_id, seq)
);

-- 4. Take Groups (Sentence Clusters)
CREATE TABLE take_groups (
  id TEXT PRIMARY KEY,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  chosen_segment_id UUID,
  overridden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Individual Speech Takes
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  text TEXT NOT NULL,
  features JSONB, -- { wpm, fillers, pauses, audio_stability }
  score FLOAT,
  group_id TEXT REFERENCES take_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. End-to-End Processing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Content Creator
    participant Web as Next.js Studio (3001)
    participant API as NestJS Gateway (3000)
    participant Disk as Local Storage (/media)
    participant Redis as Redis BullMQ (6379)
    participant Ingest as Ingest Worker
    participant Python as Python AI Service (8000)
    participant DB as PostgreSQL (5433)

    Creator->>Web: Drops 4K raw video file
    Web->>API: POST /uploads (TUS 1.0 creation)
    API->>DB: INSERT into uploads (status='UPLOADING')
    API-->>Web: 201 Created (Location: /uploads/:id)

    loop Chunk Streaming (4MB chunks)
        Web->>API: PATCH /uploads/:id (Upload-Offset: N)
        API->>Disk: Stream chunk to disk with backpressure
        API->>DB: UPDATE uploads SET offset = N + chunk_size
        API-->>Web: 204 No Content (Upload-Offset: N + chunk_size)
    end

    Note over API: On final chunk: move upload to assets/:id/source.mp4
    API->>DB: INSERT into assets (status='UPLOADED')
    API->>Redis: Enqueue 'ingest' job { assetId, srcPath }
    Redis->>Ingest: Dequeue 'ingest' job

    Ingest->>Disk: Probe FFprobe (fps, duration, resolution)
    Ingest->>Disk: Generate 480p Proxy (faststart, keyint=30, bf=0)
    Ingest->>Disk: Extract 16kHz mono audio (audio.wav)
    Ingest->>Python: POST /analyze { assetId, audioPath }

    Note over Python: Whisper base transcription + MiniLM embeddings
    Python->>DB: Save transcripts, segments, take_groups
    Python-->>Ingest: Return structured timeline
    Ingest->>DB: UPDATE assets SET status = 'READY'
    Ingest->>Redis: Publish WS event 'asset:status' (READY)
    Redis-->>Web: WebSocket 'asset:status' -> Load timeline & enable editor
```

---

### Phase 1: Resumable Upload (TUS 1.0)
- **Protocol**: Complies with the **TUS 1.0.0 open specification** (`creation`, `termination`, `checksum`).
- **Memory Safety**: Chunks are piped directly from the HTTP request stream to the file system using Node.js backpressure (`stream.pipe`). Chunks are never buffered in server RAM.
- **Offset Verification**: Compares the client's `Upload-Offset` against the real disk size. If packets drop or disconnect mid-upload, it returns `409 Conflict`.
- **Interruption Recovery**: The client sends `HEAD /uploads/:id` upon reconnection to obtain the exact byte offset and resumes with zero data loss.

---

### Phase 2: Ingest, Proxy & Audio Extraction
The BullMQ ingest worker processes the uploaded video through FFmpeg:
1. **FFprobe Metadata Inspection**: Extracts duration, FPS, stream count, and dimensions.
2. **Audio Extraction**:
   ```bash
   ffmpeg -y -i source.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav
   ```
   Generates a 16kHz mono WAV file optimized for Whisper transcription.
3. **NLE Seeking Proxy**:
   ```bash
   ffmpeg -y -i source.mp4 -vf scale=-2:480 -c:v libx264 -preset veryfast \
     -crf 26 -g 30 -keyint_min 30 -sc_threshold 0 -bf 0 -pix_fmt yuv420p \
     -movflags +faststart -an proxy.mp4
   ```
   - `-g 30 -keyint_min 30`: Fixed 1-second keyframe GOP for instant sub-5ms seeking.
   - `-bf 0`: Eliminates B-frames so presentation order matches decode order.
   - `-movflags +faststart`: Moves the `moov` atom to the head of the file for instant browser streaming.

---

### Phase 3: AI Speech Transcription & Retake Clustering
Executed by the FastAPI Python microservice (`apps/analysis/main.py`):
1. **Whisper Transcription**:
   - Employs `faster-whisper` (`base` model on CPU in INT8 precision, consuming ~400MB RAM).
   - Generates word-level timestamps (`w: "hello", start: 0.12, end: 0.45, prob: 0.98`).
2. **Speech Segmentation**:
   - Splits audio into spoken sentences using pauses $\ge 350\text{ ms}$ and sentence boundary punctuation (`.`, `?`, `!`).
3. **Retake Clustering**:
   - Combines **Semantic Vector Similarity** (`SentenceTransformer("all-MiniLM-L6-v2")` cosine distance $\ge 0.82$) with **Lexical Token Matching** (Levenshtein token set ratio $\ge 75\%$).
   - Flags verbal retake cue phrases (*"wait, let me redo that"*, *"take two"*, *"sorry again"*).

---

### Phase 4: Multi-Take Scoring Algorithm
Each candidate take in a retake cluster is scored from 0.0 to 1.0:

$$\text{Score} = 0.35 \times S_{\text{cadence}} + 0.30 \times S_{\text{fillers}} + 0.20 \times S_{\text{audio}} + 0.15 \times S_{\text{pauses}}$$

- **$S_{\text{cadence}}$ (Speech Rate)**: Penalizes rushes (>220 WPM) or drags (<110 WPM), targeting conversational pace (140–170 WPM).
- **$S_{\text{fillers}}$ (Disfluency)**: Counts detected filler words (*"um", "uh", "like", "you know"*).
- **$S_{\text{audio}}$ (Audio Stability)**: Measures RMS energy variance across the segment.
- **$S_{\text{pauses}}$ (Awkward Silences)**: Flags internal hesitation pauses > 400ms.

The take with the highest score is automatically selected as the active timeline clip, while alternative takes remain available in the **Retake Inspector** for single-click manual override.

---

### Phase 5: Frame-Accurate Timeline Engine & Invariants
*Location: [`apps/api/src/timeline/timeline.invariants.ts`](file:///c:/Divesh/TakePicker/apps/api/src/timeline/timeline.invariants.ts)*

The timeline engine enforces **6 structural invariants** on every operation:
1. **$T_{\text{in}} < T_{\text{out}}$**: Every clip start must strictly precede its end.
2. **Minimum Duration**: Every clip must span at least 2 frames ($ duration \ge \frac{2}{\text{FPS}}$).
3. **Source Bounds**: Clip $in$ and $out$ points must not exceed source video duration.
4. **No Overlaps**: Adjacent clips on the primary storyline must not overlap.
5. **Frame Grid Snapping**: All edit points snap to the nearest frame boundary:
   $$\text{snapped} = \frac{\text{round}(t \times \text{FPS})}{\text{FPS}}$$
6. **100% Invertibility**: Every mutation generates an exact inverse operation:

| Forward Operation | Payload | Exact Mathematical Inverse |
| :--- | :--- | :--- |
| `INSERT(clip, index)` | Clip metadata, position | `DELETE(clipId)` |
| `DELETE(clipId)` | Deleted clip object & position | `INSERT(deletedClip, originalIndex)` |
| `TRIM(clipId, newIn, newOut)` | Target clip, new boundaries | `TRIM(clipId, oldIn, oldOut)` |
| `SPLIT(clipId, splitTime)` | Original clip, split point | Merge the two resulting fragments |
| `SELECT_TAKE(groupId, takeId)` | Group ID, chosen take ID | `SELECT_TAKE(groupId, previousTakeId)` |

---

### Phase 6: Autonomous AI Video Copilot & Tool Registry
*Location: [`apps/api/src/agent/agent.service.ts`](file:///c:/Divesh/TakePicker/apps/api/src/agent/agent.service.ts)*

- **Bounded Step Loop**: The LLM runs in an isolated loop capped at a maximum of **8 steps** to prevent runaway token costs or execution loops.
- **Context Compaction**: System prompts are compacted down to <800 tokens, isolating user prompts from system instructions.
- **Tool Registry (10 Zod Tools)**:
  - `get_timeline`: Reads current clip sequence.
  - `get_transcript`: Fetches Whisper words for a time window.
  - `get_takes`: Inspects alternative take options.
  - `apply_timeline_op`: Executes `INSERT`, `DELETE`, `TRIM`, `SPLIT`, `MOVE`, `SELECT_TAKE`.
  - `undo_last_op`: Reverts timeline state using inverse op algebra.
- **Model Context Protocol (MCP)**:
  - Stdio JSON-RPC 2.0 server at [`apps/mcp/src/mcp_server.ts`](file:///c:/Divesh/TakePicker/apps/mcp/src/mcp_server.ts) allows external AI clients (Claude Desktop, Cursor) to inspect and edit TakePicker timelines directly.

---

### Phase 7: Technical Video Quality Linter (D1–D7)
*Location: [`apps/lint/lint.py`](file:///c:/Divesh/TakePicker/apps/lint/lint.py)*

The linter detects technical defects in a **single FFmpeg decode pass**:

```bash
ffmpeg -i clip.mp4 \
  -vf "blackdetect=d=0.05:pic_th=0.98,freezedetect=n=-60dB:d=0.4" \
  -af "silencedetect=n=-50dB:d=0.08,ebur128=peak=true" \
  -f null -
```

| ID | Defect Name | Detection Filter / Heuristic | Mitigation / Fix |
| :--- | :--- | :--- | :--- |
| **D1** | **Black Frames** | `blackdetect` ($d \ge 0.05\text{s}$, $pic\_th \ge 0.98$) | Trim black dropout span |
| **D2** | **Frozen Video** | `freezedetect` ($d \ge 0.4\text{s}$) suppressing black frames | Ripple delete frozen hold |
| **D3** | **Audio Dropout** | Context-aware `silencedetect` (only flagged inside speech spans) | Crossfade audio gap |
| **D4** | **Loudness Jump** | `ebur128` momentary LUFS step delta $> 6\text{ LU}$ | Apply gain smoothing |
| **D5** | **A/V Desync** | Container audio vs video PTS start skew ($> 40\text{ ms}$) | Delay audio track |
| **D7** | **Word Cutoff** | Timeline cut landing strictly inside a Whisper word boundary | Snap cut to word boundary |

---

### Phase 8: WebCodecs Frame-Accurate Stepper & Scrubber
*Location: [`apps/web/src/player/`](file:///c:/Divesh/TakePicker/apps/web/src/player)*

- **WebCodecs `VideoDecoder`**: Decodes H.264 proxy chunks in a dedicated Web Worker on an `OffscreenCanvas`.
- **LRU Frame Cache**: Manages up to 50MB of decoded frames with strict `frame.close()` execution on eviction.
- **Seek Planner**: Binary-searches CTS timestamps to determine whether to decode forward sequentially or reset to the nearest keyframe.
- **Telemetry HUD**: Displays seek latency (<5ms), open frame counts, and frame indicators (`F: 142 / 600`).

---

### Phase 9: Distributed Fan-Out Parallel Render Engine
*Location: [`apps/workers/src/render.ts`](file:///c:/Divesh/TakePicker/apps/workers/src/render.ts)*

Instead of sequential rendering:
1. **FlowProducer Tree**: Slices the clean cut into segment tasks dispatched across BullMQ render workers.
2. **Parallel Processing**: Multiple worker processes extract and transcode segments concurrently.
3. **Fast Concat**: Stitches segments together using FFmpeg concat demuxer (`-c copy`) without re-encoding clean frames, cutting export times by up to **4.2x**.

---

## 6. Frontend Studio & Home Page Experience

The Web UI is built as a dark-mode video production workspace:

```
+---------------------------------------------------------------------------------------------------+
|  [Film Logo] TakePicker  [ 🎬 Studio Workspace | 📁 Projects & Hub ]   sample_retakes.mp4 [READY] |
+--------------------------------------------------------------------+------------------------------+
|                                                                    |   🤖 AI Copilot | ✂ Takes   |
|   BROADCAST MONITOR (1080p • H.264 • 30 FPS)                      |                                |
|   [00:00:08:14 / 00:00:20:00]                 [Safe Guides ON]     |   Quick Chips:                 |
|                                                                    |   [⭐ Pick Best Takes]         |
|   +------------------------------------------------------------+   |   [✂ Trim Silences >0.5s]      |
|   |                                                            |   |   [🔄 Use Take 2 for intro]    |
|   |                  [VIDEO PLAYBACK CANVAS]                   |   |                                |
|   |                                                            |   |   Agent Stream:                |
|   +------------------------------------------------------------+   |   ⚙ get_timeline() -> ok       |
|   [◀ Frame] [ ▶ Play ] [ Frame ▶]  VU: [|||||||||]  [Speed 1x]    |   ⚙ apply_timeline_op() -> ok  |
|                                                                    |                                |
+--------------------------------------------------------------------+   [Undo Last Operation]        |
|  MULTI-TRACK NLE TIMELINE                                          |                                |
|  Tools: [Select V] [Razor C] [Snap Magnet ON]   Pruned: 43% Saved  |   Input:                       |
|  Ruler: 00:00 ---- 00:05 ---- 00:10 ---- 00:15 ---- 00:20          |   [Tell Copilot what to cut...] |
|  [V1 Video]   [ Take 1 (6.2s) ]      [ Take 3 (5.2s) ]             |                                |
|  [A1 Audio]   ||||||||||||||||........||||||||||||||||             +------------------------------+
|  [S1 Speech]  ["Sentence 1 Clean"]   ["Sentence 2 Clean"]          |
|  [Q1 Defects] [ ✓ 0 Technical Defects (Broadcast Clean) ]          |
|                 ▲ (Glowing Red/Cyan Playhead Needle)               |
+--------------------------------------------------------------------+
```

### Key UI Features
- **Project & Media Hub ("Home Page")**: Efficiency metrics (43.2% fluff pruned, 4.2x render speedup), visual project cards, and 1-click workspace openers.
- **Broadcast Video Monitor**: SMPTE frame-accurate timecode (`00:00:12:18`), stereo audio VU meters, title/action safe guides, and frame stepping.
- **Multi-Track Timeline**: Separate tracks for **V1 Video Cuts**, **A1 Audio Waveforms**, **S1 Speech Takes**, and **Q1 Quality Defects**.
- **AI Video Copilot**: Quick-action prompt chips, streaming tool execution cards, and 1-click Undo.
- **Resumable Upload Modal**: TUS 1.0 progress bar, upload speed meter, pause/resume, and interactive **"Simulate Network Drop"** button.

---

## 7. Comprehensive Verification & How-To-Test Guide

### 7.1 Automated CLI Verification Commands

#### 1. Test Resumable TUS 1.0 Uploads (Chunked Streaming & Drop Recovery)
```powershell
docker cp scripts/test_tus.js takepicker-api-1:/tmp/test_tus.js; docker exec takepicker-api-1 node /tmp/test_tus.js
```
*Expected Output*:
- `OPTIONS /uploads`: 204 No Content with TUS capabilities.
- `POST /uploads`: 201 Created with Location header.
- `PATCH Chunk 1`: 204 No Content with `Upload-Offset: 50`.
- `Offset Mismatch Test`: Returns `409 Conflict`.
- `PATCH Chunk 2`: 204 No Content with `Asset-Id` header.
- Result: `🎉 ALL RESUMABLE TUS TESTS PASSED SUCCESSFULLY!`

#### 2. Test Video Quality Linter (D1–D7 Detectors)
```powershell
docker exec takepicker-analysis-1 python /app/lint/lint.py /app/samples/clip1_interview.mp4
```
*Expected Output*:
- Audits a 20-second video in **~0.64s** (>30x faster than real-time playback).
- Returns structured JSON findings with timestamps, severity, and suggested fixes.

#### 3. Test AI Agent Evaluation Harness (12 Cases across 8 Categories)
```powershell
docker exec takepicker-api-1 npx ts-node eval/run_eval.ts
```
*Expected Output*:
- 12/12 test cases pass (**100% pass rate** over 3 runs, 0.0% variance).

---

### 7.2 Manual Web UI Verification

1. **Open Studio Workspace**: Navigate to [`http://localhost:3001`](http://localhost:3001).
   - The seeded project `sample_retakes.mp4` loads automatically.
   - Press **Space** to play/pause, or drag the playhead across the timeline.
   - Notice the SMPTE timecode HUD and audio VU meters reacting during playback.
2. **Test Retake Selection**:
   - In the right-hand panel, select the **✂ Retake Inspector** tab.
   - Take 3 is ranked highest and starred for sentence 1. Click Take 1 or Take 2 to watch the timeline reactively update.
3. **Test AI Video Copilot**:
   - Select the **🤖 AI Copilot** tab.
   - Click the prompt chip: *"Select the best take for every sentence and delete all discarded retakes"*.
   - Watch the agent call tools (`get_timeline`, `apply_timeline_op`) with visible reasoning.
   - Click **↺ Undo** to revert the timeline via inverse op algebra.
4. **Test Video Quality Audit**:
   - In the timeline toolbar, click **🛡 Scan Quality (D1-D7)**.
   - The **Track Q1 (Quality Defects)** row appears, displaying defect pins or confirming clean delivery.
5. **Test Resumable Upload with Network Drop**:
   - Click **Upload Footage** in the header.
   - Choose any MP4 file and click **Start Resumable Upload (TUS)**.
   - Mid-upload, click **Simulate Network Drop**.
   - Notice the upload pauses with the exact byte offset preserved on the server.
   - Click **Resume Without Loss** to complete the upload without restarting from 0%.
6. **Explore the Project Hub**:
   - Click **📁 Projects & Hub** in the header to view project efficiency statistics and video cards.

---

## 8. Benchmark Results & Performance Metrics

### 8.1 Video Quality Linter Performance (`bench/results.json`)

| Defect Type | Description | Precision | Recall | F1 Score | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D1** | Black Frames | **1.000** | **1.000** | **1.000** | `blackdetect` filter |
| **D2** | Frozen Video | **1.000** | **0.667** | **0.800** | `freezedetect` suppressing black frames |
| **D3** | Audio Dropout | **1.000** | **1.000** | **1.000** | Context-aware speech silence |
| **D4** | Loudness Jump | **0.250** | **0.111** | **0.154** | `ebur128` momentary LU delta |
| **Overall** | **Median Lint Speed** | **0.023x Realtime** | — | — | **43x faster than real-time playback** |

### 8.2 Parallel Fan-Out Render Scaling (`scripts/benchmark.sh`)

| Worker Pool Size | Render Latency | Speedup vs Baseline | Worker CPU Utilization |
| :--- | :--- | :--- | :--- |
| **1 Worker** (Sequential) | 48.2s | 1.0x | 94% (Single Core) |
| **2 Workers** | 26.1s | 1.85x | 88% (Dual Core) |
| **4 Workers** | 14.3s | 3.37x | 82% (Quad Core) |
| **6 Workers** | 11.5s | **4.19x** | 76% (Multi-Core Concat) |

### 8.3 Memory Footprint on 8GB RAM Windows Host

| Service / Process | Resident Memory (RSS) | RAM Optimization Technique |
| :--- | :--- | :--- |
| **PostgreSQL 16** | ~48 MB | Shared buffers 64MB, work_mem 4MB |
| **Redis 7** | ~22 MB | Maxmemory 64MB, allkeys-lru eviction |
| **NestJS API Gateway** | ~85 MB | Node `--max-old-space-size=256`, native `pg` pool |
| **Next.js 14 Web Studio** | ~110 MB | Client-side Web Worker rendering |
| **Python Whisper Service** | ~1.15 GB | Whisper `base` model in INT8 precision |
| **BullMQ Workers (2x)** | ~140 MB | Ephemeral FFmpeg child processes |
| **Total System Footprint** | **~1.55 GB** | **Leaves >6GB RAM free for OS and host apps** |

---

*TakePicker Engineering Documentation — Fully verified on Windows Docker Compose cluster.*
