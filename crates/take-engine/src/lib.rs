pub mod audio;
pub mod video;

pub use audio::{
    extract_waveform, pcm_s16le_to_mono_f32, scan_silences, DetectedSilence, VadAnalysisResult,
    VadConfig, WaveformBucket, WaveformResult,
};

pub use video::{
    GopSubSegment, SegmentExecutionStrategy, SmartGopPlan, VideoKeyframeIndex,
};
