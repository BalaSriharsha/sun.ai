'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { X, Plus, Trash2, Shield } from 'lucide-react';

export default function PermissionsModal({ resource_type, resource_id, resource_name, onClose }) {
    const { currentOrgId } = useWorkspace();
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Add Grant State
    const [userEmail, setUserEmail] = useState('');
    const [permissionLevel, setPermissionLevel] = useState('read'); // read, write, execute

    useEffect(() => {
        if (currentOrgId && resource_id) {
            fetchPermissions();
        }
    }, [currentOrgId, resource_id]);

    async function fetchPermissions() {
        try {
            setLoading(true);
            const data = await apiFetch(`/permissions/${resource_type}/${resource_id}`);
            setPermissions(data.permissions || []);
        } catch (err) {
            console.error('Failed to load permissions:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleGrant(e) {
        e.preventDefault();
        try {
            await apiFetch(`/permissions/${resource_type}/${resource_id}`, {
                method: 'POST',
                body: JSON.stringify({ user_email: userEmail, permission_level: permissionLevel })
            });
            setUserEmail('');
            fetchPermissions();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleRevoke(email) {
        if (!confirm(`Revoke explicit access for ${email}?`)) return;
        try {
            await apiFetch(`/permissions/${resource_type}/${resource_id}/${email}`, { method: 'DELETE' });
            fetchPermissions();
        } catch (err) {
            alert(err.message);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <div>
                        <h3>Manage Access: {resource_name || resource_type}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Assign explicit permissions to users within the organization.
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="modal-body">
                    {/* Grant new permission */}
                    <form onSubmit={handleGrant} style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Member Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={userEmail}
                                onChange={e => setUserEmail(e.target.value)}
                                placeholder="colleague@example.com"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Access</label>
                            <select
                                className="form-input"
                                value={permissionLevel}
                                onChange={e => setPermissionLevel(e.target.value)}
                            >
                                <option value="read">Read</option>
                                <option value="execute">Execute</option>
                                <option value="write">Write</option>
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                            <Plus size={16} /> Grant
                        </button>
                    </form>

                    {/* Permissions List */}
                    {loading ? (
                        <div className="loading-state" style={{ padding: '24px' }}>Loading...</div>
                    ) : permissions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px', border: '1px dashed var(--border)' }}>
                            <Shield size={24} style={{ color: 'var(--text-secondary)' }} />
                            <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>No explicit permissions granted.</p>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Users with 'admin' or 'owner' roles already have full access.</span>
                        </div>
                    ) : (
                        <div className="secrets-table-wrap" style={{ margin: 0 }}>
                            <table className="secrets-table">
                                <thead>
                                    <tr>
                                        <th>User Email</th>
                                        <th>Granted Level</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 500 }}>{p.user_email}</td>
                                            <td>
                                                <span className={`scope-badge scope-${p.permission_level === 'write' ? 'workspace' : p.permission_level === 'execute' ? 'env' : 'org'}`} style={{ textTransform: 'capitalize' }}>
                                                    {p.permission_level}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="secret-actions">
                                                    <button className="btn-icon danger" onClick={() => handleRevoke(p.user_email)} title="Revoke Access">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
