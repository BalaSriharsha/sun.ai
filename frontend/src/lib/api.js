const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

let currentUserEmail = typeof window !== 'undefined' ? localStorage.getItem('agentic_user_email') : null;

const getCurrentUserEmail = () => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('agentic_user_email');
        if (stored) return stored;
    }
    return currentUserEmail;
};

export const setApiUserEmail = (email) => {
    currentUserEmail = email;
    if (typeof window !== 'undefined') {
        if (email) {
            localStorage.setItem('agentic_user_email', email);
        } else {
            localStorage.removeItem('agentic_user_email');
        }
    }
};

export async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const email = getCurrentUserEmail();
    if (email) {
        headers['x-user-email'] = email;
    }

    const config = {
        ...options,
        headers,
    };

    const res = await fetch(url, config);

    if (!res.ok) {
        let error;
        try {
            error = await res.json();
        } catch {
            error = { detail: res.statusText };
        }

        let errorMessage = error.detail || `API Error: ${res.status}`;
        if (typeof errorMessage === 'object') {
            errorMessage = JSON.stringify(errorMessage);
        }

        throw new Error(errorMessage);
    }

    return res.json();
}

export function apiStream(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const email = getCurrentUserEmail();
    if (email) {
        headers['x-user-email'] = email;
    }

    return fetch(url, {
        method: 'POST',
        headers,
        ...options,
    });
}

export const api = {
    // Providers (organization-scoped)
    getProviders: (orgId) => apiFetch(`/providers?org_id=${orgId}`),
    createProvider: (data) => apiFetch('/providers', { method: 'POST', body: JSON.stringify(data) }),
    getProvider: (id) => apiFetch(`/providers/${id}`),
    updateProvider: (id, data) => apiFetch(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProvider: (id) => apiFetch(`/providers/${id}`, { method: 'DELETE' }),
    getProviderModels: (id) => apiFetch(`/providers/${id}/models`),
    refreshModels: (id) => apiFetch(`/providers/${id}/refresh-models`, { method: 'POST' }),
    validateProvider: (id) => apiFetch(`/providers/${id}/validate`),

    // Tools
    getTools: () => apiFetch('/tools'),
    createTool: (data) => apiFetch('/tools', { method: 'POST', body: JSON.stringify(data) }),
    getTool: (id) => apiFetch(`/tools/${id}`),
    updateTool: (id, data) => apiFetch(`/tools/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTool: (id) => apiFetch(`/tools/${id}`, { method: 'DELETE' }),
    testTool: (id, params) => apiFetch(`/tools/${id}/test`, { method: 'POST', body: JSON.stringify({ parameters: params }) }),
    downloadTool: (id) => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
        window.open(`${API_BASE}/tools/${id}/download`, '_blank');
    },
    uploadToolPack: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const url = `${API_BASE}/tools/upload-pack`;
        const headers = {};
        const email = getCurrentUserEmail();
        if (email) {
            headers['x-user-email'] = email;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!res.ok) {
            let error;
            try { error = await res.json(); } catch { error = { detail: res.statusText }; }
            throw new Error(error.detail || `API Error: ${res.status}`);
        }
        return res.json();
    },
    downloadSampleToolPack: () => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
        window.open(`${API_BASE}/tools/sample-pack`, '_blank');
    },
    generateToolPack: async (data) => {
        const url = `${API_BASE}/tools/generate-pack`;
        const headers = {
            'Content-Type': 'application/json'
        };
        const email = getCurrentUserEmail();
        if (email) {
            headers['x-user-email'] = email;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            let error;
            try { error = await res.json(); } catch { error = { detail: res.statusText }; }
            throw new Error(error.detail || `API Error: ${res.status}`);
        }

        // Return the blob for download
        const blob = await res.blob();
        const filename = res.headers.get('Content-Disposition')?.match(/filename=(.+)/)?.[1] || 'tool_pack.zip';
        return { blob, filename };
    },

    // MCP
    getMCPServers: () => apiFetch('/mcp'),
    createMCPServer: (data) => apiFetch('/mcp', { method: 'POST', body: JSON.stringify(data) }),
    getMCPServer: (id) => apiFetch(`/mcp/${id}`),
    updateMCPServer: (id, data) => apiFetch(`/mcp/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMCPServer: (id) => apiFetch(`/mcp/${id}`, { method: 'DELETE' }),
    startMCPServer: (id, orgId) => apiFetch(`/mcp/${id}/start${orgId ? `?org_id=${orgId}` : ''}`, { method: 'POST' }),
    stopMCPServer: (id) => apiFetch(`/mcp/${id}/stop`, { method: 'POST' }),
    restartMCPServer: (id, orgId) => apiFetch(`/mcp/${id}/restart${orgId ? `?org_id=${orgId}` : ''}`, { method: 'POST' }),
    getMCPTools: (id) => apiFetch(`/mcp/${id}/tools`),
    executeMCPTool: (id, data) => apiFetch(`/mcp/${id}/execute`, { method: 'POST', body: JSON.stringify(data) }),
    discoverMCPTools: (id, orgId) => apiFetch(`/mcp/${id}/discover${orgId ? `?org_id=${orgId}` : ''}`, { method: 'POST' }),

    // Chat
    getConversations: (workspaceId) => apiFetch(`/chat/conversations${workspaceId ? `?workspace_id=${workspaceId}` : ''}`),
    createConversation: (data) => apiFetch('/chat/conversations', { method: 'POST', body: JSON.stringify(data) }),
    getConversation: (id) => apiFetch(`/chat/conversations/${id}`),
    deleteConversation: (id) => apiFetch(`/chat/conversations/${id}`, { method: 'DELETE' }),
    getMessages: (id) => apiFetch(`/chat/conversations/${id}/messages`),
    uploadChatFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const url = `${API_BASE}/chat/parse_file`;
        const headers = {};
        const email = getCurrentUserEmail();
        if (email) {
            headers['x-user-email'] = email;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!res.ok) {
            let error;
            try { error = await res.json(); } catch { error = { detail: res.statusText }; }
            throw new Error(error.detail || `API Error: ${res.status}`);
        }
        return res.json();
    },

    // Workflows (workspace-scoped)
    getWorkflows: (workspaceId) => apiFetch(`/workflows?workspace_id=${workspaceId}`),
    createWorkflow: (data) => apiFetch('/workflows', { method: 'POST', body: JSON.stringify(data) }),
    getWorkflow: (id) => apiFetch(`/workflows/${id}`),
    updateWorkflow: (id, data) => apiFetch(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteWorkflow: (id) => apiFetch(`/workflows/${id}`, { method: 'DELETE' }),
    executeWorkflow: (id, data) => apiFetch(`/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify(data) }),
    getWorkflowExecutions: (id) => apiFetch(`/workflows/${id}/executions`),
    getWorkflowExecution: (wfId, execId) => apiFetch(`/workflows/${wfId}/executions/${execId}`),

    // Observability
    getLogs: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/observability/logs?${qs}`);
    },
    getLog: (id) => apiFetch(`/observability/logs/${id}`),
    getStats: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/observability/stats?${qs}`);
    },
    getTimeseries: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/observability/stats/timeseries?${qs}`);
    },

    // Agents (workspace-scoped)
    getAgents: (workspaceId) => apiFetch(`/agents?workspace_id=${workspaceId}`),
    createAgent: (data) => apiFetch('/agents', { method: 'POST', body: JSON.stringify(data) }),
    getAgent: (id) => apiFetch(`/agents/${id}`),
    updateAgent: (id, data) => apiFetch(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAgent: (id) => apiFetch(`/agents/${id}`, { method: 'DELETE' }),
    queryAgent: (id, data) => apiFetch(`/agents/${id}/query`, { method: 'POST', body: JSON.stringify({ ...data, stream: false }) }),
    getAgentConversations: (id) => apiFetch(`/agents/${id}/conversations`),
    generateRunbook: (data) => apiFetch('/agents/generate-runbook', { method: 'POST', body: JSON.stringify(data) }),

    // Workflow Query
    queryWorkflow: (id, data) => apiFetch(`/workflows/${id}/query`, { method: 'POST', body: JSON.stringify(data) }),

    // Skills (workspace-scoped)
    getSkills: (workspaceId) => apiFetch(`/skills?workspace_id=${workspaceId}`),
    createSkill: (data) => apiFetch('/skills', { method: 'POST', body: JSON.stringify(data) }),
    getSkill: (id) => apiFetch(`/skills/${id}`),
    updateSkill: (id, data) => apiFetch(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSkill: (id) => apiFetch(`/skills/${id}`, { method: 'DELETE' }),

    // Knowledge (workspace-scoped)
    getKnowledgeBases: (workspaceId) => apiFetch(`/knowledge?workspace_id=${workspaceId}`),
    createKnowledgeBase: (data) => apiFetch('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
    getKnowledgeBase: (id) => apiFetch(`/knowledge/${id}`),
    updateKnowledgeBase: (id, data) => apiFetch(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteKnowledgeBase: (id) => apiFetch(`/knowledge/${id}`, { method: 'DELETE' }),

    // Knowledge Documents
    getDocuments: (kbId) => apiFetch(`/knowledge/${kbId}/documents`),
    createDocument: (kbId, data) => apiFetch(`/knowledge/${kbId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
    queryKnowledgeBase: (kbId, query, topK = 5) => apiFetch(`/knowledge/${kbId}/query`, { method: 'POST', body: JSON.stringify({ query, top_k: topK }) }),
    uploadDocument: async (kbId, file) => {
        const formData = new FormData();
        formData.append('file', file);

        const url = `${API_BASE}/knowledge/${kbId}/documents/upload`;
        const headers = {};
        const email = getCurrentUserEmail();
        if (email) {
            headers['x-user-email'] = email;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!res.ok) {
            let error;
            try { error = await res.json(); } catch { error = { detail: res.statusText }; }
            throw new Error(error.detail || `API Error: ${res.status}`);
        }
        return res.json();
    },
    deleteDocument: (kbId, docId) => apiFetch(`/knowledge/${kbId}/documents/${docId}`, { method: 'DELETE' }),
};
