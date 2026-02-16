'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import {
    Building2, Plus, Pencil, Trash2, FolderOpen, Layers,
    ChevronRight, ChevronDown, X
} from 'lucide-react';

export default function OrgsPage() {
    const { loadOrgs, loadEnvironments, loadWorkspaces } = useWorkspace();
    const [orgs, setOrgs] = useState([]);
    const [expandedOrg, setExpandedOrg] = useState(null);
    const [expandedEnv, setExpandedEnv] = useState(null);
    const [envsByOrg, setEnvsByOrg] = useState({});
    const [workspacesByEnv, setWorkspacesByEnv] = useState({});
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('org');
    const [modalData, setModalData] = useState({ name: '', description: '' });
    const [modalParentOrg, setModalParentOrg] = useState(null);
    const [modalParentEnv, setModalParentEnv] = useState(null);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => { fetchOrgs(); }, []);

    async function fetchOrgs() {
        try {
            const data = await apiFetch('/orgs');
            setOrgs(data.organizations || []);
        } catch (err) {
            console.error('Failed to load orgs:', err);
        } finally {
            setLoading(false);
        }
    }

    async function toggleExpandOrg(orgId) {
        if (expandedOrg === orgId) {
            setExpandedOrg(null);
            setExpandedEnv(null);
            return;
        }
        setExpandedOrg(orgId);
        setExpandedEnv(null);
        if (!envsByOrg[orgId]) {
            try {
                const data = await apiFetch(`/orgs/${orgId}/environments`);
                setEnvsByOrg(prev => ({ ...prev, [orgId]: data.environments || [] }));
            } catch (err) {
                console.error('Failed to load environments:', err);
            }
        }
    }

    async function toggleExpandEnv(orgId, envId) {
        if (expandedEnv === envId) {
            setExpandedEnv(null);
            return;
        }
        setExpandedEnv(envId);
        if (!workspacesByEnv[envId]) {
            try {
                const data = await apiFetch(`/orgs/${orgId}/workspaces?env_id=${envId}`);
                setWorkspacesByEnv(prev => ({ ...prev, [envId]: data.workspaces || [] }));
            } catch (err) {
                console.error('Failed to load workspaces:', err);
            }
        }
    }

    // Modal openers
    function openCreateOrg() {
        setModalMode('org');
        setModalData({ name: '', description: '' });
        setShowModal(true);
    }
    function openCreateEnv(orgId) {
        setModalMode('env');
        setModalParentOrg(orgId);
        setModalData({ name: '', description: '' });
        setShowModal(true);
    }
    function openCreateWorkspace(orgId, envId) {
        setModalMode('workspace');
        setModalParentOrg(orgId);
        setModalParentEnv(envId);
        setModalData({ name: '', description: '' });
        setShowModal(true);
    }
    function openEditOrg(org) {
        setModalMode('editOrg');
        setEditingId(org.id);
        setModalData({ name: org.name, description: org.description || '' });
        setShowModal(true);
    }
    function openEditEnv(orgId, env) {
        setModalMode('editEnv');
        setModalParentOrg(orgId);
        setEditingId(env.id);
        setModalData({ name: env.name, description: env.description || '' });
        setShowModal(true);
    }
    function openEditWorkspace(orgId, envId, ws) {
        setModalMode('editWorkspace');
        setModalParentOrg(orgId);
        setModalParentEnv(envId);
        setEditingId(ws.id);
        setModalData({ name: ws.name, description: ws.description || '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (modalMode === 'org') {
                await apiFetch('/orgs', { method: 'POST', body: JSON.stringify(modalData) });
            } else if (modalMode === 'env') {
                await apiFetch(`/orgs/${modalParentOrg}/environments`, { method: 'POST', body: JSON.stringify(modalData) });
                const data = await apiFetch(`/orgs/${modalParentOrg}/environments`);
                setEnvsByOrg(prev => ({ ...prev, [modalParentOrg]: data.environments || [] }));
            } else if (modalMode === 'workspace') {
                await apiFetch(`/orgs/${modalParentOrg}/workspaces?env_id=${modalParentEnv}`, { method: 'POST', body: JSON.stringify(modalData) });
                const data = await apiFetch(`/orgs/${modalParentOrg}/workspaces?env_id=${modalParentEnv}`);
                setWorkspacesByEnv(prev => ({ ...prev, [modalParentEnv]: data.workspaces || [] }));
            } else if (modalMode === 'editOrg') {
                await apiFetch(`/orgs/${editingId}`, { method: 'PUT', body: JSON.stringify(modalData) });
            } else if (modalMode === 'editEnv') {
                await apiFetch(`/orgs/${modalParentOrg}/environments/${editingId}`, { method: 'PUT', body: JSON.stringify(modalData) });
                const data = await apiFetch(`/orgs/${modalParentOrg}/environments`);
                setEnvsByOrg(prev => ({ ...prev, [modalParentOrg]: data.environments || [] }));
            } else if (modalMode === 'editWorkspace') {
                await apiFetch(`/orgs/${modalParentOrg}/workspaces/${editingId}`, { method: 'PUT', body: JSON.stringify(modalData) });
                const data = await apiFetch(`/orgs/${modalParentOrg}/workspaces?env_id=${modalParentEnv}`);
                setWorkspacesByEnv(prev => ({ ...prev, [modalParentEnv]: data.workspaces || [] }));
            }
            setShowModal(false);
            fetchOrgs();
            loadOrgs();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteOrg(orgId) {
        if (!confirm('Delete this organization and all its environments and workspaces?')) return;
        try {
            await apiFetch(`/orgs/${orgId}`, { method: 'DELETE' });
            fetchOrgs();
            loadOrgs();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteEnv(orgId, envId) {
        if (!confirm('Delete this environment and all its workspaces?')) return;
        try {
            await apiFetch(`/orgs/${orgId}/environments/${envId}`, { method: 'DELETE' });
            const data = await apiFetch(`/orgs/${orgId}/environments`);
            setEnvsByOrg(prev => ({ ...prev, [orgId]: data.environments || [] }));
            loadEnvironments();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteWorkspace(orgId, envId, wsId) {
        if (!confirm('Delete this workspace?')) return;
        try {
            await apiFetch(`/orgs/${orgId}/workspaces/${wsId}`, { method: 'DELETE' });
            const data = await apiFetch(`/orgs/${orgId}/workspaces?env_id=${envId}`);
            setWorkspacesByEnv(prev => ({ ...prev, [envId]: data.workspaces || [] }));
            loadWorkspaces();
        } catch (err) {
            alert(err.message);
        }
    }

    const modalTitles = {
        org: 'Create Organization', env: 'Create Environment', workspace: 'Create Workspace',
        editOrg: 'Edit Organization', editEnv: 'Edit Environment', editWorkspace: 'Edit Workspace',
    };
    const modalPlaceholders = {
        org: 'Organization name', env: 'Environment name', workspace: 'Workspace name',
        editOrg: 'Organization name', editEnv: 'Environment name', editWorkspace: 'Workspace name',
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1>Organizations</h1>
                        <p className="page-subtitle">Manage your organizations, environments, and workspaces</p>
                    </div>
                    <button className="btn btn-primary" onClick={openCreateOrg}>
                        <Plus size={16} /> New Organization
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">Loading organizations...</div>
            ) : orgs.length === 0 ? (
                <div className="empty-state">
                    <Building2 size={48} />
                    <h3>No organizations yet</h3>
                    <p>Create your first organization to get started</p>
                    <button className="btn btn-primary" onClick={openCreateOrg}>
                        <Plus size={16} /> Create Organization
                    </button>
                </div>
            ) : (
                <div className="orgs-list">
                    {orgs.map(org => (
                        <div key={org.id} className="org-card">
                            {/* Org Header */}
                            <div className="org-card-header" onClick={() => toggleExpandOrg(org.id)}>
                                <div className="org-card-left">
                                    {expandedOrg === org.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    <div className="org-card-icon">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <div className="org-card-name">{org.name}</div>
                                        <div className="org-card-meta">
                                            {org.environment_count || 0} env{(org.environment_count || 0) !== 1 ? 's' : ''}
                                            {' · '}
                                            {org.workspace_count || 0} workspace{(org.workspace_count || 0) !== 1 ? 's' : ''}
                                            {org.description && ` · ${org.description}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="org-card-actions" onClick={e => e.stopPropagation()}>
                                    <button className="btn-icon" onClick={() => openCreateEnv(org.id)} title="Add environment">
                                        <Plus size={16} />
                                    </button>
                                    <button className="btn-icon" onClick={() => openEditOrg(org)} title="Edit">
                                        <Pencil size={16} />
                                    </button>
                                    <button className="btn-icon danger" onClick={() => deleteOrg(org.id)} title="Delete">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Environments */}
                            {expandedOrg === org.id && (
                                <div className="org-environments">
                                    {(envsByOrg[org.id] || []).length === 0 ? (
                                        <div className="env-empty">No environments in this organization</div>
                                    ) : (
                                        (envsByOrg[org.id] || []).map(env => (
                                            <div key={env.id} className="env-card">
                                                <div className="env-card-header" onClick={() => toggleExpandEnv(org.id, env.id)}>
                                                    <div className="env-card-left">
                                                        {expandedEnv === env.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        <Layers size={16} />
                                                        <div>
                                                            <div className="env-card-name">{env.name}</div>
                                                            <div className="env-card-meta">
                                                                {env.workspace_count || 0} workspace{(env.workspace_count || 0) !== 1 ? 's' : ''}
                                                                {env.description && ` · ${env.description}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="env-card-actions" onClick={e => e.stopPropagation()}>
                                                        <button className="btn-icon" onClick={() => openCreateWorkspace(org.id, env.id)} title="Add workspace">
                                                            <Plus size={14} />
                                                        </button>
                                                        <button className="btn-icon" onClick={() => openEditEnv(org.id, env)} title="Edit">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button className="btn-icon danger" onClick={() => deleteEnv(org.id, env.id)} title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Workspaces */}
                                                {expandedEnv === env.id && (
                                                    <div className="org-workspaces">
                                                        {(workspacesByEnv[env.id] || []).length === 0 ? (
                                                            <div className="workspace-empty">No workspaces in this environment</div>
                                                        ) : (
                                                            (workspacesByEnv[env.id] || []).map(ws => (
                                                                <div key={ws.id} className="workspace-row">
                                                                    <div className="workspace-row-left">
                                                                        <FolderOpen size={16} />
                                                                        <div>
                                                                            <div className="workspace-row-name">{ws.name}</div>
                                                                            {ws.description && <div className="workspace-row-desc">{ws.description}</div>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="workspace-row-actions">
                                                                        <button className="btn-icon" onClick={() => openEditWorkspace(org.id, env.id, ws)} title="Edit">
                                                                            <Pencil size={14} />
                                                                        </button>
                                                                        <button className="btn-icon danger" onClick={() => deleteWorkspace(org.id, env.id, ws.id)} title="Delete">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modalTitles[modalMode]}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={modalData.name}
                                        onChange={e => setModalData({ ...modalData, name: e.target.value })}
                                        placeholder={modalPlaceholders[modalMode]}
                                        required autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" value={modalData.description}
                                        onChange={e => setModalData({ ...modalData, description: e.target.value })}
                                        placeholder="Optional description" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {modalMode.startsWith('edit') ? 'Save Changes' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
