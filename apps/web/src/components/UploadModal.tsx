'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  Loader2,
  AlertCircle,
  WifiOff,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import type { AssetStatus } from '../../../../packages/contracts';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (assetId: string) => void;
  currentStatus?: AssetStatus;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  currentStatus,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simulatedDrop, setSimulatedDrop] = useState(false);
  const [uploadMode, setUploadMode] = useState<'tus' | 'standard'>('tus');
  const [progressBytes, setProgressBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('0 MB/s');
  const [error, setError] = useState<string | null>(null);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);

  // Keep isPausedRef in sync
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.toLowerCase().endsWith('.mp4')) {
        setFile(f);
        setError(null);
      } else {
        setError('Only MP4/H.264 files are supported in TakePicker v1');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.name.toLowerCase().endsWith('.mp4')) {
        setFile(f);
        setError(null);
      } else {
        setError('Only MP4/H.264 files are supported in TakePicker v1');
      }
    }
  };

  // Resumable TUS 1.0 upload implementation
  const startTusUpload = async (resumeExisting = false) => {
    if (!file) return;

    setIsUploading(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setSimulatedDrop(false);
    setError(null);
    setTotalBytes(file.size);

    const apiBase = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000';

    try {
      let uploadUrl = uploadSessionId;
      let currentOffset = 0;

      // 1. Create upload session if not already created
      if (!uploadUrl || !resumeExisting) {
        const metadataString = `filename ${btoa(unescape(encodeURIComponent(file.name)))}`;
        const createRes = await fetch(`${apiBase}/uploads`, {
          method: 'POST',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Length': String(file.size),
            'Upload-Metadata': metadataString,
          },
        });

        if (!createRes.ok && createRes.status !== 201) {
          throw new Error(`Failed to create TUS session (${createRes.status})`);
        }

        const locationHeader = createRes.headers.get('Location') || createRes.headers.get('location');
        if (!locationHeader) {
          throw new Error('Server did not return a Location header');
        }

        uploadUrl = locationHeader.startsWith('http') ? locationHeader : `${apiBase}${locationHeader}`;
        setUploadSessionId(uploadUrl);
      } else {
        // Query current offset on server
        const headRes = await fetch(uploadUrl, {
          method: 'HEAD',
          headers: { 'Tus-Resumable': '1.0.0' },
        });

        if (headRes.ok) {
          const srvOffset = headRes.headers.get('Upload-Offset') || headRes.headers.get('upload-offset');
          if (srvOffset) {
            currentOffset = parseInt(srvOffset, 10);
            setProgressBytes(currentOffset);
          }
        }
      }

      // 2. Chunk streaming loop (4MB chunks)
      const CHUNK_SIZE = 4 * 1024 * 1024;
      const startTime = Date.now();

      while (currentOffset < file.size) {
        if (isPausedRef.current) {
          return;
        }

        const chunkEnd = Math.min(currentOffset + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(currentOffset, chunkEnd);

        abortControllerRef.current = new AbortController();

        const patchRes = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(currentOffset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunkBlob,
          signal: abortControllerRef.current.signal,
        });

        if (patchRes.status === 409) {
          // Offset mismatch, query HEAD
          const headRes = await fetch(uploadUrl, {
            method: 'HEAD',
            headers: { 'Tus-Resumable': '1.0.0' },
          });
          const realOffset = headRes.headers.get('Upload-Offset') || headRes.headers.get('upload-offset');
          currentOffset = realOffset ? parseInt(realOffset, 10) : currentOffset;
          setProgressBytes(currentOffset);
          continue;
        }

        if (!patchRes.ok && patchRes.status !== 204) {
          throw new Error(`Upload chunk error (${patchRes.status})`);
        }

        const newOffsetHeader = patchRes.headers.get('Upload-Offset') || patchRes.headers.get('upload-offset');
        const nextOffset = newOffsetHeader ? parseInt(newOffsetHeader, 10) : chunkEnd;
        currentOffset = nextOffset;
        setProgressBytes(currentOffset);

        // Speed calculation
        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedSec > 0.5) {
          const mbPerSec = (currentOffset / (1024 * 1024)) / elapsedSec;
          setUploadSpeed(`${mbPerSec.toFixed(1)} MB/s`);
        }

        // Check if finished
        const assetIdHeader = patchRes.headers.get('Asset-Id') || patchRes.headers.get('asset-id');
        if (assetIdHeader || currentOffset >= file.size) {
          if (assetIdHeader) {
            onUploadSuccess(assetIdHeader);
          }
          break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Deliberate pause/abort
        return;
      }
      console.error('[UploadModal] Error:', err);
      setError(err.message || 'Upload failed');
      setIsUploading(false);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    startTusUpload(true);
  };

  const handleSimulateDrop = () => {
    setSimulatedDrop(true);
    handlePause();
  };

  const handleStandardUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }

      const data = await res.json();
      onUploadSuccess(data.id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload video');
      setIsUploading(false);
    }
  };

  const stages = [
    { key: 'UPLOADED', label: 'Video Uploaded & Stored' },
    { key: 'PROBING', label: 'Probing Media & Metadata (FFprobe)' },
    { key: 'PROXYING', label: 'Generating 480p Proxy & 16kHz Audio' },
    { key: 'ANALYZING', label: 'Whisper AI Transcription & Retake Clustering' },
    { key: 'READY', label: 'Timeline Ready' },
  ];

  const getStageIndex = (st?: AssetStatus) => {
    if (!st) return 0;
    return stages.findIndex((s) => s.key === st);
  };

  const activeIdx = getStageIndex(currentStatus);
  const percentComplete = totalBytes > 0 ? Math.round((progressBytes / totalBytes) * 100) : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '560px',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        position: 'relative',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}>
        {/* Close Button */}
        {(!isUploading || currentStatus === 'FAILED' || currentStatus === 'READY') && (
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
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Upload Video Footage</h3>
            <span className="badge badge-purple" style={{ marginTop: '2px' }}>TUS 1.0 Resumable Protocol</span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Upload high-resolution raw camera footage. Resilient to network interruptions with zero data loss.
        </p>

        {!isUploading ? (
          <>
            {/* Protocol Selector */}
            <div style={{
              display: 'flex',
              gap: '8px',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
            }}>
              <button
                type="button"
                onClick={() => setUploadMode('tus')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: uploadMode === 'tus' ? 'var(--accent-gradient)' : 'transparent',
                  color: uploadMode === 'tus' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <ShieldCheck size={14} />
                <span>Resumable (TUS 1.0)</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('standard')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: uploadMode === 'standard' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: uploadMode === 'standard' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Standard Form Upload
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-hover)',
                borderRadius: 'var(--radius-md)',
                padding: '34px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <UploadCloud size={40} color="#818cf8" style={{ margin: '0 auto 12px auto' }} />
              {file ? (
                <div>
                  <p style={{ fontWeight: 600, color: '#ffffff' }}>{file.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {(file.size / (1024 * 1024)).toFixed(1)} MB • Ready to stream
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 600 }}>Click to select or drag and drop video</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    MP4 video container (H.264 video codec)
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--danger)',
                fontSize: '0.82rem',
                marginTop: '12px',
              }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => uploadMode === 'tus' ? startTusUpload(false) : handleStandardUpload()}
              disabled={!file}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                background: file ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: file ? '#ffffff' : 'var(--text-dim)',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: file ? 'pointer' : 'not-allowed',
                boxShadow: file ? '0 4px 18px rgba(99, 102, 241, 0.35)' : 'none',
              }}
            >
              {uploadMode === 'tus' ? 'Start Resumable Upload (TUS)' : 'Start Analysis & Processing'}
            </button>
          </>
        ) : (
          /* Live Upload & Processing State */
          <div>
            {/* If still uploading bytes */}
            {progressBytes < totalBytes && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>
                    {isPaused ? 'Upload Paused' : 'Streaming Chunks to Disk...'}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#818cf8' }}>
                    {percentComplete}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}>
                  <div style={{
                    width: `${percentComplete}%`,
                    height: '100%',
                    background: isPaused ? 'var(--warning)' : 'var(--accent-gradient)',
                    transition: 'width 0.2s ease',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  <span>
                    {(progressBytes / (1024 * 1024)).toFixed(1)} MB / {(totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <span>{uploadSpeed}</span>
                </div>

                {/* Test Simulation Controls */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!isPaused ? (
                    <>
                      <button
                        onClick={handlePause}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--border-color)',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Pause size={13} />
                        <span>Pause</span>
                      </button>

                      <button
                        onClick={handleSimulateDrop}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#fca5a5',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <WifiOff size={13} />
                        <span>Simulate Network Drop</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleResume}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-gradient)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={13} fill="#ffffff" />
                      <span>Resume Without Loss</span>
                    </button>
                  )}
                </div>

                {simulatedDrop && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    fontSize: '0.78rem',
                    color: '#fcd34d',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                    <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Simulated Network Disconnect:</strong> The connection dropped at offset {progressBytes} bytes. Notice that the server keeps the offset saved. Click <strong>Resume Without Loss</strong> to continue without restarting from 0!
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Progress Stepper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
              {stages.map((stage, idx) => {
                const isPast = activeIdx > idx;
                const isCurrent = activeIdx === idx && currentStatus !== 'FAILED';

                return (
                  <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isPast ? (
                      <CheckCircle2 size={18} color="var(--success)" />
                    ) : isCurrent ? (
                      <Loader2 size={18} color="#818cf8" className="pulse-glow" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: '2px solid var(--text-dim)',
                      }} />
                    )}
                    <span style={{
                      fontSize: '0.86rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isPast ? '#e2e8f0' : isCurrent ? '#ffffff' : 'var(--text-dim)',
                    }}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}

              {currentStatus === 'FAILED' && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
                    <AlertCircle size={18} />
                    <span>Processing failed. Please ensure the video has speech and is H.264/MP4 format.</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsUploading(false);
                      setError(null);
                      setProgressBytes(0);
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Upload Another Video
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
