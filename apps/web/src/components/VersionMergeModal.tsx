'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Volume2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Play,
  RotateCcw
} from 'lucide-react';
import type { TimelineConflict, ConflictResolutionStrategy } from '../../../../packages/contracts';

interface VersionMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBranch: string;
  targetBranch: string;
  onConfirmMerge: (strategy: ConflictResolutionStrategy) => void;
}

export const VersionMergeModal: React.FC<VersionMergeModalProps> = ({
  isOpen,
  onClose,
  sourceBranch,
  targetBranch,
  onConfirmMerge,
}) => {
  const [selectedAudition, setSelectedAudition] = useState<'ours' | 'theirs'>('ours');
  const [chosenStrategy, setChosenStrategy] = useState<ConflictResolutionStrategy>('SPLIT_AUDITION_LANES');
  const [isMerged, setIsMerged] = useState(false);

  if (!isOpen) return null;

  // Sample real-world conflict scenario (Cardboard AI Problem #10)
  const sampleConflict: TimelineConflict = {
    id: 'conflict_trim_scene2',
    type: 'TRIM_TRIM',
    clipId: 'clip_scene2_hook',
    description: `Contradictory boundary trims on "clip_scene2_hook": ${sourceBranch} [0.00s - 7.50s] vs ${targetBranch} [0.00s - 8.80s]`,
    conflictingField: 'in/out bounds',
    recommendedStrategy: 'SPLIT_AUDITION_LANES',
  };

  const handleMerge = () => {
    setIsMerged(true);
    setTimeout(() => {
      onConfirmMerge(chosenStrategy);
      setIsMerged(false);
      onClose();
    }, 900);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(3, 5, 12, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '780px',
        backgroundColor: '#0c0f1d',
        borderRadius: '14px',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75), 0 0 32px rgba(99, 102, 241, 0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
            }}>
              <GitMerge size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                  Review & Merge Timeline
                </h3>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                }}>
                  Problem #10: Version Control
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                3-Way non-blocking merge: combines orthogonal edits & resolves collisions non-destructively
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Branch Flow Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={16} color="#818cf8" />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#c7d2fe' }}>
                Source: <code style={{ color: '#ffffff' }}>{sourceBranch}</code>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Auto-combining</span>
              <ArrowRight size={14} color="#818cf8" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#34d399" />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#a7f3d0' }}>
                Target: <code style={{ color: '#ffffff' }}>{targetBranch}</code>
              </span>
            </div>
          </div>

          {/* Diff Summary Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>+4</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>B-Roll & Takes Added</div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>-2</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Silences Excised</div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#818cf8' }}>3</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Audio Gains Leveled</div>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>1</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Audition Collision</div>
            </div>
          </div>

          {/* Interactive Audition Resolution Section */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fbbf24' }}>
                  Collision in Scene 2: Boundary Trim Divergence
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Timecode: <code>00:01:14:08</code>
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              Both editors refined <strong>Scene 2 (Clip #104)</strong>. Sarah tightened dialogue pacing to <strong>7.5s</strong>, while Alex extended it to <strong>8.8s</strong> to fit the sound riser cue.
            </p>

            {/* Audition Lanes Toggle Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedAudition('ours')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: selectedAudition === 'ours' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: selectedAudition === 'ours' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd' }}>Sarah's Cut (Tight Hook)</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Duration: 7.50s (-1.3s pace)
                  </div>
                </div>
                <kbd style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.4)', color: '#93c5fd' }}>
                  Audition A
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAudition('theirs')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: selectedAudition === 'theirs' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: selectedAudition === 'theirs' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d8b4fe' }}>Alex's Cut (Audio Room)</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Duration: 8.80s (+SFX cue)
                  </div>
                </div>
                <kbd style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.4)', color: '#d8b4fe' }}>
                  Audition B
                </kbd>
              </button>
            </div>

            {/* Resolution Strategy Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setChosenStrategy('SPLIT_AUDITION_LANES')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: chosenStrategy === 'SPLIT_AUDITION_LANES' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: chosenStrategy === 'SPLIT_AUDITION_LANES' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: chosenStrategy === 'SPLIT_AUDITION_LANES' ? '#34d399' : 'var(--text-muted)',
                }}
              >
                <Layers size={13} />
                <span>Keep Both as Audition Lanes (Zero Data Loss)</span>
              </button>

              <button
                type="button"
                onClick={() => setChosenStrategy('KEEP_OURS')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: chosenStrategy === 'KEEP_OURS' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: chosenStrategy === 'KEEP_OURS' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: chosenStrategy === 'KEEP_OURS' ? '#93c5fd' : 'var(--text-muted)',
                }}
              >
                Keep Sarah's
              </button>

              <button
                type="button"
                onClick={() => setChosenStrategy('KEEP_THEIRS')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: chosenStrategy === 'KEEP_THEIRS' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: chosenStrategy === 'KEEP_THEIRS' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: chosenStrategy === 'KEEP_THEIRS' ? '#d8b4fe' : 'var(--text-muted)',
                }}
              >
                Keep Alex's
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.76rem', fontWeight: 600 }}>
            <CheckCircle2 size={15} />
            <span>Post-merge Quality Score predicted: 100/100 (Broadcast Clean)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleMerge}
              disabled={isMerged}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              }}
            >
              <GitMerge size={15} />
              <span>{isMerged ? 'Merging Timeline...' : 'Apply 3-Way Merge to Master Cut'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
