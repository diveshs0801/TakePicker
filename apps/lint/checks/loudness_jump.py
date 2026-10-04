"""
D4: Loudness jump detection.
Parses FFmpeg ebur128 filter output from stderr.

The ebur128 filter outputs momentary and short-term loudness measurements.
We detect sudden step-changes in loudness between adjacent time windows,
which indicate a gain mismatch between joined segments.

FFmpeg output format (ebur128):
  [Parsed_ebur128_1 @ 0x...] t: 1.0   TARGET:-23 LUFS   M: -18.2 S: -20.1 ...
  [Parsed_ebur128_1 @ 0x...] t: 1.2   TARGET:-23 LUFS   M: -15.0 S: -17.3 ...
"""

import re

# Parse ebur128 momentary (M) and short-term (S) loudness
EBUR128_RE = re.compile(
    r"\[Parsed_ebur128_\d+\s*@\s*\S+\]\s*"
    r"t:\s*(?P<time>[\d.]+)\s+.*?"
    r"M:\s*(?P<momentary>[-\d.]+)\s+"
    r"S:\s*(?P<short>[-\d.]+)"
)


def parse_loudness_jump(stderr: str, config: dict) -> list[dict]:
    """
    Detect sudden loudness step-changes using ebur128 momentary loudness.
    
    Compares adjacent momentary readings. If the difference exceeds the
    threshold, flag it. This catches gain mismatches at segment joins.
    
    Args:
        stderr: Raw FFmpeg stderr output
        config: loudness_jump section from config.yaml
    
    Returns:
        List of finding dicts
    """
    threshold_lu = config.get("threshold_lu", 4.0)
    findings = []

    # Parse all ebur128 measurements
    measurements = []
    for match in EBUR128_RE.finditer(stderr):
        t = float(match.group("time"))
        m = float(match.group("momentary"))
        s = float(match.group("short"))
        measurements.append({"time": t, "momentary": m, "short": s})

    if len(measurements) < 2:
        return findings

    # Compare adjacent momentary loudness readings
    for i in range(1, len(measurements)):
        prev = measurements[i - 1]
        curr = measurements[i]

        diff = abs(curr["momentary"] - prev["momentary"])

        if diff >= threshold_lu:
            # Skip if either reading is -inf (silence)
            if prev["momentary"] < -70 or curr["momentary"] < -70:
                continue

            direction = "louder" if curr["momentary"] > prev["momentary"] else "quieter"
            severity = "error" if diff >= 8.0 else "warn"

            findings.append({
                "check": "D4_loudness_jump",
                "severity": severity,
                "start": round(prev["time"], 3),
                "end": round(curr["time"], 3),
                "duration": round(curr["time"] - prev["time"], 3),
                "message": (
                    f"Loudness jump: {diff:.1f} LU {direction} "
                    f"at {prev['time']:.1f}s→{curr['time']:.1f}s "
                    f"({prev['momentary']:.1f} → {curr['momentary']:.1f} LUFS)"
                ),
                "detail": {
                    "diff_lu": round(diff, 2),
                    "direction": direction,
                    "prev_lufs": round(prev["momentary"], 2),
                    "curr_lufs": round(curr["momentary"], 2),
                },
                "suggestedFix": None
            })

    return findings
