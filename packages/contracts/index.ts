// Shared contracts between API, workers, analysis and UI.

export type AssetStatus =
  | "UPLOADED" | "PROBING" | "PROXYING" | "TRANSCRIBING"
  | "ANALYZING" | "READY" | "FAILED";

export type RenderStatus = "QUEUED" | "RENDERING" | "MERGING" | "DONE" | "FAILED";

export interface Word {
  w: string;
  start: number;
  end: number;
  prob: number;
}

export interface TakeFeatures {
  filler_score?: number;
  repeat_score?: number;
  pause_score?: number;
  sentence_end_score?: number;
  mean_confidence?: number;
  wpm?: number;
  wpm_score?: number;
  position_bonus?: number;
  fillers_detected?: number;
  cue_phrase?: boolean;
}

export interface TakeSegment {
  id?: string;
  idx: number;
  start: number;
  end: number;
  text: string;
  score?: number;
  features?: TakeFeatures;
  groupId?: string;
  words?: Word[];
}

export interface TakeGroup {
  id: string;
  idx: number;
  chosenSegmentId: number | string;
  overridden?: boolean;
  takes: TakeSegment[];
  isRetake: boolean;
}

export interface TimelineClip {
  id: string;
  segmentIdx?: number;
  in: number;          // seconds, snapped to frame grid
  out: number;
  groupId: string | null;
  reason?: string;     // e.g. "take 3/3, score 0.91"
  text?: string;
}

export interface Timeline {
  assetId: string;
  fps: number;
  clips: TimelineClip[];
}

export interface AssetMetadata {
  duration: number;
  fps: number;
  width: number;
  height: number;
  vcodec: string;
}

export interface Asset {
  id: string;
  filename: string;
  storageKey: string;
  duration?: number;
  fps?: number;
  width?: number;
  height?: number;
  vcodec?: string;
  status: AssetStatus;
  createdAt: string;
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

export interface AssetEvent {
  assetId: string;
  status: AssetStatus;
  progress?: number;
  error?: string;
}

export const snapToFrame = (t: number, fps: number) => Math.round(t * fps) / fps;
