'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import {
    Plus, Pencil, Trash2, X, Lock, Code2, Building2, Layers, FolderOpen, ArrowUpRight
} from 'lucide-react';

export default function SecretsPage() {
    const {
        currentOrgId, currentOrg,
        currentEnvId, currentEnv,
        currentWorkspaceId, currentWorkspace
    } = useWorkspace();
    const [secrets, setSecrets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('secret');
    const [scopeLevel, setScopeLevel] = useState('workspace'); // 'org' | 'env' | 'workspace'

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', value: '', type: 'secret', description: '' });

    useEffect(() => {
        fetchSecrets();
    }, [scopeLevel, currentOrgId, currentEnvId, currentWorkspaceId]);

    function getScopeId() {
        if (scopeLevel === 'org') return currentOrgId;
        if (scopeLevel === 'env') return currentEnvId;
        return currentWorkspaceId;
    }

    function getScopeName() {
        if (scopeLevel === 'org') return currentOrg?.name || 'Organization';
        if (scopeLevel === 'env') return currentEnv?.name || 'Environment';
        return currentWorkspace?.name || 'Workspace';
    }

    async function fetchSecrets() {
        const scopeId = getScopeId();
        if (!scopeId) return;
        try {
            setLoading(true);
            const data = await apiFetch(`/secrets?scope_type=${scopeLevel}&scope_id=${scopeId}`);
            setSecrets(data.secrets || []);
        } catch (err) {
            console.error('Failed to load secrets:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate(type) {
        setEditingId(null);
        setForm({ name: '', value: '', type, description: '' });
        setShowModal(true);
    }

    function openEdit(secret) {
        setEditingId(secret.id);
        setForm({
            name: secret.name,
            value: '',
            type: secret.type,
            description: secret.description || '',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editingId) {
                const updates = { name: form.name, description: form.description };
                if (form.value) updates.value = form.value;
                await apiFetch(`/secrets/${editingId}`, { method: 'PUT', body: JSON.stringify(updates) });
            } else {
                await apiFetch('/secrets', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...form,
                        scope_type: scopeLevel,
                        scope_id: getScopeId(),
                    }),
                });
            }
            setShowModal(false);
            fetchSecrets();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this item?')) return;
        try {
            await apiFetch(`/secrets/${id}`, { method: 'DELETE' });
            fetchSecrets();
        } catch (err) {
            alert(err.message);
        }
    }

    const filtered = secrets.filter(s => s.type === activeTab);

    const scopeIcon = {
        org: <Building2 size={14} />,
        env: <Layers size={14} />,
        workspace: <FolderOpen size={14} />,
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1>Secrets & Variables</h1>
                        <p className="page-subtitle">
                            Managing at <strong>{scopeLevel}</strong> level: <strong>{getScopeName()}</strong>
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={() => openCreate(activeTab)}>
                        <Plus size={16} /> Add {activeTab === 'secret' ? 'Secret' : 'Variable'}
                    </button>
                </div>
            </div>

            {/* Scope Selector */}
            <div className="scope-selector">
                <div className="scope-selector-label">Scope:</div>
                {['org', 'env', 'workspace'].map(level => (
                    <button
                        key={level}
                        className={`scope-selector-btn ${scopeLevel === level ? 'active' : ''}`}
                        onClick={() => setScopeLevel(level)}
                    >
                        {scopeIcon[level]}
                        <span>{level === 'org' ? 'Organization' : level === 'env' ? 'Environment' : 'Workspace'}</span>
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="secrets-tabs">
                <button
                    className={`secrets-tab ${activeTab === 'secret' ? 'active' : ''}`}
                    onClick={() => setActiveTab('secret')}
                >
                    <Lock size={16} />
                    Secrets
                    <span className="secrets-tab-count">{secrets.filter(s => s.type === 'secret').length}</span>
                </button>
                <button
                    className={`secrets-tab ${activeTab === 'variable' ? 'active' : ''}`}
                    onClick={() => setActiveTab('variable')}
                >
                    <Code2 size={16} />
                    Variables
                    <span className="secrets-tab-count">{secrets.filter(s => s.type === 'variable').length}</span>
                </button>
            </div>

            {loading ? (
                <div className="loading-state">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    {activeTab === 'secret' ? <Lock size={48} /> : <Code2 size={48} />}
                    <h3>No {activeTab}s yet</h3>
                    <p>{activeTab === 'secret' ? 'Store API keys and sensitive data securely' : 'Store configuration values as variables'}</p>
                    <button className="btn btn-primary" onClick={() => openCreate(activeTab)}>
                        <Plus size={16} /> Add {activeTab === 'secret' ? 'Secret' : 'Variable'}
                    </button>
                </div>
            ) : (
                <div className="secrets-table-wrap">
                    <table className="secrets-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Value</th>
                                <th>Scope</th>
                                <th>Description</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => (
                                <tr key={s.id} className={s.inherited ? 'inherited-row' : ''}>
                                    <td>
                                        <div className="secret-name">
                                            {s.type === 'secret' ? <Lock size={14} /> : <Code2 size={14} />}
                                            <code>{s.name}</code>
                                            {s.inherited && (
                                                <span className="inherited-badge" title={`Inherited from ${s.inherited_from}`}>
                                                    <ArrowUpRight size={10} />
                                                    {s.inherited_from}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {s.type === 'secret' ? (
                                            <span className="secret-masked">••••••••</span>
                                        ) : (
                                            <code className="secret-value">{s.value}</code>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`scope-badge scope-${s.scope_type}`}>
                                            {scopeIcon[s.scope_type]}
                                            {s.scope_type}
                                        </span>
                                    </td>
                                    <td className="secret-desc">{s.description || '—'}</td>
                                    <td className="secret-date">{new Date(s.updated_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="secret-actions">
                                            {!s.inherited ? (
                                                <>
                                                    <button className="btn-icon" onClick={() => openEdit(s)} title="Edit">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button className="btn-icon danger" onClick={() => handleDelete(s.id)} title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="inherited-hint">Edit at source</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit' : 'Add'} {form.type === 'secret' ? 'Secret' : 'Variable'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. API_KEY, DATABASE_URL" required autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Value {editingId && form.type === 'secret' && '(leave blank to keep current)'}
                                    </label>
                                    <input className="form-input"
                                        type={form.type === 'secret' ? 'password' : 'text'}
                                        value={form.value}
                                        onChange={e => setForm({ ...form, value: e.target.value })}
                                        placeholder={form.type === 'secret' ? '••••••••' : 'Value'}
                                        required={!editingId} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        placeholder="Optional description" />
                                </div>
                                {!editingId && (
                                    <div className="form-group">
                                        <label className="form-label">Scope</label>
                                        <div className="scope-display">
                                            {scopeIcon[scopeLevel]}
                                            <span>{scopeLevel === 'org' ? 'Organization' : scopeLevel === 'env' ? 'Environment' : 'Workspace'}: {getScopeName()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Save Changes' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
