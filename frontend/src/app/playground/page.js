'use client';
import { useState, useEffect, useRef } from 'react';
import { api, apiStream } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Send, Plus, Trash2, Settings, Bot, User, Loader, MessageSquare, GitBranch, Wrench, Zap, Copy, Edit2, RotateCcw, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PlaygroundPage() {
    const { currentWorkspaceId, currentOrgId } = useWorkspace();
    const [mode, setMode] = useState('chat'); // 'chat' | 'agent' | 'workflow'
    const [providers, setProviders] = useState([]);
    const [allModels, setAllModels] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);

    // Message Actions State
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editContent, setEditContent] = useState('');

    // Agent mode state
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState('');
    const [agentSteps, setAgentSteps] = useState([]);

    // Workflow mode state
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState('');
    const [workflowInput, setWorkflowInput] = useState('{}');
    const [workflowResult, setWorkflowResult] = useState(null);

    useEffect(() => {
        if (currentOrgId) loadProviders();
        if (currentWorkspaceId) {
            loadAgents();
            loadWorkflows();
        }
    }, [currentOrgId, currentWorkspaceId]);

    useEffect(() => {
        loadConversations();
    }, [mode, selectedAgent, selectedWorkflow]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, agentSteps]);

    async function loadProviders() {
        if (!currentOrgId) return;
        try {
            const res = await api.getProviders(currentOrgId);
            const provs = res.providers || [];
            setProviders(provs);
            const modelsArr = [];
            for (const p of provs) {
                try {
                    const mr = await api.getProviderModels(p.id);
                    (mr.models || []).forEach(m => modelsArr.push({ ...m, provider: p }));
                } catch (e) { /* ignore */ }
            }
            setAllModels(modelsArr);
            if (provs.length > 0 && !selectedProvider) {
                setSelectedProvider(provs[0].id);
                const firstModels = modelsArr.filter(m => m.provider_id === provs[0].id);
                if (firstModels.length) setSelectedModel(firstModels[0].model_id);
            }
        } catch (e) { console.error(e); }
    }

    async function loadConversations() {
        try {
            if (mode === 'chat') {
                const res = await api.getConversations();
                setConversations(res.conversations || []);
            } else if (mode === 'agent') {
                if (!selectedAgent) { setConversations([]); return; }
                const res = await api.getAgentConversations(selectedAgent);
                setConversations(res.conversations || []);
            } else if (mode === 'workflow') {
                if (!selectedWorkflow) { setConversations([]); return; }
                const res = await api.getWorkflowExecutions(selectedWorkflow);
                const ex = res.executions || [];
                setConversations(ex.map(e => ({
                    id: e.id,
                    title: `Execution ${e.id.substring(0, 6)}`,
                    status: e.status,
                    created_at: e.started_at
                })));
            }
        } catch (e) {
            console.error(e);
            setConversations([]);
        }
    }

    async function loadAgents() {
        if (!currentWorkspaceId) return;
        try { setAgents((await api.getAgents(currentWorkspaceId)).agents || []); } catch (e) { console.error(e); }
    }

    async function loadWorkflows() {
        if (!currentWorkspaceId) return;
        try { setWorkflows((await api.getWorkflows(currentWorkspaceId)).workflows || []); } catch (e) { console.error(e); }
    }

    async function loadMessages(convId) {
        try { setMessages((await api.getMessages(convId)).messages || []); } catch (e) { console.error(e); }
    }

    function selectConversation(conv) {
        setActiveConv(conv);
        if (mode === 'workflow') {
            api.getWorkflowExecution(selectedWorkflow, conv.id).then(res => {
                setWorkflowResult(res);
            }).catch(e => console.error(e));
        } else if (mode === 'agent') {
            loadMessages(conv.id);
        } else {
            if (conv.provider_id) setSelectedProvider(conv.provider_id);
            if (conv.model_id) setSelectedModel(conv.model_id);
            loadMessages(conv.id);
        }
    }

    function startNewChat() { setActiveConv(null); setMessages([]); setInput(''); setAgentSteps([]); setWorkflowResult(null); }

    async function deleteConversation(id, e) {
        e.stopPropagation();
        try {
            await api.deleteConversation(id);
            if (activeConv?.id === id) startNewChat();
            loadConversations();
        } catch (e) { alert(e.message); }
    }

    // ── Message Actions ──
    const handleCopy = (content, index) => {
        navigator.clipboard.writeText(content);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleEditStart = (index, content) => {
        if (sending) return;
        setEditingIndex(index);
        setEditContent(content);
    };

    const handleEditCancel = () => {
        setEditingIndex(null);
        setEditContent('');
    };

    const handleEditSave = async (index) => {
        if (!editContent.trim() || sending) return;
        // Trim history up to this message, replace it, and resubmit
        const newHistory = messages.slice(0, index);
        setMessages(newHistory);
        setEditingIndex(null);

        // Temporarily set input and trigger send logic manually to simulate continuing
        const originalInput = input;
        setInput(editContent);

        // Wait for state to update then submit
        setTimeout(() => {
            if (mode === 'chat') {
                // To avoid relying on synthetic event state, we duplicate a small portion of handleSend
                handleChatSendWithInput(editContent, newHistory);
            } else if (mode === 'agent') {
                handleAgentSendWithInput(editContent, newHistory);
            }
            setInput(originalInput);
        }, 50);
    };

    const handleRerun = (index) => {
        if (sending) return;
        const msgToRerun = messages[index];
        // Trim history up to this message and resubmit its content
        const newHistory = messages.slice(0, index);
        setMessages(newHistory);

        setTimeout(() => {
            if (mode === 'chat') {
                handleChatSendWithInput(msgToRerun.content, newHistory);
            } else if (mode === 'agent') {
                handleAgentSendWithInput(msgToRerun.content, newHistory);
            }
        }, 50);
    };

    // ── Chat Mode Send ──
    async function handleChatSend() {
        if (!input.trim() || !selectedProvider || !selectedModel || sending) return;
        const userMsg = { role: 'user', content: input.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setSending(true);

        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
            const response = await fetch(`${API_BASE}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider_id: selectedProvider, model_id: selectedModel,
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    system_prompt: systemPrompt || undefined, temperature,
                    conversation_id: activeConv?.id || undefined, stream: true,
                    workspace_id: currentWorkspaceId,
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';
            let convId = activeConv?.id;
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep incomplete line in buffer

                for (let line of lines) {
                    line = line.trim();
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'content') {
                            assistantContent += data.content;
                            setMessages(prev => {
                                const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: assistantContent }; return u;
                            });
                        } else if (data.type === 'done') { convId = data.conversation_id; }
                        else if (data.type === 'usage') {
                            setMessages(prev => {
                                const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], usage: data }; return u;
                            });
                        }
                    } catch (e) { /* ignore incomplete chunks */ }
                }
            }
            if (convId && !activeConv) setActiveConv({ id: convId });
            loadConversations();
        } catch (e) {
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `Error: ${e.message}` }]);
        }
        setSending(false);
    }

    // ── Agent Mode Send ──
    async function handleAgentSend() {
        if (!input.trim() || !selectedAgent || sending) return;
        handleAgentSendWithInput(input, messages);
    }

    async function handleAgentSendWithInput(textToSend, currentMessages) {
        setSending(true);
        const userMsg = { role: 'user', content: textToSend };
        setMessages(prev => [...(currentMessages || prev), userMsg]);
        setInput('');
        setAgentSteps([]);

        try {
            let reqConvId = activeConv?.id;
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
            const response = await fetch(`${API_BASE}/agents/${selectedAgent}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: textToSend, stream: true, conversation_id: reqConvId, workspace_id: currentWorkspaceId }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let steps = [];
            let finalContent = '';

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep incomplete line in buffer

                for (let line of lines) {
                    line = line.trim();
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        steps = [...steps, data];
                        setAgentSteps([...steps]);
                        if (data.type === 'content') finalContent = data.content;
                        if (data.type === 'done' && data.conversation_id) reqConvId = data.conversation_id;
                    } catch (e) { /* ignore incomplete chunks */ }
                }
            }

            if (reqConvId && !activeConv) setActiveConv({ id: reqConvId });
            loadConversations();

            if (finalContent) {
                setMessages(prev => [...prev, { role: 'assistant', content: finalContent, isAgent: true }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
        }
        setSending(false);
    }

    // ── Workflow Mode Execute ──
    async function handleWorkflowExecute() {
        if (!selectedWorkflow || sending) return;
        setSending(true);
        setWorkflowResult(null);
        try {
            let inputData = {};
            try { inputData = JSON.parse(workflowInput); } catch (e) { /* use empty */ }
            const res = await api.queryWorkflow(selectedWorkflow, { input_data: inputData });
            setWorkflowResult(res);
        } catch (e) {
            setWorkflowResult({ error: e.message });
        }
        setSending(false);
    }

    function handleSend() {
        if (mode === 'chat') handleChatSend();
        else if (mode === 'agent') handleAgentSend();
    }

    const currentModels = allModels.filter(m => m.provider_id === selectedProvider);
    const selectedAgentObj = agents.find(a => a.id === selectedAgent);
    const selectedWorkflowObj = workflows.find(w => w.id === selectedWorkflow);

    return (
        <div style={{ margin: '-32px', height: 'calc(100vh)', display: 'flex' }}>
            {/* Conversations Sidebar */}
            <div className="chat-sidebar">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={startNewChat}>
                        <Plus size={14} /> New Chat
                    </button>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowSettings(!showSettings)}>
                        <Settings size={14} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {conversations.map(conv => (
                        <div key={conv.id}
                            className={`sidebar-link ${activeConv?.id === conv.id ? 'active' : ''}`}
                            onClick={() => selectConversation(conv)}
                            style={{ justifyContent: 'space-between', fontSize: 13 }}>
                            <span className="truncate" style={{ flex: 1 }}>{conv.title}</span>
                            {mode !== 'workflow' && (
                                <button className="btn btn-ghost btn-icon" style={{ padding: 4, opacity: 0.5 }}
                                    onClick={(e) => deleteConversation(conv.id, e)}>
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="chat-main">
                {/* Mode Tabs + Settings */}
                <div style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                }}>
                    {/* Mode Switch Tabs */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        padding: '0 20px', borderBottom: '1px solid var(--border-color)',
                    }}>
                        {[
                            { id: 'chat', label: 'Chat', icon: MessageSquare },
                            { id: 'agent', label: 'Agent', icon: Bot },
                            { id: 'workflow', label: 'Workflow', icon: GitBranch },
                        ].map(tab => (
                            <button key={tab.id}
                                onClick={() => { setMode(tab.id); startNewChat(); }}
                                style={{
                                    padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 13, fontWeight: mode === tab.id ? 600 : 400,
                                    color: mode === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    borderBottom: mode === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                                    transition: 'all 0.15s ease',
                                }}>
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Config Bar */}
                    <div style={{ padding: '10px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        {mode === 'chat' && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Provider</label>
                                    <select className="form-select" style={{ width: 160, padding: '6px 30px 6px 10px', fontSize: 13 }}
                                        value={selectedProvider} onChange={e => {
                                            setSelectedProvider(e.target.value);
                                            const pm = allModels.filter(m => m.provider_id === e.target.value);
                                            if (pm.length) setSelectedModel(pm[0].model_id);
                                        }}>
                                        <option value="">Select...</option>
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Model</label>
                                    <select className="form-select" style={{ width: 220, padding: '6px 30px 6px 10px', fontSize: 13 }}
                                        value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                                        <option value="">Select...</option>
                                        {currentModels.map(m => <option key={m.id} value={m.model_id}>{m.model_id}</option>)}
                                    </select>
                                </div>
                                {showSettings && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Temp</label>
                                            <input type="range" min="0" max="2" step="0.1" value={temperature}
                                                onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width: 80 }} />
                                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', minWidth: 24 }}>{temperature}</span>
                                        </div>
                                        <input className="form-input" placeholder="System prompt..." style={{ flex: 1, minWidth: 200, padding: '6px 10px', fontSize: 13 }}
                                            value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} />
                                    </div>
                                )}
                            </>
                        )}
                        {mode === 'agent' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Agent</label>
                                <select className="form-select" style={{ width: 260, padding: '6px 30px 6px 10px', fontSize: 13 }}
                                    value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
                                    <option value="">Select an agent...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                {selectedAgentObj && (
                                    <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedAgentObj.model_id}</span>
                                        <span><Wrench size={10} /> {selectedAgentObj.tools?.length || 0} tools</span>
                                        <span>Max {selectedAgentObj.max_iterations} iterations</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {mode === 'workflow' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Workflow</label>
                                <select className="form-select" style={{ width: 260, padding: '6px 30px 6px 10px', fontSize: 13 }}
                                    value={selectedWorkflow} onChange={e => setSelectedWorkflow(e.target.value)}>
                                    <option value="">Select a workflow...</option>
                                    {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {selectedWorkflowObj && (
                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {selectedWorkflowObj.node_count || 0} nodes
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages / Content Area */}
                <div className="chat-messages">
                    {mode === 'workflow' ? (
                        // Workflow mode content
                        <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
                            {!selectedWorkflow ? (
                                <div className="empty-state" style={{ height: 300 }}>
                                    <GitBranch size={48} />
                                    <h3>Workflow Mode</h3>
                                    <p>Select a workflow and provide input data to execute it</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Input Data (JSON)</label>
                                        <textarea className="form-textarea"
                                            value={workflowInput} onChange={e => setWorkflowInput(e.target.value)}
                                            style={{ fontFamily: 'var(--font-mono)', fontSize: 13, minHeight: 120 }}
                                            placeholder='{"key": "value"}' />
                                    </div>
                                    <button className="btn btn-primary" onClick={handleWorkflowExecute} disabled={sending} style={{ marginBottom: 20 }}>
                                        {sending ? <><Loader size={14} className="animate-spin" /> Executing...</> :
                                            <><Zap size={14} /> Execute Workflow</>}
                                    </button>
                                    {workflowResult && (
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ marginBottom: 10 }}>
                                                Status: <span className={`badge ${workflowResult.status === 'completed' ? 'badge-success' : workflowResult.error ? 'badge-error' : 'badge-neutral'}`}>
                                                    {workflowResult.status || (workflowResult.error ? 'error' : 'unknown')}
                                                </span>
                                            </div>
                                            {workflowResult.error && (
                                                <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>
                                                    {workflowResult.error}
                                                </div>
                                            )}
                                            {workflowResult.node_results && Object.entries(workflowResult.node_results).map(([id, r]) => (
                                                <div key={id} style={{
                                                    padding: 12, marginBottom: 6, background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)', fontSize: 13,
                                                    borderLeft: `3px solid ${r.status === 'success' ? 'var(--success)' : 'var(--error)'}`
                                                }}>
                                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.node_name || id}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                        {r.status} — {r.execution_time_ms}ms
                                                    </div>
                                                    {r.output && (
                                                        <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                                            {JSON.stringify(r.output).slice(0, 500)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        // Chat/Agent mode messages
                        <>
                            {messages.length === 0 && (
                                <div className="empty-state" style={{ height: '100%' }}>
                                    {mode === 'chat' ? <Bot size={48} /> : <Bot size={48} />}
                                    <h3>{mode === 'chat' ? 'Chat Playground' : 'Agent Playground'}</h3>
                                    <p>{mode === 'chat'
                                        ? 'Select a provider and model, then start chatting.'
                                        : 'Select an agent and send a query. The agent will use tools autonomously.'
                                    }</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div key={i} className="chat-message" style={{ position: 'relative' }}>
                                    <div className={`chat-message-avatar ${msg.role}`}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className="chat-message-content" style={{ width: '100%' }}>
                                        <div className="chat-message-role" style={{
                                            color: msg.role === 'user' ? 'var(--info)' : 'var(--text-accent)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span>
                                                {msg.role === 'user' ? 'You' :
                                                    (mode === 'agent' ? (selectedAgentObj?.name || 'Agent') : (selectedModel || 'Assistant'))}
                                            </span>

                                            {/* Action Buttons */}
                                            <div className="message-actions" style={{ display: 'flex', gap: 6, opacity: 0.7 }}>
                                                <button
                                                    onClick={() => handleCopy(msg.content, i)}
                                                    className="icon-btn"
                                                    style={{ padding: 4, width: 24, height: 24 }}
                                                    title="Copy message"
                                                >
                                                    {copiedIndex === i ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                                                </button>

                                                {msg.role === 'user' && !sending && (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditStart(i, msg.content)}
                                                            className="icon-btn"
                                                            style={{ padding: 4, width: 24, height: 24 }}
                                                            title="Edit and resubmit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRerun(i)}
                                                            className="icon-btn"
                                                            style={{ padding: 4, width: 24, height: 24 }}
                                                            title="Rerun from here"
                                                        >
                                                            <RotateCcw size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {editingIndex === i ? (
                                            <div style={{ marginTop: 8 }}>
                                                <textarea
                                                    className="chat-input"
                                                    style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 'var(--radius-md)' }}
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                                    <button className="btn btn-secondary" onClick={handleEditCancel}>
                                                        Cancel
                                                    </button>
                                                    <button className="btn btn-primary" onClick={() => handleEditSave(i)}>
                                                        Save & Submit
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="chat-message-text markdown-content" style={{ fontSize: 13, lineHeight: 1.6 }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {msg.usage && (
                                            <div style={{
                                                marginTop: 8, padding: '6px 10px', background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-tertiary)',
                                                display: 'flex', gap: 12, fontFamily: 'var(--font-mono)'
                                            }}>
                                                <span>In: {msg.usage.input_tokens}</span>
                                                <span>Out: {msg.usage.output_tokens}</span>
                                                <span>Total: {msg.usage.total_tokens}</span>
                                                <span>Latency: {msg.usage.latency_ms}ms</span>
                                                <span>TTFB: {msg.usage.ttfb_ms}ms</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Agent Steps Visualization */}
                            {mode === 'agent' && agentSteps.length > 0 && sending && (
                                <div style={{ padding: '10px 0' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, paddingLeft: 52 }}>
                                        Agent Execution Steps
                                    </div>
                                    {agentSteps.map((step, i) => (
                                        <div key={i} style={{
                                            marginLeft: 52, padding: '6px 12px', marginBottom: 4,
                                            borderRadius: 'var(--radius-sm)', fontSize: 12,
                                            borderLeft: `3px solid ${step.type === 'thinking' ? 'var(--warning)' :
                                                step.type === 'tool_call' ? 'var(--cyan)' :
                                                    step.type === 'tool_result' ? 'var(--success)' :
                                                        step.type === 'content' ? 'var(--accent)' :
                                                            step.type.includes('error') ? 'var(--error)' : 'var(--text-tertiary)'
                                                }`,
                                            background: 'var(--bg-tertiary)',
                                        }}>
                                            {step.type === 'thinking' && (
                                                <span style={{ color: 'var(--warning)' }}>Thinking... (iteration {step.iteration})</span>
                                            )}
                                            {step.type === 'tool_call' && (
                                                <span style={{ color: 'var(--cyan)' }}>
                                                    <Wrench size={10} style={{ marginRight: 4 }} />
                                                    Calling tool: <strong>{step.tool}</strong>
                                                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                                                        {JSON.stringify(step.arguments).slice(0, 100)}
                                                    </span>
                                                </span>
                                            )}
                                            {step.type === 'tool_result' && (
                                                <span style={{ color: 'var(--success)' }}>
                                                    Result from {step.tool}: {step.result?.slice(0, 200)}
                                                </span>
                                            )}
                                            {step.type === 'content' && (
                                                <div className="markdown-content" style={{ color: 'var(--text-primary)', marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>Final answer received</div>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {step.content}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            {step.type === 'error' && (
                                                <span style={{ color: 'var(--error)' }}>
                                                    <strong>Error:</strong> {step.error}
                                                </span>
                                            )}
                                            {step.type === 'tool_error' && (
                                                <span style={{ color: 'var(--error)' }}>
                                                    <strong>Tool Error:</strong> {step.content}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {sending && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                    <Loader size={14} className="animate-spin" />
                                    {mode === 'agent' ? 'Agent is working...' : 'Generating...'}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input (Chat/Agent modes) */}
                {mode !== 'workflow' && (
                    <div className="chat-input-area">
                        <div className="chat-input-wrapper">
                            <textarea
                                className="chat-input"
                                placeholder={
                                    mode === 'chat'
                                        ? (selectedModel ? `Message ${selectedModel}...` : 'Select a provider and model...')
                                        : (selectedAgent ? `Message ${selectedAgentObj?.name || 'agent'}...` : 'Select an agent...')
                                }
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                rows={1}
                                disabled={mode === 'chat' ? (!selectedProvider || !selectedModel) : !selectedAgent}
                            />
                            <button className="btn btn-primary" onClick={handleSend}
                                disabled={!input.trim() || sending ||
                                    (mode === 'chat' ? (!selectedProvider || !selectedModel) : !selectedAgent)}>
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
