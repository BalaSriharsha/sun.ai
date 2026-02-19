'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Plus, Bot, Play, Trash2, Edit, X, Wrench, Cpu, Send, ChevronDown, ChevronRight, Server } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AgentsPage() {
    const { currentWorkspaceId, currentOrgId } = useWorkspace();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState(null);
    const [providers, setProviders] = useState([]);
    const [allModels, setAllModels] = useState({});
    const [tools, setTools] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);
    const [testingId, setTestingId] = useState(null);
    const [testQuery, setTestQuery] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [form, setForm] = useState({
        name: '', description: '', system_prompt: 'You are a helpful AI assistant.',
        provider_id: '', model_id: '', tools: [], mcp_servers: [],
        temperature: 0.7, max_tokens: 4096, max_iterations: 10
    });

    useEffect(() => {
        if (currentWorkspaceId) loadAgents();
        if (currentOrgId) loadProviders();
        loadTools();
        loadMCPServers();
    }, [currentWorkspaceId, currentOrgId]);

    async function loadAgents() {
        if (!currentWorkspaceId) return;
        setLoading(true);
        try {
            const res = await api.getAgents(currentWorkspaceId);
            setAgents(res.agents || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function loadProviders() {
        if (!currentOrgId) return;
        try {
            const res = await api.getProviders(currentOrgId);
            setProviders(res.providers || []);
            const models = {};
            for (const p of (res.providers || [])) {
                try {
                    const mr = await api.getProviderModels(p.id);
                    models[p.id] = mr.models || [];
                } catch (e) { models[p.id] = []; }
            }
            setAllModels(models);
        } catch (e) { console.error(e); }
    }

    async function loadTools() {
        try {
            const res = await api.getTools();
            setTools(res.tools || []);
        } catch (e) { console.error(e); }
    }

    async function loadMCPServers() {
        try {
            const res = await api.getMCPServers();
            setMcpServers(res.servers || []);
        } catch (e) { console.error(e); }
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = { ...form };
            if (editingAgent) {
                await api.updateAgent(editingAgent.id, data);
            } else {
                // Agents are workspace-scoped
                data.workspace_id = currentWorkspaceId;
                await api.createAgent(data);
            }
            setShowModal(false);
            setEditingAgent(null);
            resetForm();
            loadAgents();
        } catch (e) { alert(e.message); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this agent?')) return;
        try {
            await api.deleteAgent(id);
            loadAgents();
        } catch (e) { alert(e.message); }
    }

    async function handleTest(agent) {
        if (!testQuery.trim()) return;
        setTestingId(agent.id);
        setTestResult(null);
        try {
            const res = await api.queryAgent(agent.id, { query: testQuery });
            setTestResult({ id: agent.id, result: res });
        } catch (e) {
            setTestResult({ id: agent.id, result: { error: e.message } });
        }
        setTestingId(null);
    }

    function openEdit(agent) {
        setEditingAgent(agent);
        setForm({
            name: agent.name, description: agent.description || '',
            system_prompt: agent.system_prompt || 'You are a helpful AI assistant.',
            provider_id: agent.provider_id || '', model_id: agent.model_id || '',
            tools: agent.tools || [], mcp_servers: agent.mcp_servers || [],
            temperature: agent.temperature || 0.7,
            max_tokens: agent.max_tokens || 4096, max_iterations: agent.max_iterations || 10
        });
        setShowModal(true);
    }

    function resetForm() {
        setForm({
            name: '', description: '', system_prompt: 'You are a helpful AI assistant.',
            provider_id: '', model_id: '', tools: [], mcp_servers: [],
            temperature: 0.7, max_tokens: 4096, max_iterations: 10
        });
    }

    function toggleTool(toolId) {
        setForm(f => ({
            ...f,
            tools: f.tools.includes(toolId) ? f.tools.filter(t => t !== toolId) : [...f.tools, toolId]
        }));
    }

    function toggleMCP(mcpId) {
        setForm(f => ({
            ...f,
            mcp_servers: f.mcp_servers.includes(mcpId) ? f.mcp_servers.filter(m => m !== mcpId) : [...f.mcp_servers, mcpId]
        }));
    }

    const currentModels = allModels[form.provider_id] || [];

    return (
        <div className="animate-fade">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>Agents</h1>
                    <p>Create and manage AI agents with tool-calling capabilities</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingAgent(null); resetForm(); setShowModal(true);
                }}>
                    <Plus size={16} /> Create Agent
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>
            ) : agents.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Bot size={48} />
                        <h3>No agents yet</h3>
                        <p>Create an agent with a model, tools, and system prompt</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {agents.map(agent => (
                        <div key={agent.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{
                                padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
                                cursor: 'pointer'
                            }} onClick={() => setExpandedId(expandedId === agent.id ? null : agent.id)}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(6, 182, 212, 0.15))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Bot size={22} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 16 }}>{agent.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 12, marginTop: 2 }}>
                                        <span>{agent.provider_name || 'No provider'}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{agent.model_id || 'No model'}</span>
                                        <span><Wrench size={10} style={{ marginRight: 3 }} />{agent.tools?.length || 0} tools</span>
                                        <span><Server size={10} style={{ marginRight: 3 }} />{agent.mcp_servers?.length || 0} MCPs</span>
                                    </div>
                                </div>
                                <span className={`badge ${agent.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                                    {agent.status}
                                </span>
                                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(agent)}><Edit size={14} /></button>
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(agent.id)}><Trash2 size={14} /></button>
                                </div>
                                {expandedId === agent.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>

                            {expandedId === agent.id && (
                                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)' }}>
                                    {/* Agent Details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '14px 0' }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>TEMPERATURE</div>
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{agent.temperature}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>MAX TOKENS</div>
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{agent.max_tokens}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>MAX ITERATIONS</div>
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{agent.max_iterations}</div>
                                        </div>
                                    </div>
                                    {agent.description && (
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                            {agent.description}
                                        </div>
                                    )}

                                    {/* Query Endpoint Info */}
                                    <div style={{
                                        padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                        fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8
                                    }}>
                                        <span className="badge badge-info" style={{ fontFamily: 'var(--font-sans)' }}>POST</span>
                                        <span>/api/agents/{agent.id}/query</span>
                                    </div>

                                    {/* Inline Test */}
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Test Agent</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input className="form-input" placeholder="Ask something..."
                                            value={expandedId === agent.id ? testQuery : ''} style={{ flex: 1 }}
                                            onChange={e => setTestQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleTest(agent)} />
                                        <button className="btn btn-primary btn-sm" onClick={() => handleTest(agent)}
                                            disabled={testingId === agent.id}>
                                            {testingId === agent.id ? <div className="loading-spinner" style={{ width: 14, height: 14 }} /> : <Send size={14} />}
                                        </button>
                                    </div>
                                    {testResult?.id === agent.id && (
                                        <div style={{ marginTop: 10 }}>
                                            {testResult.result.steps && (
                                                <div style={{ marginBottom: 8 }}>
                                                    {testResult.result.steps.map((step, i) => (
                                                        <div key={i} style={{
                                                            padding: '6px 10px', marginBottom: 3, fontSize: 12,
                                                            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                                                            borderLeft: `3px solid ${step.type === 'tool_call' ? 'var(--cyan)' : step.type === 'tool_result' ? 'var(--success)' : 'var(--accent)'}`
                                                        }}>
                                                            <span style={{
                                                                fontWeight: 600,
                                                                color: step.type === 'tool_call' ? 'var(--cyan)' : step.type === 'tool_result' ? 'var(--success)' : 'var(--text-primary)'
                                                            }}>
                                                                {step.type === 'tool_call' ? `Tool: ${step.tool}` :
                                                                    step.type === 'tool_result' ? `Result: ${step.result?.slice(0, 200)}` :
                                                                        step.content}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {testResult.result.content && (
                                                <div style={{
                                                    padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                                                    fontSize: 13, lineHeight: 1.6
                                                }} className="markdown-content">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {testResult.result.content}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            {testResult.result.error && (
                                                <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--error)' }}>
                                                    {testResult.result.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingAgent ? 'Edit Agent' : 'Create Agent'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Agent Name</label>
                                    <input className="form-input" required value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Research Agent" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        placeholder="Searches the web and summarizes findings" />
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Provider</label>
                                    <select className="form-select" required value={form.provider_id}
                                        onChange={e => setForm({ ...form, provider_id: e.target.value, model_id: '' })}>
                                        <option value="">Select Provider</option>
                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Model</label>
                                    <select className="form-select" required value={form.model_id}
                                        onChange={e => setForm({ ...form, model_id: e.target.value })}>
                                        <option value="">Select Model</option>
                                        {currentModels.map(m => <option key={m.id} value={m.model_id}>{m.model_id}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tools ({form.tools.length} selected)</label>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6,
                                    maxHeight: 180, overflowY: 'auto', padding: 8,
                                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                                }}>
                                    {tools.map(tool => (
                                        <label key={tool.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13,
                                            background: form.tools.includes(tool.id) ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                            border: `1px solid ${form.tools.includes(tool.id) ? 'var(--accent)' : 'transparent'}`
                                        }}>
                                            <input type="checkbox" checked={form.tools.includes(tool.id)}
                                                onChange={() => toggleTool(tool.id)} />
                                            <span>{tool.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">MCP Servers ({form.mcp_servers.length} selected)</label>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6,
                                    maxHeight: 180, overflowY: 'auto', padding: 8,
                                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                                }}>
                                    {mcpServers.map(server => (
                                        <label key={server.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13,
                                            background: form.mcp_servers.includes(server.id) ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                                            border: `1px solid ${form.mcp_servers.includes(server.id) ? 'var(--orange)' : 'transparent'}`
                                        }}>
                                            <input type="checkbox" checked={form.mcp_servers.includes(server.id)}
                                                onChange={() => toggleMCP(server.id)} />
                                            <Server size={14} style={{ color: 'var(--orange)' }} />
                                            <span>{server.name}</span>
                                        </label>
                                    ))}
                                    {mcpServers.length === 0 && (
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 8 }}>No MCP servers configured</div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Runbook</label>
                                <textarea className="form-textarea" value={form.system_prompt}
                                    onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                                    style={{ minHeight: 120 }}
                                    placeholder="Define the agent's behavior, instructions, and workflow steps..." />
                            </div>

                            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="form-label">Temperature</label>
                                    <input className="form-input" type="number" step="0.1" min="0" max="2"
                                        value={form.temperature} onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Max Tokens</label>
                                    <input className="form-input" type="number" min="1"
                                        value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Max Iterations</label>
                                    <input className="form-input" type="number" min="1" max="50"
                                        value={form.max_iterations} onChange={e => setForm({ ...form, max_iterations: parseInt(e.target.value) })} />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingAgent ? 'Update' : 'Create'} Agent</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
