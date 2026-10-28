'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  GitMerge,
  GitCommit,
  Clock,
  User,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Layers,
  Sparkles,
  Play,
  RotateCcw
} from 'lucide-react';
import type { TimelineBranch, TimelineRevision } from '../../../../packages/contracts';

interface VersionGraphWorkspaceProps {
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  onOpenMergeModal: () => void;
  onBackToStudio: () => void;
}

export const VersionGraphWorkspace: React.FC<VersionGraphWorkspaceProps> = ({
  currentBranch,
  onBranchChange,
  onOpenMergeModal,
  onBackToStudio,
}) => {
  const [selectedRevision, setSelectedRevision] = useState<string>('rev_426b');

  const branches = [
    {
      id: 'b_main',
      name: 'main',
      title: 'Master Broadcast Cut (Delivery)',
      author: 'Lead Director',
      color: '#10b981',
      commitsCount: 14,
      lastUpdated: '10m ago',
      isCurrent: currentBranch === 'main',
      description: 'Production broadcast master timeline. 181 clips, 748.3s duration, 100/100 Quality Score.',
    },
    {
      id: 'b_sarah',
      name: 'sarah/pacing',
      title: 'Sarah Pacing & Dialogue Cut',
      author: 'Sarah (Lead Editor)',
      color: '#3b82f6',
      commitsCount: 8,
      lastUpdated: '35m ago',
      isCurrent: currentBranch === 'sarah/pacing',
      description: 'Tightened speech pauses in Chapter 1 & 2. Cut 14 filler word retakes, reduced duration by 18.4s.',
    },
    {
      id: 'b_alex',
      name: 'alex/sound-design',
      title: 'Alex Audio Stem & B-Roll Overlays',
      author: 'Alex (Sound Designer)',
      color: '#a855f7',
      commitsCount: 6,
      lastUpdated: '18m ago',
      isCurrent: currentBranch === 'alex/sound-design',
      description: 'Leveled dialogue loudness (-23 LUFS EBU R128), added background ambience bed on Track A2, inserted 4 B-roll cutaways.',
    },
    {
      id: 'b_agent',
      name: 'agent/auto-tighten',
      title: 'AI Copilot Cleaned & Microfaded',
      author: 'TakePicker AI Agent',
      color: '#f59e0b',
      commitsCount: 12,
      lastUpdated: '1h ago',
      isCurrent: currentBranch === 'agent/auto-tighten',
      description: 'Automated 4-layer verification cleanup pass. Raised-cosine 15ms microfades, frame-grid snapping, zero acoustic syllable clipping.',
    },
  ];

  const revisionsGraph = [
    {
      id: 'rev_9a41',
      branch: 'main',
      hash: 'sha256:9a41...c8',
      author: 'Lead Director',
      authorBadge: 'Director',
      message: 'Master timeline broadcast baseline (TakePicker v2 ingest)',
      time: '10m ago',
      stats: { added: 181, deleted: 0, modified: 0 },
      isMergeCommit: false,
    },
    {
      id: 'rev_426b',
      branch: 'alex/sound-design',
      hash: 'sha256:426b...f1',
      author: 'Alex (Sound)',
      authorBadge: 'Audio Engineer',
      message: 'Level dialogue loudness (-23 LUFS) & add riser SFX on Track A2',
      time: '18m ago',
      stats: { added: 4, deleted: 0, modified: 3 },
      isMergeCommit: false,
    },
    {
      id: 'rev_26ab',
      branch: 'sarah/pacing',
      hash: 'sha256:26ab...e3',
      author: 'Sarah (Lead)',
      authorBadge: 'Narrative Editor',
      message: 'Trim 1.2s pause in Scene 2 hook & snap boundary to 24fps grid',
      time: '35m ago',
      stats: { added: 0, deleted: 4, modified: 12 },
      isMergeCommit: false,
    },
    {
      id: 'rev_11e0',
      branch: 'agent/auto-tighten',
      hash: 'sha256:11e0...02',
      author: 'TakePicker AI Copilot',
      authorBadge: 'Autonomous Agent',
      message: 'Auto-prune 4 dead air intervals + inject 15ms raised-cosine microfades',
      time: '1h ago',
      stats: { added: 0, deleted: 8, modified: 18 },
      isMergeCommit: true,
    },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 52px)',
      backgroundColor: '#05070e',
      color: 'var(--text-main)',
      overflow: 'hidden',
    }}>
      {/* Workspace Subheader */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: '#080b15',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.4)',
          }}>
            <GitBranch size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Timeline Version Control & Branches
              </h2>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#d8b4fe',
                border: '1px solid rgba(168, 85, 247, 0.4)',
              }}>
                Cardboard AI Problem #10: Git for Video
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Non-destructive collaborative branching, visual DAG revision history & 3-way merge
            </p>
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
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}
          >
            <GitMerge size={15} />
            <span>Review & 3-Way Merge</span>
          </button>

          <button
            type="button"
            onClick={onBackToStudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            <span>Return to Studio NLE</span>
          </button>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr 340px',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Col 1: Active Branches & Variations List */}
        <div style={{
          borderRight: '1px solid var(--border-color)',
          backgroundColor: '#070912',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
              Project Cuts & Branches
            </span>
            <span style={{ fontSize: '0.7rem', color: '#a5b4fc', fontWeight: 700 }}>
              {branches.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {branches.map((b) => (
              <div
                key={b.id}
                onClick={() => onBranchChange(b.name)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: b.isCurrent ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: b.color,
                      boxShadow: `0 0 8px ${b.color}`,
                    }} />
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: b.isCurrent ? '#ffffff' : '#cbd5e1' }}>
                      🌿 {b.name}
                    </span>
                  </div>

                  {b.isCurrent ? (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}>
                      CHECKED OUT
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {b.lastUpdated}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {b.title}
                </div>

                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {b.description}
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                }}>
                  <span>Author: <strong style={{ color: '#cbd5e1' }}>{b.author}</strong></span>
                  <span>{b.commitsCount} revisions</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2: Interactive Revision DAG Visual Graph */}
        <div style={{
          backgroundColor: '#090c16',
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                Timeline Revision History DAG
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immutable Content-Addressable Storage (CAS) snapshots with delta patches
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              <span>Legend:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Master
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Sarah
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }} /> Alex
              </span>
            </div>
          </div>

          {/* Visual Graph Nodes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            {revisionsGraph.map((rev, idx) => (
              <div
                key={rev.id}
                onClick={() => setSelectedRevision(rev.id)}
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: selectedRevision === rev.id ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: selectedRevision === rev.id ? '1px solid #6366f1' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Visual Branch Line Connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: rev.branch === 'main' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                    border: `2px solid ${rev.branch === 'main' ? '#10b981' : '#a855f7'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <GitCommit size={14} color={rev.branch === 'main' ? '#34d399' : '#c084fc'} />
                  </div>
                  {idx < revisionsGraph.length - 1 && (
                    <div style={{ width: '2px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>
                        {rev.message}
                      </span>
                      {rev.isMergeCommit && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                          3-WAY MERGE
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {rev.time}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Author: <strong style={{ color: '#e2e8f0' }}>{rev.author}</strong></span>
                    <span>•</span>
                    <span>Branch: <code style={{ color: '#a5b4fc' }}>{rev.branch}</code></span>
                    <span>•</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{rev.hash}</span>
                  </div>

                  {/* Diff Stats Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {rev.stats.added > 0 && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        +{rev.stats.added} clips
                      </span>
                    )}
                    {rev.stats.deleted > 0 && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        -{rev.stats.deleted} silences
                      </span>
                    )}
                    {rev.stats.modified > 0 && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {rev.stats.modified} trims & levels
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Selected Revision Inspector */}
        <div style={{
          borderLeft: '1px solid var(--border-color)',
          backgroundColor: '#070912',
          padding: '18px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <FileCode size={16} color="#818cf8" />
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>
              Revision Inspector
            </h4>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.75rem',
          }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Revision ID:</span>{' '}
              <code style={{ color: '#818cf8' }}>{selectedRevision}</code>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Branch:</span>{' '}
              <strong style={{ color: '#ffffff' }}>alex/sound-design</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Author:</span>{' '}
              <span>Alex (Sound Designer)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Verification Score:</span>{' '}
              <span style={{ color: '#34d399', fontWeight: 700 }}>100 / 100 (Clean)</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              Operations in this Revision
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
              • TRIM: Clip 104 in: 0.00s ➔ out: 8.80s (+1.3s audio tail)<br />
              • FIELD_EDIT: Clip 102 gain: 1.00 ➔ 1.35 (+3.2dB dialogue boost)<br />
              • INSERT: B-roll cutaway "silicon_arch_reel.mp4" on Track V2<br />
              • MICROFADE: 15ms raised-cosine fade applied to boundary
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMergeModal}
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            }}
          >
            <GitMerge size={14} />
            <span>3-Way Merge this Cut into Main</span>
          </button>
        </div>
      </div>
    </div>
  );
};
