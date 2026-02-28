from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from database import get_db
import uuid

router = APIRouter()

# ─── Pydantic Models ───

class PermissionGrant(BaseModel):
    user_email: EmailStr
    permission_level: str # read, write, execute

class PermissionUpdate(BaseModel):
    permission_level: str

# ─── API Routes ───

@router.get("/{resource_type}/{resource_id}")
async def list_permissions(org_id: str, resource_type: str, resource_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Require org admin/owner to view full explicit permissions list
        cursor = await db.execute("SELECT role FROM organization_members WHERE org_id = ? AND user_email = ?", (org_id, x_user_email))
        requestor = await cursor.fetchone()
        if not requestor or requestor['role'] not in ['owner', 'admin']:
            raise HTTPException(status_code=403, detail="Not authorized to view resource permissions")

        cursor = await db.execute(
            "SELECT * FROM resource_permissions WHERE org_id = ? AND resource_type = ? AND resource_id = ? ORDER BY created_at DESC", 
            (org_id, resource_type, resource_id)
        )
        rows = await cursor.fetchall()
        return {"permissions": [dict(r) for r in rows]}
    finally:
        await db.close()

@router.post("/{resource_type}/{resource_id}")
async def grant_permission(org_id: str, resource_type: str, resource_id: str, grant: PermissionGrant, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Require org admin/owner to assign explicit permissions
        cursor = await db.execute("SELECT role FROM organization_members WHERE org_id = ? AND user_email = ?", (org_id, x_user_email))
        requestor = await cursor.fetchone()
        if not requestor or requestor['role'] not in ['owner', 'admin']:
            raise HTTPException(status_code=403, detail="Not authorized to grant resource permissions")

        if grant.permission_level not in ['read', 'write', 'execute']:
            raise HTTPException(status_code=400, detail="Invalid permission level. Must be read, write, or execute")

        # Verify the target user is actually part of the organization
        cursor = await db.execute("SELECT id FROM organization_members WHERE org_id = ? AND user_email = ?", (org_id, grant.user_email))
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Target user must be a member of the organization first")

        # Check if a permission already exists, if so update it instead
        cursor = await db.execute(
            "SELECT id FROM resource_permissions WHERE org_id = ? AND user_email = ? AND resource_type = ? AND resource_id = ?",
            (org_id, grant.user_email, resource_type, resource_id)
        )
        existing = await cursor.fetchone()
        
        now = datetime.utcnow().isoformat()
        
        if existing:
            await db.execute(
                "UPDATE resource_permissions SET permission_level = ?, updated_at = ? WHERE id = ?",
                (grant.permission_level, now, existing['id'])
            )
            perm_id = existing['id']
        else:
            perm_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO resource_permissions (id, org_id, user_email, resource_type, resource_id, permission_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (perm_id, org_id, grant.user_email, resource_type, resource_id, grant.permission_level, now, now)
            )
            
        await db.commit()
        return {"id": perm_id, "user_email": grant.user_email, "permission_level": grant.permission_level}
    finally:
        await db.close()

@router.delete("/{resource_type}/{resource_id}/{user_email}")
async def revoke_permission(org_id: str, resource_type: str, resource_id: str, user_email: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Require org admin/owner to revoke explicit permissions
        cursor = await db.execute("SELECT role FROM organization_members WHERE org_id = ? AND user_email = ?", (org_id, x_user_email))
        requestor = await cursor.fetchone()
        if not requestor or requestor['role'] not in ['owner', 'admin']:
            raise HTTPException(status_code=403, detail="Not authorized to revoke resource permissions")
            
        await db.execute(
            "DELETE FROM resource_permissions WHERE org_id = ? AND user_email = ? AND resource_type = ? AND resource_id = ?",
            (org_id, user_email, resource_type, resource_id)
        )
        await db.commit()
        return {"status": "success"}
    finally:
        await db.close()
