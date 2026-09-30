"""Analysis service: transcription now, retake clustering + scoring next."""
from fastapi import FastAPI
from pydantic import BaseModel
from faster_whisper import WhisperModel
import os

app = FastAPI()
model = WhisperModel(os.getenv("WHISPER_MODEL", "small"), compute_type="int8")

# Whisper tends to clean up fillers; this prompt nudges it to keep them.
FILLER_PROMPT = "Umm, let me think, like, hmm... okay, so, here's what I'm, uh, thinking."

class TranscribeReq(BaseModel):
    audioPath: str

@app.post("/transcribe")
def transcribe(req: TranscribeReq):
    segments, _ = model.transcribe(
        req.audioPath,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=FILLER_PROMPT,
    )
    words = []
    for s in segments:
        for w in s.words or []:
            words.append({"w": w.word.strip(), "start": w.start, "end": w.end, "prob": w.probability})
    return {"words": words}

# TODO Day 2:
#   segment_words(words, pause=0.7)
#   find_retakes(segments)   # embeddings + rapidfuzz + prefix check + cue phrases
#   score_takes(groups)      # weighted features, store breakdown
