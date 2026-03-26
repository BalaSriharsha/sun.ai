from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from services.provider_service import discover_models, validate_api_key
import uuid
import json

router = APIRouter()

class ProviderCreate(BaseModel):
    name: str
    type: str  # openai, anthropic, google, groq, mistral, ollama, openrouter
    org_id: str  # Required: providers are organization-scoped
    api_key: Optional[str] = None
    aws_secret_key: Optional[str] = None  # Bedrock: provided separately, combined with api_key
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    config: Optional[dict] = {}

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    aws_secret_key: Optional[str] = None  # Bedrock: provided separately, combined with api_key
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    status: Optional[str] = None
    config: Optional[dict] = None


@router.get("")
async def list_providers(org_id: str):
    """List all providers for an organization."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM providers WHERE org_id = ? ORDER BY created_at DESC",
            (org_id,)
        )
        rows = await cursor.fetchall()
        providers = []
        for row in rows:
            p = dict(row)
            p["config"] = json.loads(p.get("config", "{}"))
            # Mask API key
            if p.get("api_key_encrypted"):
                p["api_key_masked"] = p["api_key_encrypted"][:8] + "..." + p["api_key_encrypted"][-4:] if len(p["api_key_encrypted"]) > 12 else "****"
            else:
                p["api_key_masked"] = None
            del p["api_key_encrypted"]
            # Get model count
            mc = await db.execute("SELECT COUNT(*) as cnt FROM models WHERE provider_id = ?", (p["id"],))
            mc_row = await mc.fetchone()
            p["model_count"] = mc_row["cnt"] if mc_row else 0
            providers.append(p)
        return {"providers": providers}
    finally:
        await db.close()


@router.post("")
async def create_provider(provider: ProviderCreate):
    valid_types = ["openai", "anthropic", "google", "groq", "mistral", "ollama", "openrouter", "azure", "bedrock", "sarvam"]
    if provider.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid provider type. Must be one of: {valid_types}")

    # For Bedrock, combine access key + secret key into the stored format
    if provider.type == "bedrock" and provider.aws_secret_key:
        if not provider.api_key:
            raise HTTPException(status_code=400, detail="AWS Access Key ID is required")
        provider = provider.model_copy(update={"api_key": f"{provider.api_key}:{provider.aws_secret_key}"})

    # Validate API key
    if provider.type != "ollama" and not provider.api_key:
        raise HTTPException(status_code=400, detail="API key is required for this provider type")

    is_valid = await validate_api_key(provider.type, provider.api_key or "", provider.base_url, provider.api_version)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid API key or provider is unreachable")

    provider_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    db = await get_db()
    try:
        # Verify org exists
        cursor = await db.execute("SELECT id FROM organizations WHERE id = ?", (provider.org_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Organization not found")

        await db.execute(
            """INSERT INTO providers (id, org_id, name, type, api_key_encrypted, base_url, api_version, status, config, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
            (provider_id, provider.org_id,
             provider.name, provider.type, provider.api_key, provider.base_url, provider.api_version,
             json.dumps(provider.config or {}), now, now)
        )
        await db.commit()

        # Discover models
        models = await discover_models(provider_id, provider.type, provider.api_key or "", provider.base_url, provider.api_version)

        return {
            "id": provider_id,
            "name": provider.name,
            "type": provider.type,
            "status": "active",
            "model_count": len(models),
            "models": models,
            "created_at": now,
        }
    finally:
        await db.close()


@router.get("/{provider_id}")
async def get_provider(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")
        p = dict(row)
        p["config"] = json.loads(p.get("config", "{}"))
        if p.get("api_key_encrypted"):
            p["api_key_masked"] = p["api_key_encrypted"][:8] + "..." + p["api_key_encrypted"][-4:] if len(p["api_key_encrypted"]) > 12 else "****"
        del p["api_key_encrypted"]
        return p
    finally:
        await db.close()


@router.put("/{provider_id}")
async def update_provider(provider_id: str, update: ProviderUpdate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Provider not found")

        existing = dict(row)
        now = datetime.utcnow().isoformat()
        name = update.name or existing["name"]

        # For Bedrock updates, rebuild the combined key if either part is provided
        if existing["type"] == "bedrock" and (update.api_key or update.aws_secret_key):
            existing_access, _, existing_secret = (existing["api_key_encrypted"] or "::").partition(":")
            new_access = update.api_key or existing_access
            new_secret = update.aws_secret_key or existing_secret
            api_key = f"{new_access}:{new_secret}"
        else:
            api_key = update.api_key or existing["api_key_encrypted"]
        base_url = update.base_url if update.base_url is not None else existing["base_url"]
        api_version = update.api_version if update.api_version is not None else existing.get("api_version")
        status = update.status or existing["status"]
        config = json.dumps(update.config) if update.config is not None else existing["config"]

        await db.execute(
            """UPDATE providers SET name=?, api_key_encrypted=?, base_url=?, api_version=?, status=?, config=?, updated_at=?
               WHERE id=?""",
            (name, api_key, base_url, api_version, status, config, now, provider_id)
        )
        await db.commit()

        # Re-discover models if API key changed
        if update.api_key:
            await discover_models(provider_id, existing["type"], api_key, base_url, api_version)

        return {"id": provider_id, "name": name, "status": status, "updated_at": now}
    finally:
        await db.close()


@router.delete("/{provider_id}")
async def delete_provider(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Provider not found")
        await db.execute("DELETE FROM providers WHERE id = ?", (provider_id,))
        await db.commit()
        return {"deleted": True}
    finally:
        await db.close()


@router.get("/{provider_id}/models")
async def get_provider_models(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        provider = await cursor.fetchone()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")

        mc = await db.execute("SELECT * FROM models WHERE provider_id = ? ORDER BY name", (provider_id,))
        rows = await mc.fetchall()
        models = [dict(r) for r in rows]
        for m in models:
            m["metadata"] = json.loads(m.get("metadata", "{}"))
        return {"models": models, "count": len(models)}
    finally:
        await db.close()


@router.post("/{provider_id}/refresh-models")
async def refresh_models(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        provider = await cursor.fetchone()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        p = dict(provider)
        models = await discover_models(provider_id, p["type"], p["api_key_encrypted"] or "", p["base_url"], p.get("api_version"))
        return {"models": models, "count": len(models)}
    finally:
        await db.close()


@router.get("/{provider_id}/validate")
async def validate_provider(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM providers WHERE id = ?", (provider_id,))
        provider = await cursor.fetchone()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        p = dict(provider)
        is_valid = await validate_api_key(p["type"], p["api_key_encrypted"] or "", p["base_url"], p.get("api_version"))
        if is_valid:
            await db.execute("UPDATE providers SET status='active', updated_at=? WHERE id=?",
                           (datetime.utcnow().isoformat(), provider_id))
        else:
            await db.execute("UPDATE providers SET status='error', updated_at=? WHERE id=?",
                           (datetime.utcnow().isoformat(), provider_id))
        await db.commit()
        return {"valid": is_valid, "status": "active" if is_valid else "error"}
    finally:
        await db.close()
