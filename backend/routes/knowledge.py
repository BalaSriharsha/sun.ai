from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db, CURRENT_DATABASE
from auth import verify_workspace_access
import uuid
import json
import litellm
import os
import shutil

router = APIRouter()

class KBCreate(BaseModel):
    name: str
    workspace_id: str
    description: Optional[str] = ""

class KBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class KnowledgeQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5

@router.post("/{kb_id}/query")
async def query_knowledge_base(kb_id: str, req: KnowledgeQuery, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Verify access
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
        await verify_workspace_access(row["workspace_id"], x_user_email)

        # If we are using Postgres with vector support
        if CURRENT_DATABASE == "postgres":
            try:
                # Generate embedding for query
                response = litellm.embedding(model="text-embedding-3-small", input=[req.query])
                query_vector = response.data[0]["embedding"]
                vector_str = f"[{','.join(map(str, query_vector))}]"
                
                # Perform vector similarity search
                # We use cosine distance <=> operator in pgvector
                # Note: We must fetch using raw db adapter because custom types can be tricky
                cursor = await db.execute(
                    """
                    SELECT id, title, content, 
                           1 - (embedding <=> $1::vector) as similarity
                    FROM knowledge_documents 
                    WHERE kb_id = $2
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                    """,
                    (vector_str, kb_id, req.top_k)
                )
                rows = await cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "id": r["id"],
                        "title": r["title"],
                        "content": r["content"],
                        "score": r["similarity"]
                    })
                return {"results": results}
            except Exception as e:
                print(f"Vector search failed: {e}")
                # Fallback to text search if vector fails
                pass
        
        # Fallback for SQLite or if Vector search fails: simple text matching
        # Note: This is a very basic fallback and not a true vector search
        search_term = f"%{req.query}%"
        cursor = await db.execute(
            """SELECT id, title, content 
               FROM knowledge_documents 
               WHERE kb_id = ? AND (title LIKE ? OR content LIKE ?)
               LIMIT ?""",
            (kb_id, search_term, search_term, req.top_k)
        )
        rows = await cursor.fetchall()
        results = [dict(r) for r in rows]
        
        # If still no results, just return some documents as context
        if not results:
             cursor = await db.execute(
                """SELECT id, title, content 
                   FROM knowledge_documents 
                   WHERE kb_id = ?
                   LIMIT ?""",
                (kb_id, req.top_k)
            )
             rows = await cursor.fetchall()
             results = [dict(r) for r in rows]
             
        return {"results": results}
    finally:
        await db.close()

class DocumentCreate(BaseModel):
    title: str
    content: str
    url: Optional[str] = None

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


@router.post("/{kb_id}/documents/upload")
async def upload_kb_document(kb_id: str, file: UploadFile = File(...), x_user_email: str = Header(...)):
    db = await get_db()
    try:
        # Verify access
        cursor = await db.execute("SELECT workspace_id FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
        await verify_workspace_access(row["workspace_id"], x_user_email)

        # Ensure upload dir exists
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, f"{uuid.uuid4()}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            from services.document_parser import parse_document
            content = parse_document(file_path, file.filename)
        except Exception as e:
            content = f"Failed to parse document: {e}"
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)
                
        if not content.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

        # Determine Embedding if on postgres
        embedding_val = None
        if CURRENT_DATABASE == "postgres":
            try:
                response = litellm.embedding(model="text-embedding-3-small", input=[content])
                embedding_vector = response.data[0]["embedding"]
                embedding_val = f"[{','.join(map(str, embedding_vector))}]"
            except Exception as e:
                print(f"Embedding failed: {e}")
                
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        if CURRENT_DATABASE == "postgres" and embedding_val is not None:
            await db.execute(
                """INSERT INTO knowledge_documents (id, kb_id, title, content, embedding, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (doc_id, kb_id, file.filename, content, embedding_val, now, now)
            )
        else:
            await db.execute(
                """INSERT INTO knowledge_documents (id, kb_id, title, content, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (doc_id, kb_id, file.filename, content, now, now)
            )
            
        await db.commit()
        return {"id": doc_id, "kb_id": kb_id, "title": file.filename, "created_at": now}
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
