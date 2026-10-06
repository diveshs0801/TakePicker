use std::env;
use std::fs::File;
use std::io::{self, Read};
use std::time::Instant;

use take_engine::audio::{extract_waveform, pcm_s16le_to_mono_f32, scan_silences, VadConfig};
use take_engine::video::VideoKeyframeIndex;

fn print_usage() {
    eprintln!(
        r#"
TakeEngine Native Performance Core v0.1.0 (Rust)
Ultra-fast SIMD audio peak extractor, VAD silence scanner & Smart GOP splicer.

USAGE:
  take-engine benchmark
  take-engine waveform <pcm_file> <sample_rate> <channels> <buckets>
  take-engine vad <pcm_file> <sample_rate> <threshold_db> <min_silence_sec>
  take-engine smart-gop <duration_sec> <fps> <gop_interval_sec> <in_sec> <out_sec>
"#
    );
}

fn run_benchmark() {
    println!("======================================================");
    println!("     TakeEngine Native Rust Performance Benchmark     ");
    println!("======================================================\n");

    // 1. Benchmark: 1 Hour of 48kHz Audio (172.8 Million Samples)
    let sample_rate = 48_000u32;
    let duration_sec = 3600.0f64; // 1 hour
    let total_samples = (sample_rate as f64 * duration_sec) as usize;

    println!("1. Simulating 1 Hour of 48kHz Stereo Audio ({} samples)...", total_samples);
    
    // Generate simulated audio with speech bursts and silences
    let mut samples = Vec::with_capacity(total_samples);
    for i in 0..total_samples {
        let t = i as f32 / sample_rate as f32;
        // Speech activity alternating every 10 seconds with 2 seconds silence
        let is_speech = (t % 12.0) < 10.0;
        if is_speech {
            let s = (t * 440.0 * 2.0 * std::f32::consts::PI).sin() * 0.4
                + (t * 880.0 * 2.0 * std::f32::consts::PI).sin() * 0.2;
            samples.push(s);
        } else {
            samples.push(0.0001); // dead air background noise
        }
    }

    println!("   Memory footprint: {:.1} MB", (samples.len() * 4) as f64 / 1_048_576.0);

    // Waveform Benchmark
    print!("   Running SIMD Waveform Extraction (2,000 UI buckets)... ");
    let t0 = Instant::now();
    let waveform_res = extract_waveform(&samples, sample_rate, 1, 2000);
    let waveform_elapsed = t0.elapsed();
    println!("DONE in {:.2}ms!", waveform_elapsed.as_secs_f64() * 1000.0);
    println!(
        "   ✓ Throughput: {:.1} Million samples/sec ({:.0}x Real-Time)",
        (total_samples as f64 / 1_000_000.0) / waveform_elapsed.as_secs_f64(),
        duration_sec / waveform_elapsed.as_secs_f64()
    );
    println!("   ✓ Buckets generated: {}", waveform_res.bucket_count);

    // VAD Silence Detection Benchmark
    println!("\n2. Running Native VAD Silence Detection...");
    let vad_cfg = VadConfig {
        frame_duration_ms: 25.0,
        silence_threshold_db: -40.0,
        min_silence_duration_sec: 0.60,
        speech_pad_sec: 0.10,
    };
    let t1 = Instant::now();
    let vad_res = scan_silences(&samples, sample_rate, &vad_cfg);
    let vad_elapsed = t1.elapsed();
    println!("   DONE in {:.2}ms!", vad_elapsed.as_secs_f64() * 1000.0);
    println!(
        "   ✓ Found {} silences totaling {:.1}s dead air",
        vad_res.silences_count, vad_res.total_silence_duration
    );
    println!(
        "   ✓ VAD Throughput: {:.0}x Real-Time Speed",
        duration_sec / vad_elapsed.as_secs_f64()
    );

    // Smart GOP Splicer Benchmark
    println!("\n3. Testing Smart GOP Stream Splicer Decision Matrix...");
    let index = VideoKeyframeIndex::new(1800.0, 30.0, 2.0); // 30 min video, 30fps, 2s keyframe interval
    
    // Test slice: in=10.5s, out=45.2s (total 34.7s)
    let plan = index.plan_smart_cut(10.5, 45.2);
    println!("   Requested Edit Cut: 10.50s -> 45.20s (Duration: {:.2}s)", plan.total_duration);
    println!("   Execution Strategy: {:?}", plan.strategy);
    println!("   Stream Copy Ratio : {:.1}% (Zero Re-encode Passthrough)", plan.stream_copy_ratio * 100.0);
    println!("   Time Copied       : {:.2}s", plan.time_stream_copied_sec);
    println!("   Time Re-encoded   : {:.2}s (Only edge GOPs)", plan.time_reencoded_sec);
    println!("   Sub-segment Plan  :");
    for (idx, seg) in plan.sub_segments.iter().enumerate() {
        println!(
            "     [{}] {:<14} {:.2}s -> {:.2}s (dur={:.2}s, reencode={})",
            idx + 1,
            seg.seg_type,
            seg.start_sec,
            seg.end_sec,
            seg.duration_sec,
            seg.requires_reencode
        );
    }

    println!("\n======================================================");
    println!("   TAKEENGINE NATIVE RUST ENGINE ALL SYSTEMS GO! ⚡🦀  ");
    println!("======================================================");
}

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        return Ok(());
    }

    match args[1].as_str() {
        "benchmark" => {
            run_benchmark();
        }
        "waveform" => {
            if args.len() < 6 {
                eprintln!("Usage: take-engine waveform <pcm_file> <sample_rate> <channels> <buckets>");
                return Ok(());
            }
            let file_path = &args[2];
            let sample_rate: u32 = args[3].parse().unwrap_or(48000);
            let channels: u16 = args[4].parse().unwrap_or(1);
            let buckets: usize = args[5].parse().unwrap_or(1000);

            let mut f = File::open(file_path)?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer)?;

            let samples = pcm_s16le_to_mono_f32(&buffer, channels);
            let res = extract_waveform(&samples, sample_rate, channels, buckets);
            println!("{}", serde_json::to_string(&res).unwrap());
        }
        "vad" => {
            if args.len() < 6 {
                eprintln!("Usage: take-engine vad <pcm_file> <sample_rate> <threshold_db> <min_silence_sec>");
                return Ok(());
            }
            let file_path = &args[2];
            let sample_rate: u32 = args[3].parse().unwrap_or(48000);
            let threshold_db: f32 = args[4].parse().unwrap_or(-40.0);
            let min_silence_sec: f64 = args[5].parse().unwrap_or(0.60);

            let mut f = File::open(file_path)?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer)?;

            let samples = pcm_s16le_to_mono_f32(&buffer, 1);
            let cfg = VadConfig {
                silence_threshold_db: threshold_db,
                min_silence_duration_sec: min_silence_sec,
                ..Default::default()
            };
            let res = scan_silences(&samples, sample_rate, &cfg);
            println!("{}", serde_json::to_string(&res).unwrap());
        }
        "smart-gop" => {
            if args.len() < 7 {
                eprintln!("Usage: take-engine smart-gop <duration_sec> <fps> <gop_interval_sec> <in_sec> <out_sec>");
                return Ok(());
            }
            let duration_sec: f64 = args[2].parse().unwrap_or(60.0);
            let fps: f64 = args[3].parse().unwrap_or(30.0);
            let gop_interval: f64 = args[4].parse().unwrap_or(2.0);
            let in_sec: f64 = args[5].parse().unwrap_or(0.0);
            let out_sec: f64 = args[6].parse().unwrap_or(10.0);

            let idx = VideoKeyframeIndex::new(duration_sec, fps, gop_interval);
            let plan = idx.plan_smart_cut(in_sec, out_sec);
            println!("{}", serde_json::to_string_pretty(&plan).unwrap());
        }
        _ => {
            print_usage();
        }
    }

    Ok(())
}
