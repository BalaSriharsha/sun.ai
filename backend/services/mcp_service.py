import json
import uuid
import subprocess
import os
import signal
import asyncio
from datetime import datetime
from database import get_db

BUILTIN_MCP_SERVERS = [
    {
        "name": "filesystem",
        "description": "File system operations - read, write, list, and search files",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
        "available_tools": [
            {"name": "read_file", "description": "Read contents of a file", "parameters": {"path": "string"}},
            {"name": "write_file", "description": "Write content to a file", "parameters": {"path": "string", "content": "string"}},
            {"name": "list_directory", "description": "List files and directories", "parameters": {"path": "string"}},
            {"name": "search_files", "description": "Search for files matching a pattern", "parameters": {"path": "string", "pattern": "string"}}
        ]
    },
    {
        "name": "database",
        "description": "SQLite database operations - execute queries, list tables, describe schemas",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sqlite"],
        "available_tools": [
            {"name": "execute_query", "description": "Execute a SQL query", "parameters": {"query": "string", "db_path": "string"}},
            {"name": "list_tables", "description": "List all tables in a database", "parameters": {"db_path": "string"}},
            {"name": "describe_table", "description": "Get table schema", "parameters": {"table_name": "string", "db_path": "string"}}
        ]
    },
    {
        "name": "web_scraper",
        "description": "Web scraping operations - fetch pages, extract text, parse HTML",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-fetch"],
        "available_tools": [
            {"name": "fetch_page", "description": "Fetch a web page and return HTML", "parameters": {"url": "string"}},
            {"name": "extract_text", "description": "Extract text content from a URL", "parameters": {"url": "string", "selector": "string"}},
            {"name": "extract_links", "description": "Extract all links from a URL", "parameters": {"url": "string"}}
        ]
    },
    {
        "name": "github",
        "description": "GitHub API integration - manage repos, issues, PRs, branches, and code search",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": ""},
        "available_tools": [
            {"name": "create_issue", "description": "Create a new GitHub issue", "parameters": {"repo": "string", "title": "string", "body": "string"}},
            {"name": "list_issues", "description": "List issues in a repository", "parameters": {"repo": "string", "state": "string"}},
            {"name": "create_pull_request", "description": "Create a pull request", "parameters": {"repo": "string", "title": "string", "head": "string", "base": "string"}},
            {"name": "search_code", "description": "Search code across GitHub", "parameters": {"query": "string"}},
            {"name": "get_file_contents", "description": "Get file contents from a repository", "parameters": {"repo": "string", "path": "string"}}
        ]
    },
    {
        "name": "brave_search",
        "description": "Web search using Brave Search API - search the internet for real-time information",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": {"BRAVE_API_KEY": ""},
        "available_tools": [
            {"name": "brave_web_search", "description": "Search the web using Brave Search", "parameters": {"query": "string", "count": "number"}},
            {"name": "brave_local_search", "description": "Search for local businesses and places", "parameters": {"query": "string"}}
        ]
    },
    {
        "name": "memory",
        "description": "Persistent memory using a knowledge graph - store and retrieve entities and relations",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "available_tools": [
            {"name": "create_entities", "description": "Create new entities in the knowledge graph", "parameters": {"entities": "array"}},
            {"name": "create_relations", "description": "Create relations between entities", "parameters": {"relations": "array"}},
            {"name": "search_nodes", "description": "Search for nodes by query", "parameters": {"query": "string"}},
            {"name": "read_graph", "description": "Read the entire knowledge graph", "parameters": {}}
        ]
    },
    {
        "name": "docker",
        "description": "Docker container management - list, create, start, stop containers and images",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-docker"],
        "available_tools": [
            {"name": "list_containers", "description": "List running Docker containers", "parameters": {}},
            {"name": "create_container", "description": "Create a new container", "parameters": {"image": "string", "name": "string"}},
            {"name": "start_container", "description": "Start a stopped container", "parameters": {"container_id": "string"}},
            {"name": "stop_container", "description": "Stop a running container", "parameters": {"container_id": "string"}},
            {"name": "list_images", "description": "List available Docker images", "parameters": {}}
        ]
    },
    {
        "name": "slack",
        "description": "Slack workspace integration - send messages, manage channels, search conversations",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-slack"],
        "env": {"SLACK_BOT_TOKEN": "", "SLACK_TEAM_ID": ""},
        "available_tools": [
            {"name": "send_message", "description": "Send a message to a Slack channel", "parameters": {"channel": "string", "text": "string"}},
            {"name": "list_channels", "description": "List available Slack channels", "parameters": {}},
            {"name": "search_messages", "description": "Search messages in the workspace", "parameters": {"query": "string"}},
            {"name": "get_channel_history", "description": "Get recent messages from a channel", "parameters": {"channel": "string", "limit": "number"}}
        ]
    },
    {
        "name": "notion",
        "description": "Notion workspace integration - search, read, and create pages and databases",
        "command": "npx",
        "args": ["-y", "@notionhq/notion-mcp-server"],
        "env": {"NOTION_API_KEY": ""},
        "available_tools": [
            {"name": "search", "description": "Search across all pages and databases", "parameters": {"query": "string"}},
            {"name": "get_page", "description": "Get a page by ID", "parameters": {"page_id": "string"}},
            {"name": "create_page", "description": "Create a new page", "parameters": {"parent_id": "string", "title": "string", "content": "string"}},
            {"name": "query_database", "description": "Query a Notion database", "parameters": {"database_id": "string"}}
        ]
    },
    {
        "name": "google_drive",
        "description": "Google Drive integration - search, read, and manage files in Google Drive",
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-server-gdrive"],
        "env": {"GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": ""},
        "available_tools": [
            {"name": "search_files", "description": "Search for files in Google Drive", "parameters": {"query": "string"}},
            {"name": "read_file", "description": "Read contents of a file from Drive", "parameters": {"file_id": "string"}},
            {"name": "list_files", "description": "List files in a folder", "parameters": {"folder_id": "string"}}
        ]
    }
]

_running_processes = {}


async def seed_builtin_mcp_servers():
    db = await get_db()
    try:
        for server in BUILTIN_MCP_SERVERS:
            cursor = await db.execute("SELECT id FROM mcp_servers WHERE name = ? AND type = 'builtin'", (server["name"],))
            existing = await cursor.fetchone()
            if not existing:
                now = datetime.utcnow().isoformat()
                await db.execute(
                    """INSERT INTO mcp_servers (id, name, type, command, args, status, description, available_tools, created_at, updated_at)
                       VALUES (?, ?, 'builtin', ?, ?, 'stopped', ?, ?, ?, ?)""",
                    (str(uuid.uuid4()), server["name"], server["command"],
                     json.dumps(server["args"]), server["description"],
                     json.dumps(server["available_tools"]), now, now)
                )
        await db.commit()
    finally:
        await db.close()


async def start_mcp_server(server_id: str) -> dict:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM mcp_servers WHERE id = ?", (server_id,))
        row = await cursor.fetchone()
        if not row:
            return {"error": "Server not found"}

        server = dict(row)

        if server_id in _running_processes:
            return {"status": "already_running", "pid": _running_processes[server_id].pid}

        command = server["command"]
        args = json.loads(server.get("args", "[]"))
        env = {**os.environ, **json.loads(server.get("env", "{}"))}

        backend_dir = os.path.dirname(os.path.dirname(__file__))
        full_args = [command] + args

        try:
            process = subprocess.Popen(
                full_args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=backend_dir,
                env=env
            )
            _running_processes[server_id] = process

            await db.execute(
                "UPDATE mcp_servers SET status='running', pid=?, updated_at=? WHERE id=?",
                (process.pid, datetime.utcnow().isoformat(), server_id)
            )
            await db.commit()

            return {"status": "running", "pid": process.pid}
        except Exception as e:
            return {"error": f"Failed to start server: {str(e)}"}
    finally:
        await db.close()


async def stop_mcp_server(server_id: str) -> dict:
    if server_id in _running_processes:
        process = _running_processes[server_id]
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            del _running_processes[server_id]
        except Exception:
            pass

    db = await get_db()
    try:
        await db.execute(
            "UPDATE mcp_servers SET status='stopped', pid=NULL, updated_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), server_id)
        )
        await db.commit()
        return {"status": "stopped"}
    finally:
        await db.close()


async def get_server_status(server_id: str) -> str:
    if server_id in _running_processes:
        process = _running_processes[server_id]
        if process.poll() is None:
            return "running"
        else:
            del _running_processes[server_id]
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE mcp_servers SET status='stopped', pid=NULL, updated_at=? WHERE id=?",
                    (datetime.utcnow().isoformat(), server_id)
                )
                await db.commit()
            finally:
                await db.close()
            return "stopped"
    return "stopped"


async def execute_mcp_tool(server_id: str, tool_name: str, parameters: dict) -> dict:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM mcp_servers WHERE id = ?", (server_id,))
        row = await cursor.fetchone()
        if not row:
            return {"error": "Server not found"}

        server = dict(row)
        server_name = server["name"]

        # For built-in servers, execute directly without spawning a process
        if server["type"] == "builtin":
            return await _execute_builtin_mcp_tool(server_name, tool_name, parameters)

        return {"error": "Custom MCP server tool execution requires running server"}
    finally:
        await db.close()


async def _execute_builtin_mcp_tool(server_name: str, tool_name: str, parameters: dict) -> dict:
    try:
        if server_name == "filesystem":
            return await _fs_tool(tool_name, parameters)
        elif server_name == "database":
            return await _db_tool(tool_name, parameters)
        elif server_name == "web_scraper":
            return await _scraper_tool(tool_name, parameters)
        return {"error": f"Unknown server: {server_name}"}
    except Exception as e:
        return {"error": str(e)}


async def _fs_tool(tool_name: str, params: dict) -> dict:
    import aiofiles
    path = params.get("path", ".")
    if tool_name == "read_file":
        with open(path, "r") as f:
            content = f.read()
        return {"content": content[:50000], "path": path, "size": len(content)}
    elif tool_name == "write_file":
        content = params.get("content", "")
        with open(path, "w") as f:
            f.write(content)
        return {"written": True, "path": path, "size": len(content)}
    elif tool_name == "list_directory":
        entries = []
        for entry in os.scandir(path):
            entries.append({
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file",
                "size": entry.stat().st_size if entry.is_file() else None
            })
        return {"entries": entries, "path": path, "count": len(entries)}
    elif tool_name == "search_files":
        pattern = params.get("pattern", "*")
        import glob
        matches = glob.glob(os.path.join(path, "**", pattern), recursive=True)
        return {"matches": matches[:100], "count": len(matches)}
    return {"error": f"Unknown filesystem tool: {tool_name}"}


async def _db_tool(tool_name: str, params: dict) -> dict:
    import aiosqlite
    db_path = params.get("db_path", "test.db")
    if tool_name == "execute_query":
        query = params.get("query", "")
        db = await aiosqlite.connect(db_path)
        db.row_factory = aiosqlite.Row
        try:
            cursor = await db.execute(query)
            if query.strip().upper().startswith("SELECT"):
                rows = await cursor.fetchall()
                return {"rows": [dict(r) for r in rows], "count": len(rows)}
            else:
                await db.commit()
                return {"affected_rows": cursor.rowcount}
        finally:
            await db.close()
    elif tool_name == "list_tables":
        db = await aiosqlite.connect(db_path)
        db.row_factory = aiosqlite.Row
        try:
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            rows = await cursor.fetchall()
            return {"tables": [dict(r)["name"] for r in rows]}
        finally:
            await db.close()
    elif tool_name == "describe_table":
        table = params.get("table_name", "")
        db = await aiosqlite.connect(db_path)
        db.row_factory = aiosqlite.Row
        try:
            cursor = await db.execute(f"PRAGMA table_info({table})")
            rows = await cursor.fetchall()
            return {"columns": [dict(r) for r in rows]}
        finally:
            await db.close()
    return {"error": f"Unknown database tool: {tool_name}"}


async def _scraper_tool(tool_name: str, params: dict) -> dict:
    import httpx
    from bs4 import BeautifulSoup
    url = params.get("url", "")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    if tool_name == "fetch_page":
        return {"html": resp.text[:50000], "status": resp.status_code, "url": str(resp.url)}
    elif tool_name == "extract_text":
        selector = params.get("selector")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        if selector:
            elements = soup.select(selector)
            text = "\n".join(el.get_text(strip=True) for el in elements)
        else:
            text = soup.get_text(separator="\n", strip=True)
        return {"text": text[:20000], "url": url}
    elif tool_name == "extract_links":
        links = []
        for a in soup.find_all("a", href=True):
            links.append({"text": a.get_text(strip=True), "href": a["href"]})
        return {"links": links[:200], "count": len(links)}
    return {"error": f"Unknown scraper tool: {tool_name}"}
