// Shared contracts between API, workers, analysis and UI.

export type AssetStatus =
  | "UPLOADED" | "PROBING" | "PROXYING" | "TRANSCRIBING"
  | "ANALYZING" | "READY" | "FAILED";

export type RenderStatus = "QUEUED" | "RENDERING" | "MERGING" | "DONE" | "FAILED";

export interface Word { w: string; start: number; end: number; prob: number }

export interface TimelineClip {
  id: string;
  in: number;          // seconds, snapped to frame grid
  out: number;
  groupId: string | null;
  reason?: string;     // e.g. "take 3/3, score 0.91"
}

export interface Timeline {
  assetId: string;
  fps: number;
  clips: TimelineClip[];
}

export interface RenderSegmentJob {
  renderId: string;
  assetId: string;
  idx: number;
  in: number;
  out: number;
  srcPath: string;
  outPath: string;
}

export interface MergeJob {
  renderId: string;
  assetId: string;
  outPath: string;
}

export interface ProgressEvent {
  renderId: string;
  segmentIdx: number;
  pct: number; // 0..100
}

export const snapToFrame = (t: number, fps: number) => Math.round(t * fps) / fps;
