'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Cpu, MessageSquare, GitBranch, Wrench, Server, BarChart3, Activity, DollarSign, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [providers, setProviders] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [provRes, wfRes, obsStats, logsRes] = await Promise.all([
        api.getProviders().catch(() => ({ providers: [] })),
        api.getWorkflows().catch(() => ({ workflows: [] })),
        api.getStats().catch(() => ({})),
        api.getLogs({ limit: 5 }).catch(() => ({ logs: [] })),
      ]);
      setProviders(provRes.providers || []);
      setWorkflows(wfRes.workflows || []);
      setStats(obsStats);
      setLogs(logsRes.logs || []);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
    setLoading(false);
  }

  const activeProviders = providers.filter(p => p.status === 'active').length;
  const totalModels = providers.reduce((sum, p) => sum + (p.model_count || 0), 0);

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your AgenticAI Platform</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Providers</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{loading ? '—' : activeProviders}</div>
          <div className="stat-change">{totalModels} models discovered</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Requests</div>
          <div className="stat-value" style={{ color: 'var(--cyan)' }}>{loading ? '—' : (stats?.total_requests || 0)}</div>
          <div className="stat-change">{stats?.success_count || 0} successful</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Cost</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>${loading ? '—' : (stats?.total_cost || 0).toFixed(4)}</div>
          <div className="stat-change">{(stats?.total_tokens || 0).toLocaleString()} total tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Latency</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{loading ? '—' : Math.round(stats?.avg_latency_ms || 0)}ms</div>
          <div className="stat-change">TTFB: {Math.round(stats?.avg_ttfb_ms || 0)}ms</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">AI Providers</span>
            <Link href="/providers" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          {providers.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <Cpu />
              <h3>No providers configured</h3>
              <p>Add an AI provider to get started</p>
              <Link href="/providers" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Add Provider</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {providers.slice(0, 5).map(p => (
                <div key={p.id} className="provider-card" style={{ padding: 14 }}>
                  <div className="provider-icon" style={{
                    width: 36, height: 36,
                    background: p.type === 'openai' ? 'rgba(16, 185, 129, 0.12)' :
                      p.type === 'anthropic' ? 'rgba(249, 115, 22, 0.12)' :
                        p.type === 'google' ? 'rgba(59, 130, 246, 0.12)' :
                          'rgba(124, 58, 237, 0.12)',
                    color: p.type === 'openai' ? 'var(--success)' :
                      p.type === 'anthropic' ? 'var(--orange)' :
                        p.type === 'google' ? 'var(--info)' :
                          'var(--accent)',
                    fontSize: 13
                  }}>
                    {p.type.charAt(0).toUpperCase()}
                  </div>
                  <div className="provider-info" style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 14 }}>{p.name}</h3>
                    <span className="provider-type">{p.type}</span>
                  </div>
                  <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                    {p.status}
                  </span>
                  <span className="chip">{p.model_count} models</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
            <Link href="/observability" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          {logs.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <Activity />
              <h3>No activity yet</h3>
              <p>Start chatting or running workflows to see activity</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => (
                <div key={log.id} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontWeight: 600 }}>{log.model_name || 'Unknown'}</span>
                    <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-tertiary">
                    <span>{log.total_tokens} tokens</span>
                    <span>${(log.cost || 0).toFixed(5)}</span>
                    <span>{log.latency_ms}ms</span>
                    <span>{log.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Quick Actions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { href: '/providers', icon: Cpu, label: 'Add Provider', desc: 'Connect an AI provider', color: 'var(--accent)' },
            { href: '/playground', icon: MessageSquare, label: 'Chat', desc: 'Open chat playground', color: 'var(--cyan)' },
            { href: '/workflows', icon: GitBranch, label: 'New Workflow', desc: 'Create a workflow', color: 'var(--success)' },
            { href: '/runbooks', icon: Zap, label: 'New Runbook', desc: 'Write a runbook', color: 'var(--orange)' },
            { href: '/tools', icon: Wrench, label: 'Add Tool', desc: 'Create custom tool', color: 'var(--pink)' },
            { href: '/observability', icon: BarChart3, label: 'Analytics', desc: 'View metrics', color: 'var(--warning)' },
          ].map(action => (
            <Link key={action.href} href={action.href} className="tool-card" style={{ textDecoration: 'none' }}>
              <div className="tool-card-icon" style={{ background: `${action.color}20`, color: action.color }}>
                <action.icon size={20} />
              </div>
              <h3>{action.label}</h3>
              <p>{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
