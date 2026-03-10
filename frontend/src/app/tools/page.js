'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Wrench, Code, Play, Trash2, Edit, Globe, Terminal, FileText, Braces, X, Upload, CheckCircle, AlertCircle, Download, Sparkles, Package, Search, Database, Calculator, Clock, FolderOpen, Type, ChevronDown, ChevronRight } from 'lucide-react';
import { useWorkspace } from '@/lib/WorkspaceContext';

// Category icons mapping
const CATEGORY_ICONS = {
    search: Search,
    network: Globe,
    compute: Terminal,
    data: Database,
    math: Calculator,
    utility: Clock,
    filesystem: FolderOpen,
    text: Type,
    custom: Code,
    uploaded: Package,
};

// Category colors
const CATEGORY_COLORS = {
    search: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' },
    network: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' },
    compute: { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' },
    data: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' },
    math: { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' },
    utility: { bg: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' },
    filesystem: { bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308' },
    text: { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' },
    custom: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6b7280' },
    uploaded: { bg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed' },
};

const PACK_COLORS = { bg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed' };

export default function ToolsPage() {
    const { currentOrgId } = useWorkspace();
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTool, setEditingTool] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [testingId, setTestingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [form, setForm] = useState({
        name: '', description: '', tool_type: 'custom', parameters_schema: '{}', code: ''
    });

    // Upload Tool Pack state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);

    // Expanded pack state
    const [expandedPacks, setExpandedPacks] = useState(new Set());

    // Generate Tool Pack state
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [providers, setProviders] = useState([]);
    const [allModels, setAllModels] = useState({});
    const [generating, setGenerating] = useState(false);
    const [generateForm, setGenerateForm] = useState({
        name: '',
        description: '',
        provider_id: '',
        model_id: ''
    });

    useEffect(() => { loadTools(); }, []);

    useEffect(() => {
        if (currentOrgId) loadProviders();
    }, [currentOrgId]);

    async function loadTools() {
        try {
            const res = await api.getTools();
            setTools(res.tools || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function loadProviders() {
        if (!currentOrgId) return;
        try {
            const res = await api.getProviders(currentOrgId);
            setProviders(res.providers || []);
            const models = {};
            for (const p of (res.providers || [])) {
                try {
                    const mr = await api.getProviderModels(p.id);
                    models[p.id] = mr.models || [];
                } catch (e) { models[p.id] = []; }
            }
            setAllModels(models);
        } catch (e) { console.error(e); }
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
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

    function handleDownload(tool) {
        api.downloadTool(tool.id);
    }

    function openEdit(tool) {
        setEditingTool(tool);
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

    // Upload handlers
    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (file && file.name.endsWith('.zip')) {
            setUploadFile(file);
        }
        e.target.value = '';
    }

    async function handleUpload() {
        if (!uploadFile) return;
        setUploading(true);
        setUploadResult(null);
        try {
            const result = await api.uploadToolPack(uploadFile);
            setUploadResult(result);
            if (result.total_created > 0) {
                loadTools();
            }
        } catch (e) {
            setUploadResult({ error: e.message });
        }
        setUploading(false);
    }

    function closeUploadModal() {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadResult(null);
    }

    // Generate handlers
    async function handleGenerateToolPack() {
        if (!generateForm.name || !generateForm.description || !generateForm.provider_id || !generateForm.model_id) {
            alert('Please fill in all fields');
            return;
        }
        setGenerating(true);
        try {
            const { blob, filename } = await api.generateToolPack(generateForm);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setShowGenerateModal(false);
            setGenerateForm({ name: '', description: '', provider_id: '', model_id: '' });
        } catch (e) {
            alert('Failed to generate tool pack: ' + e.message);
        }
        setGenerating(false);
    }

    async function handleDeletePack(packName) {
        if (!confirm(`Delete the entire "${packName}" tool pack? This will remove all ${packName} tools.`)) return;
        try {
            await api.deleteToolPack(packName);
            setExpandedPacks(prev => { const s = new Set(prev); s.delete(packName); return s; });
            loadTools();
        } catch (e) { alert(e.message); }
    }

    function togglePack(packName) {
        setExpandedPacks(prev => {
            const s = new Set(prev);
            if (s.has(packName)) s.delete(packName);
            else s.add(packName);
            return s;
        });
    }

    // Separate tools into packs and standalone tools
    const packsMap = {};
    const standaloneTools = [];
    tools.forEach(tool => {
        if (tool.source_file) {
            if (!packsMap[tool.source_file]) packsMap[tool.source_file] = [];
            packsMap[tool.source_file].push(tool);
        } else {
            standaloneTools.push(tool);
        }
    });
    const packsList = Object.entries(packsMap).map(([name, packTools]) => ({ name, tools: packTools }));

    // Get unique categories from standalone tools only
    const categories = ['all', 'packs', ...new Set(standaloneTools.map(t => t.category || 'custom'))];

    // Filter logic
    const searchLower = searchQuery.toLowerCase();
    const filteredPacks = selectedCategory === 'all' || selectedCategory === 'packs'
        ? packsList.filter(pack =>
            !searchQuery ||
            pack.name.toLowerCase().includes(searchLower) ||
            pack.tools.some(t =>
                t.name.toLowerCase().includes(searchLower) ||
                (t.description || '').toLowerCase().includes(searchLower)
            )
        )
        : [];

    const filteredTools = selectedCategory === 'all' || selectedCategory !== 'packs'
        ? standaloneTools.filter(tool => {
            const matchesSearch = !searchQuery ||
                tool.name.toLowerCase().includes(searchLower) ||
                (tool.description || '').toLowerCase().includes(searchLower);
            const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        : [];

    const totalVisible = filteredPacks.length + filteredTools.length;

    const currentGenerateModels = allModels[generateForm.provider_id] || [];

    return (
        <div className="animate-fade">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Wrench className="page-title-icon" />
                        Tools
                    </h1>
                    <p className="page-subtitle">Manage tools for your AI agents</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-ghost" onClick={() => setShowGenerateModal(true)}>
                        <Sparkles size={16} /> Generate
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                        <Upload size={16} /> Upload
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        setEditingTool(null);
                        setForm({ name: '', description: '', tool_type: 'custom', parameters_schema: '{}', code: '' });
                        setShowModal(true);
                    }}>
                        <Plus size={16} /> Create Tool
                    </button>
                </div>
            </header>

            {/* Search and Filter Bar */}
            <div style={{
                display: 'flex',
                gap: 16,
                marginBottom: 24,
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
                    <Search size={16} style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-tertiary)'
                    }} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: 38 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setSelectedCategory(cat)}
                            style={{ textTransform: 'capitalize' }}
                        >
                            {cat === 'all' ? 'All' : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tools count */}
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                {filteredPacks.length > 0 && `${filteredPacks.length} pack${filteredPacks.length !== 1 ? 's' : ''}`}
                {filteredPacks.length > 0 && filteredTools.length > 0 && ', '}
                {filteredTools.length > 0 && `${filteredTools.length} tool${filteredTools.length !== 1 ? 's' : ''}`}
                {filteredPacks.length === 0 && filteredTools.length === 0 && '0 results'}
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedCategory !== 'all' && selectedCategory !== 'packs' && ` in ${selectedCategory}`}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="loading-spinner" />
                </div>
            ) : totalVisible === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 60,
                    color: 'var(--text-secondary)'
                }}>
                    <Package size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                    <p style={{ fontSize: 16, marginBottom: 8 }}>No tools found</p>
                    <p style={{ fontSize: 13 }}>
                        {searchQuery ? 'Try a different search term' : 'Create your first tool or upload a tool pack'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Tool Pack cards */}
                    {filteredPacks.map(pack => {
                        const isExpanded = expandedPacks.has(pack.name);
                        return (
                            <div key={pack.name} style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                            }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = PACK_COLORS.color;
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Pack Header row */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 20,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                    }}
                                    onClick={() => togglePack(pack.name)}
                                >
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 'var(--radius-md)',
                                        background: PACK_COLORS.bg,
                                        color: PACK_COLORS.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Package size={20} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <h3 style={{
                                                fontSize: 15,
                                                fontWeight: 600,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {pack.name}
                                            </h3>
                                            <span style={{
                                                fontSize: 11,
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: PACK_COLORS.bg,
                                                color: PACK_COLORS.color,
                                                flexShrink: 0,
                                            }}>
                                                Tool Pack
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                                            {pack.tools.length} tool{pack.tools.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={e => { e.stopPropagation(); handleDeletePack(pack.name); }}
                                            title="Delete tool pack"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        {isExpanded
                                            ? <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />
                                            : <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                        }
                                    </div>
                                </div>

                                {/* Expanded tool list */}
                                {isExpanded && (
                                    <div style={{
                                        borderTop: '1px solid var(--border-color)',
                                        padding: '12px 20px 16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}>
                                        {pack.tools.map(tool => {
                                            const category = tool.category || 'custom';
                                            const Icon = CATEGORY_ICONS[category] || Code;
                                            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.custom;
                                            return (
                                                <div key={tool.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 10,
                                                    padding: 12,
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-color)',
                                                }}>
                                                    <div style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: colors.bg,
                                                        color: colors.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{tool.name}</p>
                                                        <p style={{
                                                            fontSize: 12,
                                                            color: 'var(--text-secondary)',
                                                            overflow: 'hidden',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 1,
                                                            WebkitBoxOrient: 'vertical',
                                                            margin: 0,
                                                        }}>
                                                            {tool.description || 'No description'}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleTest(tool)}
                                                            title="Test tool"
                                                        >
                                                            <Play size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Test result for tools inside pack */}
                                        {pack.tools.some(t => testResult?.id === t.id) && (
                                            <div className="code-block" style={{ marginTop: 4, maxHeight: 150, overflow: 'auto', fontSize: 11 }}>
                                                {JSON.stringify(testResult.result, null, 2)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Standalone tool cards */}
                    {filteredTools.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: 16
                        }}>
                            {filteredTools.map(tool => {
                                const category = tool.category || 'custom';
                                const Icon = CATEGORY_ICONS[category] || Code;
                                const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.custom;
                                const isCustom = tool.tool_type !== 'builtin';

                                return (
                                    <div key={tool.id} style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 20,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                    }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--accent)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 'var(--radius-md)',
                                                background: colors.bg,
                                                color: colors.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Icon size={20} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{
                                                    fontSize: 15,
                                                    fontWeight: 600,
                                                    marginBottom: 2,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {tool.name}
                                                </h3>
                                                <span style={{
                                                    fontSize: 11,
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: colors.bg,
                                                    color: colors.color,
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {category}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p style={{
                                            fontSize: 13,
                                            color: 'var(--text-secondary)',
                                            marginBottom: 16,
                                            flex: 1,
                                            lineHeight: 1.5,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {tool.description || 'No description'}
                                        </p>

                                        {/* Actions */}
                                        <div style={{
                                            display: 'flex',
                                            gap: 8,
                                            borderTop: '1px solid var(--border-color)',
                                            paddingTop: 12,
                                            marginTop: 'auto'
                                        }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleDownload(tool)}
                                                title="Download as tool pack"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleTest(tool)}
                                                title="Test tool"
                                            >
                                                <Play size={14} />
                                            </button>
                                            {isCustom && (
                                                <>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => openEdit(tool)}
                                                        title="Edit tool"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleDelete(tool.id)}
                                                        title="Delete tool"
                                                        style={{ marginLeft: 'auto' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Test Result */}
                                        {testResult?.id === tool.id && (
                                            <div className="code-block" style={{
                                                marginTop: 12,
                                                maxHeight: 150,
                                                overflow: 'auto',
                                                fontSize: 11
                                            }}>
                                                {JSON.stringify(testResult.result, null, 2)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{
                        width: '90vw',
                        maxWidth: 1000,
                        height: '80vh',
                        maxHeight: 700,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '24px 32px'
                    }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingTool ? 'Edit Tool' : 'Create Tool'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, flex: 1, overflowY: 'auto' }}>
                                {/* Left: Info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Name</label>
                                        <input className="form-input" required value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="my_tool" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Description</label>
                                        <textarea className="form-textarea" value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            placeholder="What this tool does..."
                                            rows={3}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                        <label className="form-label">Parameters (JSON Schema)</label>
                                        <textarea className="form-textarea" value={form.parameters_schema}
                                            onChange={e => setForm({ ...form, parameters_schema: e.target.value })}
                                            style={{ flex: 1, minHeight: 120, resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                                            placeholder='{"query": {"type": "string"}}' />
                                    </div>
                                </div>

                                {/* Right: Code */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                                        <label className="form-label">Python Code</label>
                                        <textarea className="form-textarea" value={form.code}
                                            onChange={e => setForm({ ...form, code: e.target.value })}
                                            style={{ flex: 1, resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                                            placeholder="# Your code here&#10;result = {'output': params.get('input')}" />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingTool ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={closeUploadModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Upload Tool Pack</h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeUploadModal}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                                Upload a .zip file with Python files. Each function becomes a tool.
                            </p>

                            <div
                                style={{
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 32,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    marginBottom: 16
                                }}
                                onClick={() => document.getElementById('tool-pack-input').click()}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                onDrop={e => {
                                    e.preventDefault();
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.zip'));
                                    if (file) setUploadFile(file);
                                }}
                            >
                                <Upload size={28} style={{ marginBottom: 8, color: 'var(--text-tertiary)' }} />
                                <p style={{ fontWeight: 500, fontSize: 14 }}>Drop .zip file here or click to browse</p>
                            </div>

                            <input
                                id="tool-pack-input"
                                type="file"
                                accept=".zip"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />

                            {uploadFile && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: 12,
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    marginBottom: 16
                                }}>
                                    <Package size={18} style={{ color: 'var(--accent)' }} />
                                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{uploadFile.name}</span>
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setUploadFile(null)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {uploadResult && (
                                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {uploadResult.error ? (
                                        <div style={{
                                            padding: 12,
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--error)',
                                            fontSize: 13
                                        }}>
                                            <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                            {uploadResult.error}
                                        </div>
                                    ) : (
                                        <>
                                            {uploadResult.total_created > 0 && (
                                                <div style={{
                                                    padding: 12,
                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--success)',
                                                    fontSize: 13
                                                }}>
                                                    <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                                    {uploadResult.total_created} tool{uploadResult.total_created !== 1 ? 's' : ''} created successfully
                                                </div>
                                            )}
                                            {uploadResult.errors && uploadResult.errors.length > 0 && (
                                                <div style={{
                                                    padding: 12,
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontSize: 13
                                                }}>
                                                    <div style={{ color: 'var(--error)', marginBottom: 6, fontWeight: 600 }}>
                                                        <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                                        {uploadResult.errors.length} tool{uploadResult.errors.length !== 1 ? 's' : ''} skipped:
                                                    </div>
                                                    {uploadResult.errors.map((err, i) => (
                                                        <div key={i} style={{
                                                            color: 'var(--text-secondary)',
                                                            fontSize: 12,
                                                            paddingLeft: 24,
                                                            marginTop: 4,
                                                            lineHeight: 1.4
                                                        }}>
                                                            • {err.function ? `${err.function}: ` : ''}{err.error}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {uploadResult.total_created === 0 && (!uploadResult.errors || uploadResult.errors.length === 0) && (
                                                <div style={{
                                                    padding: 12,
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--error)',
                                                    fontSize: 13
                                                }}>
                                                    <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                                    No tools were created. Check the file contains public Python functions.
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={closeUploadModal}>
                                {uploadResult ? 'Done' : 'Cancel'}
                            </button>
                            {!uploadResult && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpload}
                                    disabled={!uploadFile || uploading}
                                >
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                <Sparkles size={18} style={{ marginRight: 8, color: 'var(--accent)' }} />
                                Generate Tool Pack
                            </h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowGenerateModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '0 24px 24px' }}>
                            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                                Describe the tools you need and AI will generate them.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g., Data Processing Tools"
                                    value={generateForm.name}
                                    onChange={e => setGenerateForm({ ...generateForm, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    rows={3}
                                    placeholder="Describe what tools you need..."
                                    value={generateForm.description}
                                    onChange={e => setGenerateForm({ ...generateForm, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Provider</label>
                                    <select
                                        className="form-select"
                                        value={generateForm.provider_id}
                                        onChange={e => setGenerateForm({ ...generateForm, provider_id: e.target.value, model_id: '' })}
                                    >
                                        <option value="">Select</option>
                                        {providers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Model</label>
                                    <select
                                        className="form-select"
                                        value={generateForm.model_id}
                                        onChange={e => setGenerateForm({ ...generateForm, model_id: e.target.value })}
                                        disabled={!generateForm.provider_id}
                                    >
                                        <option value="">Select</option>
                                        {currentGenerateModels.map(m => (
                                            <option key={m.id} value={m.model_id}>{m.model_id}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerateToolPack}
                                disabled={!generateForm.name || !generateForm.description || !generateForm.provider_id || !generateForm.model_id || generating}
                            >
                                {generating ? 'Generating...' : 'Generate & Download'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
