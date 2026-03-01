'use client';
import { useState, useEffect } from 'react';
import { api, apiFetch } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Plus, Server, Play, Square, RotateCw, Trash2, ChevronDown, ChevronRight, X, HardDrive, Database, Globe, Lock, Pencil, RefreshCw } from 'lucide-react';

const MCP_ICONS = { filesystem: HardDrive, database: Database, web_scraper: Globe };

export default function MCPPage() {
    const { currentOrgId } = useWorkspace();
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingServer, setEditingServer] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [serverTools, setServerTools] = useState({});
    const [discovering, setDiscovering] = useState({});
    const [form, setForm] = useState({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });

    // Env-var configuration modal state
    const [envModal, setEnvModal] = useState(null);
    const [envValues, setEnvValues] = useState({});
    const [envSaving, setEnvSaving] = useState(false);

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
        const orgId = currentOrgId || 'default-org';
        try {
            const result = await api.createMCPServer({
                name: form.name,
                command: form.command,
                args: form.args ? JSON.parse(form.args) : [],
                env: JSON.parse(form.env_vars),
                config: JSON.parse(form.config)
            });
            setShowModal(false);
            setForm({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });
            // Auto-discover tools for the new server
            if (result.id) {
                try {
                    await api.discoverMCPTools(result.id, orgId);
                } catch (err) {
                    console.log('Tool discovery skipped:', err.message);
                }
            }
            loadServers();
        } catch (e) { alert(e.message); }
    }

    function handleEdit(server) {
        setEditingServer(server);
        setForm({
            name: server.name,
            command: server.command || '',
            args: JSON.stringify(server.args || []),
            env_vars: JSON.stringify(server.env || {}, null, 2),
            config: JSON.stringify(server.config || {}, null, 2)
        });
        setShowModal(true);
    }

    async function handleUpdate(e) {
        e.preventDefault();
        try {
            await api.updateMCPServer(editingServer.id, {
                name: form.name,
                command: form.command,
                args: JSON.parse(form.args || '[]'),
                env: JSON.parse(form.env_vars),
                config: JSON.parse(form.config)
            });
            setShowModal(false);
            setEditingServer(null);
            setForm({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });
            loadServers();
        } catch (e) { alert(e.message); }
    }

    async function handleDiscover(serverId) {
        const orgId = currentOrgId || 'default-org';
        setDiscovering(prev => ({ ...prev, [serverId]: true }));
        try {
            const result = await api.discoverMCPTools(serverId, orgId);
            if (result.tools) {
                setServerTools(prev => ({ ...prev, [serverId]: result.tools }));
            }
            loadServers();
        } catch (e) {
            alert('Tool discovery failed: ' + e.message);
        } finally {
            setDiscovering(prev => ({ ...prev, [serverId]: false }));
        }
    }

    function closeModal() {
        setShowModal(false);
        setEditingServer(null);
        setForm({ name: '', type: 'custom', command: '', args: '', env_vars: '{}', config: '{}' });
    }

    async function handleAction(id, action) {
        const orgId = currentOrgId || 'default-org';
        try {
            if (action === 'start') {
                const result = await api.startMCPServer(id, orgId);
                if (result.status === 'missing_env') {
                    setEnvModal({
                        serverId: id,
                        serverName: result.server_name,
                        requiredKeys: result.required_keys,
                    });
                    setEnvValues({});
                    return;
                }
                // Auto-discover tools after successful start
                if (result.status === 'running') {
                    try {
                        const discoverResult = await api.discoverMCPTools(id, orgId);
                        if (discoverResult.tools) {
                            setServerTools(prev => ({ ...prev, [id]: discoverResult.tools }));
                        }
                    } catch (err) {
                        console.log('Tool discovery after start:', err.message);
                    }
                }
            } else if (action === 'stop') await api.stopMCPServer(id);
            else if (action === 'restart') {
                await api.restartMCPServer(id, orgId);
                // Auto-discover tools after restart
                try {
                    const discoverResult = await api.discoverMCPTools(id, orgId);
                    if (discoverResult.tools) {
                        setServerTools(prev => ({ ...prev, [id]: discoverResult.tools }));
                    }
                } catch (err) {
                    console.log('Tool discovery after restart:', err.message);
                }
            } else if (action === 'delete') {
                if (!confirm('Delete this MCP server?')) return;
                await api.deleteMCPServer(id);
            }
            loadServers();
        } catch (e) { alert(e.message); }
    }

    async function handleSaveEnvAndStart(e) {
        e.preventDefault();
        setEnvSaving(true);
        const orgId = currentOrgId || 'default-org';
        try {
            for (const req of envModal.requiredKeys) {
                const val = envValues[req.key];
                if (!val) continue;
                await apiFetch('/secrets', {
                    method: 'POST',
                    body: JSON.stringify({
                        scope_type: 'org',
                        scope_id: orgId,
                        name: req.key,
                        value: val,
                        type: 'secret',
                        description: `${req.description || 'Required by ' + envModal.serverName + ' MCP server'}`,
                    }),
                });
            }
            const result = await api.startMCPServer(envModal.serverId, orgId);
            if (result.status === 'missing_env') {
                alert('Some required values are still missing. Please fill in all fields.');
                return;
            }
            setEnvModal(null);
            setEnvValues({});
            loadServers();
        } catch (err) {
            alert(err.message);
        } finally {
            setEnvSaving(false);
        }
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
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Server className="page-title-icon" />
                        MCP Servers
                    </h1>
                    <p className="page-subtitle">Built-in and custom Model Context Protocol servers</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add Server
                    </button>
                </div>
            </header>

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
                                <div className="card-header" onClick={() => toggleExpand(server.id)} style={{ cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                            background: isBuiltIn ? 'rgba(249, 115, 22, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                                            color: isBuiltIn ? 'var(--orange)' : 'var(--cyan)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <div className="card-title">{server.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                {server.type || 'Custom'} • {server.available_tools?.length || 0} tools
                                            </div>
                                        </div>
                                    </div>
                                    <div className="header-actions" onClick={e => e.stopPropagation()}>
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
                                        <button
                                            className="btn btn-ghost btn-icon btn-sm"
                                            onClick={() => handleDiscover(server.id)}
                                            title="Discover Tools"
                                            disabled={discovering[server.id]}
                                        >
                                            <RefreshCw size={14} className={discovering[server.id] ? 'animate-spin' : ''} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(server)} title="Edit">
                                            <Pencil size={14} />
                                        </button>
                                        {server.type !== 'builtin' && (
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleAction(server.id, 'delete')} title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        <span className={`badge ${server.status === 'running' ? 'badge-success' : 'badge-neutral'}`}>
                                            {server.status}
                                        </span>
                                        {expanded === server.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
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
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingServer ? 'Edit MCP Server' : 'Add Custom MCP Server'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={18} /></button>
                        </div>
                        <form onSubmit={editingServer ? handleUpdate : handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Server Name</label>
                                <input className="form-input" required value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="jira"
                                    disabled={editingServer?.type === 'builtin'} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Command</label>
                                <input className="form-input" required value={form.command}
                                    onChange={e => setForm({ ...form, command: e.target.value })}
                                    placeholder="npx"
                                    disabled={editingServer?.type === 'builtin'} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Arguments (JSON array)</label>
                                <input className="form-input" value={form.args}
                                    onChange={e => setForm({ ...form, args: e.target.value })}
                                    placeholder='["-y", "jira-mcp"]'
                                    disabled={editingServer?.type === 'builtin'} />
                                <small style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>JSON array format, e.g. [&quot;-y&quot;, &quot;package-name&quot;]</small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Environment Variables (JSON)</label>
                                <textarea className="form-textarea" value={form.env_vars}
                                    onChange={e => setForm({ ...form, env_vars: e.target.value })}
                                    placeholder='{"API_KEY": "", "API_URL": ""}'
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} rows={4} />
                                <small style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Empty values will be resolved from org-level secrets</small>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingServer ? 'Save Changes' : 'Add Server'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {envModal && (
                <div className="modal-overlay" onClick={() => setEnvModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Configure {envModal.serverName}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEnvModal(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '0 24px 8px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                            <Lock size={14} />
                            <span>These secrets will be saved at the <strong>organization</strong> level.</span>
                        </div>
                        <form onSubmit={handleSaveEnvAndStart}>
                            {envModal.requiredKeys.map(req => (
                                <div className="form-group" key={req.key} style={{ padding: '0 24px' }}>
                                    <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{req.key}</label>
                                    <input
                                        className="form-input"
                                        type="password"
                                        required
                                        value={envValues[req.key] || ''}
                                        onChange={e => setEnvValues(prev => ({ ...prev, [req.key]: e.target.value }))}
                                        placeholder={req.description || `Enter value for ${req.key}`}
                                        autoFocus={envModal.requiredKeys.indexOf(req) === 0}
                                    />
                                </div>
                            ))}
                            <div className="modal-actions" style={{ padding: '16px 24px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEnvModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={envSaving}>
                                    {envSaving ? 'Saving...' : 'Save & Start'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
