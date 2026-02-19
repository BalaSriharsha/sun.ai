'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Cpu, MessageSquare, GitBranch, Wrench,
    Server, BarChart3, Zap, Bot, Building2, Key, ChevronDown, Layers, BookOpen
} from 'lucide-react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { useState, useRef, useEffect } from 'react';

const navItems = [
    {
        section: 'Overview', items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/orgs', label: 'Organizations', icon: Building2 },
        ]
    },
    {
        section: 'Build', items: [
            { href: '/providers', label: 'AI Providers', icon: Cpu },
            { href: '/agents', label: 'Agents', icon: Bot },
            { href: '/playground', label: 'Playground', icon: MessageSquare },
            { href: '/workflows', label: 'Workflows', icon: GitBranch },
        ]
    },
    {
        section: 'Integrate', items: [
            { href: '/tools', label: 'Tools', icon: Wrench },
            { href: '/mcp', label: 'MCP Servers', icon: Server },
        ]
    },
    {
        section: 'Configure', items: [
            { href: '/secrets', label: 'Secrets & Variables', icon: Key },
        ]
    },
    {
        section: 'Monitor', items: [
            { href: '/observability', label: 'Observability', icon: BarChart3 },
        ]
    },
    {
        section: 'Help', items: [
            { href: '/docs', label: 'Documentation', icon: BookOpen },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const {
        orgs, environments, workspaces,
        currentOrg, currentEnv, currentWorkspace,
        switchOrg, switchEnv, switchWorkspace
    } = useWorkspace();
    const [showSwitcher, setShowSwitcher] = useState(false);
    const switcherRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (switcherRef.current && !switcherRef.current.contains(e.target)) {
                setShowSwitcher(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link href="/" className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <Zap size={20} />
                    </div>
                    <span className="sidebar-logo-text">AgenticAI</span>
                </Link>
            </div>

            {/* Workspace Switcher — 3 levels */}
            <div className="workspace-switcher" ref={switcherRef}>
                <button
                    className="workspace-switcher-btn"
                    onClick={() => setShowSwitcher(!showSwitcher)}
                >
                    <div className="workspace-switcher-info">
                        <span className="workspace-switcher-org">{currentOrg?.name || 'Loading...'}</span>
                        <span className="workspace-switcher-ws">
                            {currentEnv?.name || '—'} / {currentWorkspace?.name || '—'}
                        </span>
                    </div>
                    <ChevronDown size={14} className={`workspace-switcher-chevron ${showSwitcher ? 'open' : ''}`} />
                </button>

                {showSwitcher && (
                    <div className="workspace-switcher-dropdown">
                        {/* Organization */}
                        <div className="workspace-switcher-section">
                            <div className="workspace-switcher-label">Organization</div>
                            {orgs.map(org => (
                                <button
                                    key={org.id}
                                    className={`workspace-switcher-option ${org.id === currentOrg?.id ? 'active' : ''}`}
                                    onClick={() => { switchOrg(org.id); }}
                                >
                                    <Building2 size={14} />
                                    <span>{org.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Environment */}
                        <div className="workspace-switcher-divider" />
                        <div className="workspace-switcher-section">
                            <div className="workspace-switcher-label">Environment</div>
                            {environments.map(env => (
                                <button
                                    key={env.id}
                                    className={`workspace-switcher-option ${env.id === currentEnv?.id ? 'active' : ''}`}
                                    onClick={() => { switchEnv(env.id); }}
                                >
                                    <Layers size={14} />
                                    <span>{env.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Workspace */}
                        <div className="workspace-switcher-divider" />
                        <div className="workspace-switcher-section">
                            <div className="workspace-switcher-label">Workspace</div>
                            {workspaces.map(ws => (
                                <button
                                    key={ws.id}
                                    className={`workspace-switcher-option ${ws.id === currentWorkspace?.id ? 'active' : ''}`}
                                    onClick={() => { switchWorkspace(ws.id); setShowSwitcher(false); }}
                                >
                                    <span>{ws.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section} className="sidebar-section">
                        <div className="sidebar-section-title">{section.section}</div>
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href ||
                                (item.href !== '/' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                                >
                                    <Icon />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px 12px' }}>
                    AgenticAI Platform v2.0
                </div>
            </div>
        </aside>
    );
}
