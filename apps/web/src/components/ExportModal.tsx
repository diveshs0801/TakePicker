'use client';

import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, Download, Loader2, Play, Film, Copy, Check, FileCode, Sliders } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import type { Timeline, LintReport, ExportFormat } from '../../../../packages/contracts';

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
  const [activeTab, setActiveTab] = useState<'video' | 'nle'>('video');
  const [renderId, setRenderId] = useState<string | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'QUEUED' | 'RENDERING' | 'MERGING' | 'DONE' | 'FAILED'>('IDLE');
  const [segmentProgress, setSegmentProgress] = useState<Record<number, number>>({});
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [lintReport, setLintReport] = useState<LintReport | null>(null);

  // Pro NLE Interchange State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('fcpxml');
  const [sequenceName, setSequenceName] = useState<string>('TakePicker Rough Cut');
  const [nleLoading, setNleLoading] = useState<boolean>(false);
  const [nleResult, setNleResult] = useState<{
    content: string;
    filename: string;
    mimeType: string;
    clipCount: number;
    totalDurationSec: number;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

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

    const socketUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : 'http://localhost:3000';
    const socket: Socket = io(socketUrl, { transports: ['websocket', 'polling'] });

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

    const fetchLintReport = async (rid: string) => {
      try {
        const res = await fetch(`/api/renders/${rid}/lint`);
        if (res.ok) {
          const data = await res.json();
          setLintReport(data);
        }
      } catch (e) {
        console.warn('Could not fetch lint report:', e);
      }
    };

    socket.on('render:done', (data: { outputKey?: string; path?: string }) => {
      setStatus('DONE');
      if (data.outputKey) {
        setOutputUrl(`/media/${data.outputKey}`);
      } else {
        setOutputUrl(`/media/renders/${renderId}/final.mp4`);
      }
      fetchLintReport(renderId);
    });

    socket.on('render:lint_done', (data: any) => {
      if (data.findings) {
        setLintReport(data);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [renderId]);

  // Polling fallback to guarantee completion detection
  useEffect(() => {
    if (!renderId || status === 'DONE' || status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/renders/${renderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'MERGING') {
            setStatus('MERGING');
          } else if (data.status === 'DONE') {
            setStatus('DONE');
            setOutputUrl(data.outputUrl || `/media/renders/${renderId}/final.mp4`);
            // Mark all segments done
            const allDone: Record<number, number> = {};
            clips.forEach((_, idx) => {
              allDone[idx] = 100;
            });
            setSegmentProgress(allDone);
            fetch(`/api/renders/${renderId}/lint`)
              .then((r) => (r.ok ? r.json() : null))
              .then((rep) => rep && setLintReport(rep))
              .catch(() => {});
          } else if (data.status === 'FAILED') {
            setStatus('FAILED');
            setError('Render failed on worker pool');
          }
        }
      } catch (err) {
        console.error('Render polling error:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [renderId, status, clips]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    if (!assetId) return;
    setStatus('QUEUED');
    setError(null);
    setLintReport(null);
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

  const handleGenerateNLE = async (formatToExport: ExportFormat = selectedFormat) => {
    if (!assetId) return;
    setNleLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/export/${formatToExport}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeline,
          options: {
            format: formatToExport,
            sequenceName,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to generate NLE export');
      }

      const data = await res.json();
      setNleResult(data);
    } catch (err: any) {
      console.error('NLE export error:', err);
    } finally {
      setNleLoading(false);
    }
  };

  const handleDownloadNLEFile = () => {
    if (!nleResult) return;
    const blob = new Blob([nleResult.content], { type: nleResult.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nleResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyNLE = () => {
    if (!nleResult) return;
    navigator.clipboard.writeText(nleResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        maxWidth: '660px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Zap size={22} color="#818cf8" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            TakePicker Export Center
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Render finished video with quality audit or export project files directly into desktop NLEs.
        </p>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-color)',
        }}>
          <button
            onClick={() => setActiveTab('video')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'video' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'video' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Zap size={15} />
            Render MP4 Video
          </button>
          <button
            onClick={() => {
              setActiveTab('nle');
              if (!nleResult) {
                handleGenerateNLE(selectedFormat);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'nle' ? 'var(--accent-gradient)' : 'transparent',
              color: activeTab === 'nle' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Film size={15} />
            Pro NLE Interchange (XML / EDL)
          </button>
        </div>

        {/* PRO NLE INTERCHANGE TAB */}
        {activeTab === 'nle' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}>
              {[
                {
                  id: 'fcpxml' as ExportFormat,
                  title: 'Apple Final Cut Pro',
                  ext: '.fcpxml',
                  badge: 'FCPXML 1.9 / Resolve',
                  desc: 'Markers, take notes & frame accuracy',
                  icon: '🍏',
                },
                {
                  id: 'premiere' as ExportFormat,
                  title: 'Adobe Premiere Pro',
                  ext: '.xml',
                  badge: 'XMEML v5 / CC',
                  desc: 'Synced dual audio tracks & comments',
                  icon: '🎬',
                },
                {
                  id: 'edl' as ExportFormat,
                  title: 'DaVinci Resolve / EDL',
                  ext: '.edl',
                  badge: 'CMX 3600 SMPTE',
                  desc: 'Timecode decision list for color conform',
                  icon: '🎞️',
                },
                {
                  id: 'otio' as ExportFormat,
                  title: 'OpenTimelineIO',
                  ext: '.otio',
                  badge: 'ASWF / Pixar standard',
                  desc: 'Studio pipeline, Blender & VFX format',
                  icon: '⚡',
                },
              ].map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => {
                      setSelectedFormat(fmt.id);
                      handleGenerateNLE(fmt.id);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? '#818cf8' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{fmt.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                          {fmt.title}
                        </span>
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.68rem', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#818cf8' }}>
                        {fmt.ext}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: 0 }}>
                      {fmt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Sequence Settings */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sequence Title:</label>
                <input
                  type="text"
                  value={sequenceName}
                  onChange={(e) => setSequenceName(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    color: '#ffffff',
                    width: '240px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cut Summary:</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>
                  {clips.length} cuts • {clips.reduce((a, c) => a + (c.out - c.in), 0).toFixed(1)}s duration • {timeline?.fps || 30} fps
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <button
                onClick={handleDownloadNLEFile}
                disabled={nleLoading || !nleResult}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-gradient)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: nleLoading || !nleResult ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)',
                  opacity: nleLoading || !nleResult ? 0.6 : 1,
                }}
              >
                {nleLoading ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={16} />
                )}
                Download {nleResult?.filename || `${selectedFormat.toUpperCase()} Project`}
              </button>

              <button
                onClick={handleCopyNLE}
                disabled={!nleResult}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: !nleResult ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              <button
                onClick={() => setShowPreview(!showPreview)}
                disabled={!nleResult}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: showPreview ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: showPreview ? '#818cf8' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  cursor: !nleResult ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FileCode size={16} />
                {showPreview ? 'Hide Code' : 'Preview'}
              </button>
            </div>

            {/* Code Preview Drawer */}
            {showPreview && nleResult && (
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border-color)',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                color: '#94a3b8',
                marginBottom: '14px',
              }}>
                {nleResult.content}
              </div>
            )}
          </div>
        )}

        {/* VIDEO RENDER TAB */}
        {activeTab === 'video' && status === 'IDLE' && (
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

        {activeTab === 'video' && (status === 'QUEUED' || status === 'RENDERING' || status === 'MERGING') && (
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

        {activeTab === 'video' && status === 'DONE' && (
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

            {/* Phase 2B Video Linter Audit Scorecard */}
            {lintReport && (
              <div style={{
                textAlign: 'left',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${lintReport.passed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>{lintReport.passed ? '🛡️' : '⚠️'}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: lintReport.passed ? '#34d399' : '#fbbf24' }}>
                      {lintReport.passed ? 'Video Linter Quality Audit: PASSED' : `Video Linter: ${lintReport.defectCount} Issue(s) Detected`}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    audited in {lintReport.lintTimeSec ? `${lintReport.lintTimeSec.toFixed(2)}s` : '<0.1s'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '0.72rem', textAlign: 'center' }}>
                  <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Black Frames</div>
                    <div style={{ fontWeight: 700, color: lintReport.findings?.some((f: any) => f.check === 'D1_black_frames') ? '#f87171' : '#34d399' }}>
                      {lintReport.findings?.filter((f: any) => f.check === 'D1_black_frames').length === 0 ? '✓ 0' : `${lintReport.findings?.filter((f: any) => f.check === 'D1_black_frames').length} found`}
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Frozen Video</div>
                    <div style={{ fontWeight: 700, color: lintReport.findings?.some((f: any) => f.check === 'D2_frozen_video') ? '#f87171' : '#34d399' }}>
                      {lintReport.findings?.filter((f: any) => f.check === 'D2_frozen_video').length === 0 ? '✓ 0' : `${lintReport.findings?.filter((f: any) => f.check === 'D2_frozen_video').length} found`}
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Audio Dropout</div>
                    <div style={{ fontWeight: 700, color: lintReport.findings?.some((f: any) => f.check === 'D3_audio_dropout') ? '#f87171' : '#34d399' }}>
                      {lintReport.findings?.filter((f: any) => f.check === 'D3_audio_dropout').length === 0 ? '✓ 0' : `${lintReport.findings?.filter((f: any) => f.check === 'D3_audio_dropout').length} found`}
                    </div>
                  </div>
                  <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Loudness Jumps</div>
                    <div style={{ fontWeight: 700, color: lintReport.findings?.some((f: any) => f.check === 'D4_loudness_jump') ? '#f87171' : '#34d399' }}>
                      {lintReport.findings?.filter((f: any) => f.check === 'D4_loudness_jump').length === 0 ? '✓ 0' : `${lintReport.findings?.filter((f: any) => f.check === 'D4_loudness_jump').length} found`}
                    </div>
                  </div>
                </div>

                {lintReport.findings && lintReport.findings.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {lintReport.findings.slice(0, 3).map((f: any, i: number) => (
                      <div key={i} style={{ fontSize: '0.7rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                        • [{f.check}] {f.start?.toFixed(2)}s - {f.end?.toFixed(2)}s: {f.message}
                      </div>
                    ))}
                  </div>
                )}
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

        {activeTab === 'video' && status === 'FAILED' && (
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
