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
import type { Asset, TakeGroup, Timeline, AssetStatus, ConflictResolutionStrategy } from '../../../../packages/contracts';

export default function Home() {
  const [currentView, setCurrentView] = useState<'studio' | 'hub' | 'versions'>('studio');
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);
  const [groups, setGroups] = useState<TakeGroup[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [qualityScore, setQualityScore] = useState<number>(100);

  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [activeAssetStatus, setActiveAssetStatus] = useState<AssetStatus>('READY');
  const [rightPanelTab, setRightPanelTab] = useState<'agent' | 'retakes'>('agent');
  const [canUndo, setCanUndo] = useState<boolean>(false);

  const playerRef = useRef<WebCodecsPlayerRef | null>(null);

  const DEMO_ASSET_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  // Fetch initial or recent asset
  const loadAsset = async (assetId: string) => {
    try {
      const [assetRes, takesRes, timelineRes, lintRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch(`/api/assets/${assetId}/takes`),
        fetch(`/api/assets/${assetId}/timeline`),
        fetch(`/api/assets/${assetId}/timeline/lint`).catch(() => null),
      ]);

      if (assetRes.ok) {
        const assetData = await assetRes.json();
        setCurrentAsset(assetData);
        setActiveAssetStatus(assetData.status);
      }

      if (takesRes.ok) {
        const takesData = await takesRes.json();
        setGroups(takesData.groups || []);
      }

      if (timelineRes.ok) {
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

  // Initial load: fetch all assets
  const fetchAllAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const list = await res.json();
        setAllAssets(list || []);
        if (list && list.length > 0) {
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
    if (!currentAsset?.id) return;

    const socketUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : 'http://localhost:3000';
    const socket: Socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join:asset', { assetId: currentAsset.id });
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

    return () => {
      socket.disconnect();
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

  const videoSourceUrl = currentAsset?.storageKey
    ? `/media/${currentAsset.storageKey}`
    : currentAsset?.id
    ? `/media/assets/${currentAsset.id}/source.mp4`
    : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* 1. Universal Studio Header */}
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
        />
      ) : (
        /* Professional Broadcast Studio NLE Layout (Left Bins + Center Monitor + Right Inspector + Bottom Timeline) */
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: 'calc(100vh - 52px)',
          overflow: 'hidden',
          backgroundColor: '#04060b',
        }}>
          {/* Top Half: Left Media/Git Bins (Left) + Video Monitor (Center) + AI Inspector (Right) */}
          <div style={{
            display: 'flex',
            flex: '1 1 54%',
            minHeight: '280px',
            overflow: 'hidden',
            borderBottom: '1px solid var(--border-color)',
          }}>
            {/* Left Drawer: Media Bins & Project Organizer */}
            <LeftSidebar
              currentAsset={currentAsset}
              allAssets={allAssets}
              onSelectAsset={(id) => loadAsset(id)}
              currentBranch={currentBranch}
              onBranchChange={setCurrentBranch}
              onOpenMergeModal={() => setIsMergeModalOpen(true)}
              qualityScore={qualityScore}
              onOpenUpload={() => setIsUploadOpen(true)}
            />

            {/* Center: Broadcast Video Monitor */}
            <div style={{
              flex: 1,
              height: '100%',
              overflow: 'hidden',
              padding: '8px 10px',
              backgroundColor: '#05070e',
            }}>
              <WebCodecsPlayer
                ref={playerRef}
                src={videoSourceUrl}
                onTimeUpdate={(t) => setCurrentTime(t)}
                fps={currentAsset?.fps || 30}
              />
            </div>

            {/* Right: AI Copilot & Retake Inspector Side Dock */}
            <div style={{
              width: '420px',
              minWidth: '420px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#070a13',
              borderLeft: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}>
              {/* Tab Selector Header */}
              <div style={{
                display: 'flex',
                gap: '4px',
                padding: '6px',
                backgroundColor: '#0a0d18',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('agent')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: rightPanelTab === 'agent' ? 'var(--accent-gradient)' : 'transparent',
                    color: rightPanelTab === 'agent' ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: rightPanelTab === 'agent' ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <span>🤖 AI Copilot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightPanelTab('retakes')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: rightPanelTab === 'retakes' ? 'var(--accent-gradient)' : 'transparent',
                    color: rightPanelTab === 'retakes' ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: rightPanelTab === 'retakes' ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <span>✂ Retake Inspector</span>
                </button>
              </div>

              {/* Panel Content Body */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {rightPanelTab === 'agent' ? (
                  <AgentPanel
                    assetId={currentAsset?.id || null}
                    timeline={timeline}
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
          </div>

          {/* Bottom Half: Full-Width Multi-Track Timeline */}
          <div style={{
            flex: '0 0 auto',
            width: '100%',
            overflow: 'hidden',
          }}>
            <TimelineTrack
              timeline={timeline}
              totalDuration={currentAsset?.duration || 20.0}
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
