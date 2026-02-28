from fastapi import Header, HTTPException, Depends
from typing import Optional
from database import get_db

async def get_user_email(x_user_email: str = Header(...)) -> str:
    """Extracts user email from header."""
    return x_user_email

class RequirePermission:
    """
    Dependency generator for verifying RBAC across standard API endpoints.
    Allows for checking if the user has Org-level roles OR explicit Resource-level roles.
    """
    def __init__(self, required_role: Optional[str] = None):
        """
        :param required_role: Minimum org-level role required ('owner', 'admin', 'member', 'viewer')
        """
        self.required_role = required_role
        self.role_hierarchy = {'owner': 4, 'admin': 3, 'member': 2, 'viewer': 1}

    async def __call__(
        self,
        org_id: Optional[str] = None, # Path or query param
        x_user_email: str = Depends(get_user_email)
    ) -> dict:
        """
        Returns the user's role mapping. Raises HTTPException if unauthorized.
        Note: The actual endpoint must extract org_id from path params/query 
        or request payload if it's dynamic.
        """
        if not org_id:
            # If org_id cannot be implicitly gathered, we skip direct org auth here
            # and leave it strictly to the endpoint logic.
            return {"email": x_user_email, "role": None}

        db = await get_db()
        try:
            cursor = await db.execute(
                "SELECT role FROM organization_members WHERE org_id = ? AND user_email = ? AND status = 'active'",
                (org_id, x_user_email)
            )
            member = await cursor.fetchone()
            
            if not member:
                raise HTTPException(status_code=403, detail="Not an active member of this organization")

            current_role = member['role']

            # If a strict org-level role is required, verify hierarchy
            if self.required_role:
                req_level = self.role_hierarchy.get(self.required_role, 0)
                cur_level = self.role_hierarchy.get(current_role, 0)
                
                if cur_level < req_level:
                    raise HTTPException(status_code=403, detail=f"Requires {self.required_role} privileges.")
                    
            return {"email": x_user_email, "role": current_role, "org_id": org_id}
        finally:
            await db.close()

async def check_resource_permission(
    org_id: str, 
    resource_type: str, 
    resource_id: str, 
    x_user_email: str, 
    required_perm: str # read, write, execute
) -> bool:
    """Utility to query db and verify specific resource grants"""
    db = await get_db()
    try:
        perm_hierarchy = {'write': 3, 'execute': 2, 'read': 1}
        req_level = perm_hierarchy.get(required_perm, 1)

        cursor = await db.execute(
            "SELECT permission_level FROM resource_permissions WHERE org_id = ? AND user_email = ? AND resource_type = ? AND resource_id = ?",
            (org_id, x_user_email, resource_type, resource_id)
        )
        grant = await cursor.fetchone()
        
        if not grant:
            return False
            
        cur_level = perm_hierarchy.get(grant['permission_level'], 0)
        return cur_level >= req_level
    finally:
        await db.close()

async def verify_workspace_access(workspace_id: str, x_user_email: str = Header(...)) -> dict:
    """Dependency to verify user has access to the workspace's underlying organization"""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT org_id FROM workspaces WHERE id = ?", (workspace_id,))
        ws = await cursor.fetchone()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        org_id = ws['org_id']
        
        # Verify org access
        cursor = await db.execute(
            "SELECT role FROM organization_members WHERE org_id = ? AND user_email = ? AND status = 'active'",
            (org_id, x_user_email)
        )
        member = await cursor.fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
            
        return {"email": x_user_email, "role": member['role'], "org_id": org_id, "workspace_id": workspace_id}
    finally:
        await db.close()

async def verify_env_access(env_id: str, x_user_email: str = Header(...)) -> dict:
    """Dependency to verify user has access to the environment's underlying organization"""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT org_id FROM environments WHERE id = ?", (env_id,))
        env = await cursor.fetchone()
        if not env:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        org_id = env['org_id']
        
        # Verify org access
        cursor = await db.execute(
            "SELECT role FROM organization_members WHERE org_id = ? AND user_email = ? AND status = 'active'",
            (org_id, x_user_email)
        )
        member = await cursor.fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Not authorized to access this environment")
            
        return {"email": x_user_email, "role": member['role'], "org_id": org_id, "env_id": env_id}
    finally:
        await db.close()
