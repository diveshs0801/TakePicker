"""
D2: Frozen video detection.
Parses FFmpeg freezedetect filter output from stderr.

FFmpeg output format:
  [freezedetect @ 0x...] lavfi.freezedetect.freeze_start: 5.000
  [freezedetect @ 0x...] lavfi.freezedetect.freeze_duration: 2.000
  [freezedetect @ 0x...] lavfi.freezedetect.freeze_end: 7.000
"""

import re

FREEZE_START_RE = re.compile(
    r"\[freezedetect\s*@\s*\S+\].*freeze_start:\s*(?P<start>[\d.]+)"
)
FREEZE_END_RE = re.compile(
    r"\[freezedetect\s*@\s*\S+\].*freeze_end:\s*(?P<end>[\d.]+)"
)
FREEZE_DUR_RE = re.compile(
    r"\[freezedetect\s*@\s*\S+\].*freeze_duration:\s*(?P<dur>[\d.]+)"
)


def parse_frozen_video(stderr: str, config: dict) -> list[dict]:
    """
    Parse freezedetect output and return findings.
    
    Note from the design doc: freezedetect is expected to produce
    false alarms on talking-head video with little motion (e.g. a
    speaker standing still). This is a known limitation.
    
    Args:
        stderr: Raw FFmpeg stderr output
        config: frozen_video section from config.yaml
    
    Returns:
        List of finding dicts
    """
    min_dur = config.get("min_duration", 0.4)
    findings = []

    # Collect all starts, ends, and durations
    starts = [float(m.group("start")) for m in FREEZE_START_RE.finditer(stderr)]
    ends = [float(m.group("end")) for m in FREEZE_END_RE.finditer(stderr)]
    durations = [float(m.group("dur")) for m in FREEZE_DUR_RE.finditer(stderr)]

    # Match them up (they appear in order)
    count = min(len(starts), len(ends), len(durations))

    for i in range(count):
        start = starts[i]
        end = ends[i]
        dur = durations[i]

        if dur < min_dur:
            continue

        severity = "error" if dur >= 2.0 else "warn"

        findings.append({
            "check": "D2_frozen_video",
            "severity": severity,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(dur, 3),
            "message": f"Frozen video detected: {dur:.3f}s at {start:.2f}s",
            "suggestedFix": None
        })

    return findings
