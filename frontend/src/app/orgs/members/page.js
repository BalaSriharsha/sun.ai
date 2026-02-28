'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { useUser } from '@clerk/nextjs';
import {
    Plus, Pencil, Trash2, X, Users, BadgeCheck, Clock, ShieldAlert, Mail
} from 'lucide-react';

export default function MembersPage() {
    const { user } = useUser();
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress;

    const {
        currentOrgId, currentOrg, loadOrgs
    } = useWorkspace();

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingEmail, setEditingEmail] = useState(null);
    const [form, setForm] = useState({ user_email: '', role: 'member' });

    useEffect(() => {
        if (currentOrgId) {
            fetchMembers();
        }
    }, [currentOrgId]);

    async function fetchMembers() {
        if (!currentOrgId) return;
        try {
            setLoading(true);
            const data = await apiFetch(`/orgs/${currentOrgId}/members`);
            setMembers(data.members || []);
        } catch (err) {
            console.error('Failed to load members:', err);
        } finally {
            setLoading(false);
        }
    }

    function openInvite() {
        setEditingEmail(null);
        setForm({ user_email: '', role: 'member' });
        setShowModal(true);
    }

    function openEdit(member) {
        setEditingEmail(member.user_email);
        setForm({ user_email: member.user_email, role: member.role });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editingEmail) {
                await apiFetch(`/orgs/${currentOrgId}/members/${editingEmail}`, {
                    method: 'PUT',
                    body: JSON.stringify({ role: form.role })
                });
            } else {
                await apiFetch(`/orgs/${currentOrgId}/members`, {
                    method: 'POST',
                    body: JSON.stringify(form)
                });
            }
            setShowModal(false);
            fetchMembers();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleRemove(email) {
        if (!confirm(`Are you sure you want to remove ${email} from the organization?`)) return;
        try {
            await apiFetch(`/orgs/${currentOrgId}/members/${email}`, { method: 'DELETE' });
            fetchMembers();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleAcceptInvite() {
        try {
            await apiFetch(`/orgs/${currentOrgId}/members/${currentUserEmail}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'active' })
            });
            fetchMembers();
            loadOrgs();
        } catch (err) {
            alert(err.message);
        }
    }

    const myMemberRecord = members.find(m => m.user_email === currentUserEmail);
    const hasAdminRights = myMemberRecord?.role === 'owner' || myMemberRecord?.role === 'admin';

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1>Members & Roles</h1>
                        <p className="page-subtitle">
                            Manage access for <strong>{currentOrg?.name}</strong>
                        </p>
                    </div>
                    {hasAdminRights && (
                        <button className="btn btn-primary" onClick={openInvite}>
                            <Plus size={16} /> Invite Member
                        </button>
                    )}
                </div>
            </div>

            {myMemberRecord?.status === 'pending' && (
                <div className="alert-banner" style={{ background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Mail style={{ color: 'var(--accent)' }} />
                        <div>
                            <h4 style={{ margin: 0 }}>You have a pending invitation!</h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>You've been invited to join <strong>{currentOrg?.name}</strong> as a {myMemberRecord.role}.</p>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleAcceptInvite}>Accept Invitation</button>
                </div>
            )}

            {loading ? (
                <div className="loading-state">Loading...</div>
            ) : members.length === 0 ? (
                <div className="empty-state">
                    <Users size={48} />
                    <h3>No members found</h3>
                    <p>Invite your team to collaborate in this organization.</p>
                </div>
            ) : (
                <div className="secrets-table-wrap">
                    <table className="secrets-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                {hasAdminRights && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.id}>
                                    <td>
                                        <div className="secret-name">
                                            {m.user_email === currentUserEmail ? <BadgeCheck size={14} color="var(--accent)" /> : <Users size={14} />}
                                            <span style={{ fontWeight: 500 }}>{m.user_email}</span>
                                            {m.user_email === currentUserEmail && <span className="inherited-badge" style={{ background: 'var(--accent)', color: 'white' }}>You</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`scope-badge`} style={{
                                            background: m.role === 'owner' ? '#4f46e520' : m.role === 'admin' ? '#0ea5e920' : '#334155',
                                            color: m.role === 'owner' ? '#818cf8' : m.role === 'admin' ? '#38bdf8' : '#94a3b8'
                                        }}>
                                            {m.role === 'owner' && <ShieldAlert size={12} />}
                                            {m.role}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: m.status === 'active' ? '#10b981' : '#f59e0b' }}>
                                            {m.status === 'active' ? <BadgeCheck size={14} /> : <Clock size={14} />}
                                            {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                                        </div>
                                    </td>
                                    <td className="secret-date">{new Date(m.created_at).toLocaleDateString()}</td>
                                    {hasAdminRights && (
                                        <td>
                                            <div className="secret-actions">
                                                <button className="btn-icon" onClick={() => openEdit(m)} title="Edit Role">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="btn-icon danger" onClick={() => handleRemove(m.user_email)} title="Remove Member">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
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
                            <h3>{editingEmail ? 'Edit Member Role' : 'Invite Member'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={form.user_email}
                                        onChange={e => setForm({ ...form, user_email: e.target.value })}
                                        placeholder="colleague@example.com"
                                        required
                                        autoFocus
                                        disabled={!!editingEmail}
                                        style={{ opacity: editingEmail ? 0.6 : 1 }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select
                                        className="form-input"
                                        value={form.role}
                                        onChange={e => setForm({ ...form, role: e.target.value })}
                                    >
                                        <option value="owner">Owner (Full org control)</option>
                                        <option value="admin">Admin (Manage members & resources)</option>
                                        <option value="member">Member (Create & edit resources)</option>
                                        <option value="viewer">Viewer (Read-only access)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingEmail ? 'Save Changes' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
