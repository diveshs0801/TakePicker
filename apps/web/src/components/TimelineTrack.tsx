'use client';

import React from 'react';
import type { Timeline, TimelineClip } from '../../../../packages/contracts';
import { Scissors } from 'lucide-react';

interface TimelineTrackProps {
  timeline: Timeline | null;
  totalDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  activeClipId?: string;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  timeline,
  totalDuration,
  currentTime,
  onSeek,
  activeClipId,
}) => {
  if (!timeline || totalDuration <= 0) {
    return (
      <div className="glass" style={{
        padding: '20px',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        color: 'var(--text-dim)',
      }}>
        No timeline loaded
      </div>
    );
  }

  const clips = timeline.clips || [];
  const renderedDuration = clips.reduce((acc, c) => acc + (c.out - c.in), 0);
  const playheadPct = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  return (
    <div className="glass" style={{
      padding: '18px 24px',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Top summary row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scissors size={15} color="#818cf8" />
          <span style={{ fontWeight: 600 }}>Active Timeline Cuts</span>
          <span style={{ color: 'var(--text-muted)' }}>({clips.length} clean takes)</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <span>Source: <strong style={{ color: 'var(--text-main)' }}>{totalDuration.toFixed(1)}s</strong></span>
          <span>Clean Cut: <strong style={{ color: 'var(--success)' }}>{renderedDuration.toFixed(1)}s</strong></span>
          {totalDuration > renderedDuration && (
            <span style={{ color: '#818cf8', fontWeight: 600 }}>
              {Math.round(((totalDuration - renderedDuration) / totalDuration) * 100)}% pruned
            </span>
          )}
        </div>
      </div>

      {/* Interactive track canvas */}
      <div
        style={{
          position: 'relative',
          height: '56px',
          backgroundColor: '#0d1117',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pct = clickX / rect.width;
          onSeek(pct * totalDuration);
        }}
      >
        {/* Render timeline clips */}
        {clips.map((clip, idx) => {
          const leftPct = (clip.in / totalDuration) * 100;
          const widthPct = ((clip.out - clip.in) / totalDuration) * 100;
          const isActive = currentTime >= clip.in && currentTime <= clip.out;

          return (
            <div
              key={clip.id || idx}
              title={`${clip.reason || 'Take'} (${clip.in.toFixed(2)}s - ${clip.out.toFixed(2)}s)\n"${clip.text || ''}"`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${Math.max(0.6, widthPct)}%`,
                top: '6px',
                bottom: '6px',
                borderRadius: '6px',
                background: isActive
                  ? 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)'
                  : 'linear-gradient(180deg, #3730a3 0%, #1e1b4b 100%)',
                border: isActive ? '1px solid #c7d2fe' : '1px solid rgba(129, 140, 248, 0.4)',
                boxShadow: isActive ? '0 0 12px rgba(99, 102, 241, 0.6)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#ffffff',
                userSelect: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(clip.in);
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {idx + 1}. {clip.text || clip.reason || 'Take'}
              </span>
            </div>
          );
        })}

        {/* Playhead needle */}
        <div
          style={{
            position: 'absolute',
            left: `${playheadPct}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: '#ef4444',
            boxShadow: '0 0 8px #ef4444',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-4px',
              width: '10px',
              height: '10px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
            }}
          />
        </div>
      </div>
    </div>
  );
};
