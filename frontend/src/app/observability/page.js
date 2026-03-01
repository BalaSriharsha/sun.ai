'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { BarChart3, Clock, DollarSign, Zap, Activity, ArrowLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#000000', '#FFFFFF'];

export default function ObservabilityPage() {
    const { currentOrgId } = useWorkspace();
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [timeseries, setTimeseries] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ source: '', provider: '', status: '', limit: 50 });
    const [page, setPage] = useState(0);
    const [dateRange, setDateRange] = useState('7d'); // 'today', '7d', '30d', 'all', 'custom'
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        if (currentOrgId) loadAll();
    }, [currentOrgId, dateRange, customStart, customEnd]); // reload when range changes

    const getDateRangeParams = () => {
        if (dateRange === 'all') return {};

        let start = new Date();
        start.setHours(0, 0, 0, 0);
        let end = new Date();
        end.setHours(23, 59, 59, 999);

        if (dateRange === 'today') {
            // Already set
        } else if (dateRange === '7d') {
            start.setDate(start.getDate() - 7);
        } else if (dateRange === '30d') {
            start.setDate(start.getDate() - 30);
        } else if (dateRange === 'custom') {
            if (!customStart || !customEnd) return {}; // Wait until both are picked
            start = new Date(customStart);
            start.setHours(0, 0, 0, 0);
            end = new Date(customEnd);
            end.setHours(23, 59, 59, 999);
        }

        return { start_date: start.toISOString(), end_date: end.toISOString() };
    };

    useEffect(() => {
        if (currentOrgId) loadAll();
    }, [currentOrgId]);

    async function loadAll() {
        if (!currentOrgId) return;
        if (dateRange === 'custom' && (!customStart || !customEnd)) return;

        setLoading(true);
        const dateParams = getDateRangeParams();
        try {
            const [statsRes, logsRes, tsRes] = await Promise.all([
                api.getStats({ org_id: currentOrgId, ...dateParams }).catch(() => ({})),
                api.getLogs({ limit: filter.limit, offset: page * filter.limit, org_id: currentOrgId, ...dateParams }).catch(() => ({ logs: [] })),
                api.getTimeseries({ interval: dateRange === 'today' ? 'hour' : 'day', org_id: currentOrgId, ...dateParams }).catch(() => ({ data: [] })),
            ]);
            setStats(statsRes);
            setLogs(logsRes.logs || []);
            setTimeseries(tsRes.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function loadLogs() {
        if (!currentOrgId) return;
        try {
            const dateParams = getDateRangeParams();
            const params = { limit: filter.limit, offset: page * filter.limit, org_id: currentOrgId, ...dateParams };
            if (filter.source) params.source = filter.source;
            if (filter.provider) params.provider = filter.provider;
            if (filter.status) params.status = filter.status;
            const res = await api.getLogs(params);
            setLogs(res.logs || []);
        } catch (e) { console.error(e); }
    }

    async function viewLogDetail(log) {
        try {
            const detail = await api.getLog(log.id);
            setSelectedLog(detail);
        } catch (e) {
            setSelectedLog(log);
        }
    }

    // Model distribution for pie chart
    const modelDistribution = {};
    logs.forEach(l => {
        const key = l.model_name || 'Unknown';
        modelDistribution[key] = (modelDistribution[key] || 0) + 1;
    });
    const pieData = Object.entries(modelDistribution).map(([name, value]) => ({ name, value }));

    if (selectedLog) {
        return (
            <div className="animate-fade">
                <button className="btn btn-ghost" onClick={() => setSelectedLog(null)} style={{ marginBottom: 16 }}>
                    <ArrowLeft size={14} /> Back to Logs
                </button>
                <div className="log-detail">
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Request Detail</h2>
                    <div className="log-detail-grid">
                        <div className="log-detail-item">
                            <label>Status</label>
                            <span className={`badge ${selectedLog.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                {selectedLog.status}
                            </span>
                        </div>
                        <div className="log-detail-item">
                            <label>Provider</label>
                            <span>{selectedLog.provider_name}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Model</label>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{selectedLog.model_name}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Source</label>
                            <span className="chip">{selectedLog.source}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Input Tokens</label>
                            <span>{(selectedLog.input_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Output Tokens</label>
                            <span>{(selectedLog.output_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Cached Tokens</label>
                            <span>{(selectedLog.cached_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Total Tokens</label>
                            <span style={{ fontWeight: 700 }}>{(selectedLog.total_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Cost</label>
                            <span style={{ color: 'var(--success)' }}>${(selectedLog.cost || 0).toFixed(6)}</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Latency (Total)</label>
                            <span>{selectedLog.latency_ms}ms</span>
                        </div>
                        <div className="log-detail-item">
                            <label>TTFB</label>
                            <span>{selectedLog.ttfb_ms}ms</span>
                        </div>
                        <div className="log-detail-item">
                            <label>Timestamp</label>
                            <span style={{ fontSize: 12 }}>{new Date(selectedLog.created_at).toLocaleString()}</span>
                        </div>
                    </div>

                    {selectedLog.error_message && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>ERROR</label>
                            <div className="code-block" style={{ color: 'var(--error)', fontSize: 13 }}>
                                {selectedLog.error_message}
                            </div>
                        </div>
                    )}

                    {selectedLog.request_body && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>REQUEST</label>
                            <div className="code-block" style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                                {typeof selectedLog.request_body === 'string' ? selectedLog.request_body :
                                    JSON.stringify(selectedLog.request_body, null, 2)}
                            </div>
                        </div>
                    )}

                    {selectedLog.response_body && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>RESPONSE</label>
                            <div className="code-block" style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                                {typeof selectedLog.response_body === 'string' ? selectedLog.response_body :
                                    JSON.stringify(selectedLog.response_body, null, 2)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <BarChart3 className="page-title-icon" />
                        Observability
                    </h1>
                    <p className="page-subtitle">Monitor AI requests, costs, and performance</p>
                </div>
                <div className="header-actions">
                    {dateRange === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="date" className="form-select" style={{ padding: '6px 10px', fontSize: 13, height: 32 }}
                                value={customStart} onChange={e => setCustomStart(e.target.value)} />
                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>to</span>
                            <input type="date" className="form-select" style={{ padding: '6px 10px', fontSize: 13, height: 32 }}
                                value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                        </div>
                    )}
                    <select className="form-select" style={{ padding: '6px 30px 6px 12px', fontSize: 13, height: 32, width: 140 }}
                        value={dateRange} onChange={e => setDateRange(e.target.value)}>
                        <option value="today">Today</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom Range...</option>
                    </select>
                    <button className="btn btn-secondary" onClick={loadAll} style={{ height: 32 }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Requests</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>
                        {loading ? '—' : (stats?.total_requests || 0).toLocaleString()}
                    </div>
                    <div className="stat-change">
                        {stats?.error_count || 0} errors ({stats?.total_requests ? ((stats.error_count / stats.total_requests) * 100).toFixed(1) : 0}%)
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Cost</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        ${loading ? '—' : (stats?.total_cost || 0).toFixed(4)}
                    </div>
                    <div className="stat-change">{(stats?.total_tokens || 0).toLocaleString()} total tokens</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Avg Latency</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>
                        {loading ? '—' : Math.round(stats?.avg_latency_ms || 0)}ms
                    </div>
                    <div className="stat-change">TTFB: {Math.round(stats?.avg_ttfb_ms || 0)}ms</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Token Usage</div>
                    <div className="stat-value" style={{ color: 'var(--cyan)' }}>
                        {loading ? '—' : (stats?.total_tokens || 0).toLocaleString()}
                    </div>
                    <div className="stat-change">
                        In: {(stats?.total_input_tokens || 0).toLocaleString()} / Out: {(stats?.total_output_tokens || 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 16 }}>Requests Over Time</div>
                    <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeseries}>
                                <defs>
                                    <linearGradient id="gradient1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis
                                    dataKey="time_bucket"
                                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                                    tickFormatter={(val) => {
                                        if (!val) return '';
                                        const d = new Date(val);
                                        return dateRange === 'today' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
                                    }}
                                />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
                                    labelStyle={{ color: 'var(--text-primary)' }}
                                    labelFormatter={(val) => {
                                        if (!val) return '';
                                        const d = new Date(val);
                                        return d.toLocaleString();
                                    }}
                                />
                                <Area type="monotone" dataKey="requests" stroke="var(--accent)" fill="url(#gradient1)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title" style={{ marginBottom: 16 }}>Model Distribution</div>
                    <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                                    paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={{ stroke: 'var(--text-tertiary)' }}>
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#000000" strokeWidth={1} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Logs */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>Request Logs</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-select" style={{ width: 130, padding: '6px 30px 6px 10px', fontSize: 12 }}
                            value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); }}>
                            <option value="">All Status</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                        </select>
                        <select className="form-select" style={{ width: 130, padding: '6px 30px 6px 10px', fontSize: 12 }}
                            value={filter.source} onChange={e => { setFilter(f => ({ ...f, source: e.target.value })); }}>
                            <option value="">All Sources</option>
                            <option value="playground">Playground</option>
                            <option value="runbook">Runbook</option>
                            <option value="workflow">Workflow</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={loadLogs}><Filter size={12} /> Apply</button>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Provider</th>
                                <th>Model</th>
                                <th>Source</th>
                                <th>Tokens</th>
                                <th>Cost</th>
                                <th>Latency</th>
                                <th>TTFB</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} className="log-row" onClick={() => viewLogDetail(log)}>
                                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td>{log.provider_name}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.model_name}</td>
                                    <td><span className="chip">{log.source}</span></td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{(log.total_tokens || 0).toLocaleString()}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>${(log.cost || 0).toFixed(5)}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{log.latency_ms}ms</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{log.ttfb_ms}ms</td>
                                    <td>
                                        <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td><ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length > 0 && (
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Showing {logs.length} logs
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" disabled={page === 0}
                                onClick={() => { setPage(p => p - 1); loadLogs(); }}>Previous</button>
                            <button className="btn btn-ghost btn-sm"
                                onClick={() => { setPage(p => p + 1); loadLogs(); }}>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
