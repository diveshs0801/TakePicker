'use client';

import React from 'react';
import Link from 'next/link';
import {
  Film,
  SlidersHorizontal,
  GitBranch,
  GitMerge,
  UploadCloud,
  Download,
  BookOpen,
  Undo2,
  Redo2,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  CheckCircle2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import type { Asset } from '../../../../packages/contracts';

interface HeaderProps {
  currentAsset: Asset | null;
  currentView: 'studio' | 'hub' | 'versions';
  onViewChange: (view: 'studio' | 'hub' | 'versions') => void;
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
  isLeftOpen?: boolean;
  onToggleLeft?: () => void;
  isRightOpen?: boolean;
  onToggleRight?: () => void;
  isTimelineOpen?: boolean;
  onToggleTimeline?: () => void;
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
  isLeftOpen = true,
  onToggleLeft,
  isRightOpen = true,
  onToggleRight,
  isTimelineOpen = true,
  onToggleTimeline,
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        backgroundColor: '#070912',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '50px',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* 1. LEFT ZONE: Brand Mark, Project Breadcrumb, Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '320px' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Film size={15} color="#ffffff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              TakePicker
            </span>
            <span
              style={{
                fontSize: '0.60rem',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                letterSpacing: '0.04em',
              }}
            >
              STUDIO
            </span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Project Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '200px',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#e2e8f0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentAsset?.filename || 'Cardboard AI Social Reel (30s Cut)'}
            >
              {currentAsset?.filename?.toLowerCase().includes('birthday')
                ? 'Cardboard AI Social Reel (30s)'
                : currentAsset?.filename
                ? currentAsset.filename.replace(/\.mp4$/i, '')
                : 'Cardboard AI Social Reel (30s)'}
            </span>
          </div>

          {/* Saved Status Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.65rem',
              color: '#10b981',
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.1)',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 5px #10b981',
              }}
            />
            <span>Saved</span>
          </div>
        </div>

        {/* Undo / Redo */}
        {currentView === 'studio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '2px' }}>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo Last Action (Ctrl+Z)"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: canUndo ? '#f1f5f9' : '#475569',
                cursor: canUndo ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo Action (Ctrl+Y)"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: canRedo ? '#f1f5f9' : '#475569',
                cursor: canRedo ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Redo2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 2. CENTER ZONE: Unified Segmented Workspace Pill (DaVinci Resolve / macOS Style) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '3px',
          borderRadius: '7px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5)',
        }}
      >
        <button
          type="button"
          onClick={() => onViewChange('studio')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 13px',
            borderRadius: '5px',
            border: 'none',
            background: currentView === 'studio' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
            color: currentView === 'studio' ? '#ffffff' : '#94a3b8',
            fontWeight: currentView === 'studio' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: currentView === 'studio' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          <SlidersHorizontal size={13} color={currentView === 'studio' ? '#818cf8' : 'currentColor'} />
          <span>Studio NLE</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('versions')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 13px',
            borderRadius: '5px',
            border: 'none',
            background: currentView === 'versions' ? 'rgba(168, 85, 247, 0.28)' : 'transparent',
            color: currentView === 'versions' ? '#ffffff' : '#94a3b8',
            fontWeight: currentView === 'versions' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: currentView === 'versions' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          <GitBranch size={13} color={currentView === 'versions' ? '#c084fc' : 'currentColor'} />
          <span>Version Graph (Git)</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('hub')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 13px',
            borderRadius: '5px',
            border: 'none',
            background: currentView === 'hub' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
            color: currentView === 'hub' ? '#ffffff' : '#94a3b8',
            fontWeight: currentView === 'hub' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: currentView === 'hub' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          <FolderKanban size={13} color={currentView === 'hub' ? '#818cf8' : 'currentColor'} />
          <span>Media Hub</span>
        </button>
      </div>

      {/* 3. RIGHT ZONE: Branch Selector, Quality Badge, Review/Merge, Action Buttons & Antigravity Panel Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Branch Selector Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(168, 85, 247, 0.10)',
            border: '1px solid rgba(168, 85, 247, 0.28)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '0.74rem',
            color: '#e9d5ff',
          }}
        >
          <GitBranch size={13} color="#c084fc" />
          <select
            value={currentBranch}
            onChange={(e) => onBranchChange?.(e.target.value)}
            title="Switch Timeline Cut / Version Branch"
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
            <option value="main" style={{ background: '#0b0e1b', color: '#ffffff' }}>
              🌿 main (Master)
            </option>
            <option value="sarah/pacing" style={{ background: '#0b0e1b', color: '#ffffff' }}>
              🌿 sarah/pacing
            </option>
            <option value="alex/sound-design" style={{ background: '#0b0e1b', color: '#ffffff' }}>
              🌿 alex/sound-design
            </option>
            <option value="agent/auto-tighten" style={{ background: '#0b0e1b', color: '#ffffff' }}>
              🌿 agent/auto-tighten
            </option>
          </select>
        </div>

        {/* Verification Quality Score Badge */}
        {qualityScore !== null && qualityScore !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '999px',
              background:
                qualityScore >= 90
                  ? 'rgba(16, 185, 129, 0.12)'
                  : qualityScore >= 75
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
              border:
                qualityScore >= 90
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : qualityScore >= 75
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
              color: qualityScore >= 90 ? '#34d399' : qualityScore >= 75 ? '#fbbf24' : '#f87171',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: qualityScore >= 90 ? '#10b981' : qualityScore >= 75 ? '#f59e0b' : '#ef4444',
                boxShadow: `0 0 6px ${qualityScore >= 90 ? '#10b981' : '#f59e0b'}`,
              }}
            />
            <span>{qualityScore}% Quality</span>
          </div>
        )}

        {/* Primary CTA: 3-Way Review & Merge */}
        <button
          type="button"
          onClick={onOpenMergeModal}
          title="Cardboard AI Problem #10: 3-Way Timeline Merge & Conflict Audition"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 11px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.28) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.45)',
            color: '#f3e8ff',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <GitMerge size={13} color="#c084fc" />
          <span>Review & Merge</span>
        </button>

        {/* Quick Upload CTA */}
        <button
          type="button"
          onClick={onOpenUpload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#e2e8f0',
            fontSize: '0.74rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <UploadCloud size={13} color="#94a3b8" />
          <span>Upload</span>
        </button>

        {/* Export CTA */}
        <button
          type="button"
          onClick={onOpenExport}
          disabled={!isReadyToExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: '6px',
            background: isReadyToExport ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            border: isReadyToExport ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
            color: isReadyToExport ? '#34d399' : '#475569',
            fontSize: '0.74rem',
            fontWeight: 600,
            cursor: isReadyToExport ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          <Download size={13} />
          <span>Export</span>
        </button>

        {/* Guide / Docs Link */}
        <Link
          href="/guide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 8px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
          title="Open Engineering Guide & System Specs"
        >
          <BookOpen size={13} />
          <span>Guide</span>
        </Link>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Antigravity / IDE Panel Layout Toggles */}
        {currentView === 'studio' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '2px',
            }}
          >
            {/* Toggle Left Sidebar */}
            <button
              type="button"
              onClick={onToggleLeft}
              title={isLeftOpen ? 'Close Left Sidebar (Media & Git Bins)' : 'Open Left Sidebar'}
              style={{
                width: '26px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: isLeftOpen ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: isLeftOpen ? '#818cf8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isLeftOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
            </button>

            {/* Toggle Bottom Timeline */}
            <button
              type="button"
              onClick={onToggleTimeline}
              title={isTimelineOpen ? 'Close Bottom Timeline' : 'Open Bottom Timeline'}
              style={{
                width: '26px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: isTimelineOpen ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: isTimelineOpen ? '#818cf8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isTimelineOpen ? <PanelBottomClose size={13} /> : <PanelBottomOpen size={13} />}
            </button>

            {/* Toggle Right Inspector Dock */}
            <button
              type="button"
              onClick={onToggleRight}
              title={isRightOpen ? 'Close Right Dock (AI Copilot & Retakes)' : 'Open Right Dock'}
              style={{
                width: '26px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: isRightOpen ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: isRightOpen ? '#818cf8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isRightOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
