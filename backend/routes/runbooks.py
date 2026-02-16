from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from services.chat_service import stream_chat_completion, non_stream_chat_completion
from services.tool_service import execute_tool, get_tool_schema_for_llm
import uuid
import json

router = APIRouter()

class RunbookCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    content: str
    model_id: Optional[str] = None
    provider_id: Optional[str] = None
    tools: Optional[List[str]] = []
    mcp_servers: Optional[List[str]] = []
    system_prompt: Optional[str] = None

class RunbookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    model_id: Optional[str] = None
    provider_id: Optional[str] = None
    tools: Optional[List[str]] = None
    mcp_servers: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    status: Optional[str] = None

class RunbookExecute(BaseModel):
    input: str
    provider_id: Optional[str] = None
    model_id: Optional[str] = None


@router.get("")
async def list_runbooks():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runbooks ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        runbooks = []
        for row in rows:
            r = dict(row)
            r["tools"] = json.loads(r.get("tools", "[]"))
            r["mcp_servers"] = json.loads(r.get("mcp_servers", "[]"))
            runbooks.append(r)
        return {"runbooks": runbooks}
    finally:
        await db.close()


@router.post("")
async def create_runbook(runbook: RunbookCreate):
    runbook_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO runbooks (id, name, description, content, model_id, provider_id,
               tools, mcp_servers, system_prompt, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)""",
            (runbook_id, runbook.name, runbook.description, runbook.content,
             runbook.model_id, runbook.provider_id,
             json.dumps(runbook.tools), json.dumps(runbook.mcp_servers),
             runbook.system_prompt, now, now)
        )
        await db.commit()
        return {"id": runbook_id, "name": runbook.name, "status": "draft", "created_at": now}
    finally:
        await db.close()


@router.get("/{runbook_id}")
async def get_runbook(runbook_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Runbook not found")
        r = dict(row)
        r["tools"] = json.loads(r.get("tools", "[]"))
        r["mcp_servers"] = json.loads(r.get("mcp_servers", "[]"))
        return r
    finally:
        await db.close()


@router.put("/{runbook_id}")
async def update_runbook(runbook_id: str, update: RunbookUpdate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Runbook not found")
        existing = dict(row)
        now = datetime.utcnow().isoformat()
        await db.execute(
            """UPDATE runbooks SET name=?, description=?, content=?, model_id=?, provider_id=?,
               tools=?, mcp_servers=?, system_prompt=?, status=?, updated_at=?
               WHERE id=?""",
            (update.name or existing["name"],
             update.description if update.description is not None else existing["description"],
             update.content if update.content is not None else existing["content"],
             update.model_id if update.model_id is not None else existing["model_id"],
             update.provider_id if update.provider_id is not None else existing["provider_id"],
             json.dumps(update.tools) if update.tools is not None else existing["tools"],
             json.dumps(update.mcp_servers) if update.mcp_servers is not None else existing["mcp_servers"],
             update.system_prompt if update.system_prompt is not None else existing["system_prompt"],
             update.status or existing["status"],
             now, runbook_id)
        )
        await db.commit()
        return {"id": runbook_id, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{runbook_id}")
async def delete_runbook(runbook_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Runbook not found")
        await db.execute("DELETE FROM runbooks WHERE id = ?", (runbook_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


@router.post("/{runbook_id}/execute")
async def execute_runbook(runbook_id: str, exec_req: RunbookExecute):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Runbook not found")
        runbook = dict(row)

        provider_id = exec_req.provider_id or runbook.get("provider_id")
        model_id = exec_req.model_id or runbook.get("model_id")

        if not provider_id or not model_id:
            raise HTTPException(status_code=400, detail="Provider and model must be specified")

        # Get provider
        pc = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        provider = await pc.fetchone()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        provider = dict(provider)

        # Build system prompt from runbook
        system_prompt = runbook.get("system_prompt", "")
        runbook_content = runbook.get("content", "")
        full_system = f"{system_prompt}\n\n## Runbook Instructions\n{runbook_content}" if system_prompt else f"## Runbook Instructions\n{runbook_content}"

        # Get tools
        tool_ids = json.loads(runbook.get("tools", "[]"))
        tool_schemas = []
        for tid in tool_ids:
            tc = await db.execute("SELECT * FROM tools WHERE id = ? AND is_enabled = 1", (tid,))
            tool_row = await tc.fetchone()
            if tool_row:
                t = dict(tool_row)
                t["parameters_schema"] = json.loads(t.get("parameters_schema", "{}"))
                tool_schemas.append(get_tool_schema_for_llm(t))

        messages = [
            {"role": "system", "content": full_system},
            {"role": "user", "content": exec_req.input}
        ]

        # Update last run
        await db.execute(
            "UPDATE runbooks SET last_run_at=?, status='active', updated_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), runbook_id)
        )
        await db.commit()
    finally:
        await db.close()

    # Execute with streaming
    async def event_stream():
        steps = []
        step_count = 0
        current_messages = list(messages)
        max_iterations = 10

        for iteration in range(max_iterations):
            step_count += 1
            step = {"step": step_count, "type": "llm_call", "content": "", "tool_calls": []}

            async for chunk in stream_chat_completion(
                provider_type=provider["type"],
                model_id=model_id,
                messages=current_messages,
                api_key=provider["api_key_encrypted"],
                base_url=provider.get("base_url"),
                tools=tool_schemas if tool_schemas else None,
                provider_id=provider["id"],
                provider_name=provider["name"],
                source="runbook",
            ):
                if chunk["type"] == "content":
                    step["content"] += chunk["content"]
                    yield f"data: {json.dumps({'type': 'content', 'step': step_count, 'content': chunk['content']})}\n\n"
                elif chunk["type"] == "tool_calls":
                    step["tool_calls"] = chunk["tool_calls"]
                elif chunk["type"] == "error":
                    yield f"data: {json.dumps({'type': 'error', 'error': chunk['error']})}\n\n"
                    return

            # If there are tool calls, execute them
            if step["tool_calls"]:
                current_messages.append({"role": "assistant", "content": step["content"], "tool_calls": step["tool_calls"]})

                for tc in step["tool_calls"]:
                    tool_name = tc["function"]["name"]
                    try:
                        args = json.loads(tc["function"]["arguments"])
                    except json.JSONDecodeError:
                        args = {}

                    yield f"data: {json.dumps({'type': 'tool_start', 'step': step_count, 'tool': tool_name, 'args': args})}\n\n"

                    result = await execute_tool(tool_name, args)

                    yield f"data: {json.dumps({'type': 'tool_result', 'step': step_count, 'tool': tool_name, 'result': result})}\n\n"

                    current_messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result)
                    })
            else:
                # No tool calls, we're done
                break

        yield f"data: {json.dumps({'type': 'done', 'total_steps': step_count})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
