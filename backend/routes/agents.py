from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any
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
    query: Any  # Supports string or list of dicts (for vision)
    conversation_id: Optional[str] = None
    stream: Optional[bool] = True


class RunbookGenerateRequest(BaseModel):
    description: str
    provider_id: str
    model_id: str
    agent_name: Optional[str] = None
    tools: Optional[List[str]] = []


RUNBOOK_GENERATION_PROMPT = """You are an expert at creating AI agent runbooks (system prompts).

Based on the following agent description, generate a comprehensive runbook that includes:

1. **Role Definition**: A clear statement of who the agent is and its primary purpose
2. **Capabilities**: What the agent can do (based on available tools if provided)
3. **Behavior Guidelines**: How the agent should interact with users
4. **Step-by-Step Workflow**: If applicable, the process the agent should follow
5. **Output Format**: How responses should be structured
6. **Constraints**: Any limitations or things the agent should avoid

Agent Name: {agent_name}
Agent Description: {description}
Available Tools: {tools}

Generate a well-structured runbook in plain text. Be specific and actionable.
The runbook should be practical and ready to use as a system prompt.
Do not use markdown headers, just use clear sections with labels."""


@router.post("/generate-runbook")
async def generate_runbook(req: RunbookGenerateRequest, x_user_email: str = Header(...)):
    """Generate a runbook template based on agent description using LLM."""
    from services.chat_service import non_stream_chat_completion
    import time

    start = time.time()
    db = await get_db()
    try:
        # Get provider details
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (req.provider_id,))
        provider_row = await cursor.fetchone()
        if not provider_row:
            raise HTTPException(status_code=404, detail="Provider not found")
        provider = dict(provider_row)

        # Resolve model_id (UUID to actual model string)
        actual_model_id = req.model_id
        cursor = await db.execute("SELECT model_id FROM models WHERE id = ?", (req.model_id,))
        model_row = await cursor.fetchone()
        if model_row:
            actual_model_id = model_row["model_id"]

        # Get tool names if provided
        tool_names = []
        if req.tools:
            for tool_id in req.tools:
                tc = await db.execute("SELECT name, description FROM tools WHERE id = ?", (tool_id,))
                trow = await tc.fetchone()
                if trow:
                    tool_names.append(f"- {trow['name']}: {trow['description']}")

        tools_str = "\n".join(tool_names) if tool_names else "No specific tools assigned"

        # Build the prompt
        prompt = RUNBOOK_GENERATION_PROMPT.format(
            description=req.description,
            agent_name=req.agent_name or "AI Assistant",
            tools=tools_str
        )

        messages = [
            {"role": "system", "content": "You are an expert at creating AI agent configurations."},
            {"role": "user", "content": prompt}
        ]

        # Clean Azure base URL if needed
        base_url = provider.get("base_url")
        if provider["type"] == "azure" and base_url:
            if "/openai/" in base_url:
                base_url = base_url.split("/openai/")[0]
            if "cognitiveservices.azure.com" in base_url:
                base_url = base_url.replace("cognitiveservices.azure.com", "openai.azure.com")

        # Call LLM
        result = await non_stream_chat_completion(
            provider_type=provider["type"],
            model_id=actual_model_id,
            messages=messages,
            api_key=provider["api_key_encrypted"],
            base_url=base_url,
            api_version=provider.get("api_version"),
            tools=None,
            temperature=0.7,
            max_tokens=2000,
            provider_id=provider["id"],
            provider_name=provider["name"],
            source="runbook_generation",
        )

        elapsed = int((time.time() - start) * 1000)

        return {
            "runbook": result.get("content", ""),
            "generation_time_ms": elapsed,
            "usage": result.get("usage")
        }

    finally:
        await db.close()


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
            # For title, extract text if query is a list
            title_text = "Agent Chat"
            if isinstance(req.query, str):
                title_text = req.query[:50] + "..." if req.query else "Agent Chat"
            elif isinstance(req.query, list) and len(req.query) > 0 and req.query[0].get("type") == "text":
                title_text = req.query[0].get("text", "Agent Chat")[:50] + "..."
                
            await db.execute(
                """INSERT INTO conversations (id, workspace_id, user_email, agent_id, title, model_id, provider_id, system_prompt, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (conv_id, agent["workspace_id"], x_user_email, agent_id, title_text,
                 agent["model_id"], agent["provider_id"], agent.get("system_prompt", ""), now, now)
            )
            await db.commit()
            
        # Save user message
        msg_id = str(uuid.uuid4())
        content_to_save = json.dumps(req.query) if isinstance(req.query, list) else str(req.query)
        await db.execute(
            """INSERT INTO messages (id, conversation_id, role, content, model_id, created_at)
               VALUES (?, ?, 'user', ?, ?, ?)""",
            (msg_id, conv_id, content_to_save, agent["model_id"], now)
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
async def list_agent_conversations(agent_id: str, x_user_email: str = Header(None), limit: int = 20):
    """List conversations associated with this agent."""
    db = await get_db()
    try:
        # Verify access first by fetching the agent
        cursor = await db.execute("SELECT workspace_id FROM agents WHERE id = ?", (agent_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        await verify_workspace_access(row["workspace_id"], x_user_email)

        query = "SELECT * FROM conversations WHERE agent_id = ?"
        params = [agent_id]

        if x_user_email:
            query += " AND user_email = ?"
            params.append(x_user_email)
            
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)

        cursor = await db.execute(query, tuple(params))
        rows = await cursor.fetchall()
        conversations = [dict(row) for row in rows]
        return {"conversations": conversations}
    finally:
        await db.close()
