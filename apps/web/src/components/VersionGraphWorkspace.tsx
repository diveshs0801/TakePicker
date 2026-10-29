'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  GitMerge,
  Play,
  Pause,
  SlidersHorizontal,
  Volume2,
  Scissors,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  Film,
} from 'lucide-react';

interface VersionGraphWorkspaceProps {
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  onOpenMergeModal: () => void;
  onBackToStudio: () => void;
}

export const VersionGraphWorkspace: React.FC<VersionGraphWorkspaceProps> = ({
  currentBranch = 'main',
  onBranchChange,
  onOpenMergeModal,
  onBackToStudio,
}) => {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>('rev_426b');
  const [auditionMode, setAuditionMode] = useState<'after' | 'before' | 'split'>('after');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(45);

  const branches = [
    {
      id: 'b_main',
      name: 'main',
      title: 'Master Cut',
      author: 'Lead Director',
      color: '#10b981',
      commitsCount: 14,
      lastUpdated: '10m ago',
    },
    {
      id: 'b_sarah',
      name: 'sarah/pacing',
      title: 'Dialogue & Pacing',
      author: 'Sarah (Editor)',
      color: '#6366f1',
      commitsCount: 8,
      lastUpdated: '35m ago',
    },
    {
      id: 'b_alex',
      name: 'alex/sound-design',
      title: 'Audio Stems & B-Roll',
      author: 'Alex (Sound)',
      color: '#a855f7',
      commitsCount: 6,
      lastUpdated: '18m ago',
    },
    {
      id: 'b_agent',
      name: 'agent/auto-tighten',
      title: 'AI Copilot Cut',
      author: 'TakePicker Agent',
      color: '#f59e0b',
      commitsCount: 12,
      lastUpdated: '1h ago',
    },
  ];

  const revisions = [
    {
      id: 'rev_9a41',
      branch: 'main',
      author: 'Lead Director',
      message: 'Master broadcast baseline (Initial ingest)',
      time: '10m ago',
      color: '#10b981',
      stats: { added: 181, deleted: 0, modified: 0 },
      isMerge: false,
      summary: 'Initial rough cut created with 181 clips across 24fps frame grid.',
      diff: {
        hasBroll: false,
        cutDuration: 0,
        audioBoost: 0,
      },
    },
    {
      id: 'rev_426b',
      branch: 'alex/sound-design',
      author: 'Alex (Sound)',
      message: 'Level dialogue loudness (-23 LUFS) & add riser SFX',
      time: '18m ago',
      color: '#a855f7',
      stats: { added: 4, deleted: 0, modified: 3 },
      isMerge: false,
      summary: 'Normalized dialogue to -23 LUFS (EBU R128), added 4 atmospheric riser sound effects on Track A2, and overlayed silicon architecture B-roll on Track V2.',
      diff: {
        hasBroll: true,
        brollLabel: '✨ +3.0s B-Roll Cutaway (silicon_arch_reel)',
        cutDuration: 0,
        audioBoost: 3.2,
      },
    },
    {
      id: 'rev_26ab',
      branch: 'sarah/pacing',
      author: 'Sarah (Lead Editor)',
      message: 'Trim 1.2s pause in Scene 2 hook & snap to 24fps',
      time: '35m ago',
      color: '#6366f1',
      stats: { added: 0, deleted: 4, modified: 12 },
      isMerge: false,
      summary: 'Pruned dead air pauses longer than 0.6s. Tightened Scene 2 speech from 8.7s to 7.5s, snapping cut boundaries to the frame grid.',
      diff: {
        hasBroll: false,
        cutDuration: 1.2,
        audioBoost: 0,
      },
    },
    {
      id: 'rev_11e0',
      branch: 'agent/auto-tighten',
      author: 'TakePicker AI Agent',
      message: 'Auto-prune 4 dead air intervals + 15ms microfades',
      time: '1h ago',
      color: '#f59e0b',
      stats: { added: 4, deleted: 8, modified: 18 },
      isMerge: true,
      summary: 'Collaborative 3-way merge: auto-combined Sarah’s pacing trims with Alex’s audio stems, resolving Scene 2 conflict non-destructively via Audition Lanes.',
      diff: {
        hasBroll: true,
        brollLabel: '✨ +3.0s B-Roll Cutaway',
        cutDuration: 1.2,
        audioBoost: 3.2,
      },
    },
  ];

  const selectedRev = revisions.find((r) => r.id === selectedRevisionId) || revisions[1];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 50px)',
        backgroundColor: '#090a10',
        color: '#f4f4f5',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 1. Sleek Minimalist Top Bar */}
      <div
        style={{
          height: '50px',
          padding: '0 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0d0f18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <GitBranch size={16} color="#c084fc" />
            </div>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
              Version History & Visual Diff
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.74rem',
              color: '#a1a1aa',
            }}
          >
            <span>Current Cut:</span>
            <strong style={{ color: '#10b981' }}>🌿 {currentBranch}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onOpenMergeModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              transition: 'opacity 0.15s ease',
            }}
          >
            <GitMerge size={14} />
            <span>3-Way Timeline Merge</span>
          </button>

          <button
            type="button"
            onClick={onBackToStudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '7px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e4e4e7',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Back to NLE</span>
          </button>
        </div>
      </div>

      {/* 2. Main 3-Column Studio Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr 440px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ================= COLUMN 1: CLEAN BRANCH LIST ================= */}
        <div
          style={{
            borderRight: '1px solid rgba(255, 255, 255, 0.07)',
            backgroundColor: '#0a0c14',
            padding: '16px 14px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.70rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', letterSpacing: '0.06em' }}>
            Timeline Branches ({branches.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {branches.map((b) => {
              const isCurrent = currentBranch === b.name;
              return (
                <div
                  key={b.id}
                  onClick={() => onBranchChange(b.name)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                    border: isCurrent ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: b.color,
                          boxShadow: `0 0 6px ${b.color}`,
                        }}
                      />
                      <span style={{ fontSize: '0.80rem', fontWeight: 700, color: isCurrent ? '#ffffff' : '#d4d4d8' }}>
                        {b.name}
                      </span>
                    </div>

                    {isCurrent && (
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: '#71717a' }}>
                    <span>{b.author}</span>
                    <span>{b.lastUpdated}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= COLUMN 2: REVISION TIMELINE ================= */}
        <div
          style={{
            backgroundColor: '#0c0e17',
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
              Cut History & Revisions
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#71717a' }}>
              Click any revision to see exactly what changed in the video and timeline.
            </p>
          </div>

          {/* Vertical Clean Timeline List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {revisions.map((rev) => {
              const isSelected = selectedRev.id === rev.id;

              return (
                <div
                  key={rev.id}
                  onClick={() => setSelectedRevisionId(rev.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.15)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Node indicator */}
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: rev.color,
                        boxShadow: `0 0 8px ${rev.color}`,
                        marginTop: '5px',
                        flexShrink: 0,
                      }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#e4e4e7' }}>
                          {rev.message}
                        </span>
                        {rev.isMerge && (
                          <span
                            style={{
                              fontSize: '0.60rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            3-WAY MERGE
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.70rem', color: '#71717a', marginTop: '4px' }}>
                        <span>By <strong style={{ color: '#d4d4d8' }}>{rev.author}</strong></span>
                        <span>•</span>
                        <span style={{ color: rev.color, fontWeight: 600 }}>🌿 {rev.branch}</span>
                        <span>•</span>
                        <span>{rev.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Diff Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {rev.stats.added > 0 && (
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                        +{rev.stats.added} clips
                      </span>
                    )}
                    {rev.stats.deleted > 0 && (
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                        -{rev.stats.deleted} cuts
                      </span>
                    )}
                    {rev.stats.modified > 0 && (
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                        {rev.stats.modified} trims
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= COLUMN 3: VISUAL DIFF & VIDEO AUDITION ================= */}
        <div
          style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
            backgroundColor: '#0a0c14',
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Header */}
          <div>
            <div style={{ fontSize: '0.70rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', letterSpacing: '0.06em' }}>
              Visual Diff Inspector
            </div>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
              {selectedRev.message}
            </h4>
            <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
              Author: <strong style={{ color: '#ffffff' }}>{selectedRev.author}</strong> on <span style={{ color: selectedRev.color, fontWeight: 700 }}>🌿 {selectedRev.branch}</span>
            </div>
          </div>

          {/* 1. Sleek Video Player with Before vs After Toggle */}
          <div
            style={{
              borderRadius: '10px',
              backgroundColor: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 16:9 Viewport */}
            <div
              style={{
                height: '170px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#04060d',
              }}
            >
              {/* Background gradient simulating video state */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    auditionMode === 'before'
                      ? 'radial-gradient(ellipse at center, #1e1b4b 0%, #000000 80%)'
                      : auditionMode === 'after'
                      ? 'radial-gradient(ellipse at center, #064e3b 0%, #000000 80%)'
                      : 'linear-gradient(90deg, #1e1b4b 0%, #1e1b4b 50%, #064e3b 50%, #064e3b 100%)',
                  opacity: 0.85,
                }}
              />

              {auditionMode === 'split' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    backgroundColor: '#fbbf24',
                    zIndex: 2,
                    boxShadow: '0 0 8px #fbbf24',
                  }}
                />
              )}

              <div style={{ zIndex: 3, textAlign: 'center' }}>
                <Film size={26} color={auditionMode === 'before' ? '#818cf8' : '#34d399'} style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff' }}>
                  {auditionMode === 'before' && 'A: BEFORE THIS EDIT'}
                  {auditionMode === 'after' && 'B: AFTER THIS EDIT (COMMITTED)'}
                  {auditionMode === 'split' && 'A/B SPLIT SCREEN AUDITION'}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: '2px' }}>
                  00:01:14:08 • 24.0 fps
                </div>
              </div>
            </div>

            {/* Video Player Controls & Toggle */}
            <div style={{ padding: '10px 12px', backgroundColor: '#0d101a', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {/* Scrubber */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  marginBottom: '10px',
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  setPlaybackProgress(p);
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${playbackProgress}%`,
                    backgroundColor: auditionMode === 'before' ? '#818cf8' : '#10b981',
                    borderRadius: '2px',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                  }}
                >
                  {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                {/* Clean A/B Pill Switcher */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAuditionMode('before')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: auditionMode === 'before' ? '#6366f1' : 'transparent',
                      color: auditionMode === 'before' ? '#ffffff' : '#71717a',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditionMode('after')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: auditionMode === 'after' ? '#10b981' : 'transparent',
                      color: auditionMode === 'after' ? '#ffffff' : '#71717a',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    After
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditionMode('split')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: auditionMode === 'split' ? '#f59e0b' : 'transparent',
                      color: auditionMode === 'split' ? '#000000' : '#71717a',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Split
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Visual Timeline Diff Track */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.70rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', letterSpacing: '0.06em' }}>
              Visual Timeline Delta
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Track V2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', fontSize: '0.64rem', fontWeight: 800, color: '#818cf8' }}>V2</span>
                <div style={{ flex: 1, height: '26px', backgroundColor: 'rgba(0, 0, 0, 0.35)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                  {selectedRev.diff.hasBroll ? (
                    <div
                      style={{
                        width: '70%',
                        height: '18px',
                        backgroundColor: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid #10b981',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        color: '#a7f3d0',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                      }}
                    >
                      <Sparkles size={11} color="#34d399" />
                      <span>{selectedRev.diff.brollLabel || '✨ Added B-Roll Cutaway'}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.60rem', color: '#52525b', fontStyle: 'italic' }}>No overlay changes</span>
                  )}
                </div>
              </div>

              {/* Track V1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', fontSize: '0.64rem', fontWeight: 800, color: '#c084fc' }}>V1</span>
                <div style={{ flex: 1, height: '30px', backgroundColor: 'rgba(0, 0, 0, 0.45)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 4px', gap: '3px' }}>
                  <div style={{ width: '28%', height: '20px', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.60rem', color: '#c7d2fe' }}>
                    Scene 1 (5.0s)
                  </div>

                  <div style={{ width: '38%', height: '20px', backgroundColor: 'rgba(245, 158, 11, 0.25)', border: '1px solid #f59e0b', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.60rem', color: '#fde68a', fontWeight: 700 }}>
                    Scene 2 (Tightened)
                  </div>

                  {selectedRev.diff.cutDuration > 0 && (
                    <div
                      style={{
                        width: '18%',
                        height: '20px',
                        backgroundColor: 'rgba(244, 63, 94, 0.2)',
                        border: '1px dashed #f43f5e',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.58rem',
                        color: '#fca5a5',
                        fontWeight: 800,
                      }}
                    >
                      <Scissors size={10} color="#f87171" style={{ marginRight: '2px' }} />
                      <span>-{selectedRev.diff.cutDuration}s CUT</span>
                    </div>
                  )}

                  <div style={{ flex: 1, height: '20px', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.60rem', color: '#c7d2fe' }}>
                    Scene 3
                  </div>
                </div>
              </div>

              {/* Track A1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', fontSize: '0.64rem', fontWeight: 800, color: '#34d399' }}>A1</span>
                <div style={{ flex: 1, height: '24px', backgroundColor: 'rgba(0, 0, 0, 0.35)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '16px',
                      backgroundColor: selectedRev.diff.audioBoost > 0 ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                      border: selectedRev.diff.audioBoost > 0 ? '1px solid #a855f7' : '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 6px',
                      fontSize: '0.58rem',
                      color: selectedRev.diff.audioBoost > 0 ? '#e9d5ff' : '#a7f3d0',
                      fontWeight: 700,
                    }}
                  >
                    <span>{selectedRev.diff.audioBoost > 0 ? 'Leveled to -23.0 LUFS (+3.2dB dialogue boost)' : 'Dialogue Track (Clean)'}</span>
                    <span>15ms microfades</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff Legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: '#a1a1aa', padding: '0 4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#10b981' }} /> Added
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#f43f5e' }} /> Cut/Deleted
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#f59e0b' }} /> Trimmed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#a855f7' }} /> Audio Level
              </span>
            </div>
          </div>

          {/* Plain English Summary */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.70rem',
              color: '#d4d4d8',
              lineHeight: 1.45,
            }}
          >
            {selectedRev.summary}
          </div>

          {/* Bottom Action CTA */}
          <button
            type="button"
            onClick={() => onBranchChange(selectedRev.branch)}
            style={{
              padding: '10px 14px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              marginTop: 'auto',
            }}
          >
            <span>Switch Timeline to 🌿 {selectedRev.branch}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
