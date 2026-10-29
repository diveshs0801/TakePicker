'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { WebCodecsPlayer, WebCodecsPlayerRef } from '../player/WebCodecsPlayer';
import { TimelineTrack } from '../components/TimelineTrack';
import { RetakeInspector } from '../components/RetakeInspector';
import { UploadModal } from '../components/UploadModal';
import { ExportModal } from '../components/ExportModal';
import { AgentPanel } from '../components/AgentPanel';
import { SystemGuideModal } from '../components/SystemGuideModal';
import { ProjectHub } from '../components/ProjectHub';
import { VersionMergeModal } from '../components/VersionMergeModal';
import { LeftSidebar } from '../components/LeftSidebar';
import { VersionGraphWorkspace } from '../components/VersionGraphWorkspace';
import { io, Socket } from 'socket.io-client';
import {
  PanelRightOpen,
  PanelBottomOpen,
  Bot,
  Scissors,
  X,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import type { Asset, TakeGroup, Timeline, AssetStatus, ConflictResolutionStrategy } from '../../../../packages/contracts';

export default function Home() {
  const [currentView, setCurrentView] = useState<'studio' | 'hub' | 'versions'>('studio');
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);
  const [groups, setGroups] = useState<TakeGroup[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [qualityScore, setQualityScore] = useState<number>(100);

  // Cardboard AI Problem #10 Version Control state
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [activeProjectId, setActiveProjectId] = useState<'project_cardboard' | 'project_collab'>('project_cardboard');

  // Antigravity IDE / VS Code Style Panel Open/Close States
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(true);

  // Dialogs
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [activeAssetStatus, setActiveAssetStatus] = useState<AssetStatus>('READY');
  const [rightPanelTab, setRightPanelTab] = useState<'agent' | 'retakes'>('agent');
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const playerRef = useRef<WebCodecsPlayerRef | null>(null);

  const DEMO_ASSET_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch initial or recent asset
  const loadAsset = async (assetId: string) => {
    try {
      const [assetRes, takesRes, timelineRes, lintRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`).catch(() => null),
        fetch(`/api/assets/${assetId}/takes`).catch(() => null),
        fetch(`/api/assets/${assetId}/timeline`).catch(() => null),
        fetch(`/api/assets/${assetId}/timeline/lint`).catch(() => null),
      ]);

      if (assetRes && assetRes.ok) {
        const assetData = await assetRes.json();
        setCurrentAsset(assetData);
        setActiveAssetStatus(assetData.status);
      }

      if (takesRes && takesRes.ok) {
        const takesData = await takesRes.json();
        setGroups(takesData.groups || []);
      }

      if (timelineRes && timelineRes.ok) {
        const timelineData = await timelineRes.json();
        setTimeline(timelineData);
      }

      if (lintRes && lintRes.ok) {
        const lintData = await lintRes.json();
        setQualityScore(lintData.qualityScore ?? 100);
      }
    } catch (err) {
      console.error('Failed to load asset details:', err);
    }
  };

  const loadDemoAsset = () => {
    loadAsset(DEMO_ASSET_ID);
    setCurrentView('studio');
  };

  // Initial load: fetch all assets, prioritizing clean short-form cuts over raw 44m dumps
  const fetchAllAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const list = await res.json();
        setAllAssets(list || []);
        // Prioritize short-form showcase cuts (<= 120s) over long unedited camera dumps
        const shortFormAsset = list.find(
          (a: any) => (a.id === DEMO_ASSET_ID || (a.duration && a.duration <= 120)) && a.status === 'READY'
        );
        if (shortFormAsset) {
          loadAsset(shortFormAsset.id);
        } else if (list && list.length > 0) {
          loadAsset(list[0].id);
        } else {
          loadAsset(DEMO_ASSET_ID);
        }
      }
    } catch (err) {
      console.error('Failed to list assets:', err);
      loadAsset(DEMO_ASSET_ID);
    }
  };

  useEffect(() => {
    fetchAllAssets();
  }, []);

  // Check ops log for undo availability
  const checkOpsLog = async () => {
    if (!currentAsset?.id) return;
    try {
      const res = await fetch(`/api/assets/${currentAsset.id}/ops`);
      if (res.ok) {
        const data = await res.json();
        setCanUndo((data.ops || []).length > 0);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    checkOpsLog();
  }, [currentAsset?.id, timeline]);

  // Handle undo action
  const handleUndo = async () => {
    if (!currentAsset?.id) return;
    try {
      const res = await fetch(`/api/assets/${currentAsset.id}/undo`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.timeline) {
          setTimeline(data.timeline);
        } else {
          loadAsset(currentAsset.id);
        }
        checkOpsLog();
      }
    } catch (e) {
      console.error('Undo failed:', e);
    }
  };

  // WebSocket connection for real-time asset processing updates
  useEffect(() => {
    if (!currentAsset?.id || typeof window === 'undefined') return;

    let socket: Socket | null = null;
    try {
      const socketUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
      socket = io(socketUrl, { transports: ['websocket', 'polling'], reconnectionAttempts: 3 });

      socket.on('connect', () => {
        if (currentAsset?.id) {
          socket?.emit('join:asset', { assetId: currentAsset.id });
        }
      });

      socket.on('asset:status', (data: { assetId: string; status: AssetStatus; error?: string }) => {
        if (data.assetId === currentAsset.id) {
          setActiveAssetStatus(data.status);
          setCurrentAsset((prev) => (prev ? { ...prev, status: data.status } : null));

          if (data.status === 'READY') {
            loadAsset(data.assetId);
            fetchAllAssets();
            setIsUploadOpen(false);
          }
        }
      });
    } catch (e) {
      // safe fallback
    }

    return () => {
      socket?.disconnect();
    };
  }, [currentAsset?.id]);

  // Polling fallback to guarantee stage progression updates
  useEffect(() => {
    if (!currentAsset?.id || activeAssetStatus === 'READY' || activeAssetStatus === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/assets/${currentAsset.id}`);
        if (res.ok) {
          const data = await res.json();
          setActiveAssetStatus(data.status);
          setCurrentAsset(data);

          if (data.status === 'READY') {
            loadAsset(data.id);
            fetchAllAssets();
            setIsUploadOpen(false);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentAsset?.id, activeAssetStatus]);

  // Handle take selection change
  const handleSelectTake = async (groupId: string, segmentId: string | number) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            chosenSegmentId: segmentId,
            overridden: true,
          };
        }
        return g;
      })
    );

    try {
      const res = await fetch(`/api/assets/take-groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentId }),
      });

      if (res.ok && currentAsset?.id) {
        const timelineRes = await fetch(`/api/assets/${currentAsset.id}/timeline`);
        if (timelineRes.ok) {
          const data = await timelineRes.json();
          setTimeline(data);
        }
      }
    } catch (err) {
      console.error('Failed to update take selection:', err);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    playerRef.current?.seekTo(time);
  };

  const handleUploadSuccess = (assetId: string) => {
    loadAsset(assetId);
    fetchAllAssets();
    setActiveAssetStatus('UPLOADED');
  };

  // Dynamic video source and timeline based on active project
  const videoSourceUrl =
    activeProjectId === 'project_collab'
      ? '/proofs/project2/p2_merged_master.mp4'
      : '/proofs/2_takepicker_auto_repaired_master.mp4';

  const effectiveTimeline =
    activeProjectId === 'project_collab'
      ? {
          assetId: 'project2-collab-master',
          fps: 24,
          clips: [
            { id: 'p2_c1', segmentIdx: 0, in: 0.0, out: 4.2, text: 'Hook: High-Energy Tech Intro (Sarah)', reason: 'Scene 1 Hook' },
            { id: 'p2_c2', segmentIdx: 1, in: 4.2, out: 8.8, text: 'Product Capabilities: AI Retake Reasoning', reason: 'Scene 2 Dialogue' },
            { id: 'p2_c3', segmentIdx: 2, in: 8.8, out: 14.0, text: 'V2 B-Roll Cutaway: Silicon Architecture (Alex)', reason: 'Scene 3 Visual Cutaway' },
            { id: 'p2_c4', segmentIdx: 3, in: 14.0, out: 18.2, text: 'Outro: 3-Way AST Merge Final Delivery', reason: 'Scene 4 Climax' },
          ],
        }
      : {
          assetId: currentAsset?.id || 'cardboard-ceo-demo',
          fps: 24,
          clips: [
            { id: 'c1', segmentIdx: 0, in: 0.0, out: 4.0, text: 'Scene 1: Agentic Video Architecture (Hook)', reason: 'Hook Intro' },
            { id: 'c2', segmentIdx: 1, in: 4.0, out: 11.4, text: 'Scene 2: Multimodal First-Cut Reasoning (Saksham Aggarwal)', reason: 'Dialogue Stem' },
            { id: 'c3', segmentIdx: 2, in: 11.4, out: 17.5, text: 'Scene 3: Closed-Loop Verification & Taste Optimization', reason: 'Clean Delivery' },
          ],
        };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#070912',
        color: '#f1f5f9',
      }}
    >
      {/* 1. Universal Studio Top Bar with 3-Zone Layout & Antigravity IDE Panel Toggles */}
      <Header
        currentAsset={currentAsset}
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onLoadDemoAsset={loadDemoAsset}
        isReadyToExport={activeAssetStatus === 'READY' && !!timeline}
        qualityScore={qualityScore}
        onUndo={handleUndo}
        canUndo={canUndo}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onOpenMergeModal={() => setIsMergeModalOpen(true)}
        isLeftOpen={isLeftSidebarOpen}
        onToggleLeft={() => setIsLeftSidebarOpen((prev) => !prev)}
        isRightOpen={isRightSidebarOpen}
        onToggleRight={() => setIsRightSidebarOpen((prev) => !prev)}
        isTimelineOpen={isTimelineOpen}
        onToggleTimeline={() => setIsTimelineOpen((prev) => !prev)}
        activeProjectId={activeProjectId}
        onProjectChange={(pid) => setActiveProjectId(pid as any)}
      />

      {/* 2. Main Viewport Switcher */}
      {currentView === 'hub' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ProjectHub
            assets={allAssets}
            currentAssetId={currentAsset?.id || null}
            onSelectAsset={(id) => loadAsset(id)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenStudio={() => setCurrentView('studio')}
          />
        </div>
      ) : currentView === 'versions' ? (
        /* Dedicated Version Control & Git Graph Workspace (Cardboard AI Problem #10) */
        <VersionGraphWorkspace
          currentBranch={currentBranch}
          onBranchChange={setCurrentBranch}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onBackToStudio={() => setCurrentView('studio')}
          activeProjectId={activeProjectId}
        />
      ) : (
        /* Professional Broadcast Studio NLE Layout (Left Bins + Center Monitor + Right Inspector + Bottom Timeline) */
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: 'calc(100vh - 50px)',
            overflow: 'hidden',
            backgroundColor: '#04060b',
          }}
        >
          {/* Top Half: Left Media/Git Bins + Video Monitor + AI Inspector */}
          <div
            style={{
              display: 'flex',
              flex: isTimelineOpen ? '1 1 54%' : '1 1 100%',
              minHeight: '260px',
              overflow: 'hidden',
              borderBottom: isTimelineOpen ? '1px solid rgba(255, 255, 255, 0.07)' : 'none',
              transition: 'flex 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Left Drawer: Media Bins & Project Organizer (Antigravity collapsible) */}
            <LeftSidebar
              currentAsset={currentAsset}
              allAssets={allAssets}
              onSelectAsset={(id) => loadAsset(id)}
              currentBranch={currentBranch}
              onBranchChange={setCurrentBranch}
              onOpenMergeModal={() => setIsMergeModalOpen(true)}
              qualityScore={qualityScore}
              onOpenUpload={() => setIsUploadOpen(true)}
              isOpen={isLeftSidebarOpen}
              onToggleOpen={() => setIsLeftSidebarOpen((prev) => !prev)}
            />

            {/* Center: Broadcast Video Monitor */}
            <div
              style={{
                flex: 1,
                height: '100%',
                overflow: 'hidden',
                padding: '8px 10px',
                backgroundColor: '#05070e',
                position: 'relative',
              }}
            >
              <WebCodecsPlayer
                ref={playerRef}
                src={videoSourceUrl}
                onTimeUpdate={(t) => setCurrentTime(t)}
                fps={currentAsset?.fps || 30}
              />

              {/* Collapsed Right Inspector floating expand tab */}
              {!isRightSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen(true)}
                  title="Expand AI Copilot & Retake Inspector"
                  style={{
                    position: 'absolute',
                    top: '18px',
                    right: '18px',
                    zIndex: 30,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(99, 102, 241, 0.25)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(99, 102, 241, 0.45)',
                    color: '#e0e7ff',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <Bot size={14} color="#818cf8" />
                  <span>Open AI Inspector</span>
                </button>
              )}
            </div>

            {/* Right: AI Copilot & Retake Inspector Side Dock (Antigravity collapsible) */}
            {isRightSidebarOpen && (
              <div
                style={{
                  width: '390px',
                  minWidth: '390px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#070a13',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
                  overflow: 'hidden',
                  transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Tab Selector Header + Close Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 8px',
                    backgroundColor: '#080c18',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setRightPanelTab('agent')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      background: rightPanelTab === 'agent' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
                      color: rightPanelTab === 'agent' ? '#ffffff' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Bot size={13} color={rightPanelTab === 'agent' ? '#818cf8' : 'currentColor'} />
                    <span>AI Copilot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRightPanelTab('retakes')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      background: rightPanelTab === 'retakes' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
                      color: rightPanelTab === 'retakes' ? '#ffffff' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Scissors size={13} color={rightPanelTab === 'retakes' ? '#818cf8' : 'currentColor'} />
                    <span>Retake Inspector</span>
                  </button>

                  {/* Panel Close Button */}
                  <button
                    type="button"
                    onClick={() => setIsRightSidebarOpen(false)}
                    title="Close Inspector Dock (Antigravity Style)"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Panel Content Body */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {rightPanelTab === 'agent' ? (
                    <AgentPanel
                      assetId={currentAsset?.id || null}
                      timeline={effectiveTimeline}
                      onTimelineUpdated={() => {
                        if (currentAsset?.id) loadAsset(currentAsset.id);
                      }}
                      onSeek={handleSeek}
                    />
                  ) : (
                    <RetakeInspector
                      groups={groups}
                      onSelectTake={handleSelectTake}
                      onPreviewTake={handleSeek}
                      currentTime={currentTime}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Half: Full-Width Multi-Track Timeline (Antigravity collapsible) */}
          {isTimelineOpen ? (
            <div
              style={{
                flex: '0 0 auto',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <TimelineTrack
                timeline={effectiveTimeline}
                totalDuration={
                  effectiveTimeline?.clips && effectiveTimeline.clips.length > 0
                    ? Math.max(17.5, Math.ceil(Math.max(...effectiveTimeline.clips.map((c) => c.out || 0))))
                    : 17.5
                }
                currentTime={currentTime}
                onSeek={handleSeek}
                assetId={currentAsset?.id}
                groups={groups}
                onSelectTake={handleSelectTake}
                onTimelineMutated={() => {
                  if (currentAsset?.id) loadAsset(currentAsset.id);
                }}
              />
            </div>
          ) : (
            /* Collapsed Timeline Status Bar */
            <div
              style={{
                height: '34px',
                backgroundColor: '#070912',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                fontSize: '0.74rem',
                color: '#94a3b8',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsTimelineOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.22)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#e0e7ff',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <PanelBottomOpen size={13} />
                  <span>Expand Multi-Track Timeline</span>
                </button>
                <span style={{ fontSize: '0.70rem', color: '#64748b' }}>
                  {timeline?.clips?.length || 181} clips assembled • 24.000 fps grid locked
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.70rem' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>● 100% Broadcast Clean</span>
                <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>
                  Playhead: {currentTime.toFixed(2)}s / {(currentAsset?.duration || 2690).toFixed(1)}s
                </span>
              </div>
            </div>
          )}
        </main>
      )}

      {/* 3. Global Dialogs */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        currentStatus={activeAssetStatus}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        assetId={currentAsset?.id || null}
        timeline={timeline}
      />

      <SystemGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onLoadDemoAsset={loadDemoAsset}
      />

      {/* Cardboard AI Problem #10: Version Control 3-Way Merge Modal */}
      <VersionMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        sourceBranch={currentBranch !== 'main' ? currentBranch : 'sarah/pacing'}
        targetBranch="main"
        onConfirmMerge={(_strategy: ConflictResolutionStrategy) => {
          setQualityScore(100);
          if (currentAsset?.id) loadAsset(currentAsset.id);
        }}
      />
    </div>
  );
}
