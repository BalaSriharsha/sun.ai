import aiosqlite
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "agentic_platform.db")

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db

async def init_db():
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                owner_email TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS environments (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                env_id TEXT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY (env_id) REFERENCES environments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS secrets (
                id TEXT PRIMARY KEY,
                scope_type TEXT NOT NULL DEFAULT 'workspace',
                scope_id TEXT NOT NULL,
                name TEXT NOT NULL,
                value_encrypted TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'secret',
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS organization_members (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
                status TEXT NOT NULL DEFAULT 'pending', -- pending, active
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                UNIQUE(org_id, user_email)
            );

            CREATE TABLE IF NOT EXISTS resource_permissions (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                resource_type TEXT NOT NULL, -- agent, tool, workflow, secret, mcp_server
                resource_id TEXT NOT NULL,
                permission_level TEXT NOT NULL, -- read, write, execute
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                UNIQUE(user_email, resource_type, resource_id)
            );

            -- ===== Existing tables (with workspace_id) =====
            CREATE TABLE IF NOT EXISTS providers (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                api_key_encrypted TEXT,
                base_url TEXT,
                api_version TEXT,
                status TEXT DEFAULT 'active',
                config TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                name TEXT NOT NULL,
                context_window INTEGER DEFAULT 4096,
                input_price_per_1k REAL DEFAULT 0.0,
                output_price_per_1k REAL DEFAULT 0.0,
                supports_tools INTEGER DEFAULT 0,
                supports_vision INTEGER DEFAULT 0,
                supports_streaming INTEGER DEFAULT 1,
                metadata TEXT DEFAULT '{}',
                discovered_at TEXT NOT NULL,
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tools (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'builtin',
                category TEXT DEFAULT 'general',
                parameters_schema TEXT DEFAULT '{}',
                code TEXT,
                is_enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'builtin',
                command TEXT,
                args TEXT DEFAULT '[]',
                env TEXT DEFAULT '{}',
                status TEXT DEFAULT 'stopped',
                port INTEGER,
                description TEXT,
                available_tools TEXT DEFAULT '[]',
                config TEXT DEFAULT '{}',
                pid INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS runbooks (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                content TEXT NOT NULL,
                model_id TEXT,
                provider_id TEXT,
                tools TEXT DEFAULT '[]',
                mcp_servers TEXT DEFAULT '[]',
                system_prompt TEXT,
                status TEXT DEFAULT 'draft',
                last_run_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                nodes TEXT DEFAULT '[]',
                edges TEXT DEFAULT '[]',
                status TEXT DEFAULT 'draft',
                last_run_at TEXT,
                last_run_status TEXT,
                execution_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
                provider_id TEXT,
                model_id TEXT,
                tools TEXT DEFAULT '[]',
                mcp_servers TEXT DEFAULT '[]',
                temperature REAL DEFAULT 0.7,
                max_tokens INTEGER DEFAULT 4096,
                max_iterations INTEGER DEFAULT 10,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (provider_id) REFERENCES providers(id),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                started_at TEXT NOT NULL,
                completed_at TEXT,
                node_results TEXT DEFAULT '{}',
                error TEXT,
                FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT,
                title TEXT NOT NULL,
                model_id TEXT,
                provider_id TEXT,
                system_prompt TEXT,
                tools TEXT DEFAULT '[]',
                mcp_servers TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_calls TEXT,
                tool_call_id TEXT,
                tokens_used TEXT DEFAULT '{}',
                cost REAL DEFAULT 0.0,
                latency_ms INTEGER DEFAULT 0,
                model_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS observability_logs (
                id TEXT PRIMARY KEY,
                org_id TEXT,
                workspace_id TEXT,
                type TEXT NOT NULL DEFAULT 'llm_call',
                source TEXT DEFAULT 'chat',
                provider_id TEXT,
                provider_name TEXT,
                model_id TEXT,
                model_name TEXT,
                input_text TEXT,
                output_text TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cached_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                cost REAL DEFAULT 0.0,
                latency_ms INTEGER DEFAULT 0,
                ttfb_ms INTEGER DEFAULT 0,
                status TEXT DEFAULT 'success',
                error TEXT,
                metadata TEXT DEFAULT '{}',
                conversation_id TEXT,
                workflow_id TEXT,
                workflow_execution_id TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
        """)
        await db.commit()

        # Migration: add columns, seed defaults, create indexes
        await _run_migrations(db)

        # Seed demo agents & workflow (re-opens db internally)
        await _seed_demo_agents_workflow()
    finally:
        await db.close()


async def _run_migrations(db):
    migrations = [
        ("organizations", "owner_email", "TEXT"),
        ("providers", "workspace_id", "TEXT"),
        ("providers", "org_id", "TEXT"),  # Providers are org-scoped
        ("tools", "workspace_id", "TEXT"),
        ("mcp_servers", "workspace_id", "TEXT"),
        ("runbooks", "workspace_id", "TEXT"),
        ("workflows", "workspace_id", "TEXT"),
        ("agents", "workspace_id", "TEXT"),
        ("conversations", "workspace_id", "TEXT"),
        ("observability_logs", "workspace_id", "TEXT"),
        ("observability_logs", "org_id", "TEXT"),
        # Environment layer
        ("workspaces", "env_id", "TEXT"),
        # Secrets scope migration
        ("secrets", "scope_type", "TEXT"),
        ("secrets", "scope_id", "TEXT"),
        # Provider api_version column
        ("providers", "api_version", "TEXT"),
    ]

    for table, column, col_type in migrations:
        try:
            await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except Exception:
            pass  # Column already exists

    await db.commit()

    # Seed default org + environment + workspace and backfill existing rows
    now = datetime.utcnow().isoformat()
    DEFAULT_ORG_ID = "default-org"
    DEFAULT_ENV_ID = "default-env"
    DEFAULT_WS_ID = "default-workspace"

    cursor = await db.execute("SELECT id FROM organizations WHERE id = ?", (DEFAULT_ORG_ID,))
    if not await cursor.fetchone():
        await db.execute(
            "INSERT INTO organizations (id, name, description, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (DEFAULT_ORG_ID, "Default Organization", "Auto-created default organization", "balasriharsha.ch@gmail.com", now, now)
        )
    
    # Backfill ANY existing organizations that are missing an owner_email
    await db.execute(
        "UPDATE organizations SET owner_email = ? WHERE owner_email IS NULL",
        ("balasriharsha.ch@gmail.com",)
    )
    
    # RBAC Backfill: Ensure all org owners exist as active owners in organization_members
    cursor = await db.execute("SELECT id, owner_email FROM organizations WHERE owner_email IS NOT NULL")
    orgs = await cursor.fetchall()
    for org in orgs:
        org_id = org['id']
        owner_email = org['owner_email']
        
        # Check if owner is already mapped
        member_cursor = await db.execute("SELECT id FROM organization_members WHERE org_id = ? AND user_email = ?", (org_id, owner_email))
        if not await member_cursor.fetchone():
            import uuid
            member_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO organization_members (id, org_id, user_email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (member_id, org_id, owner_email, 'owner', 'active', now, now)
            )

    # Ensure default environment exists
    cursor = await db.execute("SELECT id FROM environments WHERE id = ?", (DEFAULT_ENV_ID,))
    if not await cursor.fetchone():
        await db.execute(
            "INSERT INTO environments (id, org_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (DEFAULT_ENV_ID, DEFAULT_ORG_ID, "Default Environment", "Auto-created default environment", now, now)
        )

    # Ensure default workspace exists
    cursor = await db.execute("SELECT id FROM workspaces WHERE id = ?", (DEFAULT_WS_ID,))
    if not await cursor.fetchone():
        await db.execute(
            "INSERT INTO workspaces (id, org_id, env_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (DEFAULT_WS_ID, DEFAULT_ORG_ID, DEFAULT_ENV_ID, "Default Workspace", "Auto-created default workspace", now, now)
        )

    # Backfill env_id on workspaces that don't have one
    await db.execute("UPDATE workspaces SET env_id = ? WHERE env_id IS NULL", (DEFAULT_ENV_ID,))

    # Backfill any rows missing workspace_id
    for table in ["tools", "mcp_servers", "runbooks", "workflows", "agents", "conversations"]:
        await db.execute(f"UPDATE {table} SET workspace_id = ? WHERE workspace_id IS NULL", (DEFAULT_WS_ID,))

    # For providers, set org_id based on workspace's org_id, or default org
    # First, update providers that have a workspace_id to use that workspace's org_id
    await db.execute("""
        UPDATE providers SET org_id = (
            SELECT org_id FROM workspaces WHERE workspaces.id = providers.workspace_id
        ) WHERE org_id IS NULL AND workspace_id IS NOT NULL
    """)
    # Then set default org for any remaining providers without org_id
    await db.execute(f"UPDATE providers SET org_id = ? WHERE org_id IS NULL", (DEFAULT_ORG_ID,))

    await db.execute(
        "UPDATE observability_logs SET workspace_id = ?, org_id = ? WHERE workspace_id IS NULL",
        (DEFAULT_WS_ID, DEFAULT_ORG_ID)
    )

    # Migrate old secrets: workspace_id -> scope_type/scope_id (only for DBs that had the old schema)
    try:
        await db.execute(
            "UPDATE secrets SET scope_type = 'workspace', scope_id = workspace_id WHERE scope_type IS NULL AND workspace_id IS NOT NULL"
        )
    except Exception:
        pass  # Fresh DB doesn't have workspace_id column on secrets

    await db.commit()

    # Create indexes on migration-added columns (safe now that columns exist)
    migration_indexes = [
        "CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider_id)",
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)",
        "CREATE INDEX IF NOT EXISTS idx_observability_created ON observability_logs(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_observability_type ON observability_logs(type)",
        "CREATE INDEX IF NOT EXISTS idx_observability_provider ON observability_logs(provider_id)",
        "CREATE INDEX IF NOT EXISTS idx_observability_model ON observability_logs(model_id)",
        "CREATE INDEX IF NOT EXISTS idx_observability_org ON observability_logs(org_id)",
        "CREATE INDEX IF NOT EXISTS idx_observability_workspace ON observability_logs(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id)",
        "CREATE INDEX IF NOT EXISTS idx_workspaces_env ON workspaces(env_id)",
        "CREATE INDEX IF NOT EXISTS idx_environments_org ON environments(org_id)",
        "CREATE INDEX IF NOT EXISTS idx_secrets_scope ON secrets(scope_type, scope_id)",
        "CREATE INDEX IF NOT EXISTS idx_providers_workspace ON providers(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_providers_org ON providers(org_id)",
        "CREATE INDEX IF NOT EXISTS idx_tools_workspace ON tools(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id)",
    ]
    for idx_sql in migration_indexes:
        try:
            await db.execute(idx_sql)
        except Exception:
            pass

    await db.commit()


async def _seed_demo_agents_workflow():
    """Seed demo data - currently disabled."""
    # Demo provider, agents, and workflows have been removed.
    # Users should create their own providers and agents via the UI.
    pass
