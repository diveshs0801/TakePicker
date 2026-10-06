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

// --- Phase 2A: Agent Layer & Timeline Operations ---

export type TimelineOpType =
  | 'INSERT'
  | 'DELETE'
  | 'TRIM'
  | 'SPLIT'
  | 'MOVE'
  | 'SELECT_TAKE';

export type TimeDomain = 'timeline' | 'source';

export interface TimelineOp<T extends TimelineOpType = TimelineOpType> {
  id: string;
  assetId: string;
  seq: number;
  opType: T;
  payload: any;
  inverse: any;
  actor: 'user' | 'agent';
  agentRunId?: string;
  createdAt: string;
}

export interface TimelineSnapshot {
  assetId: string;
  seq: number;
  timeline: Timeline;
  createdAt: string;
}

export type TimelineErrorCode =
  | 'CLIP_NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'OUT_OF_RANGE'
  | 'TOO_SHORT'
  | 'STALE_BASE_SEQ'
  | 'INVARIANT_VIOLATION'
  | 'NOTHING_TO_UNDO'
  | 'INVALID_ARGUMENT';

export interface StructuredError {
  ok: false;
  code: TimelineErrorCode;
  message: string;
  hint?: string;
}

export interface StructuredSuccess<T = any> {
  ok: true;
  data: T;
  message?: string;
}

export type ToolResult<T = any> = StructuredSuccess<T> | StructuredError;

export type AgentRunStatus = 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export interface AgentToolCallRecord {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: ToolResult;
  error?: string;
}

export interface AgentStep {
  step: number;
  thought?: string;
  toolCalls: AgentToolCallRecord[];
  response?: string;
}

export interface AgentRun {
  id: string;
  assetId: string;
  prompt: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentWsEvent {
  type: 'run_started' | 'tool_call' | 'tool_result' | 'ops_applied' | 'message' | 'run_done';
  runId: string;
  assetId: string;
  payload: any;
}

// --- Phase 2B: Video Linter & Verification Contracts ---

export type DefectCheckType =
  | 'D1_black_frames'
  | 'D2_frozen_video'
  | 'D3_audio_dropout'
  | 'D4_loudness_jump'
  | 'D5_av_desync';

export interface LintFinding {
  check: DefectCheckType | string;
  severity: 'error' | 'warn';
  start: number;
  end: number;
  message: string;
  suggestedFix?: {
    action: string;
    targetClipId?: string;
    suggestedBoundary?: number;
  };
}

export interface LintReport {
  id: string;
  renderId: string;
  assetId: string;
  defectCount: number;
  findings: LintFinding[];
  duration?: number;
  lintTimeSec?: number;
  passed: boolean;
  createdAt: string;
}

// --- Plan 4: Pro NLE Export Interchange Contracts ---

export type ExportFormat = 'fcpxml' | 'premiere' | 'edl' | 'otio';

export interface ExportOptions {
  format: ExportFormat;
  sequenceName?: string;
  timecodeStart?: string;
  includeAudio?: boolean;
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  mimeType: string;
  content: string;
  clipCount: number;
  totalDurationSec: number;
}

// --- Plan 5: AI Dynamic Captions & Subtitles Engine Contracts ---

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'json';
export type SubtitleStylePreset = 'kinetic' | 'neon' | 'modern' | 'minimal';

export interface TimelineWord extends Word {
  timelineStart: number;
  timelineEnd: number;
  clipId: string;
}

export interface SubtitleCue {
  index: number;
  start: number;
  end: number;
  text: string;
  words: TimelineWord[];
}

export interface SubtitleExportOptions {
  format?: SubtitleFormat;
  stylePreset?: SubtitleStylePreset;
  maxWordsPerCue?: number;
  maxCharsPerCue?: number;
}

export interface SubtitleExportResult {
  format: SubtitleFormat;
  filename: string;
  mimeType: string;
  content: string;
  cueCount: number;
  wordCount: number;
  totalDurationSec: number;
  cues: SubtitleCue[];
}



