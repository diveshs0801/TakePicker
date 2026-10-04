'use client';

import React, { useState, useRef } from 'react';
import type { Timeline, TimelineClip } from '../../../../packages/contracts';
import {
  Scissors,
  MousePointer,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize,
  Volume2,
  Lock,
  Eye,
  Sparkles,
  ShieldAlert,
  Flame
} from 'lucide-react';

interface TimelineTrackProps {
  timeline: Timeline | null;
  totalDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  activeClipId?: string;
  assetId?: string;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  timeline,
  totalDuration,
  currentTime,
  onSeek,
  activeClipId,
  assetId,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'select' | 'cut'>('select');
  const [lintFindings, setLintFindings] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleScanDefects = async () => {
    if (!assetId) return;
    setIsScanning(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/lint`);
      if (res.ok) {
        const data = await res.json();
        setLintFindings(data.findings || []);
        setHasScanned(true);
      }
    } catch (e) {
      console.error('Linter scan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (!timeline || totalDuration <= 0) {
    return (
      <div className="glass" style={{
        padding: '28px',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        color: 'var(--text-dim)',
      }}>
        No active timeline loaded
      </div>
    );
  }

  const clips = timeline.clips || [];
  const cleanDuration = clips.reduce((acc, c) => acc + (c.out - c.in), 0);
  const prunedPct = totalDuration > 0 ? Math.round(((totalDuration - cleanDuration) / totalDuration) * 100) : 0;
  const playheadPct = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  // Timecode ticks generator
  const tickInterval = totalDuration > 30 ? 5 : totalDuration > 10 ? 2 : 1;
  const tickCount = Math.floor(totalDuration / tickInterval);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickInterval);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, clickX / rect.width));
    let seekTime = pct * totalDuration;

    // Snap to nearest clip in/out if snap is enabled (within 0.3s)
    if (snapEnabled) {
      for (const clip of clips) {
        if (Math.abs(seekTime - clip.in) < 0.3) {
          seekTime = clip.in;
          break;
        }
        if (Math.abs(seekTime - clip.out) < 0.3) {
          seekTime = clip.out;
          break;
        }
      }
    }

    onSeek(seekTime);
  };

  return (
    <div className="glass" style={{
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    }}>
      {/* 1. Timeline Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        backgroundColor: '#0c0f17',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.82rem',
      }}>
        {/* Left: Editing Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            title="Selection Tool (V)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 9px',
              borderRadius: 'var(--radius-sm)',
              background: activeTool === 'select' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              border: activeTool === 'select' ? '1px solid #818cf8' : '1px solid transparent',
              color: activeTool === 'select' ? '#a5b4fc' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <MousePointer size={13} />
            <span>Select</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('cut')}
            title="Razor Blade Tool (C)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 9px',
              borderRadius: 'var(--radius-sm)',
              background: activeTool === 'cut' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              border: activeTool === 'cut' ? '1px solid #818cf8' : '1px solid transparent',
              color: activeTool === 'cut' ? '#a5b4fc' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <Scissors size={13} />
            <span>Razor</span>
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

          <button
            type="button"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Snap to Edits (N)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              background: snapEnabled ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: snapEnabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
              color: snapEnabled ? '#6ee7b7' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            <Magnet size={13} />
            <span>Snap {snapEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

          {/* Linter Defect Scan Button */}
          <button
            type="button"
            onClick={handleScanDefects}
            disabled={isScanning || !assetId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              background: hasScanned
                ? lintFindings.length > 0
                  ? 'rgba(239, 68, 68, 0.18)'
                  : 'rgba(16, 185, 129, 0.18)'
                : 'rgba(245, 158, 11, 0.15)',
              border: hasScanned
                ? lintFindings.length > 0
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : '1px solid rgba(16, 185, 129, 0.4)'
                : '1px solid rgba(245, 158, 11, 0.4)',
              color: hasScanned
                ? lintFindings.length > 0
                  ? '#fca5a5'
                  : '#86efac'
                : '#fcd34d',
              cursor: isScanning || !assetId ? 'wait' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <ShieldAlert size={13} />
            <span>
              {isScanning
                ? 'Auditing (D1-D7)...'
                : hasScanned
                ? `${lintFindings.length} Defects Found`
                : 'Scan Quality (D1-D7)'}
            </span>
          </button>
        </div>

        {/* Center: Efficiency Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Source:</span>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{totalDuration.toFixed(1)}s</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Clean Cut:</span>
            <span className="font-mono" style={{ fontWeight: 700, color: '#86efac' }}>{cleanDuration.toFixed(1)}s</span>
          </div>

          {prunedPct > 0 && (
            <span className="badge badge-green">
              <Sparkles size={11} />
              <span>{prunedPct}% fluff pruned</span>
            </span>
          )}
        </div>

        {/* Right: Zoom & Layout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
            disabled={zoomLevel <= 1}
            style={{ background: 'none', border: 'none', color: zoomLevel <= 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: zoomLevel <= 1 ? 'default' : 'pointer' }}
          >
            <ZoomOut size={14} />
          </button>

          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {zoomLevel.toFixed(1)}x
          </span>

          <button
            type="button"
            onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.5))}
            disabled={zoomLevel >= 3}
            style={{ background: 'none', border: 'none', color: zoomLevel >= 3 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: zoomLevel >= 3 ? 'default' : 'pointer' }}
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* 2. Main Multi-Track Work Area */}
      <div style={{ display: 'flex', backgroundColor: '#07090e' }}>
        {/* Track Headers Column (Left) */}
        <div style={{
          width: '110px',
          borderRight: '1px solid var(--border-color)',
          backgroundColor: '#0c0f17',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 5,
        }}>
          {/* Ruler header space */}
          <div style={{ height: '26px', borderBottom: '1px solid var(--border-color)', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 700 }}>TIMECODE</span>
          </div>

          {/* V1 Video Cut Header */}
          <div style={{
            height: '48px',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8' }}>V1 Video</span>
            <div style={{ display: 'flex', gap: '4px', color: 'var(--text-dim)' }}>
              <Eye size={12} />
              <Lock size={12} />
            </div>
          </div>

          {/* A1 Audio Waveform Header */}
          <div style={{
            height: '42px',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#06b6d4' }}>A1 Audio</span>
            <div style={{ display: 'flex', gap: '4px', color: 'var(--text-dim)' }}>
              <Volume2 size={12} />
            </div>
          </div>

          {/* S1 Speech Takes Header */}
          <div style={{
            height: '44px',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>S1 Speech</span>
            <Sparkles size={12} color="#10b981" />
          </div>

          {/* Q1 Defects Header */}
          <div style={{
            height: '38px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>Q1 Defects</span>
            <span className="badge" style={{ fontSize: '0.62rem', padding: '1px 5px', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' }}>
              {hasScanned ? lintFindings.length : 0}
            </span>
          </div>
        </div>

        {/* Tracks Canvas (Right) */}
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            flex: 1,
            position: 'relative',
            overflowX: 'auto',
            cursor: activeTool === 'cut' ? 'crosshair' : 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Internal Scaled Canvas */}
          <div style={{
            position: 'relative',
            width: `${100 * zoomLevel}%`,
            minWidth: '100%',
          }}>
            {/* 2A. Timecode Ruler */}
            <div style={{
              height: '26px',
              backgroundColor: '#0a0d15',
              borderBottom: '1px solid var(--border-color)',
              position: 'relative',
            }}>
              {ticks.map((t) => {
                const pct = (t / totalDuration) * 100;
                return (
                  <div
                    key={t}
                    style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      top: 0,
                      bottom: 0,
                      borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2B. Track V1: Video Cuts */}
            <div style={{
              height: '48px',
              backgroundColor: '#0d111b',
              borderBottom: '1px solid var(--border-color)',
              position: 'relative',
            }}>
              {clips.map((clip, idx) => {
                const leftPct = (clip.in / totalDuration) * 100;
                const widthPct = ((clip.out - clip.in) / totalDuration) * 100;
                const isCurrent = currentTime >= clip.in && currentTime <= clip.out;

                return (
                  <div
                    key={clip.id || idx}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${Math.max(0.5, widthPct)}%`,
                      top: '4px',
                      bottom: '4px',
                      backgroundColor: isCurrent ? '#4f46e5' : '#312e81',
                      border: isCurrent ? '1px solid #a5b4fc' : '1px solid rgba(99, 102, 241, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      overflow: 'hidden',
                      boxShadow: isCurrent ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      {clip.reason || `Clip ${idx + 1}`}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.65rem', color: '#c7d2fe' }}>
                      {(clip.out - clip.in).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2C. Track A1: Audio Waveform (High-Res Simulation) */}
            <div style={{
              height: '42px',
              backgroundColor: '#0a0d16',
              borderBottom: '1px solid var(--border-color)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
            }}>
              {/* Audio waveform bars across duration */}
              <div style={{
                width: '100%',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                opacity: 0.8,
              }}>
                {Array.from({ length: 90 }).map((_, barIdx) => {
                  const barTime = (barIdx / 90) * totalDuration;
                  const isSpeech = clips.some((c) => barTime >= c.in && barTime <= c.out);
                  const randomAmp = isSpeech ? 40 + ((barIdx * 17) % 55) : 10 + ((barIdx * 7) % 15);

                  return (
                    <div
                      key={barIdx}
                      style={{
                        flex: 1,
                        height: `${randomAmp}%`,
                        backgroundColor: isSpeech ? '#06b6d4' : 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '1px',
                        transition: 'height 0.2s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 2D. Track S1: Speech Takes (Word-Level Clusters) */}
            <div style={{
              height: '44px',
              backgroundColor: '#0d121c',
              position: 'relative',
            }}>
              {clips.map((clip, idx) => {
                const leftPct = (clip.in / totalDuration) * 100;
                const widthPct = ((clip.out - clip.in) / totalDuration) * 100;
                const isCurrent = currentTime >= clip.in && currentTime <= clip.out;

                return (
                  <div
                    key={clip.id || idx}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${Math.max(0.5, widthPct)}%`,
                      top: '4px',
                      bottom: '4px',
                      backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                      border: isCurrent ? '1px solid #34d399' : '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.68rem', color: '#6ee7b7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      "{clip.text || 'Clean delivery'}"
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2E. Track Q1: Quality Defects */}
            <div style={{
              height: '38px',
              backgroundColor: '#0a0c14',
              borderTop: '1px solid var(--border-color)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}>
              {hasScanned && lintFindings.length === 0 && (
                <div style={{ paddingLeft: '14px', fontSize: '0.72rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✓ 0 Technical Defects Detected (Broadcast Clean)</span>
                </div>
              )}
              {lintFindings.map((finding, idx) => {
                const leftPct = (finding.start / totalDuration) * 100;
                const widthPct = Math.max(1.5, ((finding.end - finding.start) / totalDuration) * 100);

                return (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(finding.start);
                    }}
                    title={`Click to jump to ${finding.check}: ${finding.message}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '24px',
                      backgroundColor: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid #ef4444',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 4px',
                      zIndex: 10,
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: '#fca5a5', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ⚠ {finding.check}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Glowing Red/Cyan Playhead Needle */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${playheadPct}%`,
                width: '2px',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 10px #ef4444',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              {/* Playhead Head Marker */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-6px',
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#ef4444',
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
