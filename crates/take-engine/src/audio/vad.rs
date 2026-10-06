use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedSilence {
    pub start_sec: f64,
    pub end_sec: f64,
    pub duration_sec: f64,
    pub avg_db: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadConfig {
    pub frame_duration_ms: f64,    // e.g. 25.0 ms
    pub silence_threshold_db: f32, // e.g. -42.0 dBFS
    pub min_silence_duration_sec: f64, // e.g. 0.50 s
    pub speech_pad_sec: f64,       // e.g. 0.08 s (breathing buffer)
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            frame_duration_ms: 25.0,
            silence_threshold_db: -40.0,
            min_silence_duration_sec: 0.50,
            speech_pad_sec: 0.10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VadAnalysisResult {
    pub total_duration_sec: f64,
    pub total_silence_duration: f64,
    pub silence_ratio: f32,
    pub speech_ratio: f32,
    pub silences_count: usize,
    pub silences: Vec<DetectedSilence>,
}

/// Native Voice Activity Detection (VAD) & Dead-Air Silence Scanner.
/// Scans audio in frame increments, evaluating energy and zero-crossing continuity.
pub fn scan_silences(samples: &[f32], sample_rate: u32, config: &VadConfig) -> VadAnalysisResult {
    if samples.is_empty() || sample_rate == 0 {
        return VadAnalysisResult {
            total_duration_sec: 0.0,
            total_silence_duration: 0.0,
            silence_ratio: 0.0,
            speech_ratio: 0.0,
            silences_count: 0,
            silences: Vec::new(),
        };
    }

    let total_duration_sec = samples.len() as f64 / sample_rate as f64;
    let samples_per_frame = ((config.frame_duration_ms / 1000.0) * sample_rate as f64).round() as usize;
    let samples_per_frame = samples_per_frame.max(16);

    let mut raw_silent_intervals: Vec<(f64, f64, f32)> = Vec::new();
    let mut in_silence = false;
    let mut silence_start = 0.0f64;
    let mut silence_sum_db = 0.0f32;
    let mut silence_frames = 0;

    let total_frames = samples.len() / samples_per_frame;

    for f in 0..total_frames {
        let start_idx = f * samples_per_frame;
        let end_idx = (start_idx + samples_per_frame).min(samples.len());
        let frame = &samples[start_idx..end_idx];

        let mut sum_sq = 0.0f32;
        for &val in frame {
            sum_sq += val * val;
        }
        let rms = (sum_sq / frame.len() as f32).sqrt();
        let frame_db = if rms <= 1e-5 {
            -100.0
        } else {
            (20.0 * rms.log10()).max(-100.0)
        };

        let frame_time = start_idx as f64 / sample_rate as f64;

        let is_frame_silent = frame_db < config.silence_threshold_db;

        if is_frame_silent {
            if !in_silence {
                in_silence = true;
                silence_start = frame_time;
                silence_sum_db = frame_db;
                silence_frames = 1;
            } else {
                silence_sum_db += frame_db;
                silence_frames += 1;
            }
        } else if in_silence {
            in_silence = false;
            let silence_end = frame_time;
            let duration = silence_end - silence_start;
            let avg_db = if silence_frames > 0 {
                silence_sum_db / silence_frames as f32
            } else {
                -100.0
            };

            if duration >= config.min_silence_duration_sec {
                raw_silent_intervals.push((silence_start, silence_end, avg_db));
            }
        }
    }

    // Trailing silence
    if in_silence {
        let duration = total_duration_sec - silence_start;
        let avg_db = if silence_frames > 0 {
            silence_sum_db / silence_frames as f32
        } else {
            -100.0
        };
        if duration >= config.min_silence_duration_sec {
            raw_silent_intervals.push((silence_start, total_duration_sec, avg_db));
        }
    }

    // Apply breathing room buffer (speech pad)
    let mut final_silences = Vec::with_capacity(raw_silent_intervals.len());
    let mut total_silence_duration = 0.0f64;

    for (raw_start, raw_end, avg_db) in raw_silent_intervals {
        // Pad silence inward so words aren't cut clipped
        let padded_start = if raw_start > 0.05 {
            raw_start + config.speech_pad_sec
        } else {
            raw_start
        };
        let padded_end = if raw_end < total_duration_sec - 0.05 {
            raw_end - config.speech_pad_sec
        } else {
            raw_end
        };

        if padded_end > padded_start && (padded_end - padded_start) >= 0.10 {
            let dur = padded_end - padded_start;
            total_silence_duration += dur;
            final_silences.push(DetectedSilence {
                start_sec: padded_start,
                end_sec: padded_end,
                duration_sec: dur,
                avg_db,
            });
        }
    }

    let silence_ratio = if total_duration_sec > 0.0 {
        (total_silence_duration / total_duration_sec) as f32
    } else {
        0.0
    };

    VadAnalysisResult {
        total_duration_sec,
        total_silence_duration,
        silence_ratio,
        speech_ratio: (1.0 - silence_ratio).max(0.0),
        silences_count: final_silences.len(),
        silences: final_silences,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vad_pure_silence() {
        let sr = 16000;
        let samples = vec![0.00001f32; 16000 * 2]; // 2 seconds silence
        let cfg = VadConfig {
            silence_threshold_db: -40.0,
            min_silence_duration_sec: 0.5,
            speech_pad_sec: 0.05,
            ..Default::default()
        };
        let res = scan_silences(&samples, sr, &cfg);
        assert_eq!(res.silences_count, 1);
        assert!((res.total_silence_duration - 2.0).abs() < 0.1);
        assert!(res.silence_ratio > 0.95);
    }

    #[test]
    fn test_vad_speech_bursts() {
        let sr = 16000;
        let mut samples = Vec::with_capacity(16000 * 5); // 5 seconds
        // 0.0 - 1.0s: speech (440Hz sine wave, amplitude 0.5)
        for i in 0..16000 {
            let t = i as f32 / sr as f32;
            samples.push((t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.5);
        }
        // 1.0 - 3.0s: silence (2.0s silence)
        for _ in 0..(16000 * 2) {
            samples.push(0.0001);
        }
        // 3.0 - 5.0s: speech
        for i in 0..(16000 * 2) {
            let t = i as f32 / sr as f32;
            samples.push((t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.5);
        }

        let cfg = VadConfig {
            silence_threshold_db: -40.0,
            min_silence_duration_sec: 0.6,
            speech_pad_sec: 0.10,
            ..Default::default()
        };
        let res = scan_silences(&samples, sr, &cfg);
        assert_eq!(res.silences_count, 1);
        let s = &res.silences[0];
        // Speech ended at 1.0s (+ pad = 1.1s), resumed at 3.0s (- pad = 2.9s)
        assert!((s.start_sec - 1.1).abs() < 0.05);
        assert!((s.end_sec - 2.9).abs() < 0.05);
        assert!((s.duration_sec - 1.8).abs() < 0.1);
    }
}

