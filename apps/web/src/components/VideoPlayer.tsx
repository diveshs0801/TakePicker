'use client';

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  SkipBack,
  SkipForward,
  Repeat,
  Grid,
  Radio,
  SlidersHorizontal,
  Compass
} from 'lucide-react';

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  src: string | null;
  onTimeUpdate?: (currentTime: number) => void;
  fps?: number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, onTimeUpdate, fps = 30 }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [showSafeGuides, setShowSafeGuides] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          const snapped = Math.round(time * fps) / fps;
          videoRef.current.currentTime = snapped;
          setCurrentTime(snapped);
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    };

    const stepFrame = (frames: number) => {
      if (!videoRef.current) return;
      const frameDuration = 1 / fps;
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames * frameDuration));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime);
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);
        onTimeUpdate?.(t);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
        videoRef.current.playbackRate = playbackRate;
      }
    };

    const changePlaybackRate = (rate: number) => {
      setPlaybackRate(rate);
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    };

    // Format SMPTE Timecode (HH:MM:SS:FF)
    const formatSMPTE = (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const frames = Math.floor((seconds % 1) * fps);
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    };

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
          return;
        }
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          stepFrame(-1);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          stepFrame(1);
        } else if (e.key === 'j' || e.key === 'J') {
          stepFrame(-5);
        } else if (e.key === 'l' || e.key === 'L') {
          stepFrame(5);
        } else if (e.key === 'k' || e.key === 'K') {
          togglePlay();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, duration, fps]);

    return (
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        backgroundColor: '#05070a',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Main Video Viewport */}
        <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
          {src ? (
            <video
              ref={videoRef}
              src={src}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
              loop={isLooping}
              style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
              playsInline
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '12px',
              background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.05) 0%, transparent 60%)',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)',
              }}>
                <Play size={28} color="#818cf8" style={{ marginLeft: '4px' }} />
              </div>
              <p style={{ fontSize: '0.92rem', fontWeight: 500, color: '#cbd5e1' }}>
                Load or select footage to begin playback
              </p>
            </div>
          )}

          {/* Title & Action Safe Grid Overlay */}
          {showSafeGuides && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 8,
            }}>
              {/* 90% Action Safe */}
              <div style={{
                position: 'absolute',
                top: '5%',
                bottom: '5%',
                left: '5%',
                right: '5%',
                border: '1px dashed rgba(6, 182, 212, 0.35)',
              }} />
              {/* 80% Title Safe */}
              <div style={{
                position: 'absolute',
                top: '10%',
                bottom: '10%',
                left: '10%',
                right: '10%',
                border: '1px dashed rgba(99, 102, 241, 0.45)',
              }} />
              {/* Center Crosshair */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '16px',
                height: '16px',
                transform: 'translate(-50%, -50%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.4)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.4)',
              }} />
            </div>
          )}

          {/* Top HUD Bar */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            right: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            {/* SMPTE Timecode HUD */}
            <div style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(9, 11, 16, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isPlaying ? '#10b981' : '#f59e0b',
                boxShadow: isPlaying ? '0 0 8px #10b981' : 'none',
              }} />
              <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.04em' }}>
                {formatSMPTE(currentTime)}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>/</span>
              <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatSMPTE(duration)}
              </span>
            </div>

            {/* Monitor Settings & Format Badges */}
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowSafeGuides(!showSafeGuides)}
                title="Toggle Action/Title Safe Area Guides"
                style={{
                  background: showSafeGuides ? 'rgba(99, 102, 241, 0.25)' : 'rgba(9, 11, 16, 0.75)',
                  backdropFilter: 'blur(8px)',
                  border: showSafeGuides ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: showSafeGuides ? '#a5b4fc' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Grid size={12} />
                <span>Guides</span>
              </button>

              <div style={{
                background: 'rgba(9, 11, 16, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                display: 'flex',
                gap: '6px',
              }}>
                <span style={{ color: '#818cf8' }}>1080p</span>
                <span>•</span>
                <span>H.264</span>
                <span>•</span>
                <span>{fps} FPS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Broadcast Control Deck */}
        <div style={{
          height: '46px',
          backgroundColor: '#0a0d14',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 10,
        }}>
          {/* Left Transport */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Step Back 1 Frame */}
            <button
              type="button"
              onClick={() => stepFrame(-1)}
              title="Previous Frame (Left Arrow)"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <SkipBack size={15} />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              type="button"
              onClick={togglePlay}
              title="Play/Pause (Space)"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-gradient)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlaying ? 'none' : '0 2px 10px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '1px' }} />}
            </button>

            {/* Step Forward 1 Frame */}
            <button
              type="button"
              onClick={() => stepFrame(1)}
              title="Next Frame (Right Arrow)"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <SkipForward size={15} />
            </button>

            {/* Restart */}
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                  onTimeUpdate?.(0);
                }
              }}
              title="Restart from beginning"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}
            >
              <RotateCcw size={14} />
            </button>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Looping Enabled' : 'Loop Disabled'}
              style={{
                background: 'none',
                border: 'none',
                color: isLooping ? '#818cf8' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Repeat size={14} />
            </button>
          </div>

          {/* Center: Live Stereo VU Audio Meters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700, fontFamily: 'monospace' }}>L</span>
            <div style={{
              width: '46px',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
              display: 'flex',
            }}>
              <div style={{
                height: '100%',
                width: isPlaying ? '68%' : '6%',
                background: 'linear-gradient(to right, #10b981 60%, #f59e0b 85%, #ef4444 100%)',
                transition: 'width 0.1s ease',
              }} />
            </div>

            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700, fontFamily: 'monospace' }}>R</span>
            <div style={{
              width: '46px',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
              display: 'flex',
            }}>
              <div style={{
                height: '100%',
                width: isPlaying ? '62%' : '6%',
                background: 'linear-gradient(to right, #10b981 60%, #f59e0b 85%, #ef4444 100%)',
                transition: 'width 0.1s ease',
              }} />
            </div>
          </div>

          {/* Right Controls: Speed, Volume, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Speed Selector */}
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255, 255, 255, 0.04)', padding: '2px', borderRadius: '4px' }}>
              {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => changePlaybackRate(rate)}
                  style={{
                    background: playbackRate === rate ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    border: 'none',
                    color: playbackRate === rate ? '#a5b4fc' : 'var(--text-dim)',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 5px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Mute toggle */}
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    videoRef.current.requestFullscreen();
                  }
                }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
