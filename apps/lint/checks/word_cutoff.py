"""
D7: Word cut off at a boundary detector.
Checks whether any timeline cut (clip start or end) falls strictly inside a spoken word.
"""

from typing import List, Dict, Any, Optional

def check_word_cutoffs(
    timeline_segments: List[Dict[str, Any]],
    words: List[Dict[str, Any]],
    threshold_sec: float = 0.04
) -> List[Dict[str, Any]]:
    """
    Compare each clip boundary against Whisper word boundaries.
    
    A boundary is flagged as D7 defect if:
      word.start + threshold_sec < cut_time < word.end - threshold_sec
    """
    findings = []
    if not timeline_segments or not words:
        return findings

    for seg_idx, seg in enumerate(timeline_segments):
        start_t = seg.get("start_time", seg.get("in_point", 0.0))
        end_t = seg.get("end_time", seg.get("out_point", 0.0))

        # Check cut at start
        for word in words:
            w_start = word.get("start", word.get("start_time", 0.0))
            w_end = word.get("end", word.get("end_time", 0.0))
            w_text = word.get("word", word.get("w", word.get("text", "")))

            # If cut lands inside word
            if (w_start + threshold_sec) < start_t < (w_end - threshold_sec):
                findings.append({
                    "type": "D7",
                    "subtype": "cut_inside_word_head",
                    "time": round(start_t, 3),
                    "word": w_text,
                    "word_start": round(w_start, 3),
                    "word_end": round(w_end, 3),
                    "severity": f"Cut {round(start_t - w_start, 2)}s into word '{w_text}'",
                    "segment_index": seg_idx,
                })

            if (w_start + threshold_sec) < end_t < (w_end - threshold_sec):
                findings.append({
                    "type": "D7",
                    "subtype": "cut_inside_word_tail",
                    "time": round(end_t, 3),
                    "word": w_text,
                    "word_start": round(w_start, 3),
                    "word_end": round(w_end, 3),
                    "severity": f"Cut {round(w_end - end_t, 2)}s before end of word '{w_text}'",
                    "segment_index": seg_idx,
                })

    return findings
