'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Timeline, TimelineOp, AgentStep } from '../../../../packages/contracts';
import { io, Socket } from 'socket.io-client';

interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  steps?: AgentStep[];
  status?: 'RUNNING' | 'DONE' | 'FAILED';
  tokensIn?: number;
  tokensOut?: number;
  timestamp: string;
}

interface AgentPanelProps {
  assetId: string | null;
  timeline: Timeline | null;
  onTimelineUpdated: () => void;
  onSeek: (time: number) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  assetId,
  timeline,
  onTimelineUpdated,
  onSeek,
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AI Video Editor. I can trim clips, select the best retakes, remove pauses and filler words, or make targeted timeline cuts. How can I help with this edit?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [opsLog, setOpsLog] = useState<TimelineOp[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'ops'>('chat');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load operation log
  const loadOpsLog = async () => {
    if (!assetId) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/ops`);
      if (res.ok) {
        const data = await res.json();
        setOpsLog(data.ops || []);
      }
    } catch (e) {
      console.error('Failed to load ops log:', e);
    }
  };

  useEffect(() => {
    loadOpsLog();
  }, [assetId]);

  // Listen to WebSocket events for real-time streaming
  useEffect(() => {
    if (!assetId) return;

    const socketUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : 'http://localhost:3000';
    const socket: Socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join:asset', { assetId });
    });

    socket.on('agent:tool_call', (data: any) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'agent' && last.status === 'RUNNING') {
          const currentSteps = last.steps || [];
          const stepObj = currentSteps.find((s) => s.step === data.step) || {
            step: data.step,
            toolCalls: [],
          };
          stepObj.toolCalls.push({
            id: data.toolCallId,
            name: data.tool,
            args: data.args,
          });
          const updatedSteps = currentSteps.filter((s) => s.step !== data.step).concat(stepObj);
          return [
            ...prev.slice(0, -1),
            { ...last, steps: updatedSteps },
          ];
        }
        return prev;
      });
    });

    socket.on('agent:tool_result', (data: any) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'agent') {
          const currentSteps = last.steps || [];
          for (const s of currentSteps) {
            const tc = s.toolCalls.find((t) => t.id === data.toolCallId);
            if (tc) {
              tc.result = data.result;
            }
          }
          return [...prev.slice(0, -1), { ...last, steps: [...currentSteps] }];
        }
        return prev;
      });
    });

    socket.on('agent:run_done', (data: any) => {
      setIsRunning(false);
      onTimelineUpdated();
      loadOpsLog();
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'agent') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              status: data.status,
              tokensIn: data.tokensIn,
              tokensOut: data.tokensOut,
            },
          ];
        }
        return prev;
      });
    });

    socket.on('timeline:op_applied', () => {
      onTimelineUpdated();
      loadOpsLog();
    });

    return () => {
      socket.disconnect();
    };
  }, [assetId]);

  const handleSubmit = async (e?: React.FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (presetPrompt || inputPrompt).trim();
    if (!promptToSend || !assetId || isRunning) return;

    setInputPrompt('');
    const userMsg: AgentMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const agentPlaceholder: AgentMessage = {
      id: `agent_${Date.now()}`,
      sender: 'agent',
      text: 'Analyzing timeline and formulating operations...',
      status: 'RUNNING',
      steps: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, agentPlaceholder]);
    setIsRunning(true);

    try {
      const res = await fetch(`/api/assets/${assetId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === agentPlaceholder.id) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: 'Done! Edited timeline successfully.',
                status: data.status,
                steps: data.steps,
                tokensIn: data.tokensIn,
                tokensOut: data.tokensOut,
              },
            ];
          }
          return prev;
        });
        onTimelineUpdated();
        loadOpsLog();
      } else {
        const err = await res.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...agentPlaceholder,
            text: `Agent encountered an error: ${err.message || 'Operation failed'}`,
            status: 'FAILED',
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...agentPlaceholder,
          text: `Connection error: ${err.message}`,
          status: 'FAILED',
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleUndo = async () => {
    if (!assetId) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/undo`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        onTimelineUpdated();
        loadOpsLog();
        setMessages((prev) => [
          ...prev,
          {
            id: `undo_${Date.now()}`,
            sender: 'agent',
            text: `Successfully undid operation ${data.undoneOp?.opType}. Reverted timeline to sequence #${data.seq}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (e) {
      console.error('Undo failed:', e);
    }
  };

  const quickPresets = [
    'Use the second take of the intro',
    'Remove clip 2',
    'Remove all filler words (ums/uhs)',
    'Cut between 10s and 15s',
    'Undo last edit',
  ];

  return (
    <div className="glass glow-box" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
    }}>
      {/* Header Tabs */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(10, 13, 20, 0.95)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isRunning ? '#f59e0b' : '#10b981',
            boxShadow: isRunning ? '0 0 10px #f59e0b' : '0 0 10px #10b981',
          }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>AI Video Copilot</span>
              <span className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>8-Step Bound</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'chat' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'chat' ? '#a5b4fc' : 'var(--text-muted)',
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('ops')}
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'ops' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'ops' ? '#a5b4fc' : 'var(--text-muted)',
            }}
          >
            Op Log ({opsLog.length})
          </button>
          <button
            onClick={handleUndo}
            disabled={opsLog.length === 0 || isRunning}
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              cursor: opsLog.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: opsLog.length === 0 ? 'var(--text-dim)' : '#f8fafc',
            }}
          >
            ↺ Undo
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      {activeTab === 'chat' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor: msg.sender === 'user' ? '#2563eb' : '#1f1f23',
                  border: msg.sender === 'user' ? 'none' : '1px solid #2e2e33',
                  color: '#f4f4f5',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}>
                  {msg.text}

                  {/* Render executed tool calls */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {msg.steps.map((st) => (
                        <div key={st.step} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {st.toolCalls.map((tc) => (
                            <div
                              key={tc.id}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#141416',
                                borderRadius: '6px',
                                border: '1px solid #333338',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#93c5fd' }}>
                                <span>⚙ {tc.name}()</span>
                                <span style={{ color: tc.result?.ok ? '#4ade80' : '#f87171' }}>
                                  {tc.result?.ok ? '✓ ok' : tc.result?.code || 'pending'}
                                </span>
                              </div>
                              <div style={{ color: '#a1a1aa', marginTop: '2px', wordBreak: 'break-all' }}>
                                {JSON.stringify(tc.args)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Telemetry info */}
                  {msg.tokensIn !== undefined && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '10px',
                      color: '#71717a',
                      display: 'flex',
                      gap: '8px',
                    }}>
                      <span>Tokens: {msg.tokensIn + (msg.tokensOut || 0)}</span>
                      <span>Status: {msg.status}</span>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '10px',
                  color: '#71717a',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Presets */}
          <div style={{
            padding: '8px 14px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            backgroundColor: 'rgba(10, 13, 20, 0.75)',
            borderTop: '1px solid var(--border-color)',
          }}>
            {[
              { label: '⭐ Pick best take for each sentence', prompt: 'Select the best take for every sentence and delete all discarded retakes' },
              { label: '✂ Trim silences > 0.5s', prompt: 'Trim silences longer than 0.5s' },
              { label: '🔄 Use Take 2 for intro', prompt: 'Use the second take of the intro' },
              { label: '🛡 Scan technical defects', prompt: 'Inspect timeline cuts for clipped words or defects' },
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSubmit(undefined, preset.prompt)}
                disabled={isRunning}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '5px 11px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: '#cbd5e1',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(10, 13, 20, 0.95)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Tell AI Copilot what to cut or refine..."
              disabled={isRunning || !assetId}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                color: '#f8fafc',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isRunning || !inputPrompt.trim() || !assetId}
              className="btn-primary"
              style={{
                padding: '0 16px',
                fontSize: '0.84rem',
                borderRadius: 'var(--radius-sm)',
                opacity: isRunning || !inputPrompt.trim() || !assetId ? 0.4 : 1,
                cursor: isRunning || !inputPrompt.trim() || !assetId ? 'not-allowed' : 'pointer',
              }}
            >
              {isRunning ? 'Planning...' : 'Send'}
            </button>
          </form>
        </div>
      ) : (
        /* Ops Log Tab */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {opsLog.length === 0 ? (
            <div style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', marginTop: '30px' }}>
              No timeline edits recorded yet.
            </div>
          ) : (
            opsLog.map((op) => (
              <div
                key={op.seq}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#18181b',
                  borderRadius: '8px',
                  border: '1px solid #27272a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: op.actor === 'agent' ? '#1e3a8a' : '#14532d',
                    color: op.actor === 'agent' ? '#93c5fd' : '#86efac',
                  }}>
                    #{op.seq} {op.opType} ({op.actor})
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                    {new Date(op.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {JSON.stringify(op.payload)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
