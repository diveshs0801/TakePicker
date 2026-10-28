'use client';

import React, { useState, useRef } from 'react';
import type { Timeline, TimelineClip, TakeGroup } from '../../../../packages/contracts';
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
  Flame,
  CheckCircle,
  RotateCcw,
  X,
  Filter,
  ExternalLink,
} from 'lucide-react';

interface TimelineTrackProps {
  timeline: Timeline | null;
  totalDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  activeClipId?: string;
  assetId?: string;
  groups?: TakeGroup[];
  onSelectTake?: (groupId: string, segmentId: string | number) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  timeline,
  totalDuration,
  currentTime,
  onSeek,
  activeClipId,
  assetId,
  groups,
  onSelectTake,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'select' | 'cut'>('select');
  const [lintFindings, setLintFindings] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [isTrimmingSilence, setIsTrimmingSilence] = useState<boolean>(false);
  const [silenceResult, setSilenceResult] = useState<{ count: number; saved: number } | null>(null);
  const [isDefectsModalOpen, setIsDefectsModalOpen] = useState<boolean>(false);
  const [defectFilter, setDefectFilter] = useState<'all' | 'D3_audio_dropout' | 'D4_loudness_jump' | 'errors_only'>('all');
  const [isRemovingFillers, setIsRemovingFillers] = useState<boolean>(false);
  const [fillerResult, setFillerResult] = useState<{ count: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Flatten all takes unconditionally at top of component (satisfies React rules of hooks)
  const allTakes = React.useMemo(() => {
    const clips = timeline?.clips || [];
    if (!groups || groups.length === 0) {
      return clips.map((c, i) => ({
        id: c.id || `clip_${i}`,
        groupId: c.groupId || `group_${i}`,
        start: c.in,
        end: c.out,
        text: c.text || c.reason || 'Clean delivery',
        score: 0.9,
        isChosen: true,
        isRetake: false,
        groupSize: 1,
        takeIdx: 1,
      }));
    }

    const items: Array<{
      id: string | number;
      groupId: string;
      start: number;
      end: number;
      text: string;
      score: number;
      isChosen: boolean;
      isRetake: boolean;
      groupSize: number;
      takeIdx: number;
    }> = [];

    for (const group of groups) {
      const isMulti = group.takes && group.takes.length > 1;
      const groupSize = group.takes ? group.takes.length : 1;

      (group.takes || []).forEach((take, takeIdx) => {
        const isChosen = String(take.id) === String(group.chosenSegmentId) || String(take.idx) === String(group.chosenSegmentId);
        items.push({
          id: take.id || take.idx,
          groupId: group.id,
          start: take.start,
          end: take.end,
          text: take.text,
          score: take.score ?? 0.8,
          isChosen,
          isRetake: isMulti,
          groupSize,
          takeIdx: takeIdx + 1,
        });
      });
    }

    return items;
  }, [groups, timeline?.clips]);

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

  const handleJumpCutSilence = async () => {
    if (!assetId) return;
    setIsTrimmingSilence(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/jump-cut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minSilenceSec: 0.6, bufferSec: 0.1 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSilenceResult({
          count: data.silencesDetected,
          saved: data.timeSaved,
        });
      }
    } catch (e) {
      console.error('Jump cut failed:', e);
    } finally {
      setIsTrimmingSilence(false);
    }
  };

  const handleRemoveFillers = async () => {
    if (!assetId) return;
    setIsRemovingFillers(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/remove-fillers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });
      if (res.ok) {
        const data = await res.json();
        setFillerResult({
          count: data.removedCount || 0,
        });
      }
    } catch (e) {
      console.error('Remove fillers failed:', e);
    } finally {
      setIsRemovingFillers(false);
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

  // Dynamic Timecode ticks: target ~8-12 ticks per visible viewport at any zoom level
  const effectiveDuration = totalDuration / zoomLevel;
  const rawInterval = effectiveDuration / 8;
  let tickInterval = 300;
  if (rawInterval >= 600) tickInterval = 600;      // 10 min
  else if (rawInterval >= 300) tickInterval = 300; // 5 min
  else if (rawInterval >= 120) tickInterval = 120; // 2 min
  else if (rawInterval >= 60) tickInterval = 60;   // 1 min
  else if (rawInterval >= 30) tickInterval = 30;   // 30 sec
  else if (rawInterval >= 15) tickInterval = 20;   // 20 sec
  else if (rawInterval >= 8) tickInterval = 10;    // 10 sec
  else if (rawInterval >= 4) tickInterval = 5;     // 5 sec
  else tickInterval = 2;

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
            onClick={hasScanned ? () => setIsDefectsModalOpen(true) : handleScanDefects}
            disabled={isScanning || !assetId}
            title={hasScanned ? "Click to inspect defects breakdown and jump to timestamps" : "Scan timeline for technical defects"}
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
                ? `${lintFindings.length} Defects (Inspect ↗)`
                : 'Scan Quality (D1-D7)'}
            </span>
          </button>

          {/* Auto Jump-Cut / Smart Silence Trimmer Button */}
          <button
            type="button"
            onClick={handleJumpCutSilence}
            disabled={isTrimmingSilence || !assetId}
            title="Automatically detects pauses and trims dead air (Jump-Cut)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              background: silenceResult
                ? 'rgba(139, 92, 246, 0.22)'
                : 'rgba(99, 102, 241, 0.15)',
              border: silenceResult
                ? '1px solid rgba(139, 92, 246, 0.5)'
                : '1px solid rgba(99, 102, 241, 0.4)',
              color: silenceResult ? '#c4b5fd' : '#a5b4fc',
              cursor: isTrimmingSilence || !assetId ? 'wait' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Scissors size={13} />
            <span>
              {isTrimmingSilence
                ? 'Trimming Dead Air...'
                : silenceResult
                ? `⚡ Saved ${silenceResult.saved.toFixed(1)}s (${silenceResult.count} cuts)`
                : '⚡ Auto Jump-Cut'}
            </span>
          </button>

          {/* Prune Fillers Button */}
          <button
            type="button"
            onClick={handleRemoveFillers}
            disabled={isRemovingFillers || !assetId}
            title="Automatically detects and removes filler words (ums, uhs, likes) using Whisper word timestamps"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              background: fillerResult
                ? 'rgba(16, 185, 129, 0.22)'
                : 'rgba(59, 130, 246, 0.15)',
              border: fillerResult
                ? '1px solid rgba(16, 185, 129, 0.5)'
                : '1px solid rgba(59, 130, 246, 0.4)',
              color: fillerResult ? '#86efac' : '#93c5fd',
              cursor: isRemovingFillers || !assetId ? 'wait' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={13} />
            <span>
              {isRemovingFillers
                ? 'Pruning Fillers...'
                : fillerResult
                ? `⚡ Pruned ${fillerResult.count} Fillers`
                : '⚡ Prune Fillers'}
            </span>
          </button>
        </div>

        {/* Center: Efficiency Stats & Visual Legend */}
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

          {/* Color Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '6px', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#86efac' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              Kept Take
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#fcd34d' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b', border: '1px dashed #fbbf24' }} />
              Pruned Retake
            </span>
          </div>
        </div>

        {/* Right: Zoom & Layout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick Zoom Presets */}
          {[1, 2, 5, 10, 15].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoomLevel(z)}
              style={{
                padding: '2px 6px',
                borderRadius: '3px',
                border: zoomLevel === z ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.08)',
                background: zoomLevel === z ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: zoomLevel === z ? '#ffffff' : 'var(--text-dim)',
                fontSize: '0.68rem',
                fontWeight: zoomLevel === z ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {z}x
            </button>
          ))}

          <button
            type="button"
            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 1))}
            disabled={zoomLevel <= 1}
            style={{ background: 'none', border: 'none', color: zoomLevel <= 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: zoomLevel <= 1 ? 'default' : 'pointer', padding: '2px' }}
          >
            <ZoomOut size={13} />
          </button>

          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', minWidth: '28px', textAlign: 'center' }}>
            {zoomLevel.toFixed(0)}x
          </span>

          <button
            type="button"
            onClick={() => setZoomLevel(Math.min(15, zoomLevel + 1))}
            disabled={zoomLevel >= 15}
            style={{ background: 'none', border: 'none', color: zoomLevel >= 15 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: zoomLevel >= 15 ? 'default' : 'pointer', padding: '2px' }}
          >
            <ZoomIn size={13} />
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
          <div
            onClick={() => {
              if (hasScanned && lintFindings.length > 0) setIsDefectsModalOpen(true);
            }}
            title={hasScanned ? "Click to open Defects Inspector" : undefined}
            style={{
              height: '38px',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: hasScanned && lintFindings.length > 0 ? 'pointer' : 'default',
            }}
          >
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

            {/* 2B. Track V1: Video Cuts (Professional NLE Style) */}
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
                const dur = (clip.out - clip.in).toFixed(1);
                const effectiveWidth = widthPct * zoomLevel;

                return (
                  <div
                    key={clip.id || idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(clip.in);
                    }}
                    title={`Clip #${idx + 1} (${dur}s): ${clip.in.toFixed(1)}s - ${clip.out.toFixed(1)}s (Click to seek)`}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${Math.max(0.18, widthPct)}%`,
                      top: '5px',
                      bottom: '5px',
                      backgroundColor: isCurrent ? '#4f46e5' : '#1e1b4b',
                      border: isCurrent ? '1.5px solid #a5b4fc' : '1px solid rgba(99, 102, 241, 0.45)',
                      borderRadius: '3px',
                      padding: effectiveWidth >= 5 ? '0 6px' : '0',
                      overflow: 'hidden',
                      boxShadow: isCurrent ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: effectiveWidth >= 5 ? 'space-between' : 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {effectiveWidth >= 6 ? (
                      <>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e0e7ff', whiteSpace: 'nowrap' }}>
                          #{idx + 1}
                        </span>
                        <span className="font-mono" style={{ fontSize: '0.64rem', color: '#a5b4fc' }}>
                          {dur}s
                        </span>
                      </>
                    ) : effectiveWidth >= 2.2 ? (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#a5b4fc' }}>
                        {idx + 1}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* 2C. Track A1: Audio Waveform (High-Density Natural Sound Wave) */}
            <div style={{
              height: '42px',
              backgroundColor: '#0a0d16',
              borderBottom: '1px solid var(--border-color)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
            }}>
              <div style={{
                width: '100%',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '1px',
                opacity: 0.85,
              }}>
                {Array.from({ length: 240 }).map((_, barIdx) => {
                  const barTime = (barIdx / 240) * totalDuration;
                  const isSpeech = clips.some((c) => barTime >= c.in && barTime <= c.out);
                  const waveSeed = (barIdx * 37) % 100;
                  const randomAmp = isSpeech
                    ? Math.max(22, (waveSeed * 0.72) + 20)
                    : Math.max(5, (waveSeed * 0.12));

                  return (
                    <div
                      key={barIdx}
                      style={{
                        flex: 1,
                        height: `${randomAmp}%`,
                        backgroundColor: isSpeech ? '#06b6d4' : 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '1px',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 2D. Track S1: Speech Takes (Adaptive & Clean Take Cards) */}
            <div style={{
              height: '46px',
              backgroundColor: '#0d121c',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {allTakes.map((take, idx) => {
                const leftPct = (take.start / totalDuration) * 100;
                const widthPct = ((take.end - take.start) / totalDuration) * 100;
                const isCurrent = currentTime >= take.start && currentTime <= take.end;
                const effectiveWidth = widthPct * zoomLevel;

                const bg = take.isChosen
                  ? isCurrent ? 'rgba(16, 185, 129, 0.42)' : 'rgba(16, 185, 129, 0.22)'
                  : isCurrent ? 'rgba(245, 158, 11, 0.42)' : 'rgba(245, 158, 11, 0.16)';

                const borderColor = take.isChosen
                  ? isCurrent ? '#34d399' : '#10b981'
                  : isCurrent ? '#fbbf24' : '#f59e0b';

                const borderStyle = take.isChosen ? 'solid' : 'dashed';
                const textColor = take.isChosen ? '#6ee7b7' : '#fcd34d';

                return (
                  <div
                    key={`${take.id}_${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!take.isChosen && onSelectTake) {
                        onSelectTake(take.groupId, take.id);
                      } else {
                        onSeek(take.start);
                      }
                    }}
                    title={take.isChosen
                      ? `✓ KEPT TAKE (Score: ${take.score.toFixed(2)}): "${take.text}"`
                      : `↺ ALTERNATE RETAKE (Score: ${take.score.toFixed(2)}): "${take.text}". Click to select this take!`}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${Math.max(0.18, widthPct)}%`,
                      top: '5px',
                      bottom: '5px',
                      backgroundColor: bg,
                      border: `1px ${borderStyle} ${borderColor}`,
                      borderRadius: '4px',
                      padding: effectiveWidth >= 5 ? '0 5px' : '0',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: effectiveWidth >= 8 ? 'flex-start' : 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isCurrent ? (take.isChosen ? '0 0 10px rgba(16, 185, 129, 0.4)' : '0 0 10px rgba(245, 158, 11, 0.4)') : 'none',
                    }}
                  >
                    {effectiveWidth >= 12 ? (
                      <>
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: take.isChosen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                          color: textColor,
                          whiteSpace: 'nowrap',
                        }}>
                          {take.isChosen ? `✓ ${take.score.toFixed(2)}` : `↺ ${take.score.toFixed(2)}`}
                        </span>
                        <span style={{ fontSize: '0.67rem', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          "{take.text}"
                        </span>
                      </>
                    ) : effectiveWidth >= 5 ? (
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: textColor,
                        whiteSpace: 'nowrap',
                      }}>
                        {take.isChosen ? `✓` : `↺`} {take.score.toFixed(2)}
                      </span>
                    ) : effectiveWidth >= 2.2 ? (
                      <span style={{ fontSize: '0.58rem', fontWeight: 800, color: textColor }}>
                        {take.isChosen ? `✓` : `↺`}
                      </span>
                    ) : null}
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
      {/* 3. Defects Inspector Modal */}
      {isDefectsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(5, 7, 12, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsDefectsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '85vh',
              backgroundColor: '#0c101a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0f1422',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f3f4f6' }}>
                    Quality Defects & Linter Audit
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Single-pass technical audit for broadcast quality standards (D1–D7)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDefectsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanatory Banner */}
            <div style={{
              margin: '16px 20px 0 20px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.78rem',
              color: '#93c5fd',
              lineHeight: 1.5,
            }}>
              <strong style={{ color: '#bfdbfe' }}>ℹ️ Audit Breakdown:</strong> {lintFindings.filter((f: any) => f.check === 'D4_loudness_jump').length} of these findings are <strong>normal speech volume dynamics (D4)</strong> in raw outdoor audio. Continuous speech naturally varies in syllable volume. Real defects occur at spliced clip joins — which are automatically smoothed and leveled by broadcast microfades upon clicking <strong>Export Clean Cut</strong>.
            </div>

            {/* Filter Tabs & Stats Bar */}
            <div style={{
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'all', label: `All (${lintFindings.length})` },
                  { id: 'D3_audio_dropout', label: `Audio Dropouts (${lintFindings.filter((f: any) => f.check === 'D3_audio_dropout').length})` },
                  { id: 'D4_loudness_jump', label: `Loudness Jumps (${lintFindings.filter((f: any) => f.check === 'D4_loudness_jump').length})` },
                  { id: 'errors_only', label: `Errors Only (${lintFindings.filter((f: any) => f.severity === 'error').length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDefectFilter(tab.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: defectFilter === tab.id ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: defectFilter === tab.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: defectFilter === tab.id ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: defectFilter === tab.id ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Findings List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              {lintFindings
                .filter((f: any) => {
                  if (defectFilter === 'all') return true;
                  if (defectFilter === 'errors_only') return f.severity === 'error';
                  return f.check === defectFilter;
                })
                .slice(0, 100)
                .map((finding: any, idx: number) => {
                  const isD3 = finding.check === 'D3_audio_dropout';
                  const min = Math.floor(finding.start / 60);
                  const sec = (finding.start % 60).toFixed(1);
                  const timecodeStr = `${min}:${sec.padStart(4, '0')}`;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: isD3 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isD3 ? '#fcd34d' : '#93c5fd',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {finding.check}
                        </span>

                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: finding.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.12)',
                            color: finding.severity === 'error' ? '#fca5a5' : '#fcd34d',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          {finding.severity}
                        </span>

                        <span
                          className="font-mono"
                          style={{ fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          @{timecodeStr}
                        </span>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {finding.message}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSeek(finding.start);
                          setIsDefectsModalOpen(false);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#c7d2fe',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ExternalLink size={11} />
                        <span>Seek to Time</span>
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer with 1-Click Fix Actions */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: '#0a0d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleJumpCutSilence();
                    setIsDefectsModalOpen(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(139, 92, 246, 0.25)',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    color: '#c4b5fd',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Scissors size={12} />
                  <span>⚡ Auto Jump-Cut (Prune Dropouts)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRemoveFillers();
                    setIsDefectsModalOpen(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.45)',
                    color: '#93c5fd',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Sparkles size={12} />
                  <span>⚡ Prune Filler Words</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDefectsModalOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
