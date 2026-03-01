'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Wrench, Code, Play, Trash2, Edit, Search, Globe, Terminal, FileText, Braces, X } from 'lucide-react';

const BUILT_IN_ICONS = {
    web_search: Globe,
    http_request: Globe,
    code_execute: Terminal,
    json_transform: Braces,
    text_extract: FileText,
};

export default function ToolsPage() {
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTool, setEditingTool] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [testingId, setTestingId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [form, setForm] = useState({
        name: '', description: '', tool_type: 'custom', parameters_schema: '{}', code: ''
    });

    useEffect(() => { loadTools(); }, []);

    async function loadTools() {
        try {
            const res = await api.getTools();
            setTools(res.tools || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            // Parse parameters_schema from string to object
            let parsedSchema = {};
            try {
                parsedSchema = JSON.parse(form.parameters_schema || '{}');
            } catch (parseErr) {
                alert('Invalid JSON in Parameters Schema: ' + parseErr.message);
                return;
            }

            const data = {
                name: form.name,
                description: form.description,
                category: 'custom',
                parameters_schema: parsedSchema,
                code: form.code
            };
            if (editingTool) {
                await api.updateTool(editingTool.id, data);
            } else {
                await api.createTool(data);
            }
            setShowModal(false);
            setEditingTool(null);
            setForm({ name: '', description: '', tool_type: 'custom', parameters_schema: '{}', code: '' });
            loadTools();
        } catch (e) { alert(e.message || String(e)); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this tool?')) return;
        try {
            await api.deleteTool(id);
            loadTools();
        } catch (e) { alert(e.message); }
    }

    async function handleTest(tool) {
        setTestingId(tool.id);
        setTestResult(null);
        try {
            const testParams = JSON.parse(prompt('Enter test parameters (JSON):', '{}') || '{}');
            const res = await api.testTool(tool.id, testParams);
            setTestResult({ id: tool.id, result: res });
        } catch (e) {
            setTestResult({ id: tool.id, result: { error: e.message } });
        }
        setTestingId(null);
    }

    function openEdit(tool) {
        setEditingTool(tool);
        // Convert parameters_schema to string if it's an object
        let schemaStr = '{}';
        if (tool.parameters_schema) {
            schemaStr = typeof tool.parameters_schema === 'string'
                ? tool.parameters_schema
                : JSON.stringify(tool.parameters_schema, null, 2);
        }
        setForm({
            name: tool.name,
            description: tool.description || '',
            tool_type: tool.type || 'custom',
            parameters_schema: schemaStr,
            code: tool.code || ''
        });
        setShowModal(true);
    }

    const filtered = filter === 'all' ? tools :
        filter === 'builtin' ? tools.filter(t => t.tool_type === 'builtin') :
            tools.filter(t => t.tool_type === 'custom');

    return (
        <div className="animate-fade">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Wrench className="page-title-icon" />
                        Tools
                    </h1>
                    <p className="page-subtitle">Built-in and custom tools for AI agents</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => {
                        setEditingTool(null);
                        setForm({ name: '', description: '', tool_type: 'custom', parameters_schema: '{}', code: '' });
                        setShowModal(true);
                    }}>
                        <Plus size={16} /> Create Tool
                    </button>
                </div>
            </header>

            <div className="tabs" style={{ maxWidth: 360 }}>
                {['all', 'builtin', 'custom'].map(f => (
                    <button key={f} className={`tab ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All Tools' : f === 'builtin' ? 'Built-in' : 'Custom'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="loading-spinner" />
                </div>
            ) : (
                <div className="grid-auto">
                    {filtered.map(tool => {
                        const Icon = BUILT_IN_ICONS[tool.name] || Code;
                        const isBuiltIn = tool.tool_type === 'builtin';
                        return (
                            <div key={tool.id} className="tool-card">
                                <div className="card-header" style={{ marginBottom: 10 }}>
                                    <div className="tool-card-icon" style={{
                                        background: isBuiltIn ? 'rgba(124, 58, 237, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                                        color: isBuiltIn ? 'var(--accent)' : 'var(--cyan)',
                                        marginBottom: 0
                                    }}>
                                        <Icon size={20} />
                                    </div>
                                    <span className={`badge ${isBuiltIn ? 'badge-info' : 'badge-neutral'}`}>
                                        {isBuiltIn ? 'Built-in' : 'Custom'}
                                    </span>
                                </div>
                                <h3>{tool.name}</h3>
                                <p style={{ marginBottom: 12 }}>{tool.description || 'No description'}</p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleTest(tool)}>
                                        <Play size={12} /> Test
                                    </button>
                                    {!isBuiltIn && (
                                        <>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tool)}>
                                                <Edit size={12} /> Edit
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(tool.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                {testResult?.id === tool.id && (
                                    <div className="code-block" style={{ marginTop: 10, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                                        {JSON.stringify(testResult.result, null, 2)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingTool ? 'Edit Tool' : 'Create Custom Tool'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Tool Name</label>
                                    <input className="form-input" required value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })} placeholder="my_custom_tool" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-select" value={form.tool_type}
                                        onChange={e => setForm({ ...form, tool_type: e.target.value })}>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="What this tool does..." rows={2} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Parameters Schema (JSON)</label>
                                <textarea className="form-textarea" value={form.parameters_schema}
                                    onChange={e => setForm({ ...form, parameters_schema: e.target.value })}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                                    placeholder='{"query": {"type": "string", "description": "Search query"}}' rows={4} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Python Code</label>
                                <textarea className="form-textarea" value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value })}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13, minHeight: 200 }}
                                    placeholder='def execute(params):\n    # Your tool logic here\n    return {"result": params.get("input")}' />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingTool ? 'Update' : 'Create'} Tool</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
