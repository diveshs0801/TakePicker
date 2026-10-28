// Shared contracts between API, workers, analysis and UI.

export type AssetStatus =
  | "UPLOADED" | "PROBING" | "PROXYING" | "TRANSCRIBING"
  | "ANALYZING" | "READY" | "FAILED";

export type RenderStatus = "QUEUED" | "RENDERING" | "MERGING" | "DONE" | "FAILED";

export interface Word {
  w: string;
  word?: string; // Alias for w
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
  trackId?: string;    // e.g. "V1", "V2", "A1", "A2"
  gain?: number;       // linear audio gain (1.0 = 0dB, default 1.0)
  speed?: number;      // playback rate (1.0 = normal, default 1.0)
  colorTag?: string;   // visual color badge
  auditionGroup?: string; // Links alternative takes in a stacked audition lane
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
  | 'TRIM_CLIP'
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

export interface LegacyLintFinding {
  check: DefectCheckType | string;
  severity: 'error' | 'warn' | 'warning';
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
  findings: (LintFinding | LegacyLintFinding)[];
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

export type LintSeverity = 'error' | 'warn' | 'warning' | 'info';
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
  check?: string;             // Backward-compatibility alias
  start?: number;             // Backward-compatibility alias
  end?: number;               // Backward-compatibility alias
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

// ============================================================================
// Cardboard AI Hard Problem #10: Version Control for Video
// Branching, 3-Way Timeline Merge, Conflict Taxonomy & Audition Resolution
// ============================================================================

export type TimelineDiffOpType =
  | 'TRIM'
  | 'SLIP'
  | 'MOVE'
  | 'INSERT'
  | 'DELETE'
  | 'FIELD_EDIT';

export interface TimelineDiffOp {
  opType: TimelineDiffOpType;
  clipId: string;
  trackId?: string;
  oldValues?: Partial<TimelineClip>;
  newValues?: Partial<TimelineClip>;
  afterClipId?: string | null;  // For MOVE or INSERT relative sequence placement
  reason?: string;
}

export interface TimelinePatch {
  baseAssetId: string;
  baseHash: string;
  targetHash: string;
  operations: TimelineDiffOp[];
  createdAt: string;
}

export type TimelineConflictType =
  | 'TRIM_TRIM'             // Both sides trimmed same clip boundaries with contradictory values
  | 'DELETE_EDIT'           // One side deleted clip, other side trimmed/color/volume-edited it
  | 'MOVE_MOVE'             // Both sides moved clip to contradictory positions or tracks
  | 'TRACK_OCCLUSION'       // Two new clips inserted into overlapping presentation times on same track
  | 'SEMANTIC_VIOLATION';   // Merged clip violates physical invariants (in >= out or duration < 1 frame)

export type ConflictResolutionStrategy =
  | 'KEEP_OURS'             // Accept current/active branch version
  | 'KEEP_THEIRS'           // Accept incoming/target branch version
  | 'SPLIT_AUDITION_LANES'  // Non-destructive: retain both clips as stacked audition layers
  | 'BLEND_FIELDWISE';      // Auto-combine orthogonal property changes (e.g. ours trim + theirs gain)

export interface TimelineConflict {
  id: string;
  type: TimelineConflictType;
  clipId: string;
  description: string;
  baseClip?: TimelineClip;
  oursClip?: TimelineClip;
  theirsClip?: TimelineClip;
  conflictingField?: string;
  recommendedStrategy: ConflictResolutionStrategy;
  resolved?: boolean;
  chosenStrategy?: ConflictResolutionStrategy;
}

export interface TimelineBranch {
  id: string;
  name: string;               // e.g. "main", "sarah/dialogue-pacing", "alex/sound-design", "agent/auto-tighten"
  assetId: string;
  headRevisionId: string;
  baseRevisionId: string;
  author: string;             // User name or "agent"
  description?: string;
  createdAt: string;
  updatedAt: string;
  isProtected?: boolean;      // True for 'main'
}

export interface TimelineRevision {
  id: string;
  branchId: string;
  parentRevisionIds: string[]; // 1 parent for standard commit, 2 parents for 3-way merge
  author: string;
  message: string;             // Human-readable editorial milestone message
  timestamp: string;
  timelineHash: string;        // Merkle tree root hash of timeline
  timelineSnapshot: Timeline;  // Materialized snapshot
  patchFromParent?: TimelineDiffOp[];
}

export interface ThreeWayMergeResult {
  baseRevisionId?: string;
  oursBranch: string;
  theirsBranch: string;
  mergedTimeline: Timeline;
  hasConflicts: boolean;
  conflicts: TimelineConflict[];
  appliedOpsCount: number;
  autoResolvedCount: number;
  stats: {
    totalClips: number;
    cleanMergesCount: number;
    conflictCount: number;
    durationSeconds: number;
  };
}

export interface VersionControlState {
  currentBranch: string;
  branches: TimelineBranch[];
  revisions: TimelineRevision[];
  activeConflicts: TimelineConflict[];
}

// =========================================================================
// Cardboard AI Problem #09: Aesthetic VLM Judge, Brand Kit & Social RL Loop
// =========================================================================

export interface BrandKitConfig {
  id: string;
  name: string;
  primaryColor: string;     // e.g. '#6366f1' (indigo)
  accentColor: string;      // e.g. '#a855f7' (purple)
  fontFamily: string;       // e.g. 'Inter', 'Outfit'
  safeZone: {
    topPct: number;         // Top margin (default: 14% to avoid mobile app headers)
    bottomPct: number;      // Bottom margin (default: 20% to avoid caption & audio tags)
    rightPct: number;       // Right margin (default: 18% to avoid engagement buttons)
  };
  targetPacingWpmMin: number;
  targetPacingWpmMax: number;
  maxShotDurationSec: number;
}

export type AestheticFindingType =
  | 'VISUAL_JUMP_CUT'           // Sub-30 degree camera angle change with identical subject position
  | 'SAFE_ZONE_VIOLATION'       // Text/overlay clipped by TikTok / Instagram Reels UI icons
  | 'BRAND_COLOR_DIVERGENCE'    // Primary color tone diverges significantly from brand kit palette
  | 'PACING_DISSONANCE'         // Sudden pacing shift without narrative justification
  | 'NARRATIVE_SETUP_MISSING';  // Hook or punchline disconnected from premise

export interface AestheticFinding {
  id: string;
  type: AestheticFindingType;
  severity: 'warn' | 'error';
  timestamp: number;
  clipId?: string;
  message: string;
  details?: Record<string, any>;
  suggestedAction: string;
}

export interface AestheticQualityReport {
  overallTasteScore: number;     // 0 - 100
  brandAdherenceScore: number;   // 0 - 100
  narrativeArcScore: number;     // 0 - 100
  visualContinuityScore: number; // 0 - 100
  findings: AestheticFinding[];
  vlmCritique?: string;
  vlmModelUsed?: string;
  tokenBudgetStats: {
    tokensUsed: number;
    tokensRemainingMinute: number;
    cacheHit: boolean;
  };
  createdAt: string;
}

export interface SocialRetentionTelemetry {
  assetId: string;
  platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels';
  sampleCount: number;
  retentionTrajectory: { second: number; retentionPct: number }[];
  threeSecondHookRate: number;   // e.g. 91.5%
  completionRate: number;        // e.g. 64.2%
  observedDropOffCliffs: {
    timestamp: number;
    dropMagnitudePct: number;
    defectCorrelation?: string;
  }[];
}

export interface VideoRLEnvironmentState {
  iteration: number;
  policyParameters: {
    pacingPatience: number;      // Higher = allows longer thoughtful shots; lower = tighter cuts
    hookDensity: number;         // Aggressiveness of opening 3s hook tightening
    brollInsertionRate: number;  // Target cuts/minute for visual relief
    pauseThresholdSec: number;   // Max permissible acoustic pause
  };
  rewardMetrics: {
    empiricalRetentionReward: number; // From social telemetry (0 to 1)
    antiBrainRotPenalty: number;     // Regularization penalty against epileptic hyper-cuts
    netTasteReward: number;          // Final combined reward
  };
  status: 'OPTIMIZING' | 'STABILIZED' | 'REGULARIZED';
  history: { iteration: number; reward: number; retentionLiftPct: number }[];
}

// =========================================================================
// Frontier Problem #09 Extensions: Dense Hazard Attribution, Causal DML,
// Creator Style Fingerprint, Video DPO, and Tri-Modal Manifold
// =========================================================================

export interface HazardRatePoint {
  second: number;
  retention: number;        // R(t) in [0.0, 1.0]
  hazardRate: number;       // h(t) = - (1/R) * dR/dt
  isDropOffCliff: boolean;  // True if h(t) > threshold
}

export interface CutCreditAttribution {
  cutIndex: number;
  clipId: string;
  timestamp: number;
  transitionType: string;
  associatedHazardDelta: number; // Localized penalty from hazard spike
  stepReward: number;            // Local credit assigned to this specific cut
  verdict: 'EXCELLENT' | 'NEUTRAL' | 'HAZARD_INDUCED';
  rootCause?: string;
}

export interface CausalTreatmentResult {
  assetId: string;
  observedRetention: number;       // Y_i (raw observed retention)
  creatorBaselineExpected: number; // g(Z_i) (expected baseline from subscriber count & past stats)
  topicViralityPrior: number;      // Prior from subject matter
  trueCausalLift: number;          // tau(X_i) = Y_i - g(Z_i) (true impact of the edit)
  isStatisticallySignificant: boolean;
}

export type CreativeSpanType =
  | 'COMEDIC_PAUSE'        // Deadpan or punchline silence (NEVER jump-cut)
  | 'DRAMATIC_BUILDUP'     // Slow cinematic accumulation of tension
  | 'REACTION_BEAT'        // Subject facial reaction without speech
  | 'MUSIC_MONTAGE';       // Visual rhythm driven by soundtrack

export interface ProtectedCreativeSpan {
  id: string;
  type: CreativeSpanType;
  start: number;
  end: number;
  rationale: string;
  lockedBy: 'creator' | 'agent_intent_inferred';
}

export interface CreatorStyleFingerprint {
  creatorId: string;
  channelName: string;
  archetype: 'CINEMATIC_STORYTELLER' | 'FAST_PACED_SOCIAL' | 'COMEDIC_PERFORMER' | 'EXPERIMENTAL';
  metrics: {
    avgShotLengthSec: number;        // e.g. 4.2s for cinematic, 1.4s for hyper-shorts
    silenceToleranceSec: number;     // e.g. 1.2s for comedy/drama, 0.25s for tech reviews
    brollToArollRatio: number;       // e.g. 0.35 (35% B-roll)
    zoomPunchFrequencyPerMin: number;// e.g. 2.0 vs 14.0
    colorGradePalette: string[];     // Array of brand #HEX tones
  };
  klDivergenceTolerance: number;     // Maximum allowable artistic drift
  protectedSpans: ProtectedCreativeSpan[];
}

export interface VideoDPOPreferencePair {
  id: string;
  assetId: string;
  timestamp: number;
  contextWindow: {
    start: number;
    end: number;
    transcriptSlice: string;
  };
  winningEdit: {
    action: string;
    cutTimestamp: number;
    zoomLevel?: number;
    actor: 'human_editor';
  };
  losingEdit: {
    action: string;
    cutTimestamp: number;
    zoomLevel?: number;
    actor: 'ai_proposal_undone';
  };
  dpoLogRatioDelta: number; // beta * (log pi(y_w) - log pi(y_l))
  createdAt: string;
}

export interface TriModalCutCandidate {
  targetTimestamp: number;
  optimalCutTimestamp: number;
  phoneticEnergyScore: number; // 0 = quiet zero-crossing room tone (best)
  musicBeatDistanceMs: number;  // Distance to nearest musical downbeat / transient
  opticalFlowMinimaMs: number;  // Distance to visual kinetic resting point
  compositeEnergyCost: number;  // Lowest = optimal harmonic cut point
}



