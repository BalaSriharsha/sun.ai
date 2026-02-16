'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import {
    Plus, Play, Save, Trash2, X, ArrowLeft, Zap, Cpu, Wrench, Server,
    GitBranch, ArrowRightLeft, FileOutput, Repeat, Clock, Globe, Database,
    Mail, MessageSquare, Filter, Variable, Copy, Download, Upload, Settings,
    ChevronLeft, ChevronRight, Search, MoreHorizontal, Eye, Pencil, Layers
} from 'lucide-react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    Panel,
    MarkerType,
    useReactFlow,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─────── NODE TYPE REGISTRY ───────
const NODE_CATEGORIES = [
    {
        name: 'Triggers',
        color: '#10b981',
        items: [
            { type: 'trigger', label: 'Manual Trigger', icon: Zap, desc: 'Start manually', color: '#10b981' },
            { type: 'schedule', label: 'Schedule', icon: Clock, desc: 'Cron / interval', color: '#10b981' },
            { type: 'webhook', label: 'Webhook', icon: Globe, desc: 'HTTP webhook', color: '#10b981' },
        ]
    },
    {
        name: 'AI',
        color: '#8b5cf6',
        items: [
            { type: 'ai_completion', label: 'AI Model', icon: Cpu, desc: 'LLM completion', color: '#8b5cf6' },
            { type: 'ai_agent', label: 'AI Agent', icon: MessageSquare, desc: 'Agent with tools', color: '#a855f7' },
        ]
    },
    {
        name: 'Logic',
        color: '#f59e0b',
        items: [
            { type: 'conditional', label: 'IF', icon: GitBranch, desc: 'Branch logic', color: '#f59e0b' },
            { type: 'loop', label: 'Loop', icon: Repeat, desc: 'Iterate items', color: '#06b6d4' },
            { type: 'filter', label: 'Filter', icon: Filter, desc: 'Filter items', color: '#ec4899' },
            { type: 'switch', label: 'Switch', icon: Layers, desc: 'Multi-branch', color: '#f97316' },
        ]
    },
    {
        name: 'Actions',
        color: '#3b82f6',
        items: [
            { type: 'http_request', label: 'HTTP Request', icon: Globe, desc: 'Call any API', color: '#3b82f6' },
            { type: 'tool_exec', label: 'Tool', icon: Wrench, desc: 'Run a tool', color: '#06b6d4' },
            { type: 'mcp_call', label: 'MCP Server', icon: Server, desc: 'MCP tool', color: '#f97316' },
            { type: 'code_node', label: 'Code', icon: Variable, desc: 'Run code', color: '#6366f1' },
        ]
    },
    {
        name: 'Data',
        color: '#14b8a6',
        items: [
            { type: 'transform', label: 'Transform', icon: ArrowRightLeft, desc: 'Map data', color: '#14b8a6' },
            { type: 'set_variable', label: 'Set Variable', icon: Variable, desc: 'Set values', color: '#64748b' },
            { type: 'database_node', label: 'Database', icon: Database, desc: 'Query DB', color: '#f43f5e' },
        ]
    },
    {
        name: 'Output',
        color: '#84cc16',
        items: [
            { type: 'output', label: 'Output', icon: FileOutput, desc: 'Final result', color: '#84cc16' },
            { type: 'email_send', label: 'Send Email', icon: Mail, desc: 'Email output', color: '#ef4444' },
        ]
    }
];

const ALL_NODE_TYPES = NODE_CATEGORIES.flatMap(c => c.items);

// ─────── n8n-STYLE NODE COMPONENT ───────
function N8nNode({ data, selected, id }) {
    const config = ALL_NODE_TYPES.find(n => n.type === data.nodeType) || ALL_NODE_TYPES[0];
    const Icon = config.icon;
    const nodeColor = config.color;
    const isRunning = data.executionStatus === 'running';
    const isSuccess = data.executionStatus === 'success';
    const isError = data.executionStatus === 'error';

    return (
        <div
            className={`n8n-node ${selected ? 'n8n-node-selected' : ''} ${isRunning ? 'n8n-node-running' : ''}`}
            style={{
                '--node-color': nodeColor,
                '--node-color-10': nodeColor + '1a',
                '--node-color-20': nodeColor + '33',
            }}
        >
            {/* Input handle */}
            {data.nodeType !== 'trigger' && data.nodeType !== 'schedule' && data.nodeType !== 'webhook' && (
                <Handle type="target" position={Position.Left} className="n8n-handle n8n-handle-input" />
            )}

            {/* Status ring */}
            {(isSuccess || isError) && (
                <div className={`n8n-node-status-ring ${isSuccess ? 'success' : 'error'}`} />
            )}

            {/* Icon circle */}
            <div className="n8n-node-icon" style={{ background: nodeColor }}>
                <Icon size={20} color="#fff" strokeWidth={2} />
            </div>

            {/* Label */}
            <div className="n8n-node-label">{data.label || config.label}</div>

            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="n8n-handle n8n-handle-output" />

            {/* Conditional extra handles */}
            {(data.nodeType === 'conditional' || data.nodeType === 'switch') && (
                <Handle type="source" position={Position.Right} id="false"
                    className="n8n-handle n8n-handle-output-alt"
                    style={{ top: '75%' }}
                />
            )}

            {isRunning && (
                <div className="n8n-node-loader">
                    <div className="n8n-node-loader-ring" style={{ borderColor: nodeColor + '44', borderTopColor: nodeColor }} />
                </div>
            )}
        </div>
    );
}

const nodeTypes = { n8n: N8nNode };

// ─────── CONNECTION STYLES ───────
const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#6366f1', strokeWidth: 2.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 16, height: 16 },
};

// ─────── NODE CONFIG PANEL ───────
function NodeConfigPanel({ node, onUpdate, onClose, onDelete, providers, allModels, tools, mcpServers }) {
    if (!node) return null;
    const config = ALL_NODE_TYPES.find(n => n.type === node.data?.nodeType) || ALL_NODE_TYPES[0];
    const Icon = config.icon;

    const updateField = (field, value) => {
        onUpdate(node.id, { ...node.data, [field]: value });
    };

    return (
        <div className="n8n-config-panel">
            <div className="n8n-config-header">
                <div className="n8n-config-title-row">
                    <div className="n8n-config-icon" style={{ background: config.color }}>
                        <Icon size={16} color="#fff" />
                    </div>
                    <div>
                        <input
                            className="n8n-config-name-input"
                            value={node.data?.label || config.label}
                            onChange={e => updateField('label', e.target.value)}
                        />
                        <div className="n8n-config-type">{config.desc}</div>
                    </div>
                </div>
                <button className="n8n-config-close" onClick={onClose}><X size={16} /></button>
            </div>

            <div className="n8n-config-body">
                {/* Description */}
                <div className="n8n-config-section">
                    <label className="n8n-config-label">Notes</label>
                    <textarea
                        className="n8n-config-textarea"
                        value={node.data?.description || ''}
                        onChange={e => updateField('description', e.target.value)}
                        placeholder="Add notes about this node..."
                        rows={2}
                    />
                </div>

                {/* AI Model config */}
                {(node.data?.nodeType === 'ai_completion' || node.data?.nodeType === 'ai_agent') && (
                    <>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">System Prompt</label>
                            <textarea
                                className="n8n-config-textarea"
                                value={node.data?.system_prompt || ''}
                                onChange={e => updateField('system_prompt', e.target.value)}
                                placeholder="You are a helpful assistant..."
                                rows={4}
                            />
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Provider</label>
                            <select className="n8n-config-select"
                                value={node.data?.provider_id || ''}
                                onChange={e => onUpdate(node.id, { ...node.data, provider_id: e.target.value, model_id: '' })}
                            >
                                <option value="">Select Provider</option>
                                {(providers || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Model</label>
                            <select className="n8n-config-select"
                                value={node.data?.model_id || ''}
                                onChange={e => updateField('model_id', e.target.value)}
                            >
                                <option value="">Select Model</option>
                                {(allModels?.[node.data?.provider_id] || []).map(m => (
                                    <option key={m.id} value={m.model_id}>{m.model_id}</option>
                                ))}
                            </select>
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Temperature</label>
                            <input className="n8n-config-input" type="number" step="0.1" min="0" max="2"
                                value={node.data?.temperature ?? 0.7} onChange={e => updateField('temperature', parseFloat(e.target.value))} />
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Tools ({(node.data?.tools || []).length} selected)</label>
                            <div style={{
                                maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
                                background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 6
                            }}>
                                {(tools || []).map(t => {
                                    const sel = (node.data?.tools || []).includes(t.id);
                                    return (
                                        <label key={t.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                                            borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                            background: sel ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        }}>
                                            <input type="checkbox" checked={sel}
                                                onChange={() => {
                                                    const cur = node.data?.tools || [];
                                                    updateField('tools', sel ? cur.filter(x => x !== t.id) : [...cur, t.id]);
                                                }} />
                                            <Wrench size={12} style={{ color: '#06b6d4' }} />
                                            <span style={{ color: '#e0e0f0' }}>{t.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">MCP Servers ({(node.data?.mcp_servers || []).length} selected)</label>
                            <div style={{
                                maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
                                background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 6
                            }}>
                                {(mcpServers || []).map(s => {
                                    const sel = (node.data?.mcp_servers || []).includes(s.id);
                                    return (
                                        <label key={s.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                                            borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                            background: sel ? 'rgba(249,115,22,0.15)' : 'transparent',
                                        }}>
                                            <input type="checkbox" checked={sel}
                                                onChange={() => {
                                                    const cur = node.data?.mcp_servers || [];
                                                    updateField('mcp_servers', sel ? cur.filter(x => x !== s.id) : [...cur, s.id]);
                                                }} />
                                            <Server size={12} style={{ color: '#f97316' }} />
                                            <span style={{ color: '#e0e0f0' }}>{s.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Conditional config */}
                {(node.data?.nodeType === 'conditional' || node.data?.nodeType === 'filter') && (
                    <div className="n8n-config-section">
                        <label className="n8n-config-label">Condition Expression</label>
                        <textarea className="n8n-config-textarea"
                            value={node.data?.condition || ''}
                            onChange={e => updateField('condition', e.target.value)}
                            placeholder="data.value > 100"
                            rows={3}
                        />
                    </div>
                )}

                {/* HTTP Request config */}
                {node.data?.nodeType === 'http_request' && (
                    <>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">URL</label>
                            <input className="n8n-config-input" value={node.data?.url || ''} onChange={e => updateField('url', e.target.value)} placeholder="https://api.example.com/data" />
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Method</label>
                            <select className="n8n-config-select" value={node.data?.method || 'GET'} onChange={e => updateField('method', e.target.value)}>
                                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Code node */}
                {(node.data?.nodeType === 'code_node' || node.data?.nodeType === 'transform') && (
                    <div className="n8n-config-section">
                        <label className="n8n-config-label">Code</label>
                        <textarea className="n8n-config-textarea n8n-code-editor"
                            value={node.data?.code || ''}
                            onChange={e => updateField('code', e.target.value)}
                            placeholder="# Write Python code here\nresult = data"
                            rows={8}
                        />
                    </div>
                )}

                {/* Schedule config */}
                {node.data?.nodeType === 'schedule' && (
                    <div className="n8n-config-section">
                        <label className="n8n-config-label">Cron Expression</label>
                        <input className="n8n-config-input" value={node.data?.cron || ''} onChange={e => updateField('cron', e.target.value)} placeholder="0 */5 * * *" />
                    </div>
                )}

                {/* Tool / MCP node */}
                {(node.data?.nodeType === 'tool_exec' || node.data?.nodeType === 'mcp_call') && (
                    <div className="n8n-config-section">
                        <label className="n8n-config-label">Tool / Server Name</label>
                        <input className="n8n-config-input" value={node.data?.tool_name || ''} onChange={e => updateField('tool_name', e.target.value)} placeholder="web_search" />
                    </div>
                )}

                {/* Variable set */}
                {node.data?.nodeType === 'set_variable' && (
                    <>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Variable Name</label>
                            <input className="n8n-config-input" value={node.data?.var_name || ''} onChange={e => updateField('var_name', e.target.value)} placeholder="my_variable" />
                        </div>
                        <div className="n8n-config-section">
                            <label className="n8n-config-label">Value Expression</label>
                            <input className="n8n-config-input" value={node.data?.var_value || ''} onChange={e => updateField('var_value', e.target.value)} placeholder="data.result" />
                        </div>
                    </>
                )}
            </div>

            <div className="n8n-config-footer">
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => onDelete(node.id)}>
                    <Trash2 size={14} /> Delete Node
                </button>
            </div>
        </div>
    );
}

// ─────── MAIN WORKFLOW BUILDER ───────
function WorkflowCanvas() {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeWorkflow, setActiveWorkflow] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [executionResult, setExecutionResult] = useState(null);
    const [executing, setExecuting] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(true);
    const [paletteSearch, setPaletteSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [providers, setProviders] = useState([]);
    const [allModels, setAllModels] = useState({});
    const [tools, setTools] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);
    const reactFlowWrapper = useRef(null);
    const { project } = useReactFlow();

    useEffect(() => {
        loadWorkflows();
        loadProviders();
        loadTools();
        loadMCPServers();
    }, []);

    async function loadProviders() {
        try {
            const res = await api.getProviders();
            setProviders(res.providers || []);
            const models = {};
            for (const p of (res.providers || [])) {
                try { const mr = await api.getProviderModels(p.id); models[p.id] = mr.models || []; } catch (_) { models[p.id] = []; }
            }
            setAllModels(models);
        } catch (e) { console.error(e); }
    }

    async function loadTools() {
        try { const res = await api.getTools(); setTools(res.tools || []); } catch (e) { console.error(e); }
    }

    async function loadMCPServers() {
        try { const res = await api.getMCPServers(); setMcpServers(res.servers || []); } catch (e) { console.error(e); }
    }

    async function loadWorkflows() {
        try { const res = await api.getWorkflows(); setWorkflows(res.workflows || []); } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function createWorkflow() {
        if (!createName.trim()) return;
        try {
            const res = await api.createWorkflow({ name: createName, description: createDesc });
            setShowCreate(false); setCreateName(''); setCreateDesc('');
            loadWorkflows(); openWorkflow(res.id);
        } catch (e) { alert(e.message); }
    }

    async function openWorkflow(id) {
        try {
            const wf = await api.getWorkflow(id);
            setActiveWorkflow(wf);
            const rawNodes = wf.nodes || [];
            const rawEdges = wf.edges || [];
            setNodes(rawNodes.map((n, i) => ({
                ...n,
                type: 'n8n',
                data: { ...n.data, nodeType: n.data?.nodeType || n.type || 'trigger' },
                position: n.position || { x: 300 + i * 250, y: 250 },
            })));
            setEdges(rawEdges.map(e => ({ ...e, ...defaultEdgeOptions })));
            setSelectedNode(null);
            setExecutionResult(null);
        } catch (e) { alert(e.message); }
    }

    async function saveWorkflow() {
        if (!activeWorkflow) return;
        setSaving(true);
        try {
            const saveNodes = nodes.map(n => ({
                id: n.id, type: n.data?.nodeType || 'trigger', position: n.position, data: n.data,
            }));
            await api.updateWorkflow(activeWorkflow.id, { nodes: saveNodes, edges });
            loadWorkflows();
        } catch (e) { alert(e.message); }
        setTimeout(() => setSaving(false), 600);
    }

    async function executeWorkflow() {
        if (!activeWorkflow) return;
        setExecuting(true); setExecutionResult(null);
        // Mark all nodes as running
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionStatus: 'running' } })));
        try {
            const res = await api.executeWorkflow(activeWorkflow.id, { input_data: {} });
            setExecutionResult(res);
            // Mark nodes based on results
            setNodes(nds => nds.map(n => {
                const nodeResult = res.node_results?.[n.id];
                return { ...n, data: { ...n.data, executionStatus: nodeResult ? (nodeResult.status === 'success' ? 'success' : 'error') : 'success' } };
            }));
        } catch (e) {
            setExecutionResult({ error: e.message });
            setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionStatus: 'error' } })));
        }
        setExecuting(false);
    }

    async function deleteWorkflow(id) {
        if (!confirm('Delete this workflow?')) return;
        try { await api.deleteWorkflow(id); if (activeWorkflow?.id === id) setActiveWorkflow(null); loadWorkflows(); } catch (e) { alert(e.message); }
    }

    const onConnect = useCallback((params) => {
        setEdges(eds => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_, node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    function addNode(type) {
        const config = ALL_NODE_TYPES.find(n => n.type === type);
        const id = `node_${Date.now()}`;
        const newNode = {
            id, type: 'n8n',
            position: { x: 250 + Math.random() * 300, y: 150 + nodes.length * 80 },
            data: { label: config.label, nodeType: type, description: config.desc },
        };
        setNodes(nds => [...nds, newNode]);
    }

    function updateNodeData(nodeId, newData) {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: newData } : n));
        if (selectedNode?.id === nodeId) setSelectedNode(prev => ({ ...prev, data: newData }));
    }

    function deleteNodeById(nodeId) {
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    }

    const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/reactflow');
        if (!type) return;
        const config = ALL_NODE_TYPES.find(n => n.type === type);
        if (!config) return;
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
        const id = `node_${Date.now()}`;
        setNodes(nds => [...nds, {
            id, type: 'n8n', position,
            data: { label: config.label, nodeType: type, description: config.desc },
        }]);
    }, [project, setNodes]);

    const onDragStart = (e, type) => {
        e.dataTransfer.setData('application/reactflow', type);
        e.dataTransfer.effectAllowed = 'move';
    };

    const filteredCategories = useMemo(() => {
        if (!paletteSearch) return NODE_CATEGORIES;
        const term = paletteSearch.toLowerCase();
        return NODE_CATEGORIES.map(cat => ({
            ...cat,
            items: cat.items.filter(i => i.label.toLowerCase().includes(term) || i.desc.toLowerCase().includes(term)),
        })).filter(cat => cat.items.length > 0);
    }, [paletteSearch]);

    // Reset execution status after 5 seconds
    useEffect(() => {
        if (executionResult) {
            const t = setTimeout(() => {
                setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionStatus: undefined } })));
            }, 8000);
            return () => clearTimeout(t);
        }
    }, [executionResult, setNodes]);

    // ─────── LIST VIEW ───────
    if (!activeWorkflow) {
        return (
            <div className="animate-fade">
                <div className="page-header flex items-center justify-between">
                    <div>
                        <h1>Workflows</h1>
                        <p>Build AI automation pipelines with a visual node editor</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> New Workflow
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loading-spinner" /></div>
                ) : workflows.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <GitBranch size={36} style={{ color: 'var(--accent)' }} />
                        </div>
                        <h3 style={{ marginBottom: 8 }}>No workflows yet</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
                            Create your first workflow to automate tasks with AI, tools, and integrations
                        </p>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                            <Plus size={16} /> Create Workflow
                        </button>
                    </div>
                ) : (
                    <div className="grid-auto">
                        {workflows.map(wf => (
                            <div key={wf.id} className="card n8n-workflow-card" onClick={() => openWorkflow(wf.id)}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div className="n8n-wf-icon">
                                        <GitBranch size={20} />
                                    </div>
                                    <span className={`badge ${wf.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                                        {wf.status || 'draft'}
                                    </span>
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{wf.name}</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    {wf.description || 'No description'}
                                </p>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                    <span className="chip">{wf.node_count || 0} nodes</span>
                                    <span className="chip">Runs: {wf.execution_count || 0}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openWorkflow(wf.id)}>
                                        <Pencil size={12} /> Edit
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => deleteWorkflow(wf.id)}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showCreate && (
                    <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">New Workflow</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><X size={18} /></button>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input className="form-input" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Data processing pipeline" autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What does this workflow do?" rows={3} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={createWorkflow}>Create</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─────── EDITOR VIEW (n8n-style) ───────
    return (
        <div className="n8n-editor">
            {/* Top toolbar */}
            <div className="n8n-toolbar">
                <div className="n8n-toolbar-left">
                    <button className="n8n-toolbar-btn" onClick={() => { setActiveWorkflow(null); setSelectedNode(null); }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div className="n8n-toolbar-divider" />
                    <span className="n8n-toolbar-name">{activeWorkflow.name}</span>
                    {activeWorkflow.description && (
                        <span className="n8n-toolbar-desc">{activeWorkflow.description}</span>
                    )}
                </div>
                <div className="n8n-toolbar-right">
                    <button className={`n8n-toolbar-btn ${saving ? 'n8n-saving' : ''}`} onClick={saveWorkflow} title="Save">
                        <Save size={16} />
                        <span>{saving ? 'Saved!' : 'Save'}</span>
                    </button>
                    <button className="n8n-toolbar-btn n8n-toolbar-run" onClick={executeWorkflow} disabled={executing}>
                        {executing ? (
                            <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Running...</>
                        ) : (
                            <><Play size={16} /> Execute</>
                        )}
                    </button>
                </div>
            </div>

            <div className="n8n-canvas-area">
                {/* Node Palette (left sidebar) */}
                <div className={`n8n-palette ${paletteOpen ? '' : 'n8n-palette-collapsed'}`}>
                    <div className="n8n-palette-header">
                        <span>Nodes</span>
                        <button className="n8n-palette-toggle" onClick={() => setPaletteOpen(!paletteOpen)}>
                            {paletteOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                        </button>
                    </div>
                    {paletteOpen && (
                        <>
                            <div className="n8n-palette-search">
                                <Search size={14} />
                                <input placeholder="Search nodes..." value={paletteSearch} onChange={e => setPaletteSearch(e.target.value)} />
                            </div>
                            <div className="n8n-palette-list">
                                {filteredCategories.map(cat => (
                                    <div key={cat.name} className="n8n-palette-category">
                                        <div className="n8n-palette-category-title">{cat.name}</div>
                                        {cat.items.map(item => {
                                            const ItemIcon = item.icon;
                                            return (
                                                <div key={item.type}
                                                    className="n8n-palette-item"
                                                    draggable
                                                    onDragStart={e => onDragStart(e, item.type)}
                                                    onClick={() => addNode(item.type)}
                                                >
                                                    <div className="n8n-palette-item-icon" style={{ background: item.color }}>
                                                        <ItemIcon size={14} color="#fff" />
                                                    </div>
                                                    <div className="n8n-palette-item-info">
                                                        <div className="n8n-palette-item-label">{item.label}</div>
                                                        <div className="n8n-palette-item-desc">{item.desc}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Canvas */}
                <div className="n8n-flow-canvas" ref={reactFlowWrapper} onDragOver={onDragOver} onDrop={onDrop}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        defaultEdgeOptions={defaultEdgeOptions}
                        fitView
                        snapToGrid
                        snapGrid={[16, 16]}
                        style={{ background: '#0f0f1a' }}
                    >
                        <Background color="#1e1e3a" gap={20} variant="dots" size={1.5} />
                        <Controls
                            style={{ background: '#1a1a2e', borderColor: '#2a2a4a', borderRadius: 10 }}
                            showInteractive={false}
                        />
                        <MiniMap
                            style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
                            nodeColor={node => {
                                const cfg = ALL_NODE_TYPES.find(n => n.type === node.data?.nodeType);
                                return cfg?.color || '#6366f1';
                            }}
                            maskColor="rgba(0,0,0,0.6)"
                        />
                        {/* Empty canvas message */}
                        {nodes.length === 0 && (
                            <Panel position="top-center">
                                <div className="n8n-empty-canvas">
                                    <Plus size={28} />
                                    <div>Drag nodes from the left panel or click to add</div>
                                </div>
                            </Panel>
                        )}
                    </ReactFlow>
                </div>

                {/* Node Config Panel (right sidebar) */}
                {selectedNode && (
                    <NodeConfigPanel
                        node={selectedNode}
                        onUpdate={updateNodeData}
                        onClose={() => setSelectedNode(null)}
                        onDelete={deleteNodeById}
                        providers={providers}
                        allModels={allModels}
                        tools={tools}
                        mcpServers={mcpServers}
                    />
                )}
            </div>

            {/* Execution Result bar */}
            {executionResult && (
                <div className={`n8n-exec-bar ${executionResult.error ? 'n8n-exec-error' : 'n8n-exec-success'}`}>
                    <div className="n8n-exec-status">
                        {executionResult.error ? (
                            <><X size={16} /> Error: {executionResult.error}</>
                        ) : (
                            <><Play size={16} /> Execution {executionResult.status || 'completed'} — {executionResult.total_time_ms || 0}ms</>
                        )}
                    </div>
                    {executionResult.node_results && (
                        <div className="n8n-exec-nodes">
                            {Object.entries(executionResult.node_results).map(([id, r]) => (
                                <span key={id} className={`n8n-exec-node-chip ${r.status === 'success' ? 'success' : 'error'}`}>
                                    {r.node_name}: {r.execution_time_ms}ms
                                </span>
                            ))}
                        </div>
                    )}
                    <button className="n8n-exec-close" onClick={() => setExecutionResult(null)}><X size={14} /></button>
                </div>
            )}
        </div>
    );
}

export default function WorkflowsPage() {
    return (
        <ReactFlowProvider>
            <WorkflowCanvas />
        </ReactFlowProvider>
    );
}
