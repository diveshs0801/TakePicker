"""
D3: Audio dropout detection (context-aware).
Parses FFmpeg silencedetect filter output from stderr.

Context rule: raw silence is NOT a defect. Silence is only flagged
if it falls inside a speech span (between consecutive words), using
Whisper word timestamps for context. A natural pause between sentences
is not flagged.

FFmpeg output format:
  [silencedetect @ 0x...] silence_start: 10.000
  [silencedetect @ 0x...] silence_end: 10.300 | silence_duration: 0.300
"""

import re

SILENCE_START_RE = re.compile(
    r"\[silencedetect\s*@\s*\S+\]\s*silence_start:\s*(?P<start>[\d.]+)"
)
SILENCE_END_RE = re.compile(
    r"\[silencedetect\s*@\s*\S+\]\s*silence_end:\s*(?P<end>[\d.]+)\s*\|\s*silence_duration:\s*(?P<dur>[\d.]+)"
)


def is_inside_speech_span(start: float, end: float, words: list[dict],
                          gap_threshold: float = 0.5) -> bool:
    """
    Check if the silence falls inside continuous speech, not between sentences.
    
    We define "inside speech" as: there exist two consecutive words W_i and W_{i+1}
    such that:
      - The silence overlaps with the gap between W_i.end and W_{i+1}.start
      - AND W_i and W_{i+1} are part of the same speech burst (their natural gap
        is small, under gap_threshold)
    
    This prevents flagging the 2-second pause between two separate sentences.
    """
    if not words:
        return True  # No word context available, be conservative

    for i in range(len(words) - 1):
        w_end = words[i].get("end", 0)
        w_next_start = words[i + 1].get("start", 0)
        natural_gap = w_next_start - w_end

        # If the natural gap between words is already large, this is a
        # sentence boundary, not continuous speech
        if natural_gap > gap_threshold:
            continue

        # Check if our silence overlaps with the span between these words
        if start < w_next_start and end > w_end:
            return True

    return False


def parse_audio_dropout(stderr: str, config: dict,
                        words: list[dict] | None = None) -> list[dict]:
    """
    Parse silencedetect output and return findings, filtered by speech context.
    
    Args:
        stderr: Raw FFmpeg stderr output
        config: audio_dropout section from config.yaml
        words: Whisper word timestamps for context filtering (optional)
    
    Returns:
        List of finding dicts
    """
    min_dur = config.get("min_duration", 0.08)
    use_context = config.get("require_speech_context", True)
    findings = []

    # Collect silence events
    starts = [float(m.group("start")) for m in SILENCE_START_RE.finditer(stderr)]
    end_matches = list(SILENCE_END_RE.finditer(stderr))

    # Match starts with ends (they appear in order)
    count = min(len(starts), len(end_matches))

    for i in range(count):
        start = starts[i]
        end = float(end_matches[i].group("end"))
        dur = float(end_matches[i].group("dur"))

        if dur < min_dur:
            continue

        # Context-aware filtering: only flag silence inside speech
        if use_context and words is not None:
            if not is_inside_speech_span(start, end, words):
                continue  # Natural pause between sentences — not a defect

        severity = "error" if dur >= 0.5 else "warn"

        findings.append({
            "check": "D3_audio_dropout",
            "severity": severity,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(dur, 3),
            "message": f"Audio dropout: {dur:.3f}s silence at {start:.2f}s"
                       + (" (inside speech)" if words else " (no speech context)"),
            "suggestedFix": None
        })

    return findings
