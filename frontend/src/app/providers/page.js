'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, ChevronDown, ChevronRight, Eye } from 'lucide-react';

const PROVIDER_TYPES = [
    { value: 'openai', label: 'OpenAI', color: '#10b981' },
    { value: 'anthropic', label: 'Anthropic', color: '#f97316' },
    { value: 'google', label: 'Google (Gemini)', color: '#3b82f6' },
    { value: 'groq', label: 'Groq', color: '#ec4899' },
    { value: 'mistral', label: 'Mistral', color: '#f59e0b' },
    { value: 'azure', label: 'Azure OpenAI', color: '#0078d4' },
    { value: 'bedrock', label: 'AWS Bedrock', color: '#ff9900' },
    { value: 'sarvam', label: 'Sarvam AI', color: '#6d28d9' },
    { value: 'ollama', label: 'Ollama (Local)', color: '#8b5cf6' },
    { value: 'openrouter', label: 'OpenRouter', color: '#06b6d4' },
];

export default function ProvidersPage() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedProvider, setExpandedProvider] = useState(null);
    const [models, setModels] = useState({});
    const [form, setForm] = useState({ name: '', type: 'openai', api_key: '', base_url: '' });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { loadProviders(); }, []);

    async function loadProviders() {
        try {
            const res = await api.getProviders();
            setProviders(res.providers || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    async function handleAdd(e) {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);
        try {
            const data = { name: form.name, type: form.type, api_key: form.api_key };
            if (form.base_url) data.base_url = form.base_url;
            await api.createProvider(data);
            setShowModal(false);
            setForm({ name: '', type: 'openai', api_key: '', base_url: '' });
            loadProviders();
        } catch (e) {
            setFormError(e.message);
        }
        setSubmitting(false);
    }

    async function handleDelete(id) {
        if (!confirm('Delete this provider and all its models?')) return;
        try {
            await api.deleteProvider(id);
            loadProviders();
        } catch (e) {
            alert(e.message);
        }
    }

    async function handleRefresh(id) {
        try {
            const res = await api.refreshModels(id);
            setModels(prev => ({ ...prev, [id]: res.models }));
            loadProviders();
        } catch (e) {
            alert(e.message);
        }
    }

    async function toggleExpand(id) {
        if (expandedProvider === id) {
            setExpandedProvider(null);
            return;
        }
        setExpandedProvider(id);
        if (!models[id]) {
            try {
                const res = await api.getProviderModels(id);
                setModels(prev => ({ ...prev, [id]: res.models }));
            } catch (e) {
                console.error(e);
            }
        }
    }

    const getProviderColor = (type) => PROVIDER_TYPES.find(p => p.value === type)?.color || '#7c3aed';

    return (
        <div className="animate-fade">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>AI Providers</h1>
                    <p>Manage AI providers and discover available models</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Add Provider
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="loading-spinner" />
                </div>
            ) : providers.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" /></svg>
                        <h3>No providers configured</h3>
                        <p>Connect an AI provider like OpenAI, Anthropic, or Google to start using models</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
                            <Plus size={16} /> Add Your First Provider
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {providers.map(provider => (
                        <div key={provider.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="provider-card" style={{ cursor: 'pointer', borderRadius: 0, border: 'none' }}
                                onClick={() => toggleExpand(provider.id)}>
                                <div className="provider-icon" style={{
                                    background: `${getProviderColor(provider.type)}20`,
                                    color: getProviderColor(provider.type)
                                }}>
                                    {provider.type.charAt(0).toUpperCase()}
                                </div>
                                <div className="provider-info" style={{ flex: 1 }}>
                                    <h3>{provider.name}</h3>
                                    <span className="provider-type">{provider.type}</span>
                                </div>
                                <span className={`badge ${provider.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                                    {provider.status === 'active' ? <><CheckCircle size={10} /> Active</> : <><XCircle size={10} /> Error</>}
                                </span>
                                <span className="chip">{provider.model_count} models</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost btn-icon btn-sm" title="Refresh models"
                                        onClick={(e) => { e.stopPropagation(); handleRefresh(provider.id); }}>
                                        <RefreshCw size={14} />
                                    </button>
                                    <button className="btn btn-ghost btn-icon btn-sm" title="Delete"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(provider.id); }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {expandedProvider === provider.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>

                            {expandedProvider === provider.id && (
                                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)', animation: 'slideUp 200ms ease' }}>
                                    <div style={{ padding: '12px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Discovered Models ({models[provider.id]?.length || provider.model_count})
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Model ID</th>
                                                    <th>Context Window</th>
                                                    <th>Input $/1K</th>
                                                    <th>Output $/1K</th>
                                                    <th>Tools</th>
                                                    <th>Vision</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(models[provider.id] || []).map(model => (
                                                    <tr key={model.id}>
                                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{model.model_id}</td>
                                                        <td>{(model.context_window || 0).toLocaleString()}</td>
                                                        <td>${model.input_price_per_1k}</td>
                                                        <td>${model.output_price_per_1k}</td>
                                                        <td>{model.supports_tools ? <CheckCircle size={14} style={{ color: 'var(--success)' }} /> : '—'}</td>
                                                        <td>{model.supports_vision ? <Eye size={14} style={{ color: 'var(--info)' }} /> : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add AI Provider</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="form-group">
                                <label className="form-label">Provider Name</label>
                                <input className="form-input" placeholder="e.g., My OpenAI" required
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Provider Type</label>
                                <select className="form-select" value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}>
                                    {PROVIDER_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">API Key {form.type === 'ollama' && '(optional for local)'}{form.type === 'bedrock' && ' (format: access_key:secret_key)'}</label>
                                <input className="form-input" type="password" placeholder={form.type === 'bedrock' ? 'AKIAIOSFODNN7EXAMPLE:wJalr...' : 'sk-...'}
                                    value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })}
                                    required={form.type !== 'ollama'} />
                            </div>
                            {(['ollama', 'openai', 'azure', 'bedrock', 'sarvam'].includes(form.type)) && (
                                <div className="form-group">
                                    <label className="form-label">Base URL {form.type === 'azure' ? '(required)' : '(optional)'}</label>
                                    <input className="form-input"
                                        placeholder={
                                            form.type === 'ollama' ? 'http://localhost:11434' :
                                                form.type === 'azure' ? 'https://your-resource.openai.azure.com' :
                                                    form.type === 'bedrock' ? 'us-east-1 (AWS region)' :
                                                        form.type === 'sarvam' ? 'https://api.sarvam.ai' :
                                                            'https://api.openai.com'
                                        }
                                        value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })}
                                        required={form.type === 'azure'} />
                                </div>
                            )}
                            {formError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{formError}</p>}
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Validating...</> : 'Add Provider'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
