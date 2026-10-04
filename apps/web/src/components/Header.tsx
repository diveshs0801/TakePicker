'use client';

import React from 'react';
import Link from 'next/link';
import {
  Film,
  FolderKanban,
  SlidersHorizontal,
  BookOpen,
  Play,
  UploadCloud,
  Zap,
  Sparkles,
  Layers,
  Activity
} from 'lucide-react';
import type { Asset } from '../../../../packages/contracts';

interface HeaderProps {
  currentAsset: Asset | null;
  currentView: 'studio' | 'hub';
  onViewChange: (view: 'studio' | 'hub') => void;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  onLoadDemoAsset: () => void;
  isReadyToExport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentAsset,
  currentView,
  onViewChange,
  onOpenUpload,
  onOpenExport,
  onLoadDemoAsset,
  isReadyToExport,
}) => {
  return (
    <header className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'rgba(10, 13, 20, 0.92)',
    }}>
      {/* 1. Left: Brand & Studio Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.45)',
          }}>
            <Film size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>TakePicker</span>
              <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                NLE Studio v2.0
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher: Studio vs Project Hub */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            type="button"
            onClick={() => onViewChange('studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: currentView === 'studio' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: currentView === 'studio' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <SlidersHorizontal size={14} color={currentView === 'studio' ? '#818cf8' : 'currentColor'} />
            <span>Studio Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('hub')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: currentView === 'hub' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: currentView === 'hub' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FolderKanban size={14} color={currentView === 'hub' ? '#818cf8' : 'currentColor'} />
            <span>Projects & Hub</span>
          </button>
        </div>
      </div>

      {/* 2. Middle: Active Project Pill */}
      {currentAsset && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: '0.82rem',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentAsset.filename}
          </span>
          {currentAsset.duration && (
            <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {Math.floor(currentAsset.duration)}s @ {currentAsset.fps || 30}fps
            </span>
          )}
          <span className={`badge ${currentAsset.status === 'READY' ? 'badge-green' : 'badge-amber'}`}>
            {currentAsset.status}
          </span>
        </div>
      )}

      {/* 3. Right: Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link
          href="/guide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            color: '#a5b4fc',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <BookOpen size={15} color="#818cf8" />
          <span>System Guide</span>
        </Link>

        <button
          type="button"
          onClick={onLoadDemoAsset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#86efac',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Play size={14} fill="#86efac" />
          <span>Demo Video</span>
        </button>

        <button
          type="button"
          onClick={onOpenUpload}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.84rem' }}
        >
          <UploadCloud size={16} />
          <span>Upload Footage</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          disabled={!isReadyToExport}
          className="btn-primary"
          style={{
            padding: '8px 18px',
            fontSize: '0.84rem',
            opacity: isReadyToExport ? 1 : 0.4,
            cursor: isReadyToExport ? 'pointer' : 'not-allowed',
          }}
        >
          <Zap size={15} />
          <span>Export Clean Cut</span>
        </button>
      </div>
    </header>
  );
};
