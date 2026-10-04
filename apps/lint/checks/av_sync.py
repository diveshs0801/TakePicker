"""
D5: Audio / Video Desync detector.
Checks whether the audio and video streams deviate in start PTS or alignment.
"""

import json
import subprocess
from typing import Dict, Any, Optional

def check_av_sync(filepath: str, threshold_ms: float = 40.0) -> Optional[Dict[str, Any]]:
    """
    Query ffprobe for video and audio stream start_time and duration.
    Detects PTS start skew and container offset.
    """
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "stream=index,codec_type,start_time,duration",
        "-of", "json",
        filepath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None

    try:
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        if not v_stream or not a_stream:
            return None

        v_start = float(v_stream.get("start_time", 0.0) or 0.0)
        a_start = float(a_stream.get("start_time", 0.0) or 0.0)

        diff_sec = abs(a_start - v_start)
        diff_ms = diff_sec * 1000.0

        if diff_ms >= threshold_ms:
            return {
                "type": "D5",
                "subtype": "av_pts_desync",
                "video_start": round(v_start, 4),
                "audio_start": round(a_start, 4),
                "offset_ms": round(diff_ms, 1),
                "severity": f"{round(diff_ms)}ms offset",
                "message": f"Audio and Video streams are desynchronized by {round(diff_ms)} ms (threshold: {threshold_ms} ms)",
            }
    except Exception:
        pass

    return None
