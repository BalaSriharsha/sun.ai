from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from services.workflow_service import execute_workflow
import uuid
import json

router = APIRouter()

class WorkflowCreate(BaseModel):
    name: str
    workspace_id: str  # Required: workflows are workspace-scoped
    description: Optional[str] = ""
    nodes: Optional[list] = []
    edges: Optional[list] = []

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[list] = None
    edges: Optional[list] = None
    status: Optional[str] = None

class WorkflowExecuteRequest(BaseModel):
    input_data: Optional[dict] = {}


@router.get("")
async def list_workflows(workspace_id: str):
    """List all workflows in a workspace."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM workflows WHERE workspace_id = ? ORDER BY updated_at DESC",
            (workspace_id,)
        )
        rows = await cursor.fetchall()
        workflows = []
        for row in rows:
            w = dict(row)
            w["nodes"] = json.loads(w.get("nodes", "[]"))
            w["edges"] = json.loads(w.get("edges", "[]"))
            w["node_count"] = len(w["nodes"])
            workflows.append(w)
        return {"workflows": workflows}
    finally:
        await db.close()


@router.post("")
async def create_workflow(workflow: WorkflowCreate):
    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        # Validate workspace exists
        cursor = await db.execute("SELECT id FROM workspaces WHERE id = ?", (workflow.workspace_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workspace not found")

        await db.execute(
            """INSERT INTO workflows (id, workspace_id, name, description, nodes, edges, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)""",
            (workflow_id, workflow.workspace_id,
             workflow.name, workflow.description,
             json.dumps(workflow.nodes), json.dumps(workflow.edges), now, now)
        )
        await db.commit()
        return {"id": workflow_id, "name": workflow.name, "workspace_id": workflow.workspace_id, "status": "draft", "created_at": now}
    finally:
        await db.close()


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Workflow not found")
        w = dict(row)
        w["nodes"] = json.loads(w.get("nodes", "[]"))
        w["edges"] = json.loads(w.get("edges", "[]"))
        return w
    finally:
        await db.close()


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, update: WorkflowUpdate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Workflow not found")
        existing = dict(row)
        now = datetime.utcnow().isoformat()
        await db.execute(
            """UPDATE workflows SET name=?, description=?, nodes=?, edges=?, status=?, updated_at=?
               WHERE id=?""",
            (update.name or existing["name"],
             update.description if update.description is not None else existing["description"],
             json.dumps(update.nodes) if update.nodes is not None else existing["nodes"],
             json.dumps(update.edges) if update.edges is not None else existing["edges"],
             update.status or existing["status"],
             now, workflow_id)
        )
        await db.commit()
        return {"id": workflow_id, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workflow not found")
        await db.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


@router.post("/{workflow_id}/execute")
async def run_workflow(workflow_id: str, req: WorkflowExecuteRequest):
    result = await execute_workflow(workflow_id, req.input_data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/{workflow_id}/executions")
async def list_executions(workflow_id: str, limit: int = 20):
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT id, workflow_id, status, started_at, completed_at, error
               FROM workflow_executions WHERE workflow_id = ?
               ORDER BY started_at DESC LIMIT ?""",
            (workflow_id, limit)
        )
        rows = await cursor.fetchall()
        return {"executions": [dict(r) for r in rows]}
    finally:
        await db.close()


@router.get("/{workflow_id}/executions/{exec_id}")
async def get_execution(workflow_id: str, exec_id: str):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM workflow_executions WHERE id = ? AND workflow_id = ?",
            (exec_id, workflow_id)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Execution not found")
        e = dict(row)
        e["node_results"] = json.loads(e.get("node_results", "{}"))
        return e
    finally:
        await db.close()


class WorkflowQueryRequest(BaseModel):
    input_data: Optional[dict] = {}
    async_mode: Optional[bool] = False


@router.post("/{workflow_id}/query")
async def query_workflow(workflow_id: str, req: WorkflowQueryRequest):
    """Query endpoint — send input data and get workflow execution results.
    Each workflow gets its own queryable API."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM workflows WHERE id = ?", (workflow_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workflow not found")
    finally:
        await db.close()

    result = await execute_workflow(workflow_id, req.input_data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

