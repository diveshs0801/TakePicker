"""
TakePicker Analysis Service
Handles Whisper transcription, pause-based segmentation,
semantic + lexical retake clustering, scoring, and initial timeline generation.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import re
import numpy as np
from rapidfuzz import fuzz

app = FastAPI(title="TakePicker Analysis Service", version="1.0.0")

# Lazy load models to optimize startup memory
_whisper_model = None
_embedding_model = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("WHISPER_MODEL", "small")
        _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _whisper_model

def get_embedder():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model

# Whisper prompt nudging model to retain natural speech disfluencies
FILLER_PROMPT = "Umm, let me think, like, hmm... okay, so, here's what I'm, uh, thinking."

FILLER_WORDS = {
    "um", "umm", "uh", "uhh", "er", "ah", "like", "hmm", "you know", "i mean", "sort of", "kind of"
}

CUE_PHRASES = [
    "let me redo that",
    "let me re-say that",
    "take two",
    "take three",
    "take four",
    "sorry, again",
    "sorry again",
    "one more time",
    "cut",
    "wait, let me",
    "wait let me",
    "from the top",
    "start over",
    "scratch that"
]

class TranscribeReq(BaseModel):
    audioPath: str

class AnalyzeReq(BaseModel):
    assetId: str
    audioPath: str
    fps: Optional[float] = 30.0

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/transcribe")
def transcribe(req: TranscribeReq):
    if not os.path.exists(req.audioPath):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {req.audioPath}")

    whisper = get_whisper()
    segments, _ = whisper.transcribe(
        req.audioPath,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=FILLER_PROMPT,
    )
    words = []
    for s in segments:
        for w in s.words or []:
            cleaned = w.word.strip()
            if cleaned:
                words.append({
                    "w": cleaned,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "prob": round(w.probability, 3)
                })
    return {"words": words}

def segment_words(words: List[Dict[str, Any]], pause_threshold: float = 0.7) -> List[Dict[str, Any]]:
    """Split word stream into segments at pauses >= pause_threshold or sentence punctuation."""
    if not words:
        return []

    segments = []
    current = []

    for i, w in enumerate(words):
        current.append(w)
        is_pause = (i + 1 < len(words) and (words[i + 1]["start"] - w["end"]) >= pause_threshold)
        is_sentence_end = w["w"].rstrip().endswith((".", "?", "!"))
        is_last = (i == len(words) - 1)

        if is_pause or is_sentence_end or is_last:
            text = " ".join(x["w"] for x in current).strip()
            segments.append({
                "idx": len(segments),
                "start": current[0]["start"],
                "end": current[-1]["end"],
                "text": text,
                "words": current
            })
            current = []

    return segments

def is_cue_phrase(text: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", text.lower()).strip()
    return any(cue in clean for cue in CUE_PHRASES)

def find_retakes(segments: List[Dict[str, Any]], sem_threshold: float = 0.78, lex_threshold: float = 75.0, window: int = 6) -> List[List[int]]:
    """Group repeated takes with union-find across semantic and lexical similarity."""
    n = len(segments)
    if n == 0:
        return []

    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int):
        pa, pb = find(a), find(b)
        if pa != pb:
            parent[pa] = pb

    # Mark cue phrase segments so they don't corrupt content takes
    cue_indices = {i for i, s in enumerate(segments) if is_cue_phrase(s["text"])}

    texts = [s["text"] for s in segments]
    embedder = get_embedder()
    embeddings = embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True)

    for i in range(n):
        if i in cue_indices:
            continue
        max_j = min(i + window + 1, n)
        for j in range(i + 1, max_j):
            if j in cue_indices:
                continue

            # Cosine similarity (embeddings are already normalized)
            cos_sim = float(np.dot(embeddings[i], embeddings[j]))
            lex_sim = float(fuzz.token_set_ratio(texts[i], texts[j]))

            # Prefix check: shorter segment is a prefix of longer
            t_i = re.sub(r"[^\w\s]", "", texts[i].lower())
            t_j = re.sub(r"[^\w\s]", "", texts[j].lower())
            is_prefix = False
            if len(t_i) > 8 and len(t_j) > 8:
                if t_j.startswith(t_i) or t_i.startswith(t_j):
                    is_prefix = True

            if cos_sim >= sem_threshold or lex_sim >= lex_threshold or is_prefix:
                union(i, j)

    # Group segments
    grouped_map: Dict[int, List[int]] = {}
    for i in range(n):
        root = find(i)
        grouped_map.setdefault(root, []).append(i)

    # Sort groups chronologically by first segment index
    sorted_groups = sorted(grouped_map.values(), key=lambda g: g[0])
    return sorted_groups

def score_take(segment: Dict[str, Any], position_in_group: int, group_size: int, median_wpm: float) -> Dict[str, Any]:
    """Score a take using delivery speed, fillers, pause, punctuation, and confidence."""
    text = segment["text"].lower()
    words = segment.get("words", [])
    word_count = len(words)
    duration = max(0.1, segment["end"] - segment["start"])
    wpm = (word_count / duration) * 60.0

    # 1. Filler rate
    clean_words = [re.sub(r"[^\w]", "", w["w"].lower()) for w in words]
    filler_count = sum(1 for w in clean_words if w in FILLER_WORDS)
    filler_ratio = filler_count / max(1, word_count)
    filler_score = max(0.0, 1.0 - (filler_ratio * 3.0))

    # 2. Repeated adjacent words ("the the")
    repeats = 0
    for idx in range(len(clean_words) - 1):
        if clean_words[idx] and clean_words[idx] == clean_words[idx + 1]:
            repeats += 1
    repeat_score = max(0.0, 1.0 - (repeats * 0.4))

    # 3. Longest internal pause
    max_pause = 0.0
    for idx in range(len(words) - 1):
        p = words[idx + 1]["start"] - words[idx]["end"]
        if p > max_pause:
            max_pause = p
    pause_score = max(0.0, 1.0 - min(1.0, max_pause / 1.5))

    # 4. Sentence ending punctuation bonus
    ends_clean = 1.0 if segment["text"].rstrip().endswith((".", "!", "?")) else 0.4

    # 5. Whisper average confidence
    mean_prob = float(np.mean([w.get("prob", 0.8) for w in words])) if words else 0.8

    # 6. WPM closeness to median
    wpm_diff = abs(wpm - median_wpm)
    wpm_score = max(0.0, 1.0 - min(1.0, wpm_diff / 80.0))

    # 7. Position bonus: later takes in a cluster are usually the speaker's refined delivery
    pos_score = (position_in_group + 1) / max(1, group_size)

    # Weighted sum
    total_score = (
        0.20 * filler_score +
        0.10 * repeat_score +
        0.15 * pause_score +
        0.10 * ends_clean +
        0.15 * mean_prob +
        0.15 * wpm_score +
        0.15 * pos_score
    )

    features = {
        "filler_score": round(filler_score, 3),
        "repeat_score": round(repeat_score, 3),
        "pause_score": round(pause_score, 3),
        "sentence_end_score": round(ends_clean, 3),
        "mean_confidence": round(mean_prob, 3),
        "wpm": round(wpm, 1),
        "wpm_score": round(wpm_score, 3),
        "position_bonus": round(pos_score, 3),
        "fillers_detected": filler_count
    }

    return {"score": round(total_score, 3), "features": features}

@app.post("/analyze")
def analyze(req: AnalyzeReq):
    """End-to-end analysis: transcribe -> segment -> cluster retakes -> score -> timeline."""
    if not os.path.exists(req.audioPath):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {req.audioPath}")

    # 1. Transcribe
    whisper = get_whisper()
    segments_raw, _ = whisper.transcribe(
        req.audioPath,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=FILLER_PROMPT,
    )

    words = []
    for s in segments_raw:
        for w in s.words or []:
            cleaned = w.word.strip()
            if cleaned:
                words.append({
                    "w": cleaned,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "prob": round(w.probability, 3)
                })

    if not words:
        return {
            "assetId": req.assetId,
            "words": [],
            "segments": [],
            "groups": [],
            "timeline": {"assetId": req.assetId, "fps": req.fps or 30.0, "clips": []}
        }

    # 2. Segment
    segments = segment_words(words, pause_threshold=0.7)

    # Compute overall median WPM
    all_wpms = []
    for s in segments:
        dur = max(0.1, s["end"] - s["start"])
        all_wpms.append((len(s["words"]) / dur) * 60.0)
    median_wpm = float(np.median(all_wpms)) if all_wpms else 130.0

    # 3. Retake Clustering
    clusters = find_retakes(segments)

    # 4. Scoring each take in groups
    output_groups = []
    fps = req.fps or 30.0
    timeline_clips = []

    for group_idx, seg_indices in enumerate(clusters):
        group_id = f"g_{group_idx + 1}"
        group_size = len(seg_indices)
        scored_takes = []

        for pos, seg_idx in enumerate(seg_indices):
            seg = segments[seg_idx]
            # Exclude cue phrases from being winning content takes
            if is_cue_phrase(seg["text"]):
                score_data = {
                    "score": 0.05,
                    "features": {"cue_phrase": True, "fillers_detected": 0}
                }
            else:
                score_data = score_take(seg, pos, group_size, median_wpm)

            seg["score"] = score_data["score"]
            seg["features"] = score_data["features"]
            seg["groupId"] = group_id
            scored_takes.append(seg)

        # Pick winning take (highest score)
        valid_takes = [t for t in scored_takes if not t["features"].get("cue_phrase")]
        chosen_take = max(valid_takes, key=lambda t: t["score"]) if valid_takes else scored_takes[-1]

        output_groups.append({
            "id": group_id,
            "idx": group_idx,
            "chosenSegmentId": chosen_take["idx"],
            "takes": scored_takes,
            "isRetake": group_size > 1
        })

        # Build timeline clip for chosen take
        # Frame snapping + 90ms padding (clamped)
        pad = 0.090
        in_snapped = max(0.0, round((chosen_take["start"] - pad) * fps) / fps)
        out_snapped = round((chosen_take["end"] + pad) * fps) / fps

        # Human-readable reason
        if group_size > 1:
            take_num = seg_indices.index(chosen_take["idx"]) + 1
            reason = f"take {take_num}/{group_size}, score {chosen_take['score']:.2f} ({chosen_take['features'].get('fillers_detected', 0)} fillers)"
        else:
            reason = "unique segment"

        timeline_clips.append({
            "id": f"clip_{len(timeline_clips) + 1}",
            "segmentIdx": chosen_take["idx"],
            "in": in_snapped,
            "out": out_snapped,
            "groupId": group_id,
            "reason": reason,
            "text": chosen_take["text"]
        })

    # Sort clips in chronological order
    timeline_clips.sort(key=lambda c: c["in"])

    # Ensure no overlapping in/out points after padding
    for i in range(len(timeline_clips) - 1):
        if timeline_clips[i]["out"] > timeline_clips[i + 1]["in"]:
            midpoint = round(((timeline_clips[i]["out"] + timeline_clips[i + 1]["in"]) / 2.0) * fps) / fps
            timeline_clips[i]["out"] = midpoint
            timeline_clips[i + 1]["in"] = midpoint

    timeline = {
        "assetId": req.assetId,
        "fps": fps,
        "clips": timeline_clips
    }

    return {
        "assetId": req.assetId,
        "words": words,
        "segments": segments,
        "groups": output_groups,
        "timeline": timeline
    }
