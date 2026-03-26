'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, ChevronDown, ChevronRight, Eye, Cpu } from 'lucide-react';

const PROVIDER_TYPES = [
    { value: 'openai', label: 'OpenAI', color: '#000000' },
    { value: 'anthropic', label: 'Anthropic', color: '#000000' },
    { value: 'google', label: 'Google (Gemini)', color: '#000000' },
    { value: 'groq', label: 'Groq', color: '#000000' },
    { value: 'mistral', label: 'Mistral', color: '#000000' },
    { value: 'azure', label: 'Azure OpenAI', color: '#000000' },
    { value: 'bedrock', label: 'AWS Bedrock', color: '#000000' },
    { value: 'sarvam', label: 'Sarvam AI', color: '#000000' },
    { value: 'ollama', label: 'Ollama (Local)', color: '#000000' },
    { value: 'openrouter', label: 'OpenRouter', color: '#000000' },
];

export default function ProvidersPage() {
    const { currentOrgId } = useWorkspace();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedProvider, setExpandedProvider] = useState(null);
    const [models, setModels] = useState({});
    const [form, setForm] = useState({ name: '', type: 'openai', api_key: '', aws_secret_key: '', base_url: '', api_version: '' });
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (currentOrgId) loadProviders();
    }, [currentOrgId]);

    async function loadProviders() {
        if (!currentOrgId) return;
        setLoading(true);
        try {
            const res = await api.getProviders(currentOrgId);
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
            const resolvedApiKey = form.type === 'bedrock'
                ? `${form.api_key}:${form.aws_secret_key}`
                : form.api_key;
            const data = {
                name: form.name,
                type: form.type,
                api_key: resolvedApiKey,
                org_id: currentOrgId,
            };
            if (form.base_url) data.base_url = form.base_url;
            if (form.api_version) data.api_version = form.api_version;
            await api.createProvider(data);
            setShowModal(false);
            setForm({ name: '', type: 'openai', api_key: '', aws_secret_key: '', base_url: '', api_version: '' });
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

    const getProviderColor = (type) => PROVIDER_TYPES.find(p => p.value === type)?.color || '#000000';

    return (
        <div className="animate-fade">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Cpu className="page-title-icon" />
                        AI Providers
                    </h1>
                    <p className="page-subtitle">Manage AI providers and discover available models</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add Provider
                    </button>
                    <button className="btn btn-secondary btn-icon" onClick={loadProviders} title="Refresh All">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

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
                                    onChange={e => setForm({ ...form, type: e.target.value, api_key: '', aws_secret_key: '' })}>
                                    {PROVIDER_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            {form.type === 'bedrock' ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">AWS Access Key ID</label>
                                        <input className="form-input" type="password" placeholder="AKIAIOSFODNN7EXAMPLE"
                                            value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })}
                                            required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">AWS Secret Access Key</label>
                                        <input className="form-input" type="password" placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                            value={form.aws_secret_key} onChange={e => setForm({ ...form, aws_secret_key: e.target.value })}
                                            required />
                                    </div>
                                </>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">API Key {form.type === 'ollama' && '(optional for local)'}</label>
                                    <input className="form-input" type="password" placeholder="sk-..."
                                        value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })}
                                        required={form.type !== 'ollama'} />
                                </div>
                            )}
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
                                    {form.type === 'azure' && (
                                        <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                                            Use the endpoint URL from Azure portal (e.g., https://xxx.openai.azure.com). Don't include /openai/ paths.
                                        </small>
                                    )}
                                </div>
                            )}
                            {form.type === 'azure' && (
                                <div className="form-group">
                                    <label className="form-label">API Version (optional)</label>
                                    <input className="form-input"
                                        placeholder="2024-06-01"
                                        value={form.api_version}
                                        onChange={e => setForm({ ...form, api_version: e.target.value })} />
                                    <small style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        Default: 2024-06-01. Change if your Azure deployment requires a different version.
                                    </small>
                                </div>
                            )}
                            {formError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{formError}</p>}
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setForm({ name: '', type: 'openai', api_key: '', aws_secret_key: '', base_url: '', api_version: '' }); setFormError(''); }}>Cancel</button>
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
