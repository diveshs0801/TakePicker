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
  ChevronLeft,
  X,
} from 'lucide-react';
import type { Asset } from '../../../../packages/contracts';

interface LeftSidebarProps {
  currentAsset: Asset | null;
  allAssets: Asset[];
  onSelectAsset: (assetId: string) => void;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  onOpenMergeModal: () => void;
  qualityScore: number;
  onOpenUpload: () => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentAsset,
  allAssets = [],
  onSelectAsset,
  currentBranch = 'main',
  onBranchChange,
  onOpenMergeModal,
  qualityScore = 100,
  onOpenUpload,
  isOpen = true,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'bins' | 'git' | 'quality'>('bins');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    footage: true,
    broll: true,
    audio: false,
    sequences: true,
  });

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // Antigravity / VS Code style tab click toggle behavior:
  // Clicking an already-active icon collapses the drawer.
  // Clicking an inactive icon switches to that tab and opens the drawer.
  const handleTabClick = (tab: 'bins' | 'git' | 'quality') => {
    if (activeTab === tab && isOpen) {
      onToggleOpen?.();
    } else {
      setActiveTab(tab);
      if (!isOpen) {
        onToggleOpen?.();
      }
    }
  };

  // Branches with color tokens
  const branchesList = [
    { name: 'main', label: 'Master Broadcast Cut', author: 'Lead Editor', commitsAhead: 0, color: '#10b981', isCurrent: currentBranch === 'main' },
    { name: 'sarah/pacing', label: 'Sarah Dialogue Pacing', author: 'Sarah (Lead)', commitsAhead: 2, color: '#6366f1', isCurrent: currentBranch === 'sarah/pacing' },
    { name: 'alex/sound-design', label: 'Alex Audio & B-Roll', author: 'Alex (Sound)', commitsAhead: 4, color: '#a855f7', isCurrent: currentBranch === 'alex/sound-design' },
    { name: 'agent/auto-tighten', label: 'AI Silence & Pop Prune', author: 'AI Copilot', commitsAhead: 1, color: '#f59e0b', isCurrent: currentBranch === 'agent/auto-tighten' },
  ];

  // Authentic Git DAG revisions with parent tracking for continuous line rendering
  const recentRevisions = [
    {
      id: 'rev_9a41',
      branch: 'main',
      author: 'Lead Editor',
      role: 'Director',
      message: 'Master timeline broadcast baseline (TakePicker v2)',
      time: '10m ago',
      clipsCount: 181,
      color: '#10b981',
      isMerge: false,
    },
    {
      id: 'rev_426b',
      branch: 'alex/sound-design',
      author: 'Alex (Sound)',
      role: 'Sound Eng',
      message: 'Level dialogue loudness (-23 LUFS) & add riser SFX',
      time: '18m ago',
      clipsCount: 184,
      color: '#a855f7',
      isMerge: false,
    },
    {
      id: 'rev_26ab',
      branch: 'sarah/pacing',
      author: 'Sarah (Lead)',
      role: 'Narrative',
      message: 'Trim 1.2s pause in Scene 2 hook & snap to grid',
      time: '35m ago',
      clipsCount: 179,
      color: '#6366f1',
      isMerge: false,
    },
    {
      id: 'rev_11e0',
      branch: 'agent/auto-tighten',
      author: 'AI Copilot',
      role: 'Auto Agent',
      message: 'Auto-prune 4 dead air intervals + 15ms microfades',
      time: '1h ago',
      clipsCount: 175,
      color: '#f59e0b',
      isMerge: true,
    },
  ];

  const filteredAssets = (allAssets || []).filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      style={{
        display: 'flex',
        height: '100%',
        backgroundColor: '#070912',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        userSelect: 'none',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        width: isOpen ? '310px' : '48px',
        minWidth: isOpen ? '310px' : '48px',
        overflow: 'hidden',
        zIndex: 20,
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Far Left Activity Bar (VS Code / Antigravity Rail) - Always 48px */}
      <div
        style={{
          width: '48px',
          minWidth: '48px',
          backgroundColor: '#04060b',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: '8px',
          boxSizing: 'border-box',
        }}
      >
        {/* Project Bins Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('bins')}
          title="Project Media Bins & Assets"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'bins' && isOpen ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
            color: activeTab === 'bins' && isOpen ? '#818cf8' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <FolderKanban size={18} />
          {activeTab === 'bins' && isOpen && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '8px',
                bottom: '8px',
                width: '3px',
                borderRadius: '0 2px 2px 0',
                backgroundColor: '#6366f1',
              }}
            />
          )}
        </button>

        {/* Version Control / Git Manager Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('git')}
          title="Version Control & Branch Manager"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'git' && isOpen ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
            color: activeTab === 'git' && isOpen ? '#c084fc' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <GitBranch size={18} />
          {/* Active branch dot indicator */}
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#a855f7',
              boxShadow: '0 0 5px #a855f7',
            }}
          />
          {activeTab === 'git' && isOpen && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '8px',
                bottom: '8px',
                width: '3px',
                borderRadius: '0 2px 2px 0',
                backgroundColor: '#a855f7',
              }}
            />
          )}
        </button>

        {/* Verification Quality Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('quality')}
          title="Editorial Linters & Verification"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'quality' && isOpen ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
            color: activeTab === 'quality' && isOpen ? '#34d399' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          <ShieldCheck size={18} />
          {activeTab === 'quality' && isOpen && (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '8px',
                bottom: '8px',
                width: '3px',
                borderRadius: '0 2px 2px 0',
                backgroundColor: '#10b981',
              }}
            />
          )}
        </button>

        {/* Ingest / Upload Shortcut */}
        <button
          type="button"
          onClick={onOpenUpload}
          title="Ingest Media Asset"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            background: 'transparent',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 'auto',
            marginBottom: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={16} />
        </button>

        {/* Activity Bar Collapse Chevron */}
        <button
          type="button"
          onClick={onToggleOpen}
          title={isOpen ? 'Collapse Sidebar (Antigravity Style)' : 'Expand Sidebar'}
          style={{
            width: '36px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.03)',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* 2. Secondary Panel Content Body (Width 262px, hides when collapsed) */}
      {isOpen && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#070912',
          }}
        >
          {/* TAB 1: MEDIA BINS & ASSETS */}
          {activeTab === 'bins' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header */}
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FolderKanban size={14} color="#818cf8" />
                  <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#f1f5f9' }}>
                    Media Bins
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    title="Import Footage"
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '4px',
                      color: '#a5b4fc',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Plus size={11} />
                    <span>Import</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleOpen}
                    title="Close Sidebar"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    padding: '4px 8px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <Search size={12} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Search clips & bins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f1f5f9',
                      fontSize: '0.74rem',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Folders Tree (DaVinci Resolve Style) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                {/* Bin 1: 01_Footage_A_Roll */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('footage')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#e2e8f0',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    {expandedFolders.footage ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {expandedFolders.footage ? <FolderOpen size={13} color="#f59e0b" /> : <Folder size={13} color="#f59e0b" />}
                    <span>01_Footage_A_Roll</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>
                      {allAssets.length}
                    </span>
                  </div>

                  {expandedFolders.footage && (
                    <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {filteredAssets.map((asset) => (
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
                            fontSize: '0.71rem',
                            background: currentAsset?.id === asset.id ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
                            color: currentAsset?.id === asset.id ? '#ffffff' : '#94a3b8',
                            border: currentAsset?.id === asset.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                          }}
                        >
                          <Video size={11} color={currentAsset?.id === asset.id ? '#818cf8' : '#64748b'} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {asset.filename}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                            {asset.duration ? `${Math.floor(asset.duration / 60)}m` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bin 2: 02_B_Roll_Overlays */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('broll')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}
                  >
                    {expandedFolders.broll ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {expandedFolders.broll ? <FolderOpen size={13} color="#06b6d4" /> : <Folder size={13} color="#06b6d4" />}
                    <span>02_B_Roll_Overlays</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>4</span>
                  </div>

                  {expandedFolders.broll && (
                    <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {[
                        { name: 'broll_reaction_01.mp4', dur: '4.2s' },
                        { name: 'broll_birthday_cake.mp4', dur: '6.8s' },
                        { name: 'broll_crowd_laugh.mp4', dur: '3.1s' },
                        { name: 'broll_close_smile.mp4', dur: '5.5s' },
                      ].map((clip) => (
                        <div
                          key={clip.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.70rem',
                            color: '#94a3b8',
                          }}
                        >
                          <Film size={11} color="#06b6d4" />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clip.name}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{clip.dur}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bin 3: 03_Audio_SFX */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('audio')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}
                  >
                    {expandedFolders.audio ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {expandedFolders.audio ? <FolderOpen size={13} color="#10b981" /> : <Folder size={13} color="#10b981" />}
                    <span>03_Audio_SFX</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>3</span>
                  </div>
                </div>

                {/* Bin 4: 04_Timelines_Cuts */}
                <div style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => toggleFolder('sequences')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}
                  >
                    {expandedFolders.sequences ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {expandedFolders.sequences ? <FolderOpen size={13} color="#a855f7" /> : <Folder size={13} color="#a855f7" />}
                    <span>04_Timelines_Cuts</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#64748b' }}>4</span>
                  </div>

                  {expandedFolders.sequences && (
                    <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
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
                            fontSize: '0.71rem',
                            background: b.isCurrent ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
                            color: b.isCurrent ? '#ffffff' : '#94a3b8',
                            border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                          }}
                        >
                          <FileCode size={11} color={b.isCurrent ? '#c084fc' : '#64748b'} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </span>
                          {b.isCurrent && (
                            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#c084fc', padding: '1px 4px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.2)' }}>
                              ACTIVE
                            </span>
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
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={14} color="#c084fc" />
                  <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#f1f5f9' }}>
                    Version Control
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.28) 100%)',
                      border: '1px solid rgba(168, 85, 247, 0.45)',
                      color: '#f3e8ff',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <GitMerge size={11} color="#c084fc" />
                    <span>Merge</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleOpen}
                    title="Close Sidebar"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>

              {/* Branch Selector List */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Project Cuts & Branches
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#a5b4fc', fontWeight: 700 }}>
                    {branchesList.length} Active
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {branchesList.map((b) => (
                    <div
                      key={b.name}
                      onClick={() => onBranchChange(b.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '0.73rem',
                        background: b.isCurrent ? 'rgba(168, 85, 247, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                        border: b.isCurrent ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: b.color,
                            boxShadow: b.isCurrent ? `0 0 6px ${b.color}` : 'none',
                          }}
                        />
                        <span style={{ fontWeight: b.isCurrent ? 700 : 500, color: b.isCurrent ? '#ffffff' : '#cbd5e1' }}>
                          🌿 {b.name}
                        </span>
                      </div>
                      {b.commitsAhead > 0 && (
                        <span
                          style={{
                            fontSize: '0.60rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                          }}
                        >
                          +{b.commitsAhead}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AUTHENTIC GIT DAG REVISION TREE (Continuous Line Connector & Aligned Nodes) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Revision History DAG
                  </span>
                  <span style={{ fontSize: '0.60rem', color: '#10b981', fontWeight: 700 }}>
                    Merkle Verified
                  </span>
                </div>

                {/* Continuous Git Tree Container */}
                <div style={{ position: 'relative', paddingLeft: '16px' }}>
                  {/* Continuous Vertical Branch Connector Line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '5px',
                      top: '10px',
                      bottom: '20px',
                      width: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    }}
                  />

                  {/* Commit Nodes along the rail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentRevisions.map((rev) => (
                      <div
                        key={rev.id}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          padding: '7px 9px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          transition: 'all 0.12s ease',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Circular Commit Node directly on the vertical rail line */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-16px',
                            top: '11px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: rev.color,
                            border: '2px solid #070912',
                            boxShadow: `0 0 6px ${rev.color}`,
                          }}
                        />

                        {/* Row 1: Author, Role Badge & Time */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9' }}>
                              {rev.author}
                            </span>
                            <span
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 600,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: '#94a3b8',
                              }}
                            >
                              {rev.role}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                            {rev.time}
                          </span>
                        </div>

                        {/* Row 2: Commit Message */}
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.69rem',
                            color: '#cbd5e1',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={rev.message}
                        >
                          {rev.message}
                        </p>

                        {/* Row 3: Hash Pill, Clips Count & Merge Tag */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                          <code style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>{rev.id}</code>
                          <span>•</span>
                          <span>{rev.clipsCount} clips</span>
                          {rev.isMerge && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(16, 185, 129, 0.18)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              3-WAY MERGED
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUALITY & VERIFICATION (PROBLEM #09) */}
          {activeTab === 'quality' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 12px', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                  paddingBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={15} color="#34d399" />
                  <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#f1f5f9' }}>
                    Verification Linters
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399' }}>
                    {qualityScore}/100
                  </span>
                  <button
                    type="button"
                    onClick={onToggleOpen}
                    title="Close Sidebar"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>

              {/* 4-Layer Architecture Indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div
                  style={{
                    padding: '7px 9px',
                    borderRadius: '5px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: '#a7f3d0' }}>
                    Layer 1: Physical Signal
                  </span>
                  <CheckCircle2 size={12} color="#10b981" />
                </div>

                <div
                  style={{
                    padding: '7px 9px',
                    borderRadius: '5px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: '#a7f3d0' }}>
                    Layer 2: Syntactic AST
                  </span>
                  <CheckCircle2 size={12} color="#10b981" />
                </div>

                <div
                  style={{
                    padding: '7px 9px',
                    borderRadius: '5px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: '#a7f3d0' }}>
                    Layer 3: Narrative Arc
                  </span>
                  <CheckCircle2 size={12} color="#10b981" />
                </div>

                <div
                  style={{
                    padding: '7px 9px',
                    borderRadius: '5px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: '#a7f3d0' }}>
                    Layer 4: RL Retention
                  </span>
                  <CheckCircle2 size={12} color="#10b981" />
                </div>
              </div>

              {/* Status summary */}
              <div
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ffffff' }}>
                  100% Broadcast Clean
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.35 }}>
                  Frame-grid snapped (24fps). 15ms raised-cosine microfades active across boundaries.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
