'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Cpu, MessageSquare, GitBranch, Wrench,
    Server, BarChart3, Zap, Bot, Building2, Key, ChevronDown, Layers, BookOpen, Users, Sun, Moon,
    GraduationCap, Library, Compass
} from 'lucide-react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { useState, useRef, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { useTheme } from 'next-themes';

const navItems = [
    {
        section: 'Overview', items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/discover', label: 'Discover', icon: Compass },
            { href: '/orgs', label: 'Organizations', icon: Building2 },
        ]
    },
    {
        section: 'Build', items: [
            { href: '/providers', label: 'AI Providers', icon: Cpu },
            { href: '/agents', label: 'Agents', icon: Bot },
            { href: '/skills', label: 'Skills', icon: GraduationCap },
            { href: '/knowledge', label: 'Knowledge', icon: Library },
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
            { href: '/orgs/members', label: 'Members & Roles', icon: Users },
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
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const {
        orgs, environments, workspaces,
        currentOrg, currentEnv, currentWorkspace,
        switchOrg, switchEnv, switchWorkspace,
        loading
    } = useWorkspace();
    const [showSwitcher, setShowSwitcher] = useState(false);
    const switcherRef = useRef(null);

    useEffect(() => {
        setMounted(true);
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
                    <div className="sidebar-logo-icon" style={{ overflow: 'hidden' }}>
                        <img src="/logo.png" alt="sun.ai Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span className="sidebar-logo-text">sun.ai</span>
                </Link>
            </div>

            {/* Workspace Switcher — 3 levels */}
            <div className="workspace-switcher" ref={switcherRef}>
                <button
                    className="workspace-switcher-btn"
                    onClick={() => setShowSwitcher(!showSwitcher)}
                >
                    <div className="workspace-switcher-info">
                        <span className="workspace-switcher-org">
                            {loading ? 'Loading...' : (currentOrg?.name || 'No Organization')}
                            {currentOrg?.status === 'pending' && <span style={{ marginLeft: '6px', fontSize: '10px', border: '1px solid var(--border-color)', padding: '2px 4px', borderRadius: '4px' }}>Pending</span>}
                        </span>
                        <span className="workspace-switcher-ws">
                            {loading ? '—' : (`${currentEnv?.name || '—'} / ${currentWorkspace?.name || '—'}`)}
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
                                    style={org.status === 'pending' ? { opacity: 0.7 } : {}}
                                >
                                    <Building2 size={14} />
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {org.name}
                                        {org.status === 'pending' && <span style={{ fontSize: '10px', border: '1px solid var(--border-color)', padding: '2px 4px', borderRadius: '4px' }}>Pending</span>}
                                    </span>
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
            <div className="sidebar-footer" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mounted && (
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="sidebar-link"
                        style={{ width: '100%', justifyContent: 'flex-start', background: 'transparent' }}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SignedIn>
                        <Link href="/profile" className="sidebar-link" style={{ width: '100%', justifyContent: 'flex-start', background: 'transparent' }}>
                            <Users size={18} />
                            <span>My Profile</span>
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton>
                            <button className="btn btn-primary" style={{ width: '100%', fontSize: '13px', padding: '6px 12px' }}>
                                Sign In
                            </button>
                        </SignInButton>
                    </SignedOut>
                </div>
            </div>
        </aside>
    );
}
