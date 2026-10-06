use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SegmentExecutionStrategy {
    /// Completely aligned with GOP boundaries: zero re-encoding, pure stream copy.
    PureStreamCopy,
    /// Smart GOP hybrid: re-encode fractional head/tail frames, stream copy 95% of body.
    SmartGopHybrid,
    /// Short clip under single GOP: full re-encode required.
    FullReencode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GopSubSegment {
    pub seg_type: String, // "head_reencode" | "body_copy" | "tail_reencode" | "full_copy"
    pub start_sec: f64,
    pub end_sec: f64,
    pub duration_sec: f64,
    pub requires_reencode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartGopPlan {
    pub requested_in: f64,
    pub requested_out: f64,
    pub total_duration: f64,
    pub strategy: SegmentExecutionStrategy,
    pub time_reencoded_sec: f64,
    pub time_stream_copied_sec: f64,
    pub stream_copy_ratio: f32,
    pub sub_segments: Vec<GopSubSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoKeyframeIndex {
    pub fps: f64,
    pub duration_sec: f64,
    pub keyframes: Vec<f64>, // List of keyframe timestamps in seconds
}

impl VideoKeyframeIndex {
    /// Constructs a simulated or probed keyframe index with uniform or explicit GOP intervals.
    pub fn new(duration_sec: f64, fps: f64, keyframe_interval_sec: f64) -> Self {
        let mut keyframes = Vec::new();
        let mut t = 0.0f64;
        let interval = keyframe_interval_sec.max(0.5);
        while t < duration_sec {
            keyframes.push((t * fps).round() / fps);
            t += interval;
        }
        Self {
            fps,
            duration_sec,
            keyframes,
        }
    }

    /// Evaluates an edit slice `[in_sec, out_sec]` and formulates the optimal Smart GOP execution plan.
    pub fn plan_smart_cut(&self, in_sec: f64, out_sec: f64) -> SmartGopPlan {
        let in_sec = in_sec.max(0.0);
        let out_sec = out_sec.min(self.duration_sec);
        let total_duration = (out_sec - in_sec).max(0.0);

        if total_duration <= 0.0 {
            return SmartGopPlan {
                requested_in: in_sec,
                requested_out: out_sec,
                total_duration: 0.0,
                strategy: SegmentExecutionStrategy::FullReencode,
                time_reencoded_sec: 0.0,
                time_stream_copied_sec: 0.0,
                stream_copy_ratio: 0.0,
                sub_segments: Vec::new(),
            };
        }

        // Tolerance in seconds (half a frame)
        let frame_dur = 1.0 / self.fps;
        let tol = frame_dur * 0.5;

        // Check if in_sec is aligned with a keyframe
        let in_is_keyframe = self.keyframes.iter().any(|&kf| (kf - in_sec).abs() <= tol);

        // Find keyframes strictly inside (in_sec, out_sec)
        let internal_kfs: Vec<f64> = self
            .keyframes
            .iter()
            .copied()
            .filter(|&kf| kf > in_sec + tol && kf < out_sec - tol)
            .collect();

        // If in_sec is aligned and out_sec is aligned: pure stream copy!
        let out_is_keyframe = self.keyframes.iter().any(|&kf| (kf - out_sec).abs() <= tol);
        if in_is_keyframe && out_is_keyframe {
            return SmartGopPlan {
                requested_in: in_sec,
                requested_out: out_sec,
                total_duration,
                strategy: SegmentExecutionStrategy::PureStreamCopy,
                time_reencoded_sec: 0.0,
                time_stream_copied_sec: total_duration,
                stream_copy_ratio: 1.0,
                sub_segments: vec![GopSubSegment {
                    seg_type: "full_copy".to_string(),
                    start_sec: in_sec,
                    end_sec: out_sec,
                    duration_sec: total_duration,
                    requires_reencode: false,
                }],
            };
        }

        // If there are internal keyframes, we can stream copy the middle body!
        if !internal_kfs.is_empty() {
            let first_kf = *internal_kfs.first().unwrap();
            let last_kf = *internal_kfs.last().unwrap();

            let mut subs = Vec::new();
            let mut reencoded = 0.0;
            let mut copied = 0.0;

            // 1. Head (in_sec to first_kf)
            if in_is_keyframe {
                // Head is already aligned to in_sec, so body starts at in_sec
            } else {
                let head_dur = first_kf - in_sec;
                if head_dur >= frame_dur {
                    subs.push(GopSubSegment {
                        seg_type: "head_reencode".to_string(),
                        start_sec: in_sec,
                        end_sec: first_kf,
                        duration_sec: head_dur,
                        requires_reencode: true,
                    });
                    reencoded += head_dur;
                }
            }

            // 2. Body (stream copy between keyframes)
            let body_start = if in_is_keyframe { in_sec } else { first_kf };
            let body_end = last_kf;

            if body_end > body_start && (body_end - body_start) >= frame_dur {
                let body_dur = body_end - body_start;
                subs.push(GopSubSegment {
                    seg_type: "body_copy".to_string(),
                    start_sec: body_start,
                    end_sec: body_end,
                    duration_sec: body_dur,
                    requires_reencode: false,
                });
                copied += body_dur;
            }

            // 3. Tail (last_kf to out_sec)
            let tail_dur = out_sec - last_kf;
            if tail_dur >= frame_dur {
                subs.push(GopSubSegment {
                    seg_type: "tail_reencode".to_string(),
                    start_sec: last_kf,
                    end_sec: out_sec,
                    duration_sec: tail_dur,
                    requires_reencode: true,
                });
                reencoded += tail_dur;
            }

            let copy_ratio = if total_duration > 0.0 {
                (copied / total_duration) as f32
            } else {
                0.0
            };

            return SmartGopPlan {
                requested_in: in_sec,
                requested_out: out_sec,
                total_duration,
                strategy: SegmentExecutionStrategy::SmartGopHybrid,
                time_reencoded_sec: reencoded,
                time_stream_copied_sec: copied,
                stream_copy_ratio: copy_ratio,
                sub_segments: subs,
            };
        }

        // Sub-GOP or no internal keyframes: full re-encode
        SmartGopPlan {
            requested_in: in_sec,
            requested_out: out_sec,
            total_duration,
            strategy: SegmentExecutionStrategy::FullReencode,
            time_reencoded_sec: total_duration,
            time_stream_copied_sec: 0.0,
            stream_copy_ratio: 0.0,
            sub_segments: vec![GopSubSegment {
                seg_type: "full_reencode".to_string(),
                start_sec: in_sec,
                end_sec: out_sec,
                duration_sec: total_duration,
                requires_reencode: true,
            }],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pure_stream_copy() {
        // Keyframes at 0, 2, 4, 6, 8, 10
        let idx = VideoKeyframeIndex::new(20.0, 30.0, 2.0);
        let plan = idx.plan_smart_cut(2.0, 8.0);
        assert_eq!(plan.strategy, SegmentExecutionStrategy::PureStreamCopy);
        assert_eq!(plan.time_reencoded_sec, 0.0);
        assert_eq!(plan.time_stream_copied_sec, 6.0);
        assert_eq!(plan.stream_copy_ratio, 1.0);
    }

    #[test]
    fn test_smart_gop_hybrid() {
        // Cut from 1.5s to 9.5s
        // Keyframes at 0, 2, 4, 6, 8, 10
        let idx = VideoKeyframeIndex::new(20.0, 30.0, 2.0);
        let plan = idx.plan_smart_cut(1.5, 9.5);
        assert_eq!(plan.strategy, SegmentExecutionStrategy::SmartGopHybrid);
        // Body: 2.0 to 8.0 = 6.0s copied
        assert_eq!(plan.time_stream_copied_sec, 6.0);
        // Head (1.5 -> 2.0 = 0.5s) + Tail (8.0 -> 9.5 = 1.5s) = 2.0s reencoded
        assert!((plan.time_reencoded_sec - 2.0).abs() < 0.01);
        assert_eq!(plan.sub_segments.len(), 3);
    }

    #[test]
    fn test_full_reencode_sub_gop() {
        // Cut between keyframes: 2.2s to 3.5s (no keyframes inside)
        let idx = VideoKeyframeIndex::new(20.0, 30.0, 2.0);
        let plan = idx.plan_smart_cut(2.2, 3.5);
        assert_eq!(plan.strategy, SegmentExecutionStrategy::FullReencode);
        assert_eq!(plan.time_stream_copied_sec, 0.0);
        assert!((plan.time_reencoded_sec - 1.3).abs() < 0.01);
    }
}

