from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db, CURRENT_DATABASE
from auth import verify_workspace_access
import uuid
import json
import litellm

router = APIRouter()

class KBCreate(BaseModel):
    name: str
    workspace_id: str
    description: Optional[str] = ""

class KBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DocumentCreate(BaseModel):
    title: str
    content: str


@router.get("")
async def list_kbs(workspace_id: str, x_user_email: str = Header(...)):
    await verify_workspace_access(workspace_id, x_user_email)
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT kb.*, 
               (SELECT COUNT(*) FROM knowledge_documents WHERE kb_id = kb.id) as document_count
               FROM knowledge_bases kb 
               WHERE workspace_id = ? ORDER BY created_at DESC""",
            (workspace_id,)
        )
        rows = await cursor.fetchall()
        return {"knowledge_bases": [dict(r) for r in rows]}
    finally:
        await db.close()


@router.post("")
async def create_kb(kb: KBCreate, x_user_email: str = Header(...)):
    await verify_workspace_access(kb.workspace_id, x_user_email)
    kb_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM workspaces WHERE id = ?", (kb.workspace_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workspace not found")

        await db.execute(
            """INSERT INTO knowledge_bases (id, workspace_id, name, description, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (kb_id, kb.workspace_id, kb.name, kb.description, now, now)
        )
        await db.commit()
        return {
            "id": kb_id, 
            "workspace_id": kb.workspace_id, 
            "name": kb.name, 
            "description": kb.description,
            "document_count": 0,
            "created_at": now
        }
    finally:
        await db.close()


@router.get("/{kb_id}")
async def get_kb(kb_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
            
        k = dict(row)
        await verify_workspace_access(k["workspace_id"], x_user_email)
        return k
    finally:
        await db.close()


@router.put("/{kb_id}")
async def update_kb(kb_id: str, update: KBUpdate, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
            
        existing = dict(row)
        await verify_workspace_access(existing["workspace_id"], x_user_email)
        now = datetime.utcnow().isoformat()

        await db.execute(
            """UPDATE knowledge_bases SET name=?, description=?, updated_at=? WHERE id=?""",
            (
                update.name or existing["name"],
                update.description if update.description is not None else existing["description"],
                now, kb_id
            )
        )
        await db.commit()
        return {"id": kb_id, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{kb_id}")
async def delete_kb(kb_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
            
        await verify_workspace_access(row["workspace_id"], x_user_email)
        await db.execute("DELETE FROM knowledge_bases WHERE id = ?", (kb_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


# --- Document & Embedding Endpoints ---

@router.get("/{kb_id}/documents")
async def list_kb_documents(kb_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Verify access
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
        await verify_workspace_access(row["workspace_id"], x_user_email)

        # Do not return the massive embedding vector block
        cursor = await db.execute(
            "SELECT id, kb_id, title, content, created_at, updated_at FROM knowledge_documents WHERE kb_id = ? ORDER BY created_at DESC",
            (kb_id,)
        )
        docs = await cursor.fetchall()
        return {"documents": [dict(d) for d in docs]}
    finally:
        await db.close()


@router.post("/{kb_id}/documents")
async def add_kb_document(kb_id: str, doc: DocumentCreate, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Verify access
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
        await verify_workspace_access(row["workspace_id"], x_user_email)
        
        # Determine Embedding if on postgres
        embedding_val = None
        if CURRENT_DATABASE == "postgres":
            try:
                # We use OpenAI's fast cheap model for embeddings by default. 
                # (Assuming OPENAI_API_KEY is in env)
                response = litellm.embedding(model="text-embedding-3-small", input=[doc.content])
                embedding_vector = response.data[0]["embedding"]
                embedding_val = f"[{','.join(map(str, embedding_vector))}]"
            except Exception as e:
                print(f"Embedding failed: {e}")
                raise HTTPException(status_code=500, detail="Failed to generate embedding for document.")
        
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # We write different insert queries depending on vector support
        if CURRENT_DATABASE == "postgres" and embedding_val is not None:
            await db.execute(
                """INSERT INTO knowledge_documents (id, kb_id, title, content, embedding, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (doc_id, kb_id, doc.title, doc.content, embedding_val, now, now)
            )
        else:
            await db.execute(
                """INSERT INTO knowledge_documents (id, kb_id, title, content, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (doc_id, kb_id, doc.title, doc.content, now, now)
            )
            
        await db.commit()
        return {"id": doc_id, "kb_id": kb_id, "title": doc.title, "created_at": now}
    finally:
        await db.close()


@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_kb_document(kb_id: str, doc_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
            
        await verify_workspace_access(row["workspace_id"], x_user_email)
        await db.execute("DELETE FROM knowledge_documents WHERE id = ?", (doc_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()
