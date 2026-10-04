'use client';

import React from 'react';
import {
  Film,
  Sparkles,
  UploadCloud,
  Play,
  Scissors,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Layers,
  FileVideo
} from 'lucide-react';
import type { Asset } from '../../../../packages/contracts';

interface ProjectHubProps {
  assets: Asset[];
  currentAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onOpenUpload: () => void;
  onOpenStudio: () => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({
  assets,
  currentAssetId,
  onSelectAsset,
  onOpenUpload,
  onOpenStudio,
}) => {
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px' }}>
      {/* 1. Hero Showcase Banner */}
      <div className="glass glow-box" style={{
        borderRadius: 'var(--radius-xl)',
        padding: '36px',
        marginBottom: '32px',
        background: 'linear-gradient(135deg, rgba(22, 28, 45, 0.85) 0%, rgba(13, 17, 26, 0.95) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-purple">AI Multi-Take Cut Engine</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Zero-overhead video editing pipeline</span>
          </div>

          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Cut Talking-Head Footage 10x Faster with AI Retake Detection
          </h2>

          <p style={{ fontSize: '0.96rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '24px' }}>
            Upload raw multi-take footage. TakePicker transcribes speech, clusters repeated attempts into semantic sentence groups, stars the sharpest take, and lets an autonomous AI agent prune silences and polish cuts in seconds.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onOpenUpload}
              className="btn-primary"
              style={{ padding: '11px 22px', fontSize: '0.9rem' }}
            >
              <UploadCloud size={18} />
              <span>Upload New Footage (TUS 1.0)</span>
            </button>

            <button
              type="button"
              onClick={onOpenStudio}
              className="btn-secondary"
              style={{ padding: '11px 20px', fontSize: '0.9rem' }}
            >
              <Film size={17} color="#818cf8" />
              <span>Launch Studio Editor</span>
            </button>
          </div>
        </div>

        {/* Efficiency Metric Tiles */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginTop: '32px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>43.2%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Fluff Pruned</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Scissors size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>&lt; 3.5s</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Agent Plan Latency</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>4.2x Faster</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Parallel Fan-Out Render</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>D1 to D7</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quality Defect Scanner</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Project Library Grid */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Recent Video Projects</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Select any project to inspect its timeline cuts, sentence retakes, or edit with the AI Copilot.
          </p>
        </div>

        <span className="badge badge-purple font-mono">
          {assets.length} Active {assets.length === 1 ? 'Project' : 'Projects'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Project Card List */}
        {assets.map((asset) => {
          const isSelected = asset.id === currentAssetId;
          const isDemo = asset.id === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

          return (
            <div
              key={asset.id}
              className="glass glass-hover glow-box"
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                border: isSelected ? '1px solid #818cf8' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
              }}
            >
              <div>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: isDemo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      color: isDemo ? '#10b981' : '#818cf8',
                    }}>
                      <FileVideo size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                        {asset.filename}
                      </h4>
                      {isDemo && (
                        <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '1px 6px', marginTop: '2px' }}>
                          Verified Demo Project
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={`badge ${asset.status === 'READY' ? 'badge-green' : 'badge-amber'}`}>
                    {asset.status}
                  </span>
                </div>

                {/* Metadata Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {asset.duration && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      ⏱ {Math.floor(asset.duration)}s Duration
                    </span>
                  )}
                  {asset.fps && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      🎬 {asset.fps} FPS
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    📦 H.264 / MP4
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '18px' }}>
                  {isDemo
                    ? 'Sample talking-head footage with 3 sentences, 5 retakes detected, and full Whisper word-level alignment ready for AI editing.'
                    : `Raw user video asset with ID ${asset.id.slice(0, 8)}...`}
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  onSelectAsset(asset.id);
                  onOpenStudio();
                }}
                className={isSelected ? 'btn-primary' : 'btn-secondary'}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '9px',
                  fontSize: '0.86rem',
                }}
              >
                <span>Open in Studio Workspace</span>
                <ArrowRight size={15} />
              </button>
            </div>
          );
        })}

        {/* Upload New Footage Card */}
        <div
          onClick={onOpenUpload}
          className="glass glass-hover"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '28px 20px',
            border: '2px dashed var(--border-hover)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            minHeight: '220px',
            background: 'rgba(255, 255, 255, 0.015)',
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <UploadCloud size={24} color="#818cf8" />
          </div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            Upload New Video Footage
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', maxWidth: '240px' }}>
            TUS 1.0 chunked resumable upload with network-drop recovery
          </p>
        </div>
      </div>
    </div>
  );
};
