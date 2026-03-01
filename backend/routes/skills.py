from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth import verify_workspace_access
import uuid
import json

router = APIRouter()

class SkillCreate(BaseModel):
    name: str
    workspace_id: str
    description: Optional[str] = ""
    content: str

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None

@router.get("")
async def list_skills(workspace_id: str, x_user_email: str = Header(...)):
    """List all skills in a workspace."""
    await verify_workspace_access(workspace_id, x_user_email)
    
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM skills WHERE workspace_id = ? ORDER BY created_at DESC",
            (workspace_id,)
        )
        rows = await cursor.fetchall()
        return {"skills": [dict(r) for r in rows]}
    finally:
        await db.close()

@router.post("")
async def create_skill(skill: SkillCreate, x_user_email: str = Header(...)):
    """Create a new skill."""
    await verify_workspace_access(skill.workspace_id, x_user_email)
    
    skill_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        # Validate workspace exists
        cursor = await db.execute("SELECT id FROM workspaces WHERE id = ?", (skill.workspace_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workspace not found")

        await db.execute(
            """INSERT INTO skills (id, workspace_id, name, description, content, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (skill_id, skill.workspace_id, skill.name, skill.description, skill.content, now, now)
        )
        await db.commit()
        return {
            "id": skill_id, 
            "workspace_id": skill.workspace_id, 
            "name": skill.name, 
            "description": skill.description,
            "content": skill.content,
            "created_at": now
        }
    finally:
        await db.close()

@router.get("/{skill_id}")
async def get_skill(skill_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Skill not found")
            
        s = dict(row)
        await verify_workspace_access(s["workspace_id"], x_user_email)
        return s
    finally:
        await db.close()

@router.put("/{skill_id}")
async def update_skill(skill_id: str, update: SkillUpdate, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Skill not found")
            
        existing = dict(row)
        await verify_workspace_access(existing["workspace_id"], x_user_email)
        now = datetime.utcnow().isoformat()

        await db.execute(
            """UPDATE skills SET name=?, description=?, content=?, updated_at=? WHERE id=?""",
            (
                update.name or existing["name"],
                update.description if update.description is not None else existing["description"],
                update.content if update.content is not None else existing["content"],
                now, skill_id
            )
        )
        await db.commit()
        return {"id": skill_id, "updated_at": now}
    finally:
        await db.close()

@router.delete("/{skill_id}")
async def delete_skill(skill_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT workspace_id FROM skills WHERE id = ?", (skill_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Skill not found")
            
        await verify_workspace_access(row["workspace_id"], x_user_email)
        await db.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()
