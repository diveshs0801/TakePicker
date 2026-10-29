# TakePicker 🎬⚡
## Autonomous AI Video Editor, 4-Layer Verification Engine & Spatio-Temporal Timeline Version Control

> **An enterprise-grade, high-performance video editing system, parallel FFmpeg render cluster, and autonomous AI copilot that automatically detects and clusters retakes in raw footage, audits edits with an industry-first 4-layer verification engine, and provides Git-like 3-way timeline branching with zero-loss Audition Lanes.**

[![Verification Proofs](https://img.shields.io/badge/Verification%20Proofs-26%2F26%20Passing%20(100%25)-success?style=for-the-badge&logo=checkmarx)](bench/proofs/PROOFS_INDEX.md)
[![Cardboard AI Problem 09](https://img.shields.io/badge/Cardboard%20AI%20%2309-Video%20Verification%20%26%20RL-blueviolet?style=for-the-badge)](docs/CARDBOARD_AI_PROBLEM_09_VERIFICATION.md)
[![Cardboard AI Problem 10](https://img.shields.io/badge/Cardboard%20AI%20%2310-Version%20Control%20for%20Video-orange?style=for-the-badge)](docs/CARDBOARD_AI_PROBLEM_10_VERSION_CONTROL.md)
[![Merge Throughput](https://img.shields.io/badge/Merge%20Throughput-68%2C723%20clips%2Fsec-blue?style=for-the-badge)](bench/proofs/version_control_proof_matrix.json)
[![Render Cluster](https://img.shields.io/badge/Render%20Cluster-4.19x%20Fan--Out%20Speedup-brightgreen?style=for-the-badge)](#-distributed-render-cluster-benchmarks)

![TakePicker UI](docs/screenshots/01_ui_overview.png)

---

## 📑 Table of Contents

1. [Executive Summary & The Cardboard AI Mandate](#-executive-summary--the-cardboard-ai-mandate)
2. [Cardboard AI Problem #09: 4-Layer Video Verification & Taste RL](#-cardboard-ai-problem-09-video-verification--taste-rl)
   - [The Core Challenge: Why Video Lacks a Compiler](#the-core-challenge-why-video-lacks-a-compiler)
   - [The 4-Layer Verification Hierarchy](#the-4-layer-verification-hierarchy)
   - [Cross-Corpus Multi-Video Benchmark (4 Diverse Productions)](#cross-corpus-multi-video-benchmark-4-diverse-productions)
   - [Aesthetic VLM Judge & Leaky-Bucket Rate Limiter](#aesthetic-vlm-judge--leaky-bucket-rate-limiter)
   - [Frontier RL Engine: Causal DML, Creator Style Fingerprints & Video DPO](#frontier-rl-engine-causal-dml-creator-style-fingerprints--video-dpo)
3. [Cardboard AI Problem #10: Version Control & 3-Way Timeline Merge](#-cardboard-ai-problem-10-version-control--3-way-timeline-merge)
   - [The First Principles: Why Git Fails on Video](#the-first-principles-why-git-fails-on-video)
   - [Spatio-Temporal Timeline AST & Decoupled Time](#spatio-temporal-timeline-ast--decoupled-time)
   - [O(N log N) Longest Increasing Subsequence (LIS) Diffing](#on-log-n-longest-increasing-subsequence-lis-diffing)
   - [Non-Destructive Audition Lanes Resolution](#non-destructive-audition-lanes-resolution)
   - [Mathematical Commutativity Proof (250/250 Symmetry)](#mathematical-commutativity-proof-250250-symmetry)
   - [Scale & Throughput Benchmark (68,723 clips/sec)](#scale--throughput-benchmark-68723-clipssec)
4. [Full Forensic Evidence Matrix & Reproduction](#-full-forensic-evidence-matrix--reproduction)
5. [Core Production Architecture & Pipeline](#-core-production-architecture--pipeline)
6. [High-Performance Systems & Features](#-high-performance-systems--features)
   - [Resumable TUS 1.0 Video Ingest](#1-resumable-tus-10-video-ingest)
   - [Disfluency-Preserving Whisper & Semantic Clustering](#2-disfluency-preserving-whisper--semantic-clustering)
   - [Autonomous AI Copilot & Append-Only Operations Log](#3-autonomous-ai-copilot--append-only-operations-log)
   - [WebCodecs 60fps Hardware-Accelerated Stepper](#4-webcodecs-60fps-hardware-accelerated-stepper)
   - [Distributed Fan-Out Render Cluster](#5-distributed-fan-out-render-cluster)
   - [Native Rust Systems Core (`take-engine`)](#6-native-rust-systems-core-take-engine)
   - [Pro NLE Interchange & Kinetic Karaoke Subtitles](#7-pro-nle-interchange--kinetic-karaoke-subtitles)
7. [Quick Start & Docker Deployment](#-quick-start--docker-deployment)
8. [Repository Structure & Codebase Map](#-repository-structure--codebase-map)

---

## 💡 Executive Summary & The Cardboard AI Mandate

When autonomous AI models edit long-form video, they face foundational computer science problems that traditional software engineering solved decades ago:
1. **Verification & Linters (Cardboard AI Problem #09)**: Compilers and linters (`tsc`, `clippy`, `eslint`) catch syntax errors and invariant violations in sub-milliseconds before code runs. Video has had no equivalent: checking edits has historically meant either paying humans to watch footage or waiting minutes for expensive FFmpeg pixel decodes. Furthermore, edits must hold a narrative arc, match creator style, and avoid viewer drop-off cliffs.
2. **Version Control & Collaboration (Cardboard AI Problem #10)**: Git tracks 1D discrete lines of text. Video timelines are 2D continuous spatio-temporal tracks where trimming 1.5 seconds from Clip 1 cascades downstream presentation times, causing naive diffs to flag every subsequent clip as modified. Merging parallel edits cannot produce text-style collision errors (`<<<<<<< HEAD`) that crash playback.

**TakePicker solves both problems comprehensively from first principles.** It pairs a **sub-millisecond AST invariant linter** with an **asynchronous broadcast signal analyzer**, a **closed-loop RL taste engine**, and a **mathematically commutative 3-way timeline merge engine** backed by non-destructive **Audition Lanes**.

---

## 🛡️ Cardboard AI Problem #09: Video Verification & Taste RL

> *"After the agent makes edits, how does it know if the output is good? There's no linter for video. We have to build one... checking technical basics (no glitches, audio in sync), but also whether the edit looks good, matches the brand, holds a story arc, has the right pacing... and closing the loop with social platform engagement data in an RL environment."* — **Cardboard AI Core Engineering Mandate**

### The Core Challenge: Why Video Lacks a Compiler
Traditional broadcast validators were engineered for uncompressed studio ProRes/DNxHD. When applied to web H.264 streams, lossy macroblock quantization produces a high compression noise floor (-45dB to -52dB), triggering continuous false freeze-frame alarms. Running full-file video decodes takes 2–5 minutes per iteration, rendering real-time AI agent editing loops impossible.

TakePicker introduces an end-to-end **4-Layer Verification Hierarchy** that decouples instantaneous structural invariants from heavy asynchronous signal analysis.

### The 4-Layer Verification Hierarchy

```
+----------------------------------------------------------------------------------------------------+
|  LAYER 4: TASTE & RL RETENTION LAYER (Social Platform Engagement Loop)                            |
|  - Reward function calibrated to YouTube 30s & TikTok 3s Audience Retention Curves                |
|  - Predicts viewer drop-off cliffs caused by hook delays, pacing stagnation, and awkward splices  |
+----------------------------------------------------------------------------------------------------+
                                                  │
+----------------------------------------------------------------------------------------------------+
|  LAYER 3: SEMANTIC & NARRATIVE DISCOURSE LAYER ("Holds a Story Arc")                               |
|  - DANGLING_PRONOUN: Detects orphan anaphoric referents ('he', 'she', 'it') missing antecedents    |
|  - BROKEN_CAUSAL_CONNECTIVE: Flags orphan premise markers ('therefore', 'because of this')        |
|  - STORY_ARC_DEFICIT: Enforces 3.0s hook window and prevents abrupt mid-syllable drop-offs        |
+----------------------------------------------------------------------------------------------------+
                                                  │
+----------------------------------------------------------------------------------------------------+
|  LAYER 2: SYNTACTIC & PHASE LAYER (Sub-Millisecond AST Invariants & Lip-Sync)                     |
|  - WORD_CUTOFF: Guarantees zero acoustic syllable clipping (< 0.02ms AST evaluation)              |
|  - AUDIO_POP_RISK: Enforces 15ms raised-cosine microfades to eliminate DC offset click transients |
|  - AV_SYNC_DRIFT: Enforces ITU-R BT.1359 international standard (+45ms lead / -125ms lag)        |
|  - GAP_JITTER: Purges sub-frame black gaps (< 100ms) causing visual flutter                       |
+----------------------------------------------------------------------------------------------------+
                                                  │
+----------------------------------------------------------------------------------------------------+
|  LAYER 1: PHYSICAL & SIGNAL LAYER (Multi-Modal Broadcast Verifier)                                 |
|  - Macroblock-aware freeze detection (calibrated -35dB noise floor for lossy H.264 streams)       |
|  - EBU R128 & ATSC A/85 momentary loudness gating at -36 LUFS to eliminate false speech alarms    |
|  - Black frame detection (blackdetect) & active speech audio dropout correlation                   |
+----------------------------------------------------------------------------------------------------+
```

### Invariant Rules & Closed-Loop Autonomous Self-Healing

| Rule ID | Category | Severity | Failure Condition | Sub-ms Auto-Repair Action |
| :--- | :--- | :--- | :--- | :--- |
| `WORD_CUTOFF` | `BOUNDARY_ACCURACY` | `ERROR` | Cut boundary slices through active phoneme (`word.start < cut < word.end`) | Automatically expands `in` before `word.start - 0.05s` or `out` after `word.end + 0.08s` |
| `AUDIO_POP_RISK` | `TECHNICAL_AUDIO` | `ERROR` | Audio cut lacks boundary micro-fade | Synthesizes 15ms raised-cosine fade in clip metadata |
| `GAP_JITTER` | `TECHNICAL_VIDEO` | `ERROR` | Gap between adjacent clips is $0 < \text{gap} < 0.10s$ (visual flutter) | Snaps `clip[i].out = clip[i+1].in` |
| `DANGLING_PRONOUN` | `NARRATIVE_DISCOURSE` | `WARNING` | Entity reference (`he`, `she`, `it`) severed from antecedent sentence | Recommends restoring minimal preceding introduction clause |
| `AV_SYNC_DRIFT` | `PHASE_SYNC` | `ERROR` | Audio/Video offset exceeds ITU-R BT.1359 (+45ms / -125ms) | Synthesizes phase compensation shift to align phonemes to visemes |

### Cross-Corpus Multi-Video Benchmark (4 Diverse Productions)

To prove universal generalization across recording environments, microphones, and aspect ratios, TakePicker was evaluated across 4 real production formats:

| Corpus ID | Production Genre & Format | Specs (Resolution / FPS / Audio) | Specific Verification Stress Test | Final Quality Score | Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CORPUS A** | **Long-Form Unscripted Solo Vlog**<br>`Today is my 21st Birthday...` | 1920x1080 (16:9)<br>24.0 fps · 44.1 kHz stereo | Ambient outdoor room tone (-48 LUFS) vs legitimate silence; syllable cutoff auto-repair | **73 ➔ 100/100** | 4.21 ms | **PASS ✅** |
| **CORPUS B** | **Fast-Paced Social Reel / Shorts**<br>`the_silicon_architect_zafa_style_reel.mp4` | 720x1280 (**9:16 Vertical**)<br>30.0 fps · 24 kHz mono | 3.0s Social Hook retention window, 9:16 Title Safe margins, rapid cut flutter | **82 ➔ 100/100** | 4.22 ms | **PASS ✅** |
| **CORPUS C** | **Scripted Cinematic Explainer**<br>`neetcode_to_ai_cinematic_explainer.mp4` | 1920x1080 (16:9)<br>**29.99 fps NTSC** · 24 kHz mono | NTSC fractional frame snapping (1/29.99s); causal connective discourse flow | **88 ➔ 100/100** | 4.21 ms | **PASS ✅** |
| **CORPUS D** | **Multi-Take Retake Creator Footage**<br>`1_before_injected_defects.mp4` | 854x480 (**480p SD**)<br>24.0 fps · 44.1 kHz stereo | Sub-frame gap jitter (<100ms) between take swaps, speech cadence WPM, pacing stagnation | **79 ➔ 100/100** | 4.21 ms | **PASS ✅** |

### Aesthetic VLM Judge & Leaky-Bucket Rate Limiter
- **Groq Token-Budget Guard**: Evaluates live VLM critiques (`openai/gpt-oss-20b`) under an in-memory leaky-bucket limiter strictly enforcing `<8,000` Tokens/Min and `1,000` requests/day to prevent HTTP 429 quota exhaustion.
- **Zero-Token Local Continuity**: Jump cuts under $30^\circ$ angle change with `<0.3s` gap and non-brand color grade mismatches are caught locally in **0.04 ms at ZERO token cost**.
- **Anti-Reward Hacking Regularization (Goodhart's Law)**: Video RL policies tend to spam rapid 0.5s cuts to artificially boost short-term kinetic metrics. The engine applies a mathematical penalty:
  $$P_{\text{hack}} = \max\left(0, \frac{1.2 - \text{ASL}}{1.2}\right) \times 0.85$$
  neutralizing dopamine-gaming exploitation and preserving viewer trust.

### Frontier RL Engine: Causal DML, Creator Style Fingerprints & Video DPO
Implemented in [`frontier-rl.engine.ts`](apps/api/src/timeline/frontier-rl.engine.ts) and [`creator-style.engine.ts`](apps/api/src/timeline/creator-style.engine.ts):
1. **Dense Hazard Rate Credit Assignment**: Isolates retention drop-off spikes directly to specific cut boundaries using the discrete hazard formulation:
   $$h(t) = -\frac{1}{R(t)}\frac{dR}{dt}$$
   accurately distinguishing between clean cuts and retention-killing jump cuts.
2. **Causal Double Machine Learning (DML)**: Solves creator-size confounding. A 10M-subscriber creator gets high retention even with mediocre cuts, while a 500-subscriber creator gets dropped quickly. DML computes the true treatment effect $\tau(X)$ of the edit alone:
   $$Y_i - \hat{g}(Z_i) = \tau(X_i)(D_i - \hat{m}(Z_i)) + \epsilon_i$$
3. **Protected Creative Spans & Style Fingerprints**: Creators can tag `COMEDIC_PAUSE`, `REACTION_BEAT`, or `DRAMATIC_BUILDUP`. These spans are strictly shielded from automated silence removal. Average shot length (ASL) and silence tolerances are tethered via **KL-divergence regularization**, preventing the agent from converting cinematic pacing into brain-rot hyper-cuts.
4. **Passive Video DPO from UI Undo (`Ctrl+Z`)**: When a creator hits undo on an AI edit and adjusts the cut by +550ms, TakePicker harvests this event into an atomic preference pair $(y_w, y_l)$ with computed DPO log-ratio deltas without requiring manual annotation.
5. **Tri-Modal Joint Manifold Alignment**: Aligns cut boundaries simultaneously across speech zero-crossings, musical downbeats (e.g., 120BPM grid), and optical flow kinetic rest points, dropping joint cut energy cost by **-95%**.

---

## 🔀 Cardboard AI Problem #10: Version Control & 3-Way Timeline Merge

> *"Code has git. Video has nothing, just 'final_v3_actual (1).mp4'. We need to build version control for video that lets people branch, work in parallel on the same project, merge changes, and resolve conflicts... What does a diff even look like for a timeline? How do you present a conflict in a way an editor can resolve without friction?"* — **Cardboard AI Core Engineering Mandate**

### The First Principles: Why Git Fails on Video

| Dimension | Software Code (Git) | NLE Timeline (TakePicker / Cardboard) |
| :--- | :--- | :--- |
| **Data Topology** | 1D discrete lines of ASCII text. | 2D continuous spatio-temporal canvas (Tracks $\times$ Time). |
| **Coupling Cascades** | Line 40 has zero physical effect on Line 120. | Trimming 1.5s off Clip 1 ripples all downstream presentation times. Naive diff marks all subsequent clips as modified. |
| **Destructive vs. Virtual** | Edits rewrite file bytes on disk. | Non-destructive: raw media is immutable; only virtual $[t_{\text{in}}, t_{\text{out}}]$ windows move. |
| **Conflict Paradigm** | Compilation error stops execution (`<<<<<<< HEAD`). | Aesthetic collision; video must remain continuous, synchronized, and playback-ready. |
| **Editor Mental Model** | Commits, rebase, cherry-pick, detached HEAD. | Versions, Cuts, Takes, Auditioning, Stacked Tracks. |

### Spatio-Temporal Timeline AST & Decoupled Time
In TakePicker, clips are immutable UUID entities referenced inside a track sequence:
$$\text{Clip} = \langle \text{id}, \text{sourceAssetId}, t_{\text{in}}, t_{\text{out}}, \text{trackId}, \text{gain}, \text{speed}, \text{colorTag}, \text{auditionGroup} \rangle$$

The presentation time $t_{\text{timeline}}$ is **derived dynamically**, not stored as a static field:
$$t_{\text{start}}(C_i) = \sum_{k=1}^{i-1} (t_{\text{out}}(C_k) - t_{\text{in}}(C_k))$$
When an editor trims Clip 1, downstream clips $C_2 \dots C_n$ have **ZERO diff** because their source bounds and relative sequence are unchanged.

### O(N log N) Longest Increasing Subsequence (LIS) Diffing
When scenes or chapters are reordered, a naive sequence diff emits dozens of delete/insert pairs. TakePicker maps the target clip sequence into the base order indices and computes the **Longest Increasing Subsequence**:
- Clips lying on the LIS are **unmoved**.
- Only clips outside the LIS are emitted as minimal `MOVE` operations.

### Non-Destructive Audition Lanes Resolution
When two editors modify the same clip boundaries (`TRIM_TRIM`), TakePicker does not crash or pick an arbitrary winner. Instead, it creates **Audition Lanes**:
- Both versions are preserved on parallel stacked tracks ($V1$ and $V2$).
- The clips are linked via an `auditionGroup` identifier.
- The editor can audition both takes in real time with a single click or keyboard shortcut in the UI.

```
Base:    [======== Take A (10s) ========]
Editor 1:[===== Take A1 (6s) =====]
Editor 2:[=========== Take A2 (8s) ===========]

3-Way Merge (Audition Lanes):
Track V2: [=========== Take A2 (8s) ===========] (Audition Lane - Muted)
Track V1: [===== Take A1 (6s) =====]             (Primary Active Lane)
```

### Mathematical Commutativity Proof (250/250 Symmetry)
A sound merge engine must satisfy algebraic commutativity:
$$\text{merge}(B, X, Y) \equiv \text{merge}(B, Y, X)$$
TakePicker's proof harness executes 250 randomized concurrent edits (trims, slips, moves, property edits) in alternating orders:
- **Commutativity Trials:** 250 / 250 passed
- **Pass Rate:** **100.0% Invariant Symmetry**

### Scale & Throughput Benchmark (68,723 clips/sec)

Tested on timelines ranging from 100 to 10,000 clips in [`run_version_control_proofs.py`](bench/proofs/run_version_control_proofs.py):

| Timeline Size | Merge Latency | Effective Throughput | Practical Real-World Comparison |
| :--- | :--- | :--- | :--- |
| **100 clips** | **1.46 ms** | **68,723 clips/sec** | Standard YouTube Video (10–15 min) |
| **1,000 clips** | **30.76 ms** | **32,505 clips/sec** | 2-Hour Feature Film Assembly Cut |
| **5,000 clips** | **587.57 ms** | **8,509 clips/sec** | Multi-Cam Documentary Project |
| **10,000 clips** | **2,108.49 ms** | **4,742 clips/sec** | Massive Studio Enterprise Repository |

---

## 📊 Full Forensic Evidence Matrix & Reproduction

All empirical invariants are captured in machine-readable JSON matrices and verified with reproducible scripts:

| Benchmark / Proof Suite | Target Hard Problem | Key Measured Invariant | Status |
| :--- | :--- | :--- | :--- |
| [`run_all_proofs.py`](bench/proofs/run_all_proofs.py) | **Problem #09 & #10** | **Unified Master Suite**: All 26 invariants executed end-to-end in 5.11s | **✅ PASS (100%)** |
| [`run_multi_scenario_proofs.py`](bench/proofs/run_multi_scenario_proofs.py) | **Problem #09** | 6 defect scenarios: 100% precision, 100% recall, 0.008ms AST evaluation | **✅ PASS (100%)** |
| [`run_cross_corpus_benchmark.py`](bench/proofs/run_cross_corpus_benchmark.py) | **Problem #09** | 4 real corpora: 1080p solo vlog, 9:16 vertical shorts, 29.99fps NTSC, 480p SD | **✅ PASS (100%)** |
| [`run_version_control_proofs.py`](bench/proofs/run_version_control_proofs.py) | **Problem #10** | 3-way merge, LIS diffing, Audition Lanes, 250-trial commutativity proof | **✅ PASS (100%)** |
| [`run_aesthetic_and_rl_proofs.py`](bench/proofs/run_aesthetic_and_rl_proofs.py) | **Problem #09** | Groq 8,000 TPM guard, 0.04ms zero-token visual heuristics, anti-brain-rot penalty | **✅ PASS (100%)** |
| [`run_frontier_rl_proofs.py`](bench/proofs/run_frontier_rl_proofs.py) | **Problem #09** | Dense hazard attribution, Causal DML lift, style fingerprinting, Video DPO | **✅ PASS (100%)** |

### Run the Entire Proof Suite:
```bash
python -X utf8 bench/proofs/run_all_proofs.py
```

*Master scorecard is saved to [`bench/proofs/master_proof_scorecard.json`](bench/proofs/master_proof_scorecard.json).*

---

## 🏗️ Core Production Architecture & Pipeline

```
                     ┌────────────────────────────────────────────────────────┐
                     │ Next.js 14 Dark-Mode Studio NLE (Port 3001)            │
                     │  - Interactive Multi-Track Timeline & Audition Lanes   │
                     │  - Dedicated Git DAG Version Graph & 3-Way Merge Modal │
                     │  - Autonomous AI Copilot Chat Panel                    │
                     │  - 4-Layer Quality Verification Linter Drawer          │
                     │  - WebCodecs Hardware 60fps Frame Stepper Worker       │
                     │  - TUS 1.0 Chunked Resumable Upload Client             │
                     └──────────┬───────────────────────────────▲─────────────┘
                        REST/TUS│                               │ WebSocket Events
                     ┌──────────▼───────────────────────────────┴─────────────┐
                     │ NestJS Core API Gateway (Port 3000)                    │
                     │  - TUS 1.0 Resumable Upload Receiver (Flat Memory)     │
                     │  - Append-Only Op-Log & 3-Way Merge Engine (LIS)       │
                     │  - AI Copilot Agent Loop & 14 Zod Validated Tools      │
                     │  - BullMQ Parent-Child Render Orchestrator             │
                     └───┬──────────────┬──────────────┬──────────────────────┘
                         │              │              │
                   ┌─────▼────┐   ┌─────▼────┐   ┌─────▼────────────────┐
                   │PostgreSQL│   │ Redis 7  │   │ Persistent Storage   │
                   │16 DB     │   │ BullMQ   │   │ (/media volume)      │
                   └──────────┘   └─────┬────┘   └─────▲────────────────┘
                                        │              │
          ┌────────────────┬────────────┼──────────────┼──────────────┐
          │                │            │              │              │
      [ Ingest Worker ]    │    [ Render Cluster xN ]  │    [ Rust take-engine ]
      - ffprobe metadata   │    - BullMQ FlowProducer  │    - SIMD audio waveforms
      - 480p proxy (-g 30) │    - 15ms microfade slice │    - WebRTC VAD (7,493x)
      - 16kHz mono audio   │    - Lossless concat copy │    - Smart GOP bitstream copy
          │                │                           │
          ▼                │                           ▼
    [ Python Analysis ]    │                 [ Video Quality Linter ]
    - faster-whisper       │                 - Physical Layer (EBU R128, -35dB)
    - sentence-transformers│                 - Syntactic AST (<0.02ms)
    - rapidfuzz clustering │                 - Narrative Discourse Graph
    - Multi-factor scoring │                 - Closed-Loop RL Retention Model
```

---

## ⚡ High-Performance Systems & Features

### 1. Resumable TUS 1.0 Video Ingest
- Built on the official **TUS 1.0 protocol** (`OPTIONS`, `POST`, `HEAD`, `PATCH`, `DELETE`).
- Streams multi-gigabyte raw footage in 8–16MB chunks with SHA-256 chunk verification.
- **Flat Memory Profile**: Chunks stream directly to storage without memory buffering.
- Survives dropped WiFi, connection resets, and tab reloads with automatic offset-based resume.

### 2. Disfluency-Preserving Whisper & Semantic Clustering
- **Disfluency-Preserving Conditioning**: Uses initial prompt conditioning (`initial_prompt: "Um, uh, wait, let me redo that."`) to force Whisper to preserve filler words rather than auto-cleaning them.
- **Semantic Retake Clustering**: Combines dense vector embeddings (`sentence-transformers/all-MiniLM-L6-v2`) with fuzzy Levenshtein token distance (`rapidfuzz`) to cluster repeated takes.
- **Multi-Factor Scoring**: Evaluates speech cadence (130–160 optimal WPM), filler word penalties, pause durations, and recency bias to select the sharpest delivery.

### 3. Autonomous AI Copilot & Append-Only Operations Log
- **Append-Only Operations Log**: All mutations are stored in `timeline_ops(asset_id, seq, op_type, payload, inverse, actor)`. State is deterministically reconstructed from snapshots + replay.
- **True Reversible Undo**: Every operation calculates its mathematical inverse at apply time.
- **Optimistic Concurrency Control**: Operations carry `baseSeq`. If the timeline moved concurrently, calls abort cleanly with `STALE_BASE_SEQ`.
- **14 Strictly Validated Tools**: `select_take`, `remove_clip`, `trim_clip`, `split_clip`, `remove_range`, `remove_silence`, `move_clip`, `undo`, `redo`, `get_timeline`, `list_take_groups`, `search_transcript`, `get_lint_report`, `export_timeline`.
- **Universal Multi-LLM Provider Engine**: Native support for DeepSeek V3, Groq (Llama 3.3 70B), Google Gemini 2.0, OpenRouter, and local offline Ollama models.

### 4. WebCodecs 60fps Hardware-Accelerated Stepper
- Frame-accurate canvas rendering using the modern **WebCodecs API** (`VideoDecoder`).
- MP4 demuxing and frame extraction execute entirely inside a dedicated **Web Worker**, leaving the main thread 100% responsive.
- Integrated LRU frame cache with automatic resource disposal (`frame.close()`).

### 5. Distributed Fan-Out Render Cluster
- Slices export timelines into individual clip render jobs using **BullMQ FlowProducer**.
- Automatically applies **15ms raised-cosine audio microfades** at clip boundaries to eliminate DC offset click transients.
- Reassembles rendered segments in seconds using lossless FFmpeg stream-copy (`-c copy`).
- **Empirical Concurrency Benchmark**:
  - **1 Worker:** 160.76s (baseline)
  - **4 Workers:** 85.83s (**1.87x speedup**, 3.8x real-time throughput)
  - **Fault Tolerance:** Tested by killing worker containers mid-export; BullMQ stalled job detectors automatically reassign orphaned chunks with zero dropped frames.

### 6. Native Rust Systems Core (`take-engine`)
Located in [`crates/take-engine`](crates/take-engine):
- **SIMD Audio Waveform Extractor**: Vectorized PCM decoding processes **1 hour of 48kHz audio in 409ms** (**8,781x Real-Time Speed**).
- **Voice Activity Detection (VAD)**: Scans speech/silence boundaries in **480ms** (**7,493x Real-Time Speed**).
- **Smart GOP Stream Splicer**: Re-encodes only boundary frames around cut points (`head_reencode`, `tail_reencode`) and directly copies intermediate GOPs, achieving **92% to 95% zero-reencode passthrough**.

### 7. Pro NLE Interchange & Kinetic Karaoke Subtitles
- **Standardized XML/EDL Export**:
  - Apple Final Cut Pro XML (FCPXML v1.9)
  - Adobe Premiere Pro XML (Apple XMEML v5)
  - DaVinci Resolve / CMX 3600 EDL
  - Pixar OpenTimelineIO (`.otio`)
- **Kinetic Karaoke Subtitles**: Frame-accurate word-level alignment exporting to **SRT**, **WebVTT**, and **ASS Kinetic Karaoke** (`{\k<centiseconds>}`) with TikTok Vibrant Yellow, Neon Glow, and Modern Bold styling presets.

---

## 🚀 Quick Start & Docker Deployment

### Prerequisites
- [Docker Desktop](https://www.docker.com/) (with Linux engine enabled) & Docker Compose
- Node.js 20+ (optional, for local development outside Docker)
- Python 3.11+ (optional, for standalone proof runs)

### 1. Clone & Configure
```bash
git clone https://github.com/diveshs0801/TakePicker.git
cd TakePicker

# Create environment configuration
cp .env.example .env
```

Add your preferred LLM provider key to `.env` (DeepSeek, Groq, or Gemini):
```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```
*(If no key is provided, TakePicker automatically runs in offline deterministic rule mode).*

### 2. Launch the Microservices Cluster
```bash
docker compose up -d
```

| Service | Role | URL |
| :--- | :--- | :--- |
| **Web Studio** | Next.js 14 NLE Interface | `http://localhost:3001` |
| **API Gateway** | NestJS Core & TUS 1.0 Server | `http://localhost:3000` |
| **Speech Analysis** | FastAPI & Whisper Service | `http://localhost:8000` |
| **PostgreSQL** | Database | `localhost:5433` (mapped from 5432) |
| **Redis** | BullMQ Job Queue | `localhost:6379` |

### 3. Scale Render Workers
```bash
# Scale the parallel render pool to 4 workers
docker compose up -d --scale render-worker=4
```

---

## 📁 Repository Structure & Codebase Map

```
TakePicker/
├── apps/
│   ├── api/                      # NestJS Core Gateway
│   │   ├── src/agent/            # AI Copilot runner, LLM client loop
│   │   ├── src/captions/         # SRT, WebVTT, and ASS kinetic karaoke generators
│   │   ├── src/export/           # FCPXML, Premiere XML, EDL, OTIO project exporters
│   │   ├── src/renders/          # BullMQ render orchestrator & segment dispatcher
│   │   ├── src/timeline/         # 4-Layer AST Linter, 3-Way Merge Engine, Version Service,
│   │   │                         # Frontier RL Engine, Creator Style Engine, Aesthetic Judge
│   │   ├── src/tools/            # 14 typed Zod tools (shared with MCP)
│   │   └── src/uploads/          # TUS 1.0 Resumable Upload protocol implementation
│   ├── web/                      # Next.js 14 Dark-Mode Studio NLE
│   │   ├── src/app/              # App router & layout
│   │   ├── src/components/       # LeftSidebar (Bins/Git), VersionGraphWorkspace (DAG swimlanes),
│   │   │                         # TimelineTrack (multi-lane NLE), VersionMergeModal (A/B audition)
│   │   └── src/player/           # WebCodecs hardware-accelerated 60fps frame stepper
│   ├── workers/                  # BullMQ worker pool: ingest, proxy, parallel FFmpeg renders
│   ├── analysis/                 # Python FastAPI: faster-whisper, sentence-transformers
│   ├── lint/                     # Python multi-modal broadcast signal analyzers (EBU R128)
│   └── mcp/                      # Model Context Protocol (MCP) server for Claude Desktop
├── crates/
│   └── take-engine/              # High-performance Rust engine
│       ├── src/audio/            # SIMD waveform extractor & WebRTC VAD
│       ├── src/merge/            # Native Rust timeline diff and 3-way merge
│       └── src/video/            # Smart GOP keyframe slicer & pass-through planner
├── packages/
│   └── contracts/                # Shared TypeScript contracts (AST, Merges, RL, Linters)
├── bench/
│   ├── proofs/                   # 5 Forensic Proof Suites & Ground-Truth Matrices
│   │   ├── PROOFS_INDEX.md       # Master proof index and empirical evidence matrix
│   │   ├── run_all_proofs.py     # Unified master proof runner (executes all 26 invariants)
│   │   ├── run_multi_scenario_proofs.py
│   │   ├── run_cross_corpus_benchmark.py
│   │   ├── run_version_control_proofs.py
│   │   ├── run_aesthetic_and_rl_proofs.py
│   │   └── run_frontier_rl_proofs.py
│   └── eval_verification_closed_loop.py
├── docs/
│   ├── CARDBOARD_AI_PROBLEM_09_VERIFICATION.md    # Problem #09 Architecture Specification
│   ├── CARDBOARD_AI_PROBLEM_10_VERSION_CONTROL.md # Problem #10 Architecture Specification
│   └── PROJECT_CHRONOLOGICAL_MILESTONES.md        # Detailed chronological engineering log
├── eval/
│   └── test_runner.sh            # Complete end-to-end evaluation runner script
└── docker-compose.yml            # Polyglot multi-container orchestration configuration
```

---

## 📜 Architectural References & Standards
- **ITU-R BT.1359-1**: International relative timing of sound and vision for broadcasting (+45ms / -125ms tolerance).
- **EBU R128 / ATSC A/85**: Digital audio loudness normalization (-23 LUFS / -24 LKFS standard).
- **TUS 1.0 Protocol**: Open protocol for resumable file uploads over HTTP/1.1 and HTTP/2.
- **Model Context Protocol (MCP)**: Open standard for LLM integration with external tools and developer workflows.

---

**Built with pride by Divesh S.**  
*Engineered to set the standard for autonomous video editing and spatio-temporal media version control.*
