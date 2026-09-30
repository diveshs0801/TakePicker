'use client';

import React from 'react';
import type { TakeGroup, TakeSegment } from '../../../../packages/contracts';
import { CheckCircle2, Circle, Play, AlertCircle, Sparkles, MessageSquare } from 'lucide-react';

interface RetakeInspectorProps {
  groups: TakeGroup[];
  onSelectTake: (groupId: string, segmentId: string | number) => void;
  onPreviewTake: (startTime: number) => void;
  currentTime: number;
}

export const RetakeInspector: React.FC<RetakeInspectorProps> = ({
  groups,
  onSelectTake,
  onPreviewTake,
  currentTime,
}) => {
  if (!groups || groups.length === 0) {
    return (
      <div className="glass" style={{
        padding: '32px 20px',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        color: 'var(--text-dim)',
      }}>
        <MessageSquare size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
        <p style={{ fontSize: '0.95rem' }}>No speech segments analyzed yet.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
          Upload a talking-head video to detect retakes automatically.
        </p>
      </div>
    );
  }

  const retakeCount = groups.filter((g) => g.isRetake).length;

  return (
    <div className="glass" style={{
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: 'calc(100vh - 120px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#818cf8" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Retake Analysis & Selection</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--warning)',
            fontWeight: 600,
          }}>
            {retakeCount} retakes detected
          </span>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '20px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#818cf8',
            fontWeight: 600,
          }}>
            {groups.length} total blocks
          </span>
        </div>
      </div>

      {/* Groups list */}
      <div style={{
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {groups.map((group, groupIdx) => {
          const isMultiTake = group.isRetake && group.takes.length > 1;

          return (
            <div
              key={group.id}
              className="glass glass-hover"
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: isMultiTake ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid var(--border-color)',
                transition: 'all 0.2s',
              }}
            >
              {/* Group label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#94a3b8',
                  }}>
                    Block {groupIdx + 1}
                  </span>
                  {isMultiTake ? (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--warning)',
                    }}>
                      {group.takes.length} attempts
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      padding: '1px 7px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-dim)',
                    }}>
                      Unique
                    </span>
                  )}
                </div>

                {group.overridden && (
                  <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600 }}>
                    Manual Pick
                  </span>
                )}
              </div>

              {/* Takes in this group */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.takes.map((take: TakeSegment, takeIdx: number) => {
                  const isChosen =
                    take.id === group.chosenSegmentId ||
                    take.idx === group.chosenSegmentId ||
                    (typeof group.chosenSegmentId === 'number' && take.idx === group.chosenSegmentId);

                  const isPlaying =
                    currentTime >= take.start && currentTime <= take.end;

                  const fillers = take.features?.fillers_detected ?? 0;
                  const score = take.score ?? 0;

                  return (
                    <div
                      key={take.id || take.idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isChosen
                          ? 'rgba(99, 102, 241, 0.12)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isChosen
                          ? '1px solid rgba(99, 102, 241, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.04)',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Top take row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                          }}
                          onClick={() => onSelectTake(group.id, take.id || take.idx)}
                        >
                          {isChosen ? (
                            <CheckCircle2 size={16} color="#818cf8" />
                          ) : (
                            <Circle size={16} color="var(--text-dim)" />
                          )}
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: isChosen ? 700 : 500,
                            color: isChosen ? '#ffffff' : 'var(--text-muted)',
                          }}>
                            Take {takeIdx + 1}
                          </span>
                          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {take.start.toFixed(2)}s – {take.end.toFixed(2)}s
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Score */}
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: score >= 0.75 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                            color: score >= 0.75 ? 'var(--success)' : 'var(--text-muted)',
                          }}>
                            {(score * 100).toFixed(0)}%
                          </span>

                          {/* Preview button */}
                          <button
                            onClick={() => onPreviewTake(take.start)}
                            title="Preview Take"
                            style={{
                              background: isPlaying ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                              border: 'none',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Play size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Take transcribed speech text */}
                      <p style={{
                        fontSize: '0.82rem',
                        lineHeight: '1.35',
                        color: isChosen ? '#f1f5f9' : '#94a3b8',
                        marginBottom: '8px',
                      }}>
                        "{take.text}"
                      </p>

                      {/* Feature pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: fillers === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: fillers === 0 ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {fillers === 0 ? '✓ No fillers' : `${fillers} filler${fillers > 1 ? 's' : ''}`}
                        </span>

                        {take.features?.wpm && (
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                          }}>
                            {take.features.wpm} WPM
                          </span>
                        )}

                        {take.features?.mean_confidence && (
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                          }}>
                            {Math.round(take.features.mean_confidence * 100)}% conf
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
