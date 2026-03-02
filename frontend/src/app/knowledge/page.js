'use client';
import { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Library, Plus, Trash2, Edit, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function KnowledgePage() {
    const { currentWorkspace } = useWorkspace();
    const [kbs, setKbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isKbModalOpen, setIsKbModalOpen] = useState(false);
    const [kbFormData, setKbFormData] = useState({ id: null, name: '', description: '' });

    // Document state
    const [activeKb, setActiveKb] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docFormData, setDocFormData] = useState({ title: '', content: '' });
    const [docSaving, setDocSaving] = useState(false);
    const [docMode, setDocMode] = useState('text'); // 'text' or 'file'
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (currentWorkspace) fetchKBs();
    }, [currentWorkspace]);

    const fetchKBs = async () => {
        setLoading(true);
        try {
            const data = await api.getKnowledgeBases(currentWorkspace.id);
            setKbs(data.knowledge_bases || []);
        } catch (error) {
            console.error('Failed to fetch knowledge bases', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async (kb_id) => {
        setDocsLoading(true);
        try {
            const data = await api.getDocuments(kb_id);
            setDocuments(data.documents || []);
        } catch (error) {
            console.error('Failed to fetch documents', error);
        } finally {
            setDocsLoading(false);
        }
    };

    const handleKbSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...kbFormData, workspace_id: currentWorkspace.id };
            if (kbFormData.id) {
                await api.updateKnowledgeBase(kbFormData.id, payload);
            } else {
                await api.createKnowledgeBase(payload);
            }
            setIsKbModalOpen(false);
            fetchKBs();
        } catch (error) {
            console.error('Failed to save knowledge base', error);
        }
    };

    const handleKbDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this Knowledge Base and ALL its documents?')) return;
        try {
            await api.deleteKnowledgeBase(id);
            if (activeKb?.id === id) setActiveKb(null);
            fetchKBs();
        } catch (error) {
            console.error('Failed to delete kb', error);
        }
    };

    const handleDocSubmit = async (e) => {
        e.preventDefault();
        setDocSaving(true);
        try {
            if (docMode === 'file') {
                if (!selectedFile) throw new Error("Please select a file to upload");
                await api.uploadDocument(activeKb.id, selectedFile);
            } else {
                await api.createDocument(activeKb.id, docFormData);
            }
            setIsDocModalOpen(false);
            fetchDocuments(activeKb.id);
            fetchKBs();
        } catch (error) {
            console.error('Failed to add document', error);
            alert(error.message || 'An error occurred during embedding.');
        } finally {
            setDocSaving(false);
        }
    };

    const handleDocDelete = async (doc_id) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await api.deleteDocument(activeKb.id, doc_id);
            fetchDocuments(activeKb.id);
            fetchKBs();
        } catch (error) {
            console.error('Failed to delete document', error);
        }
    };

    // Render individual KB documents view
    if (activeKb) {
        return (
            <div className="page-container">
                <header className="page-header">
                    <div>
                        <button
                            className="btn btn-secondary"
                            style={{ marginBottom: '12px', padding: '4px 8px' }}
                            onClick={() => setActiveKb(null)}
                        >
                            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Back to KBs
                        </button>
                        <h1 className="page-title">
                            <Library className="page-title-icon" />
                            {activeKb.name} Documents
                        </h1>
                        <p className="page-subtitle">{activeKb.description || 'Manage documents within this Knowledge Base.'}</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={() => {
                            setDocFormData({ title: '', content: '' });
                            setIsDocModalOpen(true);
                        }}>
                            <Plus size={16} /> Add Text Document
                        </button>
                    </div>
                </header>

                <div className="content-section">
                    {docsLoading ? (
                        <div className="empty-state">Loading documents...</div>
                    ) : documents.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3>No Documents</h3>
                            <p>Upload your first text document to embed and search.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {documents.map((doc) => (
                                <div key={doc.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 500 }}>{doc.title}</h4>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                            Embedded {new Date(doc.created_at).toLocaleString()} • {doc.content.substring(0, 100)}...
                                        </p>
                                    </div>
                                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDocDelete(doc.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isDocModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsDocModalOpen(false)}>
                        <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Embed Document</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setIsDocModalOpen(false)}>✕</button>
                            </div>
                            
                            <div className="tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
                                <button className={`tab ${docMode === 'text' ? 'active' : ''}`} onClick={() => setDocMode('text')}>
                                    Plain Text
                                </button>
                                <button className={`tab ${docMode === 'file' ? 'active' : ''}`} onClick={() => setDocMode('file')}>
                                    File Upload
                                </button>
                            </div>
                            
                            <form onSubmit={handleDocSubmit} style={{ padding: '0 24px 24px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    Your document will be parsed, chunked, and passed through the OpenAI `text-embedding-3-small` model and saved into the vector database.
                                </p>
                                
                                {docMode === 'text' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Document Title</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={docFormData.title}
                                                onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Plain Text Content</label>
                                            <textarea
                                                className="form-textarea"
                                                value={docFormData.content}
                                                onChange={(e) => setDocFormData({ ...docFormData, content: e.target.value })}
                                                rows={8}
                                                required
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Upload File (PDF, DOCX, XLSX, CSV, Images, Audio, Video)</label>
                                        <input 
                                            type="file" 
                                            className="form-input" 
                                            style={{ padding: '12px' }}
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                            required 
                                        />
                                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                            Supported: .txt, .pdf, .docx, .xlsx, .csv, .jpg, .png, .mp3, .wav, .mp4, .mov
                                        </p>
                                    </div>
                                )}
                                
                                <div className="modal-actions" style={{ marginTop: 24 }}>
                                    <button type="button" className="btn btn-secondary" disabled={docSaving} onClick={() => setIsDocModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={docSaving}>
                                        {docSaving ? <><Loader2 size={14} className="spin" style={{ marginRight: '6px' }} /> Embedding...</> : 'Embed Knowledge'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main KBs View
    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Library className="page-title-icon" />
                        Knowledge Bases
                    </h1>
                    <p className="page-subtitle">Manage vector databases holding your RAG documents.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => {
                        setKbFormData({ id: null, name: '', description: '' });
                        setIsKbModalOpen(true);
                    }}>
                        <Plus size={16} /> New Knowledge Base
                    </button>
                </div>
            </header>

            <div className="content-section">
                {loading ? (
                    <div className="empty-state">Loading knowledge bases...</div>
                ) : kbs.length === 0 ? (
                    <div className="empty-state">
                        <Library size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <h3>No Knowledge Bases</h3>
                        <p>Create a Knowledge Base to start managing context for your agents.</p>
                        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => {
                            setKbFormData({ id: null, name: '', description: '' });
                            setIsKbModalOpen(true);
                        }}>
                            Create First Knowledge Base
                        </button>
                    </div>
                ) : (
                    <div className="stats-grid">
                        {kbs.map((kb) => (
                            <div
                                key={kb.id}
                                className="card"
                                style={{ cursor: 'pointer', transition: 'transform 0.1s ease-in-out' }}
                                onClick={() => {
                                    setActiveKb(kb);
                                    fetchDocuments(kb.id);
                                }}
                            >
                                <div className="card-header">
                                    <h3 className="card-title">{kb.name}</h3>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => {
                                            e.stopPropagation();
                                            setKbFormData(kb);
                                            setIsKbModalOpen(true);
                                        }}><Edit size={14} /></button>
                                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleKbDelete(kb.id, e)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        {kb.description || 'No description provided.'}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        <FileText size={14} />
                                        {kb.document_count} Document{kb.document_count !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                        Created {new Date(kb.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isKbModalOpen && (
                <div className="modal-overlay" onClick={() => setIsKbModalOpen(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{kbFormData.id ? 'Edit Knowledge Base' : 'Create Knowledge Base'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setIsKbModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleKbSubmit}>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={kbFormData.name}
                                    onChange={(e) => setKbFormData({ ...kbFormData, name: e.target.value })}
                                    placeholder="e.g. Sales Playbook"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <textarea
                                    className="form-textarea"
                                    value={kbFormData.description}
                                    onChange={(e) => setKbFormData({ ...kbFormData, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsKbModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{kbFormData.id ? 'Save Changes' : 'Create Base'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
