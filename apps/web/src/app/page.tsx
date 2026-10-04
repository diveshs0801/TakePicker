'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { VideoPlayer, VideoPlayerRef } from '../components/VideoPlayer';
import { TimelineTrack } from '../components/TimelineTrack';
import { RetakeInspector } from '../components/RetakeInspector';
import { UploadModal } from '../components/UploadModal';
import { ExportModal } from '../components/ExportModal';
import { AgentPanel } from '../components/AgentPanel';
import { SystemGuideModal } from '../components/SystemGuideModal';
import { ProjectHub } from '../components/ProjectHub';
import { io, Socket } from 'socket.io-client';
import type { Asset, TakeGroup, Timeline, AssetStatus } from '../../../../packages/contracts';

export default function Home() {
  const [currentView, setCurrentView] = useState<'studio' | 'hub'>('studio');
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);
  const [groups, setGroups] = useState<TakeGroup[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [activeAssetStatus, setActiveAssetStatus] = useState<AssetStatus>('READY');
  const [rightPanelTab, setRightPanelTab] = useState<'agent' | 'retakes'>('agent');

  const playerRef = useRef<VideoPlayerRef | null>(null);

  const DEMO_ASSET_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  // Fetch initial or recent asset
  const loadAsset = async (assetId: string) => {
    try {
      const [assetRes, takesRes, timelineRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch(`/api/assets/${assetId}/takes`),
        fetch(`/api/assets/${assetId}/timeline`),
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
    // Optimistic update of groups state
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* 1. Universal Top Header */}
      <Header
        currentAsset={currentAsset}
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onLoadDemoAsset={loadDemoAsset}
        isReadyToExport={activeAssetStatus === 'READY' && !!timeline}
      />

      {/* 2. Main Viewport Switcher */}
      {currentView === 'hub' ? (
        <ProjectHub
          assets={allAssets}
          currentAssetId={currentAsset?.id || null}
          onSelectAsset={(id) => loadAsset(id)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenStudio={() => setCurrentView('studio')}
        />
      ) : (
        /* Studio Workspace View */
        <main style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: '16px',
          padding: '16px 20px',
          flex: 1,
          maxWidth: '1800px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Left Column: Broadcast Video Monitor + Multi-Track Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <VideoPlayer
              ref={playerRef}
              src={videoSourceUrl}
              onTimeUpdate={(t) => setCurrentTime(t)}
              fps={currentAsset?.fps || 30}
            />

            <TimelineTrack
              timeline={timeline}
              totalDuration={currentAsset?.duration || 20.0}
              currentTime={currentTime}
              onSeek={handleSeek}
              assetId={currentAsset?.id}
            />
          </div>

          {/* Right Column: AI Video Copilot & Retake Inspector */}
          <div style={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column' }}>
            {/* Tab switch header */}
            <div style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '10px',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <button
                type="button"
                onClick={() => setRightPanelTab('agent')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: rightPanelTab === 'agent' ? 'var(--accent-gradient)' : 'transparent',
                  color: rightPanelTab === 'agent' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: rightPanelTab === 'agent' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>🤖 AI Copilot</span>
              </button>

              <button
                type="button"
                onClick={() => setRightPanelTab('retakes')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: rightPanelTab === 'retakes' ? 'var(--accent-gradient)' : 'transparent',
                  color: rightPanelTab === 'retakes' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: rightPanelTab === 'retakes' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>✂ Retake Inspector</span>
              </button>
            </div>

            {/* Tab content area */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {rightPanelTab === 'agent' ? (
                <AgentPanel
                  assetId={currentAsset?.id || null}
                  timeline={timeline}
                  onTimelineUpdated={() => currentAsset?.id && loadAsset(currentAsset.id)}
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
        </main>
      )}

      {/* 3. Global Modals */}
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
    </div>
  );
}
