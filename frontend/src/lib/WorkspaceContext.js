'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setApiUserEmail } from './api';
import { useUser } from '@clerk/nextjs';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
    const [orgs, setOrgs] = useState([]);
    const [environments, setEnvironments] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [currentOrgId, setCurrentOrgId] = useState(null);
    const [currentEnvId, setCurrentEnvId] = useState(null);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
    const [loading, setLoading] = useState(true);

    const { isLoaded, isSignedIn, user } = useUser();

    // Effect to configure API identity and kick off org load
    useEffect(() => {
        if (isLoaded && isSignedIn && user?.primaryEmailAddress?.emailAddress) {
            setApiUserEmail(user.primaryEmailAddress.emailAddress);
            loadOrgs();
        } else if (isLoaded && !isSignedIn) {
            // Unauthenticated state
            setOrgs([]);
            setLoading(false);
        }
    }, [isLoaded, isSignedIn, user]);

    const currentOrg = orgs.find(o => o.id === currentOrgId) || null;

    // Load environments when org changes
    useEffect(() => {
        if (currentOrgId && currentOrg?.status !== 'pending') {
            loadEnvironments(currentOrgId);
        } else if (currentOrg?.status === 'pending') {
            setEnvironments([]);
            setCurrentEnvId(null);
            setCurrentWorkspaceId(null);
        }
    }, [currentOrgId, currentOrg?.status]);

    // Load workspaces when env changes
    useEffect(() => {
        if (currentOrgId && currentEnvId && currentOrg?.status !== 'pending') {
            loadWorkspaces(currentOrgId, currentEnvId);
        }
    }, [currentOrgId, currentEnvId, currentOrg?.status]);

    // Persist selection to localStorage
    useEffect(() => {
        if (currentOrgId) localStorage.setItem('agentic_org_id', currentOrgId);
        if (currentEnvId) localStorage.setItem('agentic_env_id', currentEnvId);
        if (currentWorkspaceId) localStorage.setItem('agentic_workspace_id', currentWorkspaceId);
    }, [currentOrgId, currentEnvId, currentWorkspaceId]);

    const loadOrgs = useCallback(async () => {
        try {
            let data = await apiFetch('/orgs');

            // Auto-provision brand new users
            if (!data.organizations || data.organizations.length === 0) {
                console.log("No organizations found. Auto-provisioning Default Organization for new user...");
                const newOrgData = await apiFetch('/orgs', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: "My Workspace",
                        description: "Auto-created personal workspace"
                    })
                });
                // Fetch the list again now that it's created
                data = await apiFetch('/orgs');

                setOrgs(data.organizations || []);
                setCurrentOrgId(newOrgData.id);
                setCurrentEnvId(newOrgData.default_env_id);
                setCurrentWorkspaceId(newOrgData.default_workspace_id);
                return; // Skip normal loading flows
            }

            setOrgs(data.organizations || []);

            const savedOrg = localStorage.getItem('agentic_org_id');
            const orgList = data.organizations || [];

            if (savedOrg && orgList.find(o => o.id === savedOrg)) {
                setCurrentOrgId(savedOrg);
            } else if (orgList.length > 0) {
                // IMPORTANT: If we didn't just auto-provision, grab the first one
                setCurrentOrgId(orgList[0].id);
            }
        } catch (err) {
            console.error('Failed to load orgs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadEnvironments = useCallback(async (orgId) => {
        try {
            const data = await apiFetch(`/orgs/${orgId}/environments`);
            setEnvironments(data.environments || []);

            const savedEnv = localStorage.getItem('agentic_env_id');
            const envList = data.environments || [];
            if (savedEnv && envList.find(e => e.id === savedEnv)) {
                setCurrentEnvId(savedEnv);
            } else if (envList.length > 0) {
                setCurrentEnvId(envList[0].id);
            }
        } catch (err) {
            console.error('Failed to load environments:', err);
        }
    }, []);

    const loadWorkspaces = useCallback(async (orgId, envId) => {
        try {
            const data = await apiFetch(`/orgs/${orgId}/workspaces?env_id=${envId}`);
            setWorkspaces(data.workspaces || []);

            const savedWs = localStorage.getItem('agentic_workspace_id');
            const wsList = data.workspaces || [];
            if (savedWs && wsList.find(w => w.id === savedWs)) {
                setCurrentWorkspaceId(savedWs);
            } else if (wsList.length > 0) {
                setCurrentWorkspaceId(wsList[0].id);
            }
        } catch (err) {
            console.error('Failed to load workspaces:', err);
        }
    }, []);

    const switchOrg = useCallback((orgId) => {
        setCurrentOrgId(orgId);
        setCurrentEnvId(null);
        setCurrentWorkspaceId(null);
    }, []);

    const switchEnv = useCallback((envId) => {
        setCurrentEnvId(envId);
        setCurrentWorkspaceId(null);
    }, []);

    const switchWorkspace = useCallback((wsId) => {
        setCurrentWorkspaceId(wsId);
    }, []);

    const currentEnv = environments.find(e => e.id === currentEnvId) || null;
    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || null;

    return (
        <WorkspaceContext.Provider value={{
            orgs,
            environments,
            workspaces,
            currentOrgId,
            currentEnvId,
            currentWorkspaceId,
            currentOrg,
            currentEnv,
            currentWorkspace,
            switchOrg,
            switchEnv,
            switchWorkspace,
            loadOrgs,
            loadEnvironments: () => currentOrgId && loadEnvironments(currentOrgId),
            loadWorkspaces: () => currentOrgId && currentEnvId && loadWorkspaces(currentOrgId, currentEnvId),
            loading,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
    return ctx;
}
