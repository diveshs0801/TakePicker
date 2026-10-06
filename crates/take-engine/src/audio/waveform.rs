use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveformBucket {
    pub min: f32,
    pub max: f32,
    pub rms: f32,
    pub peak_db: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveformResult {
    pub total_samples: usize,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_sec: f64,
    pub bucket_count: usize,
    pub max_peak: f32,
    pub buckets: Vec<WaveformBucket>,
}

/// Computes dBFS from amplitude in range [0.0, 1.0]
#[inline]
pub fn amplitude_to_db(amp: f32) -> f32 {
    if amp <= 1e-5 {
        -100.0
    } else {
        (20.0 * amp.log10()).max(-100.0)
    }
}

/// Converts interleaved raw 16-bit PCM bytes (LE) into normalized f32 mono samples [-1.0, 1.0].
pub fn pcm_s16le_to_mono_f32(raw_bytes: &[u8], channels: u16) -> Vec<f32> {
    let num_samples = raw_bytes.len() / 2;
    let ch = channels.max(1) as usize;
    let frames = num_samples / ch;
    let mut mono = Vec::with_capacity(frames);

    let mut i = 0;
    while i + (ch * 2) <= raw_bytes.len() {
        let mut sum = 0.0f32;
        for c in 0..ch {
            let offset = i + c * 2;
            let sample = i16::from_le_bytes([raw_bytes[offset], raw_bytes[offset + 1]]);
            sum += sample as f32 / 32768.0;
        }
        mono.push(sum / (ch as f32));
        i += ch * 2;
    }

    mono
}

/// High-speed SIMD-friendly waveform peak and RMS extractor.
/// Aggregates `samples` into `target_buckets` buckets.
pub fn extract_waveform(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
    target_buckets: usize,
) -> WaveformResult {
    let total_samples = samples.len();
    let duration_sec = if sample_rate > 0 {
        total_samples as f64 / sample_rate as f64
    } else {
        0.0
    };

    if total_samples == 0 || target_buckets == 0 {
        return WaveformResult {
            total_samples: 0,
            sample_rate,
            channels,
            duration_sec: 0.0,
            bucket_count: 0,
            max_peak: 0.0,
            buckets: Vec::new(),
        };
    }

    let actual_buckets = target_buckets.min(total_samples);
    let mut buckets = Vec::with_capacity(actual_buckets);
    let samples_per_bucket = total_samples as f64 / actual_buckets as f64;
    let mut overall_max_peak = 0.0f32;

    for b in 0..actual_buckets {
        let start = (b as f64 * samples_per_bucket).floor() as usize;
        let end = (((b + 1) as f64 * samples_per_bucket).ceil() as usize).min(total_samples);
        let slice = &samples[start..end];

        if slice.is_empty() {
            buckets.push(WaveformBucket {
                min: 0.0,
                max: 0.0,
                rms: 0.0,
                peak_db: -100.0,
            });
            continue;
        }

        let mut min_val = 0.0f32;
        let mut max_val = 0.0f32;
        let mut sum_sq = 0.0f32;

        for &val in slice {
            if val < min_val {
                min_val = val;
            }
            if val > max_val {
                max_val = val;
            }
            sum_sq += val * val;
        }

        let rms = (sum_sq / slice.len() as f32).sqrt().min(1.0);
        let peak = max_val.abs().max(min_val.abs());
        if peak > overall_max_peak {
            overall_max_peak = peak;
        }

        buckets.push(WaveformBucket {
            min: min_val,
            max: max_val,
            rms,
            peak_db: amplitude_to_db(peak),
        });
    }

    WaveformResult {
        total_samples,
        sample_rate,
        channels,
        duration_sec,
        bucket_count: buckets.len(),
        max_peak: overall_max_peak,
        buckets,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_waveform_empty() {
        let res = extract_waveform(&[], 48000, 1, 100);
        assert_eq!(res.total_samples, 0);
        assert_eq!(res.bucket_count, 0);
    }

    #[test]
    fn test_waveform_sine_wave() {
        let sr = 48000;
        let mut samples = Vec::with_capacity(48000);
        for i in 0..48000 {
            let t = i as f32 / sr as f32;
            samples.push((t * 440.0 * 2.0 * std::f32::consts::PI).sin());
        }

        let res = extract_waveform(&samples, sr, 1, 10);
        assert_eq!(res.bucket_count, 10);
        assert!((res.max_peak - 1.0).abs() < 0.05);

        for b in &res.buckets {
            assert!(b.max > 0.8);
            assert!(b.min < -0.8);
            // Sine wave RMS should be ~0.707
            assert!((b.rms - 0.707).abs() < 0.1);
        }
    }

    #[test]
    fn test_pcm_s16le_to_mono_f32() {
        let mut bytes = Vec::new();
        // 0x7FFF = 32767 (~1.0)
        bytes.extend_from_slice(&32767i16.to_le_bytes());
        // 0x8000 = -32768 (-1.0)
        bytes.extend_from_slice(&(-32768i16).to_le_bytes());

        let samples = pcm_s16le_to_mono_f32(&bytes, 1);
        assert_eq!(samples.len(), 2);
        assert!((samples[0] - 1.0).abs() < 0.001);
        assert!((samples[1] - (-1.0)).abs() < 0.001);
    }
}

