'use client';

import React, { useState, useRef } from 'react';
import { X, UploadCloud, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleUpload = async () => {
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
    { key: 'UPLOADED', label: 'Video Uploaded' },
    { key: 'PROBING', label: 'Probing Media & Metadata' },
    { key: 'PROXYING', label: 'Generating 480p Proxy & 16kHz Audio' },
    { key: 'ANALYZING', label: 'Whisper Transcription & AI Retake Clustering' },
    { key: 'READY', label: 'Timeline Ready' },
  ];

  const getStageIndex = (st?: AssetStatus) => {
    if (!st) return 0;
    return stages.findIndex((s) => s.key === st);
  };

  const activeIdx = getStageIndex(currentStatus);

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
        maxWidth: '540px',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        position: 'relative',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
      }}>
        {/* Close Button */}
        {!isUploading && (
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
        )}

        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
          Upload Raw Footage
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Upload your raw unedited talking-head footage (H.264/MP4).
        </p>

        {!isUploading ? (
          <>
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-hover)',
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
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
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
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
              onClick={handleUpload}
              disabled={!file}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: file ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: file ? '#ffffff' : 'var(--text-dim)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: file ? 'pointer' : 'not-allowed',
                boxShadow: file ? '0 4px 16px rgba(99, 102, 241, 0.35)' : 'none',
              }}
            >
              Start Analysis & Processing
            </button>
          </>
        ) : (
          /* Live Progress Stepper */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 0' }}>
            {stages.map((stage, idx) => {
              const isPast = activeIdx > idx;
              const isCurrent = activeIdx === idx;

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
          </div>
        )}
      </div>
    </div>
  );
};
