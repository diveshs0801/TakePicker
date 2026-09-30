'use client';

import React from 'react';
import { UploadCloud, Film, PlayCircle, Zap, Cpu } from 'lucide-react';
import type { Asset } from '../../../../packages/contracts';

interface HeaderProps {
  currentAsset: Asset | null;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  isReadyToExport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentAsset,
  onOpenUpload,
  onOpenExport,
  isReadyToExport,
}) => {
  return (
    <header className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 28px',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
        }}>
          <Film size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>TakePicker</h1>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}>
              Parallel Cut Engine
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            AI retake detection & fan-out FFmpeg export
          </p>
        </div>
      </div>

      {/* Middle: Asset info */}
      {currentAsset && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: '0.82rem',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentAsset.filename}
          </span>
          {currentAsset.duration && (
            <span style={{ color: 'var(--text-muted)' }}>
              {Math.floor(currentAsset.duration)}s @ {currentAsset.fps || 30}fps
            </span>
          )}
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: currentAsset.status === 'READY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: currentAsset.status === 'READY' ? 'var(--success)' : 'var(--warning)',
            fontWeight: 600,
          }}>
            {currentAsset.status}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onOpenUpload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontSize: '0.88rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          <UploadCloud size={17} />
          Upload Footage
        </button>

        <button
          onClick={onOpenExport}
          disabled={!isReadyToExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: 'var(--radius-md)',
            background: isReadyToExport ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: isReadyToExport ? '#ffffff' : 'var(--text-dim)',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: isReadyToExport ? 'pointer' : 'not-allowed',
            boxShadow: isReadyToExport ? '0 4px 18px rgba(99, 102, 241, 0.35)' : 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (isReadyToExport) {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (isReadyToExport) {
              e.currentTarget.style.filter = 'brightness(1.0)';
            }
          }}
        >
          <Zap size={17} />
          <span>Export Clean Cut</span>
          <span style={{
            fontSize: '0.7rem',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '1px 6px',
            borderRadius: '12px',
          }}>
            Fan-Out
          </span>
        </button>
      </div>
    </header>
  );
};
