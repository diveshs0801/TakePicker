"""
D1: Black frame detection.
Parses FFmpeg blackdetect filter output from stderr.

FFmpeg output format:
  [blackdetect @ 0x...] black_start:10.000 black_end:10.500 black_duration:0.500
"""

import re

# Pattern for blackdetect output lines
BLACKDETECT_RE = re.compile(
    r"\[blackdetect\s*@\s*\S+\]\s*"
    r"black_start:\s*(?P<start>[\d.]+)\s+"
    r"black_end:\s*(?P<end>[\d.]+)\s+"
    r"black_duration:\s*(?P<dur>[\d.]+)"
)


def parse_black_frames(stderr: str, config: dict) -> list[dict]:
    """
    Parse blackdetect output and return findings.
    
    Args:
        stderr: Raw FFmpeg stderr output
        config: black_frames section from config.yaml
    
    Returns:
        List of finding dicts
    """
    min_dur = config.get("min_duration", 0.05)
    findings = []

    for match in BLACKDETECT_RE.finditer(stderr):
        start = float(match.group("start"))
        end = float(match.group("end"))
        dur = float(match.group("dur"))

        if dur < min_dur:
            continue

        severity = "error" if dur >= 0.25 else "warn"

        findings.append({
            "check": "D1_black_frames",
            "severity": severity,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(dur, 3),
            "message": f"Black frames detected: {dur:.3f}s span at {start:.2f}s",
            "suggestedFix": None
        })

    return findings
