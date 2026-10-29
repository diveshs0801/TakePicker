'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  GitBranch,
  GitMerge,
  GitCommit,
  MoreHorizontal,
  Play,
  Pause,
  SlidersHorizontal,
  Volume2,
  Scissors,
  Sparkles,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  User,
  Film,
  ChevronDown,
  RefreshCw,
  Eye,
  Sliders,
  RotateCcw,
} from 'lucide-react';

interface VersionGraphWorkspaceProps {
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  onOpenMergeModal: () => void;
  onBackToStudio: () => void;
  activeProjectId?: string;
}

export const VersionGraphWorkspace: React.FC<VersionGraphWorkspaceProps> = ({
  currentBranch = 'main',
  onBranchChange,
  onOpenMergeModal,
  onBackToStudio,
  activeProjectId = 'project_cardboard',
}) => {
  const isCollabProject = activeProjectId === 'project_collab';
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    isCollabProject ? 'rev_p2_c6' : 'rev_11e0'
  );

  useEffect(() => {
    if (activeProjectId === 'project_collab') {
      setSelectedRevisionId('rev_p2_c6');
    } else {
      setSelectedRevisionId('rev_11e0');
    }
  }, [activeProjectId]);

  const [auditionMode, setAuditionMode] = useState<'after' | 'before' | 'split'>('after');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(18.0);
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [showBranchMenu, setShowBranchMenu] = useState<boolean>(false);
  const [commitMessageInput, setCommitMessageInput] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const beforeVideoRef = useRef<HTMLVideoElement | null>(null);

  const branches = isCollabProject
    ? [
        { id: 'b_main', name: 'main', title: 'Master Production Delivery', author: 'Team Master', color: '#10b981' },
        { id: 'b_sarah', name: 'sarah/first-half', title: 'First Half Hook & Pacing', author: 'Sarah (Editor 1)', color: '#6366f1' },
        { id: 'b_alex', name: 'alex/second-half', title: 'Second Half B-Roll & SFX', author: 'Alex (Editor 2)', color: '#a855f7' },
        { id: 'b_merge', name: 'agent/3way-merge', title: '3-Way AST Merge Master', author: 'TakePicker AI Copilot', color: '#f59e0b' },
      ]
    : [
        { id: 'b_main', name: 'main', title: 'Master Broadcast Cut', author: 'Lead Director', color: '#10b981' },
        { id: 'b_sarah', name: 'sarah/pacing', title: 'Pacing & Dialogue Trims', author: 'Sarah (Editor)', color: '#6366f1' },
        { id: 'b_alex', name: 'alex/sound-design', title: 'Audio Stems & B-Roll', author: 'Alex (Sound)', color: '#a855f7' },
        { id: 'b_agent', name: 'agent/auto-tighten', title: 'AI Copilot Cut (Merged)', author: 'TakePicker Agent', color: '#f59e0b' },
      ];

  const project1Revisions = [
    {
      id: 'rev_9a41',
      branch: 'main',
      author: 'Lead Director',
      message: 'Master broadcast baseline (Initial ingest cut)',
      time: '10m ago',
      color: '#10b981',
      videoUrl: '/proofs/proof_main_baseline.mp4',
      stats: { added: 18, deleted: 0, modified: 0 },
      isMerge: false,
      summary: 'Initial rough cut created with 18 clips across 23.98fps frame grid. Contains natural dead-air pauses and raw dialogue loudness.',
      diff: {
        hasBroll: false,
        cutDuration: 0,
        audioBoost: 0,
        brollLabel: '',
      },
    },
    {
      id: 'rev_26ab',
      branch: 'sarah/pacing',
      author: 'Sarah (Lead Editor)',
      message: 'Trim 1.8s dead air pause in Scene 2 hook & snap to 24fps',
      time: '35m ago',
      color: '#6366f1',
      videoUrl: '/proofs/proof_sarah_pacing.mp4',
      stats: { added: 0, deleted: 4, modified: 12 },
      isMerge: false,
      summary: 'Pruned dead air pauses longer than 0.5s. Tightened Scene 2 speech from 9.2s to 7.4s, eliminating retention drop cliff while keeping acoustic rhythm.',
      diff: {
        hasBroll: false,
        brollLabel: '',
        cutDuration: 1.8,
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
      videoUrl: '/proofs/proof_alex_sound_broll.mp4',
      stats: { added: 4, deleted: 0, modified: 3 },
      isMerge: false,
      summary: 'Normalized dialogue to -23 LUFS (EBU R128), added 4 atmospheric riser sound effects on Track A2, and overlayed silicon architecture B-roll on Track V2.',
      diff: {
        hasBroll: true,
        brollLabel: '✨ +3.0s B-Roll Cutaway (silicon_arch_reel.mp4)',
        cutDuration: 0,
        audioBoost: 3.2,
      },
    },
    {
      id: 'rev_11e0',
      branch: 'agent/auto-tighten',
      author: 'TakePicker AI Agent',
      message: '3-Way Merge: Combine Sarah pacing + Alex audio/B-roll',
      time: 'Just now',
      color: '#f59e0b',
      videoUrl: '/proofs/proof_agent_merged_master.mp4',
      stats: { added: 4, deleted: 4, modified: 18 },
      isMerge: true,
      summary: 'Non-destructive 3-way merge: auto-reconciled Sarah’s tightened cut boundaries with Alex’s audio stems and B-roll cutaway, resolving Scene 2 conflict via Audition Lanes and 15ms microfades.',
      diff: {
        hasBroll: true,
        brollLabel: '🔀 3-Way Merged: B-Roll + Tight Pacing + Microfades',
        cutDuration: 1.8,
        audioBoost: 3.2,
      },
    },
  ];

  const project2Revisions = [
    {
      id: 'rev_p2_c1',
      branch: 'main',
      author: 'Divesh (Ingest Lead)',
      message: 'Ingest: Raw camera A-roll footage & assets package',
      time: '1h ago',
      color: '#10b981',
      videoUrl: '/proofs/project2/p2_c1_raw_ingest.mp4',
      stats: { added: 8, deleted: 0, modified: 0 },
      isMerge: false,
      summary: 'Uploaded 8 media assets: 1080p 24fps camera A-roll talking head, B-roll reels, and raw audio files into TakePicker CAS.',
      diff: {
        hasBroll: false,
        brollLabel: '',
        cutDuration: 0,
        audioBoost: 0,
      },
    },
    {
      id: 'rev_p2_c2',
      branch: 'main',
      author: 'Alex (Sound)',
      message: 'Add ambient music bed on Track A2 & level dialogue',
      time: '45m ago',
      color: '#10b981',
      videoUrl: '/proofs/project2/p2_c2_audio_added.mp4',
      stats: { added: 2, deleted: 0, modified: 2 },
      isMerge: false,
      summary: 'Placed ambient tech synth music bed on Track A2 (-18dB under dialogue), normalized dialogue loudness to EBU R128 (-23 LUFS).',
      diff: {
        hasBroll: false,
        brollLabel: '',
        cutDuration: 0,
        audioBoost: 3.2,
      },
    },
    {
      id: 'rev_p2_c3',
      branch: 'main',
      author: 'Sarah (Editor 1)',
      message: 'Assemble 4-scene rough cut & trim initial dead-air pause',
      time: '30m ago',
      color: '#10b981',
      videoUrl: '/proofs/project2/p2_c3_rough_cut.mp4',
      stats: { added: 0, deleted: 1, modified: 4 },
      isMerge: false,
      summary: 'Assembled rough timeline (Hook, Capabilities, Silicon B-Roll, Outro). Pruned 1.5s pre-roll dead air pause before speech starts.',
      diff: {
        hasBroll: false,
        brollLabel: '',
        cutDuration: 1.5,
        audioBoost: 0,
      },
    },
    {
      id: 'rev_p2_c4',
      branch: 'sarah/first-half',
      author: 'Sarah (Editor 1)',
      message: 'sarah/first-half: Tighten Scene 1 & 2 hook pacing to 24fps',
      time: '20m ago',
      color: '#6366f1',
      videoUrl: '/proofs/project2/p2_editor1_first_half.mp4',
      stats: { added: 0, deleted: 3, modified: 6 },
      isMerge: false,
      summary: 'Editor 1 (Sarah) worked on the FIRST HALF: tightened Scene 1 hook pacing, trimmed 1.8s mid-sentence stutter, and snapped cuts to 24fps frame grid.',
      diff: {
        hasBroll: false,
        brollLabel: '✂️ First-Half Hook Tightened (-1.8s dead air)',
        cutDuration: 1.8,
        audioBoost: 0,
      },
    },
    {
      id: 'rev_p2_c5',
      branch: 'alex/second-half',
      author: 'Alex (Editor 2)',
      message: 'alex/second-half: Overlay silicon B-roll on V2 & riser SFX',
      time: '15m ago',
      color: '#a855f7',
      videoUrl: '/proofs/project2/p2_editor2_second_half.mp4',
      stats: { added: 4, deleted: 0, modified: 4 },
      isMerge: false,
      summary: 'Editor 2 (Alex) worked concurrently on the SECOND HALF: inserted silicon architecture B-roll cutaway on Track V2 and added high-frequency riser SFX on Track A3.',
      diff: {
        hasBroll: true,
        brollLabel: '✨ +3.0s Second-Half B-Roll Cutaway on V2',
        cutDuration: 0,
        audioBoost: 2.8,
      },
    },
    {
      id: 'rev_p2_c6',
      branch: 'agent/3way-merge',
      author: 'TakePicker AI Copilot',
      message: '3-Way AST Merge: Combine Sarah First-Half + Alex Second-Half',
      time: 'Just now',
      color: '#f59e0b',
      videoUrl: '/proofs/project2/p2_merged_master.mp4',
      stats: { added: 4, deleted: 3, modified: 14 },
      isMerge: true,
      summary: 'Non-Destructive 3-Way AST Merge: Merged Sarah’s First-Half hook trimming with Alex’s Second-Half B-roll & riser SFX. Resolved overlap via non-destructive Audition Lanes with 15ms raised-cosine microfades.',
      diff: {
        hasBroll: true,
        brollLabel: '🔀 3-Way AST Merged: First-Half Pacing + Second-Half B-Roll + Microfades',
        cutDuration: 1.8,
        audioBoost: 3.2,
      },
    },
  ];

  const revisions = isCollabProject ? project2Revisions : project1Revisions;
  const selectedRev = revisions.find((r) => r.id === selectedRevisionId) || revisions[revisions.length - 1];

  const beforeVideoUrl = isCollabProject
    ? '/proofs/project2/p2_c1_raw_ingest.mp4'
    : '/proofs/1_full_defects_showcase.mp4';

  // Active video source based on Audition Mode
  const currentVideoSrc = auditionMode === 'before' ? beforeVideoUrl : selectedRev.videoUrl;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (beforeVideoRef.current) beforeVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        if (beforeVideoRef.current) beforeVideoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (beforeVideoRef.current) {
      beforeVideoRef.current.currentTime = newTime;
    }
  };

  // Handle keyboard spacebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24);
    return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 50px)',
        backgroundColor: '#07080e',
        color: '#f4f4f5',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* =========================================================================
          LEFT PANEL: SOURCE CONTROL & GIT TREE GRAPH (VS Code / Antigravity Style)
          ========================================================================= */}
      <div
        style={{
          width: '325px',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0c0e17',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* Source Control Header with Three-Dots Menu */}
        <div
          style={{
            height: '44px',
            padding: '0 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f111c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
              SOURCE CONTROL
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              title="Branches & Actions"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                padding: '4px 6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <MoreHorizontal size={15} />
            </button>

            {/* Three-Dots Menu Dropdown */}
            {showBranchMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '28px',
                  right: 0,
                  width: '230px',
                  backgroundColor: '#161928',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                  zIndex: 50,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase' }}>
                  Project Branches (Cuts)
                </div>
                {branches.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      onBranchChange(b.name);
                      setShowBranchMenu(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '5px',
                      backgroundColor: currentBranch === b.name ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      color: currentBranch === b.name ? '#ffffff' : '#cbd5e1',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: b.color }} />
                    <span style={{ flex: 1 }}>{b.name}</span>
                    {currentBranch === b.name && (
                      <span style={{ fontSize: '0.60rem', color: '#34d399', fontWeight: 800 }}>ACTIVE</span>
                    )}
                  </div>
                ))}

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0', paddingTop: '4px' }}>
                  <div
                    onClick={() => {
                      onOpenMergeModal();
                      setShowBranchMenu(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '5px',
                      color: '#c084fc',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <GitMerge size={14} />
                    <span>3-Way Timeline Merge...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Changes & Commit Input Box (Exact Antigravity / VS Code style) */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#94a3b8', fontSize: '0.70rem', fontWeight: 700 }}>
            <ChevronDown size={14} />
            <span>CHANGES</span>
          </div>

          <div
            style={{
              position: 'relative',
              backgroundColor: '#131622',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 8px',
            }}
          >
            <input
              type="text"
              value={commitMessageInput}
              onChange={(e) => setCommitMessageInput(e.target.value)}
              placeholder="Message (Ctrl+Enter to commit cut)"
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f1f5f9',
                fontSize: '0.74rem',
                outline: 'none',
                paddingRight: '60px',
              }}
            />
            <button
              type="button"
              onClick={() => setCommitMessageInput('Auto-clean dead air & tighten dialogue')}
              style={{
                position: 'absolute',
                right: '4px',
                top: '4px',
                bottom: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                borderRadius: '4px',
                color: '#c7d2fe',
                fontSize: '0.62rem',
                fontWeight: 700,
                padding: '0 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>Generate</span>
              <Sparkles size={11} color="#818cf8" />
            </button>
          </div>

          <div style={{ marginTop: '8px', display: 'flex' }}>
            <button
              type="button"
              onClick={() => {
                if (commitMessageInput.trim()) {
                  alert(`Cut committed: "${commitMessageInput}"`);
                  setCommitMessageInput('');
                }
              }}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '5px 0 0 5px',
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Check size={14} />
              <span>Commit Cut</span>
            </button>
            <button
              type="button"
              style={{
                padding: '6px 8px',
                borderRadius: '0 5px 5px 0',
                backgroundColor: '#1d4ed8',
                border: 'none',
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Section 2: Graph Header (Antigravity Style) */}
        <div
          style={{
            padding: '10px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.70rem', fontWeight: 700 }}>
            <ChevronDown size={14} />
            <span>GRAPH</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.66rem' }}>
            <span style={{ color: '#94a3b8' }}>Auto</span>
            <GitBranch size={13} style={{ cursor: 'pointer' }} />
            <RefreshCw size={12} style={{ cursor: 'pointer' }} />
            <MoreHorizontal size={13} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        {/* The Tree Graph List (Connected vertical line + glowing dots + commit name + author + clip cuts) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            position: 'relative',
          }}
        >
          {/* Vertical connecting line connecting all dots */}
          <div
            style={{
              position: 'absolute',
              top: '22px',
              bottom: '30px',
              left: '21px',
              width: '2px',
              backgroundColor: '#3b82f6',
              opacity: 0.45,
              zIndex: 1,
            }}
          />

          {revisions.map((rev) => {
            const isSelected = selectedRev.id === rev.id;

            return (
              <div
                key={rev.id}
                onClick={() => {
                  setSelectedRevisionId(rev.id);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                }}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 8px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {/* Node Circle on Vertical Graph Line */}
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#ffffff' : rev.color,
                    border: `2px solid ${rev.color}`,
                    boxShadow: isSelected ? `0 0 10px ${rev.color}` : 'none',
                    flexShrink: 0,
                    marginTop: '3px',
                  }}
                />

                {/* Commit Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#ffffff' : '#e2e8f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                      title={rev.message}
                    >
                      {rev.message}
                    </span>

                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        flexShrink: 0,
                      }}
                    >
                      {rev.branch}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{rev.author}</span>
                    <span>•</span>
                    <span>{rev.time}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                    {rev.stats.added > 0 && (
                      <span
                        style={{
                          fontSize: '0.60rem',
                          fontWeight: 800,
                          color: '#34d399',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        +{rev.stats.added} clips
                      </span>
                    )}
                    {rev.stats.deleted > 0 && (
                      <span
                        style={{
                          fontSize: '0.60rem',
                          fontWeight: 800,
                          color: '#f43f5e',
                          backgroundColor: 'rgba(244, 63, 94, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        -{rev.stats.deleted} cuts
                      </span>
                    )}
                    {rev.stats.modified > 0 && (
                      <span
                        style={{
                          fontSize: '0.60rem',
                          fontWeight: 800,
                          color: '#a78bfa',
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {rev.stats.modified} trims
                      </span>
                    )}
                    {rev.isMerge && (
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          color: '#fbbf24',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          marginLeft: 'auto',
                        }}
                      >
                        3-WAY MERGE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Return to Studio NLE */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: '#090b14' }}>
          <button
            type="button"
            onClick={onBackToStudio}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <SlidersHorizontal size={13} />
            <span>Return to Studio NLE</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN VIEW: FULL SCREEN BIG VIDEO AUDITION & FULL-WIDTH TIMELINE DIFF
          ========================================================================= */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          backgroundColor: '#05060b',
          overflow: 'hidden',
        }}
      >
        {/* Top Breadcrumb & Commit Action Bar */}
        <div
          style={{
            height: '44px',
            padding: '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#0a0d18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.35)',
              }}
            >
              🌿 {selectedRev.branch}
            </span>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
              {selectedRev.message}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              by <strong style={{ color: '#e2e8f0' }}>{selectedRev.author}</strong> ({selectedRev.time})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onOpenMergeModal}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
              }}
            >
              <GitMerge size={13} />
              <span>Review & 3-Way Merge</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            UPPER VIEWPORT: BIG VIDEO SEEING SPACE (Real MP4 Player)
            ===================================================================== */}
        <div
          style={{
            flex: '1 1 58%',
            minHeight: '280px',
            backgroundColor: '#000000',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Real Video Player Element (Playing generated video proof) */}
          <div
            onClick={togglePlay}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {/* Main / After Video */}
            <video
              ref={videoRef}
              src={currentVideoSrc}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current && videoRef.current.duration) {
                  setDuration(videoRef.current.duration);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              preload="auto"
              playsInline
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                position: 'absolute',
                inset: 0,
                margin: 'auto',
                clipPath:
                  auditionMode === 'split'
                    ? `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)`
                    : undefined,
              }}
            />

            {/* Split Screen 'Before' Video (defective showcase for side-by-side comparison) */}
            {auditionMode === 'split' && (
              <video
                ref={beforeVideoRef}
                src="/proofs/1_full_defects_showcase.mp4"
                preload="auto"
                playsInline
                muted
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  position: 'absolute',
                  inset: 0,
                  margin: 'auto',
                  clipPath: `polygon(0 0, ${splitPosition}% 0, ${splitPosition}% 100%, 0 100%)`,
                }}
              />
            )}

            {/* Big Play Button Overlay when paused */}
            {!isPlaying && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 8,
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                  backdropFilter: 'blur(4px)',
                  transition: 'transform 0.15s ease',
                  pointerEvents: 'none',
                }}
              >
                <Play size={26} color="#ffffff" style={{ marginLeft: '4px' }} />
              </div>
            )}
          </div>

          {/* Interactive Split Screen Divider */}
          {auditionMode === 'split' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${splitPosition}%`,
                width: '3px',
                backgroundColor: '#fbbf24',
                zIndex: 6,
                boxShadow: '0 0 14px #fbbf24',
                cursor: 'ew-resize',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#fbbf24',
                  boxShadow: '0 0 10px rgba(0,0,0,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                }}
              >
                ◫
              </div>
            </div>
          )}

          {/* Left/Right Split Screen Labels */}
          {auditionMode === 'split' && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '24px',
                  zIndex: 5,
                  padding: '4px 10px',
                  borderRadius: '5px',
                  backgroundColor: 'rgba(239, 68, 68, 0.45)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                A: BEFORE (DEFECTIVE RAW)
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '24px',
                  zIndex: 5,
                  padding: '4px 10px',
                  borderRadius: '5px',
                  backgroundColor: 'rgba(16, 185, 129, 0.45)',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                B: AFTER ({selectedRev.branch.toUpperCase()})
              </div>
            </>
          )}

          {/* Floating Top Controls: Audition Mode Selector */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(10, 12, 22, 0.9)',
              backdropFilter: 'blur(10px)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >
            <button
              type="button"
              onClick={() => setAuditionMode('before')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: auditionMode === 'before' ? '#ef4444' : 'transparent',
                color: auditionMode === 'before' ? '#ffffff' : '#94a3b8',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              A: Before (Defective)
            </button>
            <button
              type="button"
              onClick={() => setAuditionMode('after')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: auditionMode === 'after' ? '#10b981' : 'transparent',
                color: auditionMode === 'after' ? '#ffffff' : '#94a3b8',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              B: After (Committed)
            </button>
            <button
              type="button"
              onClick={() => setAuditionMode('split')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: auditionMode === 'split' ? '#f59e0b' : 'transparent',
                color: auditionMode === 'split' ? '#000000' : '#94a3b8',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              Split Comparison
            </button>
          </div>

          {/* Floating Bottom Bar: Video Scrubbing & Playhead Controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 24px',
              background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.92) 100%)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Scrubber Track */}
            <div
              style={{
                height: '7px',
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.16)',
                borderRadius: '4px',
                position: 'relative',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                handleSeek(p * duration);
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(currentTime / (duration || 1)) * 100}%`,
                  backgroundColor: auditionMode === 'before' ? '#ef4444' : '#10b981',
                  borderRadius: '4px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-4px',
                  left: `${(currentTime / (duration || 1)) * 100}%`,
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 0 10px rgba(0,0,0,0.8)',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>

            {/* Play Button, Timecode & Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={togglePlay}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlaying ? 'Pause' : 'Play Audition'}</span>
                </button>

                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                  <strong style={{ color: '#38bdf8' }}>{formatTimecode(currentTime)}</strong> / {formatTimecode(duration)}
                </div>

                <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
                  Press <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>Space</kbd>
                </span>
              </div>

              <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                Video Proof:{' '}
                <strong style={{ color: auditionMode === 'before' ? '#f87171' : '#34d399' }}>
                  {auditionMode === 'before'
                    ? isCollabProject
                      ? 'p2_c1_raw_ingest.mp4 (Raw Camera Ingest)'
                      : '1_full_defects_showcase.mp4 (8 Injected Linter Defects)'
                    : selectedRev.videoUrl.replace('/proofs/project2/', '').replace('/proofs/', '')}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            LOWER VIEWPORT: FULL-WIDTH MULTI-TRACK TIMELINE DIFF
            ===================================================================== */}
        <div
          style={{
            flex: '1 1 42%',
            padding: '16px 24px',
            backgroundColor: '#090b14',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {/* Header of Timeline Diff */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#ffffff' }}>
                  Timeline Delta: What Changed in this Commit
                </h3>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                  }}
                >
                  {selectedRev.stats.added + selectedRev.stats.deleted + selectedRev.stats.modified} Spatio-Temporal AST Operations
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                {selectedRev.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onBranchChange(selectedRev.branch)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
                flexShrink: 0,
              }}
            >
              <span>Switch Active Timeline to this Cut</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Full-Width Visual Multi-Track Canvas */}
          <div
            style={{
              backgroundColor: '#06070e',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Track V2 (Overlays / B-Roll) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '30px', fontSize: '0.68rem', fontWeight: 800, color: '#818cf8', flexShrink: 0 }}>V2</span>
              <div
                style={{
                  flex: 1,
                  height: '30px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderRadius: '5px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                }}
              >
                {selectedRev.diff.hasBroll ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: '22%',
                      width: '42%',
                      height: '22px',
                      backgroundColor: 'rgba(16, 185, 129, 0.25)',
                      border: '1px solid #10b981',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      color: '#a7f3d0',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    <Sparkles size={12} color="#34d399" />
                    <span>{selectedRev.diff.brollLabel}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.64rem', color: '#475569', fontStyle: 'italic', paddingLeft: '8px' }}>
                    No overlay changes on this track (A-Roll primary only)
                  </span>
                )}
              </div>
            </div>

            {/* Track V1 (Primary Dialogue Track) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '30px', fontSize: '0.68rem', fontWeight: 800, color: '#c084fc', flexShrink: 0 }}>V1</span>
              <div
                style={{
                  flex: 1,
                  height: '36px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '5px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                  gap: '4px',
                }}
              >
                {isCollabProject ? (
                  <>
                    <div
                      style={{
                        width: '22%',
                        height: '28px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.64rem',
                        color: '#c7d2fe',
                      }}
                    >
                      Scene 1: Hook Intro (4.2s)
                    </div>

                    <div
                      style={{
                        width: '26%',
                        height: '28px',
                        backgroundColor: 'rgba(245, 158, 11, 0.25)',
                        border: '1px solid #f59e0b',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        color: '#fde68a',
                        fontWeight: 700,
                      }}
                    >
                      Scene 2: AI Retakes (4.6s)
                    </div>

                    {selectedRev.diff.cutDuration > 0 && (
                      <div
                        style={{
                          width: '14%',
                          height: '28px',
                          backgroundColor: 'rgba(244, 63, 94, 0.2)',
                          border: '1px dashed #f43f5e',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.62rem',
                          color: '#fca5a5',
                          fontWeight: 800,
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(244, 63, 94, 0.15), rgba(244, 63, 94, 0.15) 4px, transparent 4px, transparent 8px)',
                        }}
                      >
                        <Scissors size={10} color="#f87171" style={{ marginRight: '2px' }} />
                        <span>-{selectedRev.diff.cutDuration}s CUT</span>
                      </div>
                    )}

                    <div
                      style={{
                        width: '24%',
                        height: '28px',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.64rem',
                        color: '#a7f3d0',
                      }}
                    >
                      Scene 3: Silicon B-Roll (5.2s)
                    </div>

                    <div
                      style={{
                        flex: 1,
                        height: '28px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.64rem',
                        color: '#c7d2fe',
                      }}
                    >
                      Scene 4: Delivery (4.2s)
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '24%',
                        height: '28px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.66rem',
                        color: '#c7d2fe',
                      }}
                    >
                      Scene 1 (Intro Hook 4.0s)
                    </div>

                    <div
                      style={{
                        width: '38%',
                        height: '28px',
                        backgroundColor: 'rgba(245, 158, 11, 0.25)',
                        border: '1px solid #f59e0b',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.68rem',
                        color: '#fde68a',
                        fontWeight: 700,
                      }}
                    >
                      Scene 2 (Tightened Dialogue 7.4s)
                    </div>

                    {selectedRev.diff.cutDuration > 0 && (
                      <div
                        style={{
                          width: '16%',
                          height: '28px',
                          backgroundColor: 'rgba(244, 63, 94, 0.2)',
                          border: '1px dashed #f43f5e',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.64rem',
                          color: '#fca5a5',
                          fontWeight: 800,
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(244, 63, 94, 0.15), rgba(244, 63, 94, 0.15) 4px, transparent 4px, transparent 8px)',
                        }}
                      >
                        <Scissors size={11} color="#f87171" style={{ marginRight: '3px' }} />
                        <span>-{selectedRev.diff.cutDuration}s CUT</span>
                      </div>
                    )}

                    <div
                      style={{
                        flex: 1,
                        height: '28px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.66rem',
                        color: '#c7d2fe',
                      }}
                    >
                      Scene 3 (Architecture 6.1s)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Track A1 (Audio Stems & Leveling) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '30px', fontSize: '0.68rem', fontWeight: 800, color: '#34d399', flexShrink: 0 }}>A1</span>
              <div
                style={{
                  flex: 1,
                  height: '28px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderRadius: '5px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '22px',
                    backgroundColor:
                      selectedRev.diff.audioBoost > 0 ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                    border:
                      selectedRev.diff.audioBoost > 0
                        ? '1px solid #a855f7'
                        : '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 10px',
                    fontSize: '0.64rem',
                    color: selectedRev.diff.audioBoost > 0 ? '#e9d5ff' : '#a7f3d0',
                    fontWeight: 700,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Volume2 size={12} />
                    <span>
                      {selectedRev.diff.audioBoost > 0
                        ? 'Leveled to -23.0 LUFS (+3.2dB dialogue boost)'
                        : 'Dialogue Track Audio (EBU R128 Clean)'}
                    </span>
                  </div>
                  <span>15ms microfades active</span>
                </div>
              </div>
            </div>

            {/* Track A2 (Ambient Music Bed - Project 2) */}
            {isCollabProject && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '30px', fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>A2</span>
                <div
                  style={{
                    flex: 1,
                    height: '28px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: '5px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '22px',
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 10px',
                      fontSize: '0.64rem',
                      color: '#bae6fd',
                      fontWeight: 700,
                    }}
                  >
                    <span>🎵 Ambient Synth Music Bed (-18dB Ducked Under Dialogue)</span>
                    <span>Continuous Multi-Track Stem</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Diff Color Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.70rem',
              color: '#94a3b8',
              padding: '0 4px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              <span>Green: Added Content / B-Roll</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f43f5e' }} />
              <span>Red: Cut / Deleted Silence</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
              <span>Amber: Trimmed Boundary (24fps snap)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#a855f7' }} />
              <span>Purple: Audio Leveling & Microfades</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
