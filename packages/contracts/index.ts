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
  fps?: number;
  encoder?: string;
  crf?: number;
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
  | 'SELECT_TAKE'
  | 'JUMP_CUT'
  | 'RESTORE_CLIPS';

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

// --- Milestone 12: Silence Detection & Smart Jump-Cut ---
export interface SilenceInterval {
  start: number;
  end: number;
  duration: number;
  precedingWord?: string;
  followingWord?: string;
}

export interface SilenceDetectionOptions {
  minSilenceSec?: number; // threshold in seconds, default: 0.60
  bufferSec?: number;     // pad/breathing room around words, default: 0.10
}

export interface SilenceRemovalResult {
  assetId: string;
  silencesDetected: number;
  totalSilenceDuration: number;
  timeSaved: number;
  newClipsCount: number;
  timeline: Timeline;
  intervals: SilenceInterval[];
}

// ==============================================================================
// Cardboard AI Hard Problem #09: Video Verification & Linting Engine
// ==============================================================================

export type LintSeverity = 'error' | 'warning' | 'info';
export type LintCategory = 'technical' | 'pacing' | 'audio' | 'cadence' | 'narrative' | 'brand' | 'sync';

export type LintRuleId =
  | 'WORD_CUTOFF'               // Tier 1: Cut intersects a spoken word token
  | 'AUDIO_POP_RISK'           // Tier 1: Hard cut boundary missing microfade
  | 'GAP_JITTER'               // Tier 1: Sub-frame gap (< 1/fps) causing black flash
  | 'UNSNAPPED_FRAME_GRID'     // Tier 1: Timestamp not locked to video FPS grid
  | 'ZERO_DURATION_CLIP'       // Tier 1: Degenerate in >= out clip
  | 'OUT_OF_BOUNDS_CLIP'       // Tier 1: Clip out point exceeds asset duration
  | 'AV_SYNC_DRIFT'            // Tier 1: ITU-R BT.1359 audio/video lip-sync phase drift (>+45ms / <-125ms)
  | 'DANGLING_PRONOUN'         // Tier 2 (Narrative): Orphan pronoun (he/she/it/this) missing antecedent
  | 'BROKEN_CAUSAL_CONNECTIVE' // Tier 2 (Narrative): Orphan discourse marker (therefore/because) missing premise
  | 'STORY_ARC_DEFICIT'        // Tier 2 (Narrative): Missing 3-second hook or abrupt unresolved ending
  | 'BRAND_SAFE_ZONE_VIOLATION'// Tier 2 (Brand): Visual element violates 80% Title Safe boundary
  | 'HOOK_DEAD_AIR'            // Tier 2: First spoken word delayed > 1.0s in hook window
  | 'SHOT_PACING_STAGNATION'   // Tier 2: Single clip duration > 12.0s without cut
  | 'DEAD_AIR_DENSITY'         // Tier 2: Excessive pause duration (> 15% of timeline)
  | 'RAPID_FIRE_CUT_CLUSTER'   // Tier 2: > 3 cuts in < 1.0s causing visual flutter
  | 'SPEECH_CADENCE_WPM'       // Tier 2: Conversational rate out of optimal bounds (<110 or >210 WPM)
  | 'RETENTION_DROP_RISK'      // Tier 2: High probability of viewer drop-off predicted by retention model
  | 'D1_BLACK_FRAMES'          // Dynamic: Black frame sequence detected
  | 'D2_FROZEN_VIDEO'          // Dynamic: Repeated frozen frames detected
  | 'D3_AUDIO_DROPOUT'         // Dynamic: Muted audio dropout detected
  | 'D4_LOUDNESS_JUMP';        // Dynamic: Jarring audio gain surge detected

export interface LintFinding {
  id: string;
  rule: LintRuleId;
  category: LintCategory;
  severity: LintSeverity;
  message: string;
  timestamp: number;          // Timeline seconds where defect occurs
  endTimestamp?: number;      // Optional end timestamp
  clipId?: string;
  sourceTimestamp?: number;   // In source asset time
  details?: Record<string, any>;
  suggestedRepair?: {
    opType: 'trim_clip' | 'split_clip' | 'remove_range' | 'snap_bounds' | 'restore_context' | 'realign_sync';
    clipId?: string;
    suggestedIn?: number;
    suggestedOut?: number;
    explanation: string;
  };
}

export interface RetentionCurvePoint {
  timeSec: number;
  retentionPct: number;       // 0 to 100 predicted viewer retention
  penaltyFactor: number;      // Pacing or defect penalty at this timestamp
}

export interface TimelineLintReport {
  valid: boolean;
  score: number;               // 0 to 100 composite verification score
  tier1Passed: boolean;        // Zero-glitch technical floor passed
  tier2Passed: boolean;        // Editorial & pacing quality passed
  storyArcPassed: boolean;     // Narrative continuity & discourse coherent
  findings: LintFinding[];
  retentionPrediction?: {
    overallRetentionScore: number;     // 0 to 100 predicted platform engagement
    threeSecondHookRetention: number;  // % of viewers held through 3s mark
    thirtySecondRetention: number;     // % of viewers held through 30s mark
    curve: RetentionCurvePoint[];
  };
  metrics: {
    totalDuration: number;
    clipCount: number;
    avgClipDuration: number;
    wordsPerMinute: number;
    deadAirSeconds: number;
    deadAirPercent: number;
    hookLatencySeconds: number;
    errorCount: number;
    warningCount: number;
    storyCoherenceScore: number;       // 0 to 100
  };
  suggestedRepairs: Array<{
    rule: LintRuleId;
    clipId?: string;
    repairAction: string;
    targetBounds: { in: number; out: number };
    explanation: string;
  }>;
}
