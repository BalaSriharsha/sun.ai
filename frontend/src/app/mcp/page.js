'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Server, Play, Square, RotateCw, Trash2, ChevronDown, ChevronRight, X, HardDrive, Database, Globe } from 'lucide-react';

const MCP_ICONS = { filesystem: HardDrive, database: Database, web_scraper: Globe };

export default function MCPPage() {
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [serverTools, setServerTools] = useState({});
    const [form, setForm] = useState({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });

    useEffect(() => { loadServers(); }, []);

    async function loadServers() {
        try {
            const res = await api.getMCPServers();
            setServers(res.servers || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function handleCreate(e) {
        e.preventDefault();
        try {
            await api.createMCPServer({
                name: form.name,
                command: form.command,
                args: form.args.split(' ').filter(Boolean),
                env_vars: JSON.parse(form.env_vars),
                config: JSON.parse(form.config)
            });
            setShowModal(false);
            setForm({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });
            loadServers();
        } catch (e) { alert(e.message); }
    }

    async function handleAction(id, action) {
        try {
            if (action === 'start') await api.startMCPServer(id);
            else if (action === 'stop') await api.stopMCPServer(id);
            else if (action === 'restart') await api.restartMCPServer(id);
            else if (action === 'delete') {
                if (!confirm('Delete this MCP server?')) return;
                await api.deleteMCPServer(id);
            }
            loadServers();
        } catch (e) { alert(e.message); }
    }

    async function toggleExpand(id) {
        if (expanded === id) { setExpanded(null); return; }
        setExpanded(id);
        if (!serverTools[id]) {
            try {
                const res = await api.getMCPTools(id);
                setServerTools(prev => ({ ...prev, [id]: res.tools }));
            } catch (e) { console.error(e); }
        }
    }

    return (
        <div className="animate-fade">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>MCP Servers</h1>
                    <p>Built-in and custom Model Context Protocol servers</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Add Server
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>
            ) : servers.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Server size={48} />
                        <h3>No MCP Servers</h3>
                        <p>Built-in servers will appear after first backend start</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {servers.map(server => {
                        const Icon = MCP_ICONS[server.type] || Server;
                        const isBuiltIn = server.server_type === 'builtin';
                        return (
                            <div key={server.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{
                                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                                    cursor: 'pointer'
                                }} onClick={() => toggleExpand(server.id)}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                        background: isBuiltIn ? 'rgba(249, 115, 22, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                                        color: isBuiltIn ? 'var(--orange)' : 'var(--cyan)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Icon size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 15 }}>{server.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            {server.type || 'Custom'} • {server.available_tools?.length || 0} tools
                                        </div>
                                    </div>
                                    <span className={`badge ${server.status === 'running' ? 'badge-success' : 'badge-neutral'}`}>
                                        {server.status}
                                    </span>
                                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                        {server.status !== 'running' && (
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction(server.id, 'start')} title="Start">
                                                <Play size={14} />
                                            </button>
                                        )}
                                        {server.status === 'running' && (
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction(server.id, 'stop')} title="Stop">
                                                <Square size={14} />
                                            </button>
                                        )}
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction(server.id, 'restart')} title="Restart">
                                            <RotateCw size={14} />
                                        </button>
                                        {!isBuiltIn && (
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction(server.id, 'delete')} title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {expanded === server.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                                {expanded === server.id && (
                                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)' }}>
                                        <div style={{ paddingTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                            Available Tools
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                                            {(serverTools[server.id] || server.available_tools || []).map((tool, i) => (
                                                <div key={i} style={{
                                                    padding: '10px 14px', background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)', fontSize: 13
                                                }}>
                                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{typeof tool === 'string' ? tool : tool.name}</div>
                                                    {typeof tool !== 'string' && tool.description && (
                                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{tool.description}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Custom MCP Server</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Server Name</label>
                                <input className="form-input" required value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My MCP Server" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Command</label>
                                <input className="form-input" required value={form.command}
                                    onChange={e => setForm({ ...form, command: e.target.value })} placeholder="python3" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Arguments</label>
                                <input className="form-input" value={form.args}
                                    onChange={e => setForm({ ...form, args: e.target.value })} placeholder="server.py --port 8080" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Environment Variables (JSON)</label>
                                <textarea className="form-textarea" value={form.env_vars}
                                    onChange={e => setForm({ ...form, env_vars: e.target.value })}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} rows={3} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Server</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
