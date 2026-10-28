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
  Activity,
  ShieldCheck,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  GitMerge,
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
  qualityScore?: number | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  currentBranch?: string;
  onOpenMergeModal?: () => void;
  onBranchChange?: (branch: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentAsset,
  currentView,
  onViewChange,
  onOpenUpload,
  onOpenExport,
  onLoadDemoAsset,
  isReadyToExport,
  qualityScore = 100,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  currentBranch = 'main',
  onOpenMergeModal,
  onBranchChange,
}) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 20px',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: '#070912',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '52px',
      boxSizing: 'border-box',
    }}>
      {/* 1. Left: Brand & Studio Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
          }}>
            <Film size={18} color="#ffffff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              TakePicker
            </span>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.35)',
            }}>
              STUDIO PRO
            </span>
          </div>
        </div>

        {/* View Switcher: Studio Workspace vs Project Hub */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '2px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            type="button"
            onClick={() => onViewChange('studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '4px',
              border: 'none',
              background: currentView === 'studio' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
              color: currentView === 'studio' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={13} color={currentView === 'studio' ? '#818cf8' : 'currentColor'} />
            <span>Studio Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('hub')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '4px',
              border: 'none',
              background: currentView === 'hub' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
              color: currentView === 'hub' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FolderKanban size={13} color={currentView === 'hub' ? '#818cf8' : 'currentColor'} />
            <span>Projects Hub</span>
          </button>
        </div>

        {/* Quick Undo / Redo in Header */}
        {currentView === 'studio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo Last Action (Ctrl+Z)"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '4px 7px',
                color: canUndo ? 'var(--text-main)' : 'var(--text-dim)',
                cursor: canUndo ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.72rem',
              }}
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '4px 7px',
                color: canRedo ? 'var(--text-main)' : 'var(--text-dim)',
                cursor: canRedo ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.72rem',
              }}
            >
              <Redo2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 2. Middle: Active Project Pill & Quality Indicator */}
      {currentAsset && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem',
        }}>
          <span style={{
            fontWeight: 600,
            color: 'var(--text-main)',
            maxWidth: '220px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {currentAsset.filename}
          </span>

          {currentAsset.duration && (
            <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              {Math.floor(currentAsset.duration / 60)}:{String(Math.floor(currentAsset.duration % 60)).padStart(2, '0')} @ {currentAsset.fps || 30}fps
            </span>
          )}

          {/* Verification Quality Score Badge */}
          {qualityScore !== null && qualityScore !== undefined && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '999px',
              background: qualityScore >= 90
                ? 'rgba(16, 185, 129, 0.15)'
                : qualityScore >= 75
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              border: qualityScore >= 90
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : qualityScore >= 75
                ? '1px solid rgba(245, 158, 11, 0.35)'
                : '1px solid rgba(239, 68, 68, 0.35)',
              color: qualityScore >= 90
                ? '#6ee7b7'
                : qualityScore >= 75
                ? '#fcd34d'
                : '#fca5a5',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: qualityScore >= 90 ? '#10b981' : qualityScore >= 75 ? '#f59e0b' : '#ef4444',
                boxShadow: `0 0 6px ${qualityScore >= 90 ? '#10b981' : qualityScore >= 75 ? '#f59e0b' : '#ef4444'}`,
              }} />
              <span>{qualityScore}% Quality</span>
            </div>
          )}

          <span className={`badge ${currentAsset.status === 'READY' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
            {currentAsset.status}
          </span>
        </div>
      )}

      {/* Cardboard AI Problem #10: Version Control & Cut Selector */}
      {currentAsset && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.28)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 8px',
            fontSize: '0.74rem',
            color: '#c7d2fe',
          }}>
            <GitBranch size={13} color="#818cf8" />
            <select
              value={currentBranch}
              onChange={(e) => onBranchChange?.(e.target.value)}
              title="Switch Cut / Version Branch"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.74rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="main" style={{ background: '#0c0f1d' }}>🌿 main (Master Cut)</option>
              <option value="sarah/pacing" style={{ background: '#0c0f1d' }}>🌿 sarah/pacing (Lead Cut)</option>
              <option value="alex/sound-design" style={{ background: '#0c0f1d' }}>🌿 alex/sound-design (B-Roll Cut)</option>
              <option value="agent/auto-tighten" style={{ background: '#0c0f1d' }}>🌿 agent/auto-tighten (AI Pacing)</option>
            </select>
          </div>

          {onOpenMergeModal && (
            <button
              type="button"
              onClick={onOpenMergeModal}
              title="Cardboard AI Problem #10: 3-Way Timeline Merge & Audition Resolver"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#e0e7ff',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <GitMerge size={12} color="#c084fc" />
              <span>Review & Merge</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Right: Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          href="/guide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 11px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#a5b4fc',
            fontSize: '0.78rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <BookOpen size={13} color="#818cf8" />
          <span>Guide</span>
        </Link>

        <button
          type="button"
          onClick={onLoadDemoAsset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 11px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.28)',
            color: '#86efac',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Play size={12} fill="#86efac" />
          <span>Demo Video</span>
        </button>

        <button
          type="button"
          onClick={onOpenUpload}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          <UploadCloud size={14} />
          <span>Upload</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          disabled={!isReadyToExport}
          className="btn-primary"
          style={{
            padding: '6px 14px',
            fontSize: '0.78rem',
            opacity: isReadyToExport ? 1 : 0.4,
            cursor: isReadyToExport ? 'pointer' : 'not-allowed',
          }}
        >
          <Zap size={14} />
          <span>Export Clean Cut</span>
        </button>
      </div>
    </header>
  );
};
