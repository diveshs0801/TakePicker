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
  Pause,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Check,
  ExternalLink,
  Volume2,
  Scissors,
  Eye,
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

  // Branch swimlanes definition
  const branches = [
    {
      id: 'b_main',
      name: 'main',
      title: 'Master Broadcast Cut (Delivery)',
      author: 'Lead Director',
      color: '#10b981',
      lane: 0,
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
      color: '#6366f1',
      lane: 1,
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
      lane: 2,
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
      lane: 3,
      commitsCount: 12,
      lastUpdated: '1h ago',
      isCurrent: currentBranch === 'agent/auto-tighten',
      description: 'Automated 4-layer verification cleanup pass. Raised-cosine 15ms microfades, frame-grid snapping, zero acoustic syllable clipping.',
    },
  ];

  // DAG Revisions mapped to branch lanes for true SVG graph rendering
  // Row height is exactly 78px
  const ROW_HEIGHT = 78;
  const LANE_X = [22, 56, 90, 124]; // X coordinates for Lane 0, 1, 2, 3

  const revisionsGraph = [
    {
      id: 'rev_9a41',
      branch: 'main',
      lane: 0,
      hash: 'sha256:9a41...c8',
      author: 'Lead Director',
      authorBadge: 'Director',
      message: 'Master timeline broadcast baseline (TakePicker v2 ingest)',
      time: '10m ago',
      stats: { added: 181, deleted: 0, modified: 0 },
      isMergeCommit: false,
      parentIds: [],
      opsSummary: [
        { type: 'INSERT_CLIP', track: 'V1', count: 181, desc: 'Initial ingest sequence assembled' },
      ],
    },
    {
      id: 'rev_426b',
      branch: 'alex/sound-design',
      lane: 2,
      hash: 'sha256:426b...f1',
      author: 'Alex (Sound)',
      authorBadge: 'Audio Engineer',
      message: 'Level dialogue loudness (-23 LUFS) & add riser SFX on Track A2',
      time: '18m ago',
      stats: { added: 4, deleted: 0, modified: 3 },
      isMergeCommit: false,
      parentIds: ['rev_9a41'],
      forkFromLane: 0,
      opsSummary: [
        { type: 'ADJUST_VOLUME', track: 'A1', count: 3, desc: 'EBU R128 integrated loudness normalization' },
        { type: 'INSERT_CLIP', track: 'A2', count: 4, desc: 'Ambient atmospheric riser sound effects' },
      ],
    },
    {
      id: 'rev_26ab',
      branch: 'sarah/pacing',
      lane: 1,
      hash: 'sha256:26ab...e3',
      author: 'Sarah (Lead)',
      authorBadge: 'Narrative Editor',
      message: 'Trim 1.2s pause in Scene 2 hook & snap boundary to 24fps grid',
      time: '35m ago',
      stats: { added: 0, deleted: 4, modified: 12 },
      isMergeCommit: false,
      parentIds: ['rev_9a41'],
      forkFromLane: 0,
      opsSummary: [
        { type: 'TRIM_CLIP', track: 'V1', count: 12, desc: 'Sub-frame precision tight trim on Scene 2' },
        { type: 'DELETE_INTERVAL', track: 'V1', count: 4, desc: 'Pruned dead air pauses (> 0.6s)' },
      ],
    },
    {
      id: 'rev_11e0',
      branch: 'agent/auto-tighten',
      lane: 3,
      hash: 'sha256:11e0...02',
      author: 'TakePicker AI Agent',
      authorBadge: 'Autonomous Agent',
      message: 'Auto-prune 4 dead air intervals + inject 15ms raised-cosine microfades',
      time: '1h ago',
      stats: { added: 0, deleted: 8, modified: 18 },
      isMergeCommit: true,
      mergeTargetLane: 0,
      parentIds: ['rev_9a41', 'rev_26ab'],
      opsSummary: [
        { type: 'DELETE_INTERVAL', track: 'V1', count: 8, desc: 'Pruned speech pauses & filler stutter' },
        { type: 'APPLY_MICROFADE', track: 'A1', count: 18, desc: '15ms raised-cosine boundary crossfades' },
      ],
    },
  ];

  const selectedRev = revisionsGraph.find((r) => r.id === selectedRevisionId) || revisionsGraph[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 50px)',
        backgroundColor: '#070912',
        color: '#f1f5f9',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Workspace Subheader */}
      <div
        style={{
          height: '46px',
          padding: '0 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          backgroundColor: '#090c16',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitBranch size={16} color="#c084fc" />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
              Version Control & Revision Graph
            </span>
          </div>

          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.35)',
            }}
          >
            ACTIVE: 🌿 {currentBranch}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onOpenMergeModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 13px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              color: '#f3e8ff',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <GitMerge size={14} color="#c084fc" />
            <span>3-Way Timeline Merge</span>
          </button>

          <button
            type="button"
            onClick={onBackToStudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={13} />
            <span>Return to Studio NLE</span>
          </button>
        </div>
      </div>

      {/* 3-Column Studio Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 450px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* COLUMN 1: Branches & Cuts Panel (Left) */}
        <div
          style={{
            borderRight: '1px solid rgba(255, 255, 255, 0.07)',
            backgroundColor: '#070912',
            padding: '14px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              Project Cuts & Branches
            </span>
            <span style={{ fontSize: '0.64rem', color: '#a5b4fc', fontWeight: 700 }}>
              {branches.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {branches.map((b) => (
              <div
                key={b.id}
                onClick={() => onBranchChange(b.name)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: b.isCurrent ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: b.color,
                        boxShadow: `0 0 6px ${b.color}`,
                      }}
                    />
                    <span style={{ fontSize: '0.80rem', fontWeight: 700, color: b.isCurrent ? '#ffffff' : '#cbd5e1' }}>
                      🌿 {b.name}
                    </span>
                  </div>

                  {b.isCurrent ? (
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      CHECKED OUT
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
                      {b.lastUpdated}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {b.title}
                </div>

                <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  {b.description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '5px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    fontSize: '0.64rem',
                    color: '#64748b',
                  }}
                >
                  <span>Author: <strong style={{ color: '#cbd5e1' }}>{b.author}</strong></span>
                  <span>{b.commitsCount} revisions</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: Interactive Revision DAG Visual Graph (True SVG DAG + Perfectly Aligned Rows) */}
        <div
          style={{
            backgroundColor: '#080a14',
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.90rem', fontWeight: 800, color: '#ffffff' }}>
                Timeline Revision History DAG
              </h3>
              <p style={{ margin: 0, fontSize: '0.70rem', color: '#94a3b8', marginTop: '2px' }}>
                Immutable Content-Addressable Storage (CAS) snapshots with delta patches
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.68rem', color: '#64748b' }}>
              <span>Swimlanes:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Master
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1' }} /> Sarah
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#a855f7' }} /> Alex
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> AI Copilot
              </span>
            </div>
          </div>

          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 100px 1fr 180px 100px',
              padding: '6px 12px',
              fontSize: '0.66rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#64748b',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              letterSpacing: '0.04em',
            }}
          >
            <span>DAG Branch Graph</span>
            <span>Revision</span>
            <span>Commit Message & Author</span>
            <span>Diff Summary</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {/* DAG Container with Synchronized SVG Canvas */}
          <div style={{ position: 'relative', width: '100%' }}>
            {/* SVG Tracks Canvas Layer (width: 150px, height: revisions * ROW_HEIGHT) */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '150px',
                height: `${revisionsGraph.length * ROW_HEIGHT}px`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {/* Continuous vertical branch track lines */}
              {LANE_X.map((x, laneIdx) => (
                <line
                  key={`track-${laneIdx}`}
                  x1={x}
                  y1={20}
                  x2={x}
                  y2={revisionsGraph.length * ROW_HEIGHT - 20}
                  stroke={laneIdx === 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.12)'}
                  strokeWidth={laneIdx === 0 ? 2 : 1.5}
                  strokeDasharray={laneIdx === 0 ? 'none' : '3 3'}
                />
              ))}

              {/* Branch connecting bezier curves (Forks and Merges) */}
              {/* Fork 1: Main (rev_9a41) -> Alex (rev_426b) */}
              <path
                d={`M ${LANE_X[0]} ${0 * ROW_HEIGHT + 39} C ${LANE_X[0]} ${0 * ROW_HEIGHT + 60}, ${LANE_X[2]} ${1 * ROW_HEIGHT + 18}, ${LANE_X[2]} ${1 * ROW_HEIGHT + 39}`}
                fill="none"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="4 2"
              />

              {/* Fork 2: Main (rev_9a41) -> Sarah (rev_26ab) */}
              <path
                d={`M ${LANE_X[0]} ${0 * ROW_HEIGHT + 39} C ${LANE_X[0]} ${1 * ROW_HEIGHT + 20}, ${LANE_X[1]} ${1 * ROW_HEIGHT + 60}, ${LANE_X[1]} ${2 * ROW_HEIGHT + 39}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
              />

              {/* Merge: Sarah & Agent converging to Main */}
              <path
                d={`M ${LANE_X[3]} ${3 * ROW_HEIGHT + 39} C ${LANE_X[3]} ${3 * ROW_HEIGHT + 20}, ${LANE_X[0]} ${3 * ROW_HEIGHT + 20}, ${LANE_X[0]} ${3 * ROW_HEIGHT + 39}`}
                fill="none"
                stroke="#10b981"
                strokeWidth={2}
              />

              {/* Commit Nodes along the SVG tracks */}
              {revisionsGraph.map((rev, idx) => {
                const cx = LANE_X[rev.lane];
                const cy = idx * ROW_HEIGHT + 39;
                const isSelected = selectedRevisionId === rev.id;
                const color =
                  rev.branch === 'main'
                    ? '#10b981'
                    : rev.branch === 'sarah/pacing'
                    ? '#6366f1'
                    : rev.branch === 'alex/sound-design'
                    ? '#a855f7'
                    : '#f59e0b';

                return (
                  <g key={`node-${rev.id}`}>
                    {/* Pulsing ring on selected node */}
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={2} opacity={0.6}>
                        <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Commit Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={color}
                      stroke="#080a14"
                      strokeWidth={2}
                    />

                    {/* Special center dot for merge commit */}
                    {rev.isMergeCommit && (
                      <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Synchronized Row List Aligned with SVG Nodes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, zIndex: 2, position: 'relative' }}>
              {revisionsGraph.map((rev, idx) => {
                const isSelected = selectedRevisionId === rev.id;
                const branchColor =
                  rev.branch === 'main'
                    ? '#10b981'
                    : rev.branch === 'sarah/pacing'
                    ? '#6366f1'
                    : rev.branch === 'alex/sound-design'
                    ? '#a855f7'
                    : '#f59e0b';

                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedRevisionId(rev.id)}
                    style={{
                      height: `${ROW_HEIGHT}px`,
                      display: 'grid',
                      gridTemplateColumns: '150px 100px 1fr 180px 100px',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      border: isSelected ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Col 1: Empty space reserved for SVG Tracks */}
                    <div style={{ height: '100%' }} />

                    {/* Col 2: Hash pill & Branch */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontFamily: 'monospace',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#a5b4fc',
                          width: 'fit-content',
                        }}
                      >
                        {rev.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: branchColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rev.branch}
                      </span>
                    </div>

                    {/* Col 3: Message & Author */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                          {rev.message}
                        </span>
                        {rev.isMergeCommit && (
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            3-WAY MERGE
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.66rem', color: '#64748b' }}>
                        <span>Author: <strong style={{ color: '#cbd5e1' }}>{rev.author}</strong></span>
                        <span>•</span>
                        <span>{rev.time}</span>
                      </div>
                    </div>

                    {/* Col 4: Diff Summary Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {rev.stats.added > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.12)', padding: '1px 5px', borderRadius: '3px' }}>
                          +{rev.stats.added} clips
                        </span>
                      )}
                      {rev.stats.deleted > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', padding: '1px 5px', borderRadius: '3px' }}>
                          -{rev.stats.deleted} silences
                        </span>
                      )}
                      {rev.stats.modified > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#818cf8', background: 'rgba(99, 102, 241, 0.12)', padding: '1px 5px', borderRadius: '3px' }}>
                          {rev.stats.modified} trims
                        </span>
                      )}
                    </div>

                    {/* Col 5: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBranchChange(rev.branch);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: '#e2e8f0',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Checkout
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 3: Visual Timeline Diff & A/B Video Player (Editor-First) */}
        <div
          style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
            backgroundColor: '#070912',
            padding: '14px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.07)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Visual Revision Inspector
              </span>
              <span style={{ fontSize: '0.66rem', fontFamily: 'monospace', color: '#a5b4fc' }}>
                {selectedRev.hash}
              </span>
            </div>
            <h4 style={{ margin: '6px 0 0 0', fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
              {selectedRev.message}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.68rem', color: '#94a3b8' }}>
              <span>Author: <strong style={{ color: '#ffffff' }}>{selectedRev.author}</strong></span>
              <span>•</span>
              <span style={{ color: '#c084fc', fontWeight: 700 }}>🌿 {selectedRev.branch}</span>
              <span>•</span>
              <span>{selectedRev.time}</span>
            </div>
          </div>

          {/* 🎬 1. INTERACTIVE A/B VIDEO PLAYER (BEFORE VS AFTER) */}
          <div
            style={{
              borderRadius: '8px',
              backgroundColor: '#03050c',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Player Viewport */}
            <div
              style={{
                height: '160px',
                backgroundColor: '#000000',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Simulated Canvas / Frame */}
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

              {/* Scanline or waveform graphic */}
              <div style={{ zIndex: 2, textAlign: 'center', padding: '10px' }}>
                <Film size={26} color={auditionMode === 'before' ? '#818cf8' : '#34d399'} style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ffffff' }}>
                  {auditionMode === 'before' && '⏪ A: PRE-EDIT BASELINE CUT'}
                  {auditionMode === 'after' && '⏩ B: REVISED MASTER CUT (COMMITTED)'}
                  {auditionMode === 'split' && '🔀 A/B SPLIT SCREEN COMPARISON'}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '3px' }}>
                  Timecode: <code style={{ color: '#38bdf8' }}>00:01:14:08</code> • 24.000 fps
                </div>
              </div>

              {/* Split screen divider line */}
              {auditionMode === 'split' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    backgroundColor: '#fbbf24',
                    zIndex: 3,
                    boxShadow: '0 0 8px #fbbf24',
                  }}
                />
              )}

              {/* Status Badge Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  zIndex: 4,
                  fontSize: '0.60rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor:
                    auditionMode === 'before'
                      ? 'rgba(239, 68, 68, 0.85)'
                      : auditionMode === 'after'
                      ? 'rgba(16, 185, 129, 0.85)'
                      : 'rgba(245, 158, 11, 0.85)',
                  color: '#ffffff',
                }}
              >
                {auditionMode === 'before' ? 'UNCUT (1.2s Dead Air)' : auditionMode === 'after' ? 'TIGHTENED & LEVELED' : 'A/B COMPARISON'}
              </div>
            </div>

            {/* Video Player Scrubber & Controls */}
            <div style={{ padding: '8px 12px', backgroundColor: '#0c1020', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
              {/* Scrubber bar */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  marginBottom: '8px',
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
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: `${playbackProgress}%`,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>

              {/* Control Buttons & A/B Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    <span>{isPlaying ? 'Pause' : 'Play Cut'}</span>
                  </button>
                </div>

                {/* A / B Audition Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAuditionMode('before')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      background: auditionMode === 'before' ? '#ef4444' : 'transparent',
                      color: auditionMode === 'before' ? '#ffffff' : '#94a3b8',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    A: Before
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditionMode('after')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      background: auditionMode === 'after' ? '#10b981' : 'transparent',
                      color: auditionMode === 'after' ? '#ffffff' : '#94a3b8',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    B: After
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditionMode('split')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      background: auditionMode === 'split' ? '#f59e0b' : 'transparent',
                      color: auditionMode === 'split' ? '#000000' : '#94a3b8',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Split
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 🎞️ 2. VISUAL TIMELINE DIFF (COLOR-CODED MULTI-TRACK) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Visual Timeline Diff
              </span>
              <span style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>
                Comparing <strong style={{ color: '#ef4444' }}>Before</strong> vs <strong style={{ color: '#10b981' }}>After</strong>
              </span>
            </div>

            {/* Visual Timeline Track Canvas */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* Track V2 (Overlays / B-Roll) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '28px', fontSize: '0.62rem', fontWeight: 800, color: '#818cf8', flexShrink: 0 }}>V2</span>
                <div style={{ flex: 1, height: '26px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  {selectedRev.id === 'rev_426b' || selectedRev.id === 'rev_11e0' ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: '25%',
                        width: '45%',
                        height: '100%',
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
                      <span>✨ +3.0s B-Roll Cutaway (silicon_arch_reel)</span>
                    </div>
                  ) : (
                    <span style={{ paddingLeft: '8px', fontSize: '0.60rem', color: '#475569', fontStyle: 'italic' }}>No overlay clips</span>
                  )}
                </div>
              </div>

              {/* Track V1 (Primary Dialogue Track) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '28px', fontSize: '0.62rem', fontWeight: 800, color: '#c084fc', flexShrink: 0 }}>V1</span>
                <div style={{ flex: 1, height: '32px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 2px' }}>
                  {/* Clip 1: Unchanged baseline */}
                  <div
                    style={{
                      width: '28%',
                      height: '24px',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.60rem',
                      color: '#c7d2fe',
                      fontWeight: 600,
                    }}
                  >
                    Intro (5.0s)
                  </div>

                  {/* Clip 2: Trimmed Dialogue with Deleted Red Ghost Section */}
                  <div
                    style={{
                      width: '42%',
                      height: '24px',
                      marginLeft: '3px',
                      backgroundColor: 'rgba(245, 158, 11, 0.22)',
                      border: '1px solid #f59e0b',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.60rem',
                      color: '#fde68a',
                      fontWeight: 700,
                    }}
                  >
                    Scene 2 (Tightened 7.5s)
                  </div>

                  {/* Red Ghost Box: The 1.2s Dead Air Silence that was CUT! */}
                  <div
                    style={{
                      width: '16%',
                      height: '24px',
                      marginLeft: '2px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px dashed #ef4444',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.58rem',
                      color: '#fca5a5',
                      fontWeight: 800,
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.15) 4px, transparent 4px, transparent 8px)',
                    }}
                  >
                    <Scissors size={10} color="#f87171" style={{ marginRight: '2px' }} />
                    <span>-1.2s CUT</span>
                  </div>

                  {/* Clip 3: Unchanged baseline */}
                  <div
                    style={{
                      flex: 1,
                      height: '24px',
                      marginLeft: '3px',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.60rem',
                      color: '#c7d2fe',
                      fontWeight: 600,
                    }}
                  >
                    Climax (8.0s)
                  </div>
                </div>
              </div>

              {/* Track A1 (Audio Stems & Leveling) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '28px', fontSize: '0.62rem', fontWeight: 800, color: '#34d399', flexShrink: 0 }}>A1</span>
                <div style={{ flex: 1, height: '24px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 2px' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '18px',
                      backgroundColor: selectedRev.id === 'rev_426b' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                      border: selectedRev.id === 'rev_426b' ? '1px solid #a855f7' : '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 8px',
                      fontSize: '0.58rem',
                      color: selectedRev.id === 'rev_426b' ? '#e9d5ff' : '#a7f3d0',
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Volume2 size={11} />
                      <span>{selectedRev.id === 'rev_426b' ? 'Leveled: -23.0 LUFS (+3.2dB dialogue boost)' : 'Dialogue Track Audio (EBU R128 Compliant)'}</span>
                    </div>
                    <span>15ms Microfade Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Diff Color Legend (Editor Guide) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', fontSize: '0.60rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#10b981' }} />
                <span style={{ color: '#a7f3d0' }}>Green: Added Content</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
                <span style={{ color: '#fca5a5' }}>Red: Cut / Deleted</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
                <span style={{ color: '#fde68a' }}>Amber: Trimmed Boundary</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: '#a855f7' }} />
                <span style={{ color: '#e9d5ff' }}>Purple: Audio/Color</span>
              </div>
            </div>
          </div>

          {/* 🔀 3. COLLABORATIVE 3-WAY MERGE BREAKDOWN (IF MERGE COMMIT) */}
          {selectedRev.isMergeCommit && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitMerge size={14} color="#818cf8" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff' }}>
                  Collaborative 3-Way Merge Attribution
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                <div style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <div style={{ fontSize: '0.60rem', color: '#a5b4fc', fontWeight: 700 }}>🔵 Sarah Pacing Cuts</div>
                  <div style={{ fontSize: '0.70rem', color: '#ffffff', fontWeight: 800 }}>12 Trims Auto-Merged</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: '5px', backgroundColor: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ fontSize: '0.60rem', color: '#d8b4fe', fontWeight: 700 }}>🟣 Alex Sound Stems</div>
                  <div style={{ fontSize: '0.70rem', color: '#ffffff', fontWeight: 800 }}>4 SFX Tracks Merged</div>
                </div>
              </div>
              <div style={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.3, marginTop: '2px' }}>
                Non-destructive merge: Scene 2 boundary collision resolved via stacked <strong>Audition Lanes (Tracks V1 / V2)</strong> with zero playback breakage.
              </div>
            </div>
          )}

          {/* Bottom Action CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
            <button
              type="button"
              onClick={() => onBranchChange(selectedRev.branch)}
              style={{
                padding: '9px 12px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
              }}
            >
              <span>Switch Timeline to 🌿 {selectedRev.branch}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
