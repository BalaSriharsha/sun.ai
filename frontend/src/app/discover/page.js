'use client';
import { useState } from 'react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Compass, GraduationCap, Server, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import CURATED_MCPS from './mcps.json';

const CURATED_SKILLS = [
    {
        id: 'skill-1',
        name: 'Senior Software Engineer',
        description: 'Writes clean, efficient, and well-documented code. Emphasizes best practices and thorough testing.',
        content: `You are a Senior Software Engineer.
Your goals:
1. Write code that is clean, modular, and easy to read.
2. Prioritize stability, performance, and security.
3. Always provide brief, clear explanations for complex logic.
4. When writing tests, ensure high coverage for edge cases.`
    },
    {
        id: 'skill-2',
        name: 'Data Analyst',
        description: 'Specializes in extracting insights from data, structuring SQL queries, and explaining metrics.',
        content: `You are a Data Analyst.
Your goals:
1. When asked to write SQL, use standard ANSI SQL formatting with clear aliases.
2. Focus on uncovering actionable business insights from raw numbers.
3. Explain statistical concepts simply to non-technical stakeholders.
4. Point out potential biases or missing data parameters in requests.`
    },
    {
        id: 'skill-3',
        name: 'Copywriter',
        description: 'Crafts engaging, punchy, and persuasive text optimized for marketing and user conversion.',
        content: `You are an Expert Copywriter.
Your goals:
1. Write concise, punchy text that grabs attention immediately.
2. Focus on the benefits to the user, not just the features.
3. Use active voice and strong verbs.
4. Always include a clear Call to Action (CTA) when appropriate.`
    }
];

export default function DiscoverPage() {
    const { currentWorkspace, currentOrgId } = useWorkspace();
    const [activeTab, setActiveTab] = useState('skills'); // 'skills' | 'mcps'
    const [searchTerm, setSearchTerm] = useState('');

    // Track installation statuses locally so we can show checks
    const [addingIds, setAddingIds] = useState(new Set());
    const [addedIds, setAddedIds] = useState(new Set());

    const handleAddSkill = async (skill) => {
        if (!currentWorkspace?.id) return alert("Select a workspace first");

        setAddingIds(prev => new Set(prev).add(skill.id));
        try {
            const payload = {
                name: skill.name,
                description: skill.description,
                content: skill.content,
                workspace_id: currentWorkspace.id
            };

            await api.createSkill(payload);
            setAddedIds(prev => new Set(prev).add(skill.id));
        } catch (e) {
            console.error(e);
            alert("Error adding skill: " + e.message);
        } finally {
            setAddingIds(prev => {
                const next = new Set(prev);
                next.delete(skill.id);
                return next;
            });
        }
    };

    const handleAddMCP = async (mcp) => {
        if (!currentOrgId) return alert("Select an organization first");

        setAddingIds(prev => new Set(prev).add(mcp.id));
        try {
            // MCP servers are created against the Org
            const payload = {
                name: mcp.name,
                command: mcp.command,
                args: mcp.args,
                env: {}, // We don't have the keys yet, the user will add them in the MCP page if required
                config: {}
            };

            const result = await api.createMCPServer(payload);

            // Try auto-discovery
            if (result.id) {
                try {
                    await api.discoverMCPTools(result.id, currentOrgId);
                } catch (e) { console.log('Auto discovery skipped for marketplace item'); }
            }

            setAddedIds(prev => new Set(prev).add(mcp.id));

            // Prompt user about environment variables
            if (mcp.required_env.length > 0) {
                alert(`Added ${mcp.name}!\n\nIMPORTANT: This server requires the following secrets to be added in the MCP Servers page to start successfully: \n${mcp.required_env.join(', ')}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error adding MCP server: " + e.message);
        } finally {
            setAddingIds(prev => {
                const next = new Set(prev);
                next.delete(mcp.id);
                return next;
            });
        }
    };

    return (
        <div className="page-container animate-fade">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Compass className="page-title-icon" />
                        Discover
                    </h1>
                    <p className="page-subtitle">Browse curated Skills and MCP Servers to supercharge your workspace.</p>
                </div>
            </header>

            {/* Standard Tab Switcher */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
                    onClick={() => setActiveTab('skills')}
                >
                    <GraduationCap size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Curated Skills
                </button>
                <button
                    className={`tab ${activeTab === 'mcps' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mcps')}
                >
                    <Server size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> MCP Servers
                </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder={`Search ${activeTab === 'skills' ? 'Skills' : 'Servers'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                />
            </div>

            <div className="content-section">
                <div className="stats-grid">
                    {activeTab === 'skills' ? (
                        CURATED_SKILLS.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.description.toLowerCase().includes(searchTerm.toLowerCase())).map(skill => {
                            const isAdding = addingIds.has(skill.id);
                            const isAdded = addedIds.has(skill.id);

                            return (
                                <div key={skill.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="card-header">
                                        <h3 className="card-title">{skill.name}</h3>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <GraduationCap size={18} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, marginBottom: '16px' }}>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {skill.description}
                                        </p>
                                    </div>
                                    <div style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '16px' }}>
                                        <button
                                            className={`btn ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={() => handleAddSkill(skill)}
                                            disabled={isAdding || isAdded}
                                        >
                                            {isAdding ? "Adding..." : (isAdded ? <><Check size={14} /> Added to Workspace</> : <><Plus size={14} /> Add Pattern</>)}
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        CURATED_MCPS.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.description.toLowerCase().includes(searchTerm.toLowerCase())).map((mcp, ix) => {
                            const isAdding = addingIds.has(mcp.id);
                            const isAdded = addedIds.has(mcp.id);

                            if (searchTerm === '' && ix > 50) return null; // restrict default list size

                            return (
                                <div key={mcp.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="card-header">
                                        <h3 className="card-title">{mcp.name}</h3>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(249, 115, 22, 0.1)', color: 'var(--orange)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Server size={18} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, marginBottom: '16px' }}>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                            {mcp.description}
                                        </p>
                                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '4px' }}>
                                            {mcp.command} {mcp.args.join(' ')}
                                        </div>
                                    </div>
                                    <div style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '16px' }}>
                                        <button
                                            className={`btn ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={() => handleAddMCP(mcp)}
                                            disabled={isAdding || isAdded}
                                        >
                                            {isAdding ? "Adding..." : (isAdded ? <><Check size={14} /> Added to Org</> : <><Plus size={14} /> Install Server</>)}
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
