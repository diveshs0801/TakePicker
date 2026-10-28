'use client';

import React, { useState } from 'react';
import {
  FolderKanban,
  GitBranch,
  GitMerge,
  ShieldCheck,
  Folder,
  FolderOpen,
  Film,
  Music,
  Video,
  FileCode,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  ArrowRight,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import type { Asset, TimelineBranch, TimelineRevision } from '../../../../packages/contracts';

interface LeftSidebarProps {
  currentAsset: Asset | null;
  allAssets: Asset[];
  onSelectAsset: (assetId: string) => void;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  onOpenMergeModal: () => void;
  qualityScore: number;
  onOpenUpload: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentAsset,
  allAssets,
  onSelectAsset,
  currentBranch,
  onBranchChange,
  onOpenMergeModal,
  qualityScore,
  onOpenUpload,
}) => {
  const [activeTab, setActiveTab] = useState<'bins' | 'git' | 'quality'>('bins');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    footage: true,
    broll: true,
    audio: false,
    sequences: true,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // Mock real-world branch revisions DAG (Cardboard AI Problem #10)
  const branchesList = [
    { name: 'main', label: 'Master Broadcast Cut', author: 'Lead Editor', commitsAhead: 0, isCurrent: currentBranch === 'main' },
    { name: 'sarah/pacing', label: 'Sarah Dialogue Pacing', author: 'Sarah (Lead)', commitsAhead: 2, isCurrent: currentBranch === 'sarah/pacing' },
    { name: 'alex/sound-design', label: 'Alex Audio & B-Roll', author: 'Alex (Sound)', commitsAhead: 4, isCurrent: currentBranch === 'alex/sound-design' },
    { name: 'agent/auto-tighten', label: 'AI Silence & Pop Prune', author: 'AI Copilot', commitsAhead: 1, isCurrent: currentBranch === 'agent/auto-tighten' },
  ];

  const recentRevisions = [
    { id: 'rev_9a41', branch: 'main', author: 'Lead Editor', message: 'Master timeline broadcast baseline (TakePicker v2)', time: '10m ago', clipsCount: 181, isMerge: false },
    { id: 'rev_426b', branch: 'alex/sound-design', author: 'Alex (Sound)', message: 'Level dialogue loudness (-23 LUFS) & add riser SFX', time: '18m ago', clipsCount: 184, isMerge: false },
    { id: 'rev_26ab', branch: 'sarah/pacing', author: 'Sarah (Lead)', message: 'Trim 1.2s pause in Scene 2 hook & snap to grid', time: '35m ago', clipsCount: 179, isMerge: false },
    { id: 'rev_11e0', branch: 'agent/auto-tighten', author: 'AI Copilot', message: 'Auto-prune 4 dead air intervals + 15ms microfades', time: '1h ago', clipsCount: 175, isMerge: true },
  ];

  return (
    <aside style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#070912',
      borderRight: '1px solid var(--border-color)',
      userSelect: 'none',
      transition: 'width 0.2s ease',
      width: isCollapsed ? '48px' : '300px',
      minWidth: isCollapsed ? '48px' : '300px',
      overflow: 'hidden',
      zIndex: 20,
    }}>
      {/* 1. Far Left Activity Bar (Icons Rail) */}
      <div style={{
        width: '48px',
        minWidth: '48px',
        backgroundColor: '#04060b',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '12px',
      }}>
        {/* Project Bins Tab */}
        <button
          type="button"
          onClick={() => {
            if (isCollapsed) setIsCollapsed(false);
            setActiveTab('bins');
          }}
          title="Project Media Bins & Assets"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'bins' && !isCollapsed ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: activeTab === 'bins' && !isCollapsed ? '#818cf8' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <FolderKanban size={18} />
        </button>

        {/* Version Control / Git Manager Tab */}
        <button
          type="button"
          onClick={() => {
            if (isCollapsed) setIsCollapsed(false);
            setActiveTab('git');
          }}
          title="Version Control & Branch Manager (Problem #10)"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'git' && !isCollapsed ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
            color: activeTab === 'git' && !isCollapsed ? '#c084fc' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <GitBranch size={18} />
          {/* Active branch indicator dot */}
          <span style={{
            position: 'absolute',
            top: '7px',
            right: '7px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#a855f7',
            boxShadow: '0 0 6px #a855f7',
          }} />
        </button>

        {/* Verification & Quality Tab */}
        <button
          type="button"
          onClick={() => {
            if (isCollapsed) setIsCollapsed(false);
            setActiveTab('quality');
          }}
          title="Verification & Quality Linters (Problem #09)"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'quality' && !isCollapsed ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: activeTab === 'quality' && !isCollapsed ? '#34d399' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={18} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* 2. Expanded Drawer Content */}
      {!isCollapsed && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#070912',
        }}>
          {/* TAB 1: MEDIA BINS & ASSETS */}
          {activeTab === 'bins' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Drawer Header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff' }}>
                  Project Media Bins
                </span>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  title="Import Footage or B-Roll"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#a5b4fc',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} />
                  <span>Import</span>
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}>
                  <Search size={12} color="var(--text-dim)" />
                  <input
                    type="text"
                    placeholder="Search clips, bins, takes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.74rem',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>
              </div>

              {/* Folder Tree (Premiere / DaVinci Bin Structure) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                {/* Folder 1: A-Roll Footage */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('footage')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#cbd5e1',
                    }}
                  >
                    {expandedFolders.footage ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {expandedFolders.footage ? <FolderOpen size={14} color="#f59e0b" /> : <Folder size={14} color="#f59e0b" />}
                    <span>01_Footage_A_Roll</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                      {allAssets.length} items
                    </span>
                  </div>

                  {expandedFolders.footage && (
                    <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {allAssets.map((asset) => (
                        <div
                          key={asset.id}
                          onClick={() => onSelectAsset(asset.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            background: currentAsset?.id === asset.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: currentAsset?.id === asset.id ? '#ffffff' : 'var(--text-muted)',
                            border: currentAsset?.id === asset.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                          }}
                        >
                          <Video size={12} color={currentAsset?.id === asset.id ? '#818cf8' : 'currentColor'} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {asset.filename}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                            {asset.duration ? `${Math.floor(asset.duration / 60)}m` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Folder 2: B-Roll Cutaways */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('broll')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#cbd5e1',
                    }}
                  >
                    {expandedFolders.broll ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {expandedFolders.broll ? <FolderOpen size={14} color="#3b82f6" /> : <Folder size={14} color="#3b82f6" />}
                    <span>02_B_Roll_Overlays</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-dim)' }}>2 items</span>
                  </div>

                  {expandedFolders.broll && (
                    <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Film size={12} color="#60a5fa" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>silicon_arch_reel.mp4</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Film size={12} color="#60a5fa" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>cinematic_intro_broll.mp4</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Folder 3: Audio Stems & SFX */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('audio')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#cbd5e1',
                    }}
                  >
                    {expandedFolders.audio ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {expandedFolders.audio ? <FolderOpen size={14} color="#10b981" /> : <Folder size={14} color="#10b981" />}
                    <span>03_Audio_Tracks_SFX</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-dim)' }}>2 items</span>
                  </div>

                  {expandedFolders.audio && (
                    <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Music size={12} color="#34d399" />
                        <span>dialogue_clean_stem.wav</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Music size={12} color="#34d399" />
                        <span>upbeat_background_bed.mp3</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Folder 4: Timelines & Cuts */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('sequences')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#cbd5e1',
                    }}
                  >
                    {expandedFolders.sequences ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {expandedFolders.sequences ? <FolderOpen size={14} color="#a855f7" /> : <Folder size={14} color="#a855f7" />}
                    <span>04_Timelines_Cuts</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-dim)' }}>4 cuts</span>
                  </div>

                  {expandedFolders.sequences && (
                    <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {branchesList.map((b) => (
                        <div
                          key={b.name}
                          onClick={() => onBranchChange(b.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            background: b.isCurrent ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: b.isCurrent ? '#ffffff' : 'var(--text-muted)',
                            border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                          }}
                        >
                          <FileCode size={12} color={b.isCurrent ? '#c084fc' : 'currentColor'} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </span>
                          {b.isCurrent && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#c084fc' }}>ACTIVE</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VERSION CONTROL & GIT MANAGER (CARDBOARD AI PROBLEM #10) */}
          {activeTab === 'git' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Drawer Header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={15} color="#c084fc" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
                    Version Control
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenMergeModal}
                  title="Review & 3-Way Merge"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#e0e7ff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <GitMerge size={12} color="#c084fc" />
                  <span>Merge</span>
                </button>
              </div>

              {/* Branch Selector List */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Project Cuts & Branches
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                  {branchesList.map((b) => (
                    <div
                      key={b.name}
                      onClick={() => onBranchChange(b.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        background: b.isCurrent ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: b.isCurrent ? '#c084fc' : 'var(--text-dim)',
                        }} />
                        <span style={{ fontWeight: b.isCurrent ? 700 : 500, color: b.isCurrent ? '#ffffff' : 'var(--text-muted)' }}>
                          🌿 {b.name}
                        </span>
                      </div>
                      {b.commitsAhead > 0 && (
                        <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>
                          +{b.commitsAhead}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Revision DAG Log */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Revision History DAG
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {recentRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <GitCommit size={12} color="#818cf8" />
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e0e7ff' }}>
                            {rev.author}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                          {rev.time}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                        {rev.message}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                        <code>{rev.id}</code>
                        <span>•</span>
                        <span>{rev.clipsCount} clips</span>
                        {rev.isMerge && (
                          <span style={{ padding: '0 4px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                            MERGED
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUALITY & VERIFICATION (PROBLEM #09) */}
          {activeTab === 'quality' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px 14px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <ShieldCheck size={16} color="#34d399" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
                  Verification Linters
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800, color: '#34d399' }}>
                  {qualityScore}/100
                </span>
              </div>

              {/* 4-Layer Architecture Indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a7f3d0' }}>Layer 1: Physical Signal</span>
                  <CheckCircle2 size={13} color="#10b981" />
                </div>
                <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a7f3d0' }}>Layer 2: Syntactic AST</span>
                  <CheckCircle2 size={13} color="#10b981" />
                </div>
                <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a7f3d0' }}>Layer 3: Narrative Arc</span>
                  <CheckCircle2 size={13} color="#10b981" />
                </div>
                <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a7f3d0' }}>Layer 4: RL Retention</span>
                  <CheckCircle2 size={13} color="#10b981" />
                </div>
              </div>

              {/* Status summary */}
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>Zero Defects Detected</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  All 181 cuts snapped to video frame grid. 15ms microfades active across speech boundaries.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
