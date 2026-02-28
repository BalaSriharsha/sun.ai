from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from services.agent_service import run_agent, stream_agent
from auth import verify_workspace_access
import uuid
import json

router = APIRouter()


class AgentCreate(BaseModel):
    name: str
    workspace_id: str  # Required: agents are workspace-scoped
    description: Optional[str] = ""
    system_prompt: Optional[str] = "You are a helpful AI assistant."
    provider_id: str
    model_id: str
    tools: Optional[List[str]] = []
    mcp_servers: Optional[List[str]] = []
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    max_iterations: Optional[int] = 10


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    provider_id: Optional[str] = None
    model_id: Optional[str] = None
    tools: Optional[List[str]] = None
    mcp_servers: Optional[List[str]] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    max_iterations: Optional[int] = None
    status: Optional[str] = None


class AgentQueryRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    stream: Optional[bool] = True


@router.get("")
async def list_agents(workspace_id: str, x_user_email: str = Header(...)):
    """List all agents in a workspace."""
    await verify_workspace_access(workspace_id, x_user_email)
    
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM agents WHERE workspace_id = ? ORDER BY updated_at DESC",
            (workspace_id,)
        )
        rows = await cursor.fetchall()
        agents = []
        for row in rows:
            a = dict(row)
            a["tools"] = json.loads(a.get("tools", "[]"))
            a["mcp_servers"] = json.loads(a.get("mcp_servers", "[]"))

            # Get provider name
            if a.get("provider_id"):
                pc = await db.execute("SELECT name, type FROM providers WHERE id = ?", (a["provider_id"],))
                prow = await pc.fetchone()
                if prow:
                    a["provider_name"] = dict(prow)["name"]
                    a["provider_type"] = dict(prow)["type"]

            agents.append(a)
        return {"agents": agents}
    finally:
        await db.close()


@router.post("")
async def create_agent(agent: AgentCreate, x_user_email: str = Header(...)):
    """Create a new agent."""
    await verify_workspace_access(agent.workspace_id, x_user_email)
    
    agent_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = await get_db()
    try:
        # Validate workspace exists
        cursor = await db.execute("SELECT id FROM workspaces WHERE id = ?", (agent.workspace_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Workspace not found")

        # Validate provider exists
        cursor = await db.execute("SELECT id FROM providers WHERE id = ?", (agent.provider_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Provider not found")

        await db.execute(
            """INSERT INTO agents (id, workspace_id, name, description, system_prompt, provider_id, model_id,
               tools, mcp_servers, temperature, max_tokens, max_iterations, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
            (agent_id, agent.workspace_id,
             agent.name, agent.description, agent.system_prompt,
             agent.provider_id, agent.model_id,
             json.dumps(agent.tools), json.dumps(agent.mcp_servers),
             agent.temperature, agent.max_tokens, agent.max_iterations, now, now)
        )
        await db.commit()
        return {"id": agent_id, "name": agent.name, "workspace_id": agent.workspace_id, "status": "active", "created_at": now}
    finally:
        await db.close()


@router.get("/{agent_id}")
async def get_agent(agent_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        a = dict(row)
        
        # Verify access
        await verify_workspace_access(a["workspace_id"], x_user_email)
        a["tools"] = json.loads(a.get("tools", "[]"))
        a["mcp_servers"] = json.loads(a.get("mcp_servers", "[]"))

        # Get provider info
        if a.get("provider_id"):
            pc = await db.execute("SELECT name, type FROM providers WHERE id = ?", (a["provider_id"],))
            prow = await pc.fetchone()
            if prow:
                a["provider_name"] = dict(prow)["name"]
                a["provider_type"] = dict(prow)["type"]

        # Get tool details
        tool_details = []
        for tid in a["tools"]:
            tc = await db.execute("SELECT id, name, description FROM tools WHERE id = ?", (tid,))
            trow = await tc.fetchone()
            if trow:
                tool_details.append(dict(trow))
        a["tool_details"] = tool_details

        return a
    finally:
        await db.close()


@router.put("/{agent_id}")
async def update_agent(agent_id: str, update: AgentUpdate, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        existing = dict(row)
        
        # Verify access
        await verify_workspace_access(existing["workspace_id"], x_user_email)
        now = datetime.utcnow().isoformat()

        await db.execute(
            """UPDATE agents SET name=?, description=?, system_prompt=?, provider_id=?, model_id=?,
               tools=?, mcp_servers=?, temperature=?, max_tokens=?, max_iterations=?, status=?, updated_at=?
               WHERE id=?""",
            (
                update.name or existing["name"],
                update.description if update.description is not None else existing["description"],
                update.system_prompt if update.system_prompt is not None else existing["system_prompt"],
                update.provider_id or existing["provider_id"],
                update.model_id or existing["model_id"],
                json.dumps(update.tools) if update.tools is not None else existing["tools"],
                json.dumps(update.mcp_servers) if update.mcp_servers is not None else existing["mcp_servers"],
                update.temperature if update.temperature is not None else existing["temperature"],
                update.max_tokens if update.max_tokens is not None else existing["max_tokens"],
                update.max_iterations if update.max_iterations is not None else existing["max_iterations"],
                update.status or existing["status"],
                now, agent_id
            )
        )
        await db.commit()
        return {"id": agent_id, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, x_user_email: str = Header(...)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT workspace_id FROM agents WHERE id = ?", (agent_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
            
        # Verify access
        await verify_workspace_access(row["workspace_id"], x_user_email)
        await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


@router.post("/{agent_id}/query")
async def query_agent(agent_id: str, req: AgentQueryRequest, x_user_email: str = Header(...)):
    """Query endpoint — send a message, get an agentic response with tool-calling loop."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        agent_row = await cursor.fetchone()
        if not agent_row:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent = dict(agent_row)
        
        # Verify access
        await verify_workspace_access(agent["workspace_id"], x_user_email)
        conv_id = req.conversation_id
        now = datetime.utcnow().isoformat()
        if not conv_id:
            conv_id = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO conversations (id, workspace_id, title, model_id, provider_id, system_prompt, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (conv_id, agent["workspace_id"], req.query[:50] + "..." if req.query else "Agent Chat",
                 agent["model_id"], agent["provider_id"], agent.get("system_prompt", ""), now, now)
            )
            await db.commit()
            
        # Save user message
        msg_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO messages (id, conversation_id, role, content, model_id, created_at)
               VALUES (?, ?, 'user', ?, ?, ?)""",
            (msg_id, conv_id, req.query, agent["model_id"], now)
        )
        await db.commit()
    finally:
        await db.close()

    if req.stream:
        async def event_stream():
            full_content = ""
            async for step in stream_agent(agent_id, req.query, conv_id):
                if step.get("type") == "content":
                    full_content = step.get("content", "")
                yield f"data: {json.dumps(step)}\n\n"

            # Save assistant message
            if full_content:
                db2 = await get_db()
                try:
                    amsg_id = str(uuid.uuid4())
                    now2 = datetime.utcnow().isoformat()
                    await db2.execute(
                        """INSERT INTO messages (id, conversation_id, role, content, model_id, created_at)
                           VALUES (?, ?, 'assistant', ?, ?, ?)""",
                        (amsg_id, conv_id, full_content, agent["model_id"], now2)
                    )
                    await db2.commit()
                finally:
                    await db2.close()

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    else:
        result = await run_agent(agent_id, req.query, conv_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        # Save assistant message
        db2 = await get_db()
        try:
            amsg_id = str(uuid.uuid4())
            now2 = datetime.utcnow().isoformat()
            await db2.execute(
                """INSERT INTO messages (id, conversation_id, role, content, model_id, created_at)
                   VALUES (?, ?, 'assistant', ?, ?, ?)""",
                (amsg_id, conv_id, result.get("content", ""), agent["model_id"], now2)
            )
            await db2.commit()
        finally:
            await db2.close()
            
        result["conversation_id"] = conv_id
        return result


@router.get("/{agent_id}/conversations")
async def list_agent_conversations(agent_id: str, limit: int = 20):
    """List conversations associated with this agent (via observability logs)."""
    db = await get_db()
    try:
        # Find conversations that used this agent through observability logs, MUST actually exist in conversations table
        cursor = await db.execute(
            """SELECT c.*, o.last_used 
               FROM conversations c
               JOIN (
                   SELECT conversation_id, MAX(created_at) as last_used
                   FROM observability_logs 
                   WHERE source = 'agent' AND conversation_id IS NOT NULL AND provider_name != 'system'
                   GROUP BY conversation_id
               ) o ON c.id = o.conversation_id
               ORDER BY o.last_used DESC LIMIT ?""",
            (limit,)
        )
        rows = await cursor.fetchall()
        conversations = [dict(row) for row in rows]
        return {"conversations": conversations}
    finally:
        await db.close()
