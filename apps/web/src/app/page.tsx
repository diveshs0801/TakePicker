'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { VideoPlayer, VideoPlayerRef } from '../components/VideoPlayer';
import { TimelineTrack } from '../components/TimelineTrack';
import { RetakeInspector } from '../components/RetakeInspector';
import { UploadModal } from '../components/UploadModal';
import { ExportModal } from '../components/ExportModal';
import { io, Socket } from 'socket.io-client';
import type { Asset, TakeGroup, Timeline, AssetStatus } from '../../../../packages/contracts';

export default function Home() {
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);
  const [groups, setGroups] = useState<TakeGroup[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [activeAssetStatus, setActiveAssetStatus] = useState<AssetStatus>('READY');

  const playerRef = useRef<VideoPlayerRef | null>(null);

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

  // Initial load
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/assets');
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) {
            loadAsset(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to list assets:', err);
      }
    };
    fetchRecent();
  }, []);

  // WebSocket connection for real-time asset processing updates
  useEffect(() => {
    if (!currentAsset?.id) return;

    const socket: Socket = io('/', { path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('join:asset', { assetId: currentAsset.id });
    });

    socket.on('asset:status', (data: { assetId: string; status: AssetStatus; error?: string }) => {
      if (data.assetId === currentAsset.id) {
        setActiveAssetStatus(data.status);
        setCurrentAsset((prev) => (prev ? { ...prev, status: data.status } : null));

        if (data.status === 'READY') {
          loadAsset(data.assetId);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentAsset?.id]);

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
        body: JSON.stringify({ chosenSegmentId: String(segmentId) }),
      });

      if (res.ok && currentAsset?.id) {
        // Refetch timeline with new selection
        const tlRes = await fetch(`/api/assets/${currentAsset.id}/timeline`);
        if (tlRes.ok) {
          const newTl = await tlRes.json();
          setTimeline(newTl);
        }
      }
    } catch (err) {
      console.error('Failed to update take selection:', err);
    }
  };

  const handleSeek = (time: number) => {
    playerRef.current?.seekTo(time);
  };

  const handleUploadSuccess = (newAssetId: string) => {
    setCurrentAsset({
      id: newAssetId,
      filename: 'Processing...',
      storageKey: `assets/${newAssetId}/source.mp4`,
      status: 'UPLOADED',
      createdAt: new Date().toISOString(),
    });
    setActiveAssetStatus('UPLOADED');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        currentAsset={currentAsset}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        isReadyToExport={currentAsset?.status === 'READY' && (timeline?.clips.length || 0) > 0}
      />

      <main style={{
        flex: 1,
        padding: '24px 28px',
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* Left Column: Player & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <VideoPlayer
            ref={playerRef}
            src={currentAsset?.id ? `/media/assets/${currentAsset.id}/proxy.mp4` : null}
            onTimeUpdate={setCurrentTime}
            fps={currentAsset?.fps || 30}
          />

          <TimelineTrack
            timeline={timeline}
            totalDuration={currentAsset?.duration || 0}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>

        {/* Right Column: Retakes Inspector */}
        <div style={{ height: 'calc(100vh - 120px)' }}>
          <RetakeInspector
            groups={groups}
            onSelectTake={handleSelectTake}
            onPreviewTake={handleSeek}
            currentTime={currentTime}
          />
        </div>
      </main>

      {/* Modals */}
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
    </div>
  );
}
