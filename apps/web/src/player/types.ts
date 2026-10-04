/**
 * WebCodecs Frame Stepper & Scrubber Type Definitions
 */

export interface Sample {
  index: number;
  cts: number; // Composition time in seconds
  dts: number; // Decode time in seconds
  duration: number; // Duration in seconds
  isSync: boolean; // Keyframe flag
  offset: number;
  size: number;
  data: Uint8Array;
}

export interface VideoTrackInfo {
  codec: string;
  width: number;
  height: number;
  timescale: number;
  duration: number;
  sampleCount: number;
  description?: Uint8Array; // avcC box
}

export interface SeekPlan {
  targetIndex: number;
  keyframeIndex: number;
  canContinue: boolean;
  samplesToDecode: number[];
}

export interface PlayerStats {
  openFrames: number;
  cacheBytes: number;
  cacheFrames: number;
  lastSeekLatencyMs: number;
  droppedFrames: number;
  isHardwareAccelerated: boolean;
}

export type PlayerCommand =
  | { type: 'INIT'; canvas: OffscreenCanvas; width: number; height: number }
  | { type: 'LOAD'; url: string }
  | { type: 'SEEK'; time: number; seekId: number }
  | { type: 'STEP'; frames: number; seekId: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' };

export type PlayerEvent =
  | { type: 'READY'; duration: number; fps: number; width: number; height: number }
  | { type: 'FRAME'; index: number; timestamp: number; seekId?: number }
  | { type: 'STATS'; stats: PlayerStats }
  | { type: 'ERROR'; message: string };
