'use client';
import { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { useAuth } from '@clerk/nextjs';
import { GraduationCap, Plus, Search, Trash2, Edit } from 'lucide-react';
import { api } from '@/lib/api';

export default function SkillsPage() {
    const { currentWorkspace } = useWorkspace();
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', description: '', content: '' });

    useEffect(() => {
        if (currentWorkspace) fetchSkills();
    }, [currentWorkspace]);

    const fetchSkills = async () => {
        setLoading(true);
        try {
            const data = await api.getSkills(currentWorkspace.id);
            setSkills(data.skills || []);
        } catch (error) {
            console.error('Failed to fetch skills', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, workspace_id: currentWorkspace.id };
            if (formData.id) {
                await api.updateSkill(formData.id, payload);
            } else {
                await api.createSkill(payload);
            }
            setIsModalOpen(false);
            fetchSkills();
        } catch (error) {
            console.error('Failed to save skill', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;
        try {
            await api.deleteSkill(id);
            fetchSkills();
        } catch (error) {
            console.error('Failed to delete skill', error);
        }
    };

    const openModal = (skill = null) => {
        if (skill) {
            setFormData(skill);
        } else {
            setFormData({ id: null, name: '', description: '', content: '' });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <GraduationCap className="page-title-icon" />
                        Skills
                    </h1>
                    <p className="page-subtitle">Manage reusable instructional skills that can be connected to Agents.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={16} /> New Skill
                    </button>
                </div>
            </header>

            <div className="content-section">
                {loading ? (
                    <div className="empty-state">Loading skills...</div>
                ) : skills.length === 0 ? (
                    <div className="empty-state">
                        <GraduationCap size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <h3>No Skills Yet</h3>
                        <p>Create a skill to give your agents specialized instructions.</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => openModal()}>
                            Create First Skill
                        </button>
                    </div>
                ) : (
                    <div className="stats-grid">
                        {skills.map((skill) => (
                            <div key={skill.id} className="card">
                                <div className="card-header">
                                    <h3 className="card-title">{skill.name}</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openModal(skill)}><Edit size={14} /></button>
                                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(skill.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        {skill.description || 'No description provided.'}
                                    </p>
                                </div>
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                        Added {new Date(skill.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{formData.id ? 'Edit Skill' : 'Create Skill'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Skill Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Code Reviewer Guidelines"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What does this skill do?"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Instructional Content</label>
                                <textarea
                                    className="form-textarea"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Enter the prompt or specific instructions for the agent..."
                                    rows={10}
                                    required
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{formData.id ? 'Save Changes' : 'Create Skill'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
