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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#111113',
      borderRadius: '12px',
      border: '1px solid #27272a',
      overflow: 'hidden',
    }}>
      {/* Header Tabs */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#18181b',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isRunning ? '#eab308' : '#22c55e',
            boxShadow: isRunning ? '0 0 8px #eab308' : '0 0 8px #22c55e',
          }} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#f4f4f5' }}>AI Timeline Agent</span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'chat' ? '#3f3f46' : 'transparent',
              color: activeTab === 'chat' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('ops')}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'ops' ? '#3f3f46' : 'transparent',
              color: activeTab === 'ops' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Op Log ({opsLog.length})
          </button>
          <button
            onClick={handleUndo}
            disabled={opsLog.length === 0 || isRunning}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid #3f3f46',
              cursor: opsLog.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: '#27272a',
              color: opsLog.length === 0 ? '#71717a' : '#f4f4f5',
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
            padding: '8px 16px',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            backgroundColor: '#141416',
            borderTop: '1px solid #27272a',
          }}>
            {quickPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSubmit(undefined, preset)}
                disabled={isRunning}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: '#202024',
                  color: '#d4d4d8',
                  borderRadius: '14px',
                  border: '1px solid #2e2e33',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '12px 16px',
              backgroundColor: '#18181b',
              borderTop: '1px solid #27272a',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Tell the agent what to edit (e.g. 'Use second take of intro')..."
              disabled={isRunning || !assetId}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                color: '#f4f4f5',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isRunning || !inputPrompt.trim() || !assetId}
              style={{
                padding: '0 16px',
                backgroundColor: isRunning ? '#4b5563' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              {isRunning ? 'Running...' : 'Send'}
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
