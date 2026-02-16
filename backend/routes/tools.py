from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from services.tool_service import execute_tool, get_tool_schema_for_llm
import uuid
import json

router = APIRouter()

class ToolCreate(BaseModel):
    name: str
    description: str
    category: Optional[str] = "custom"
    parameters_schema: Optional[dict] = {}
    code: Optional[str] = None

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    parameters_schema: Optional[dict] = None
    code: Optional[str] = None
    is_enabled: Optional[bool] = None

class ToolTest(BaseModel):
    parameters: dict = {}


@router.get("")
async def list_tools(workspace_id: Optional[str] = None):
    db = await get_db()
    try:
        if workspace_id:
            cursor = await db.execute("SELECT * FROM tools WHERE workspace_id = ? ORDER BY type, name", (workspace_id,))
        else:
            cursor = await db.execute("SELECT * FROM tools ORDER BY type, name")
        rows = await cursor.fetchall()
        tools = []
        for row in rows:
            t = dict(row)
            t["parameters_schema"] = json.loads(t.get("parameters_schema", "{}"))
            t["is_enabled"] = bool(t.get("is_enabled", 1))
            tools.append(t)
        return {"tools": tools, "count": len(tools)}
    finally:
        await db.close()


@router.post("")
async def create_tool(tool: ToolCreate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM tools WHERE name = ?", (tool.name,))
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Tool with name '{tool.name}' already exists")

        tool_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        await db.execute(
            """INSERT INTO tools (id, name, description, type, category, parameters_schema, code, is_enabled, created_at, updated_at)
               VALUES (?, ?, ?, 'custom', ?, ?, ?, 1, ?, ?)""",
            (tool_id, tool.name, tool.description, tool.category,
             json.dumps(tool.parameters_schema), tool.code, now, now)
        )
        await db.commit()
        return {"id": tool_id, "name": tool.name, "type": "custom", "created_at": now}
    finally:
        await db.close()


@router.get("/{tool_id}")
async def get_tool(tool_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")
        t = dict(row)
        t["parameters_schema"] = json.loads(t.get("parameters_schema", "{}"))
        t["is_enabled"] = bool(t.get("is_enabled", 1))
        return t
    finally:
        await db.close()


@router.put("/{tool_id}")
async def update_tool(tool_id: str, update: ToolUpdate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")

        existing = dict(row)
        if existing["type"] == "builtin" and (update.name or update.parameters_schema or update.code):
            raise HTTPException(status_code=400, detail="Cannot modify built-in tool definition")

        now = datetime.utcnow().isoformat()
        await db.execute(
            """UPDATE tools SET name=?, description=?, category=?, parameters_schema=?, code=?, is_enabled=?, updated_at=?
               WHERE id=?""",
            (update.name or existing["name"],
             update.description or existing["description"],
             update.category or existing["category"],
             json.dumps(update.parameters_schema) if update.parameters_schema else existing["parameters_schema"],
             update.code if update.code is not None else existing["code"],
             int(update.is_enabled) if update.is_enabled is not None else existing["is_enabled"],
             now, tool_id)
        )
        await db.commit()
        return {"id": tool_id, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{tool_id}")
async def delete_tool(tool_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")
        if dict(row)["type"] == "builtin":
            raise HTTPException(status_code=400, detail="Cannot delete built-in tools")
        await db.execute("DELETE FROM tools WHERE id = ?", (tool_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


@router.post("/{tool_id}/test")
async def test_tool(tool_id: str, test: ToolTest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")
        tool = dict(row)
        import time
        start = time.time()
        result = await execute_tool(tool["name"], test.parameters, tool.get("code"))
        elapsed = int((time.time() - start) * 1000)
        return {"result": result, "execution_time_ms": elapsed}
    finally:
        await db.close()


@router.get("/{tool_id}/schema")
async def get_tool_llm_schema(tool_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")
        tool = dict(row)
        tool["parameters_schema"] = json.loads(tool.get("parameters_schema", "{}"))
        return get_tool_schema_for_llm(tool)
    finally:
        await db.close()
