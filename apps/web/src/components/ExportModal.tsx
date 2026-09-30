'use client';

import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, Download, Loader2, Play } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import type { Timeline } from '../../../../packages/contracts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
  timeline: Timeline | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  assetId,
  timeline,
}) => {
  const [renderId, setRenderId] = useState<string | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'QUEUED' | 'RENDERING' | 'MERGING' | 'DONE' | 'FAILED'>('IDLE');
  const [segmentProgress, setSegmentProgress] = useState<Record<number, number>>({});
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  const clips = timeline?.clips || [];

  // Elapsed timer
  useEffect(() => {
    let interval: any;
    if (startTime && (status === 'QUEUED' || status === 'RENDERING' || status === 'MERGING')) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [startTime, status]);

  // Connect to Socket.IO for live progress
  useEffect(() => {
    if (!renderId) return;

    const socket: Socket = io('/', { path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('join:render', { renderId });
    });

    socket.on('render:progress', (data: { segmentIdx: number; pct: number }) => {
      setSegmentProgress((prev) => ({
        ...prev,
        [data.segmentIdx]: data.pct,
      }));
    });

    socket.on('render:event', (data: { status: string; progress?: number }) => {
      if (data.status === 'MERGING') {
        setStatus('MERGING');
      } else if (data.status === 'DONE') {
        setStatus('DONE');
      } else if (data.status === 'FAILED') {
        setStatus('FAILED');
      }
    });

    socket.on('render:done', (data: { outputKey?: string; path?: string }) => {
      setStatus('DONE');
      if (data.outputKey) {
        setOutputUrl(`/media/${data.outputKey}`);
      } else {
        setOutputUrl(`/media/renders/${renderId}/final.mp4`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [renderId]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    if (!assetId) return;
    setStatus('QUEUED');
    setError(null);
    setStartTime(Date.now());
    setSegmentProgress({});

    try {
      const res = await fetch(`/api/assets/${assetId}/renders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to start export');
      }

      const data = await res.json();
      setRenderId(data.id);
      setStatus('RENDERING');
    } catch (err: any) {
      setError(err.message || 'Render failed');
      setStatus('FAILED');
    }
  };

  const completedSegments = Object.values(segmentProgress).filter((p) => p >= 100).length;
  const overallSegmentPct =
    clips.length > 0
      ? Math.round(
          Object.values(segmentProgress).reduce((acc, p) => acc + p, 0) / clips.length
        )
      : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '620px',
        borderRadius: 'var(--radius-lg)',
        padding: '26px',
        position: 'relative',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Zap size={22} color="#818cf8" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Fan-Out Video Export
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
          Renders {clips.length} segments in parallel across worker pool, then losslessly merges with concat.
        </p>

        {status === 'IDLE' && (
          <div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--border-color)',
              marginBottom: '20px',
              fontSize: '0.86rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Clips:</span>
                <span style={{ fontWeight: 600 }}>{clips.length} cuts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Encoding Mode:</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>Parallel Re-encode (x264 veryfast)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Audio Joins:</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>15ms micro-fades (pop prevention)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Final Merge:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Lossless stream copy (-c copy)</span>
              </div>
            </div>

            <button
              onClick={handleStartRender}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-gradient)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)',
              }}
            >
              Start Parallel Export
            </button>
          </div>
        )}

        {(status === 'QUEUED' || status === 'RENDERING' || status === 'MERGING') && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={18} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {status === 'MERGING' ? 'Merging segments (-c copy)...' : 'Rendering segments in parallel...'}
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {elapsed}s elapsed
              </span>
            </div>

            {/* Overall progress bar */}
            <div style={{
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}>
              <div style={{
                height: '100%',
                width: status === 'MERGING' ? '95%' : `${overallSegmentPct}%`,
                background: 'var(--accent-gradient)',
                transition: 'width 0.3s ease',
              }} />
            </div>

            {/* Per-segment worker progress grid */}
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}>
              {clips.map((clip, idx) => {
                const pct = segmentProgress[idx] ?? 0;
                return (
                  <div key={clip.id || idx} style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Seg {idx + 1} ({((clip.out - clip.in)).toFixed(1)}s)</span>
                      <span className="font-mono" style={{ fontWeight: 600, color: pct >= 100 ? 'var(--success)' : '#818cf8' }}>
                        {pct >= 100 ? '✓ Done' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: pct >= 100 ? 'var(--success)' : '#818cf8',
                        transition: 'width 0.2s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Worker threads are actively encoding segments simultaneously to achieve linear speedup.
            </p>
          </div>
        )}

        {status === 'DONE' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}>
              <CheckCircle2 size={32} color="var(--success)" />
            </div>

            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
              Export Complete!
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Rendered {clips.length} cuts in {elapsed}s with zero audio pops.
            </p>

            {outputUrl && (
              <div style={{ marginBottom: '20px' }}>
                <video
                  src={outputUrl}
                  controls
                  style={{
                    width: '100%',
                    maxHeight: '220px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#000000',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {outputUrl && (
                <a
                  href={outputUrl}
                  download="takepicker_cut.mp4"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-gradient)',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <Download size={18} />
                  Download Clean Cut
                </a>
              )}
              <button
                onClick={onClose}
                style={{
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {status === 'FAILED' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '8px' }}>
              Export failed
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {error || 'An unexpected error occurred during rendering'}
            </p>
            <button
              onClick={handleStartRender}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry Render
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
