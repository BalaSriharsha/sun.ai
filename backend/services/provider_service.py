import httpx
import json
from datetime import datetime
from database import get_db
import uuid


MODEL_PRICING = {
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "o1": {"input": 0.015, "output": 0.06},
    "o1-mini": {"input": 0.003, "output": 0.012},
    "o3-mini": {"input": 0.0011, "output": 0.0044},
    "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
    "claude-3-5-haiku-20241022": {"input": 0.001, "output": 0.005},
    "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
    "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
    "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
    "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004},
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
    "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},
    "gemini-2.0-flash-lite": {"input": 0.0, "output": 0.0},
    "llama-3.3-70b-versatile": {"input": 0.00059, "output": 0.00079},
    "llama-3.1-8b-instant": {"input": 0.00005, "output": 0.00008},
    "mixtral-8x7b-32768": {"input": 0.00024, "output": 0.00024},
    "gemma2-9b-it": {"input": 0.0002, "output": 0.0002},
    "mistral-large-latest": {"input": 0.002, "output": 0.006},
    "mistral-small-latest": {"input": 0.0002, "output": 0.0006},
    "codestral-latest": {"input": 0.0003, "output": 0.0009},
    "open-mistral-nemo": {"input": 0.00015, "output": 0.00015},
    # AWS Bedrock models
    "anthropic.claude-3-5-sonnet-20241022-v2:0": {"input": 0.003, "output": 0.015},
    "anthropic.claude-3-5-haiku-20241022-v1:0": {"input": 0.001, "output": 0.005},
    "anthropic.claude-3-opus-20240229-v1:0": {"input": 0.015, "output": 0.075},
    "amazon.titan-text-premier-v1:0": {"input": 0.0005, "output": 0.0015},
    "amazon.titan-text-express-v1": {"input": 0.0002, "output": 0.0006},
    "meta.llama3-1-70b-instruct-v1:0": {"input": 0.00099, "output": 0.00099},
    "meta.llama3-1-8b-instruct-v1:0": {"input": 0.00022, "output": 0.00022},
    "mistral.mistral-large-2407-v1:0": {"input": 0.002, "output": 0.006},
    # Sarvam AI models
    "sarvam-m": {"input": 0.0003, "output": 0.0009},
    "sarvam-translate": {"input": 0.0001, "output": 0.0003},
}

MODEL_CONTEXT_WINDOWS = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "o1": 200000,
    "o1-mini": 128000,
    "o3-mini": 200000,
    "claude-3-5-sonnet-20241022": 200000,
    "claude-3-5-haiku-20241022": 200000,
    "claude-3-opus-20240229": 200000,
    "claude-3-sonnet-20240229": 200000,
    "claude-3-haiku-20240307": 200000,
    "gemini-2.0-flash": 1048576,
    "gemini-1.5-pro": 2097152,
    "gemini-1.5-flash": 1048576,
    "gemini-2.0-flash-lite": 1048576,
    "llama-3.3-70b-versatile": 128000,
    "llama-3.1-8b-instant": 131072,
    "mixtral-8x7b-32768": 32768,
    "gemma2-9b-it": 8192,
    "mistral-large-latest": 128000,
    "mistral-small-latest": 32000,
    "codestral-latest": 32000,
    "open-mistral-nemo": 128000,
}

VISION_MODELS = {
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
    "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307",
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    "anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-opus-20240229-v1:0",
}

TOOL_MODELS = {
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
    "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229",
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    "mistral-large-latest", "mistral-small-latest",
    "llama-3.3-70b-versatile",
    "anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0",
    "meta.llama3-1-70b-instruct-v1:0",
    "mistral.mistral-large-2407-v1:0",
    "sarvam-m",
}


async def discover_models(provider_id: str, provider_type: str, api_key: str, base_url: str = None):
    models = []
    try:
        if provider_type == "openai":
            url = (base_url or "https://api.openai.com") + "/v1/models"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("data", []):
                    mid = m["id"]
                    if any(mid.startswith(p) for p in ["gpt-", "o1", "o3", "chatgpt"]):
                        models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "anthropic":
            known_models = [
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
            ]
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01"
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for m in data.get("data", []):
                        mid = m.get("id", "")
                        models.append(_build_model(provider_id, mid, m.get("display_name", mid)))
                else:
                    for mid in known_models:
                        models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "google":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("models", []):
                    mid = m.get("name", "").replace("models/", "")
                    if "gemini" in mid:
                        display = m.get("displayName", mid)
                        models.append(_build_model(provider_id, mid, display))

        elif provider_type == "groq":
            url = "https://api.groq.com/openai/v1/models"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("data", []):
                    mid = m["id"]
                    models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "mistral":
            url = "https://api.mistral.ai/v1/models"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("data", []):
                    mid = m["id"]
                    models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "ollama":
            url = (base_url or "http://localhost:11434") + "/api/tags"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("models", []):
                    mid = m.get("name", "")
                    models.append(_build_model(provider_id, mid, mid, context_window=4096))

        elif provider_type == "openrouter":
            url = "https://openrouter.ai/api/v1/models"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                resp.raise_for_status()
                data = resp.json()
                for m in data.get("data", []):
                    mid = m["id"]
                    pricing = m.get("pricing", {})
                    models.append(_build_model(
                        provider_id, mid, m.get("name", mid),
                        context_window=m.get("context_length", 4096),
                        input_price=float(pricing.get("prompt", 0)) * 1000,
                        output_price=float(pricing.get("completion", 0)) * 1000,
                    ))

        elif provider_type == "azure":
            # Azure OpenAI — list deployments
            azure_url = (base_url or "").rstrip("/")
            url = f"{azure_url}/openai/deployments?api-version=2024-02-01"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"api-key": api_key})
                if resp.status_code == 200:
                    data = resp.json()
                    for d in data.get("data", []):
                        mid = d.get("id", d.get("model", ""))
                        model_name = d.get("model", mid)
                        models.append(_build_model(provider_id, mid, model_name))
                else:
                    # Fallback: user can manually test deployments
                    for mid in ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-35-turbo"]:
                        models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "bedrock":
            # AWS Bedrock — known models (no public listing API without boto3)
            bedrock_models = [
                ("anthropic.claude-3-5-sonnet-20241022-v2:0", "Claude 3.5 Sonnet v2", 200000),
                ("anthropic.claude-3-5-haiku-20241022-v1:0", "Claude 3.5 Haiku", 200000),
                ("anthropic.claude-3-opus-20240229-v1:0", "Claude 3 Opus", 200000),
                ("amazon.titan-text-premier-v1:0", "Titan Text Premier", 32000),
                ("amazon.titan-text-express-v1", "Titan Text Express", 8192),
                ("meta.llama3-1-70b-instruct-v1:0", "Llama 3.1 70B", 128000),
                ("meta.llama3-1-8b-instruct-v1:0", "Llama 3.1 8B", 128000),
                ("mistral.mistral-large-2407-v1:0", "Mistral Large", 128000),
            ]
            for mid, name, ctx in bedrock_models:
                models.append(_build_model(provider_id, mid, name, context_window=ctx))

        elif provider_type == "sarvam":
            # Sarvam AI — known models
            sarvam_models = [
                ("sarvam-m", "Sarvam M (Chat & Reasoning)", 32000),
                ("sarvam-translate", "Sarvam Translate", 8192),
            ]
            for mid, name, ctx in sarvam_models:
                models.append(_build_model(provider_id, mid, name, context_window=ctx))

    except Exception as e:
        print(f"Error discovering models for provider {provider_id}: {e}")

    # Save to database
    db = await get_db()
    try:
        await db.execute("DELETE FROM models WHERE provider_id = ?", (provider_id,))
        for model in models:
            await db.execute(
                """INSERT INTO models (id, provider_id, model_id, name, context_window,
                   input_price_per_1k, output_price_per_1k, supports_tools, supports_vision,
                   supports_streaming, metadata, discovered_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (model["id"], model["provider_id"], model["model_id"], model["name"],
                 model["context_window"], model["input_price_per_1k"], model["output_price_per_1k"],
                 model["supports_tools"], model["supports_vision"], model["supports_streaming"],
                 json.dumps(model.get("metadata", {})), datetime.utcnow().isoformat())
            )
        await db.commit()
    finally:
        await db.close()

    return models


def _build_model(provider_id, model_id, name, context_window=None, input_price=None, output_price=None):
    pricing = MODEL_PRICING.get(model_id, {})
    return {
        "id": str(uuid.uuid4()),
        "provider_id": provider_id,
        "model_id": model_id,
        "name": name,
        "context_window": context_window or MODEL_CONTEXT_WINDOWS.get(model_id, 4096),
        "input_price_per_1k": input_price if input_price is not None else pricing.get("input", 0.0),
        "output_price_per_1k": output_price if output_price is not None else pricing.get("output", 0.0),
        "supports_tools": 1 if model_id in TOOL_MODELS else 0,
        "supports_vision": 1 if model_id in VISION_MODELS else 0,
        "supports_streaming": 1,
        "metadata": {},
    }


async def validate_api_key(provider_type: str, api_key: str, base_url: str = None) -> bool:
    try:
        if provider_type == "openai":
            url = (base_url or "https://api.openai.com") + "/v1/models"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
                return resp.status_code == 200
        elif provider_type == "anthropic":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-3-haiku-20240307", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}
                )
                return resp.status_code in (200, 400, 429)
        elif provider_type == "google":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                return resp.status_code == 200
        elif provider_type == "groq":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {api_key}"})
                return resp.status_code == 200
        elif provider_type == "mistral":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("https://api.mistral.ai/v1/models", headers={"Authorization": f"Bearer {api_key}"})
                return resp.status_code == 200
        elif provider_type == "ollama":
            url = (base_url or "http://localhost:11434") + "/api/tags"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                return resp.status_code == 200
        elif provider_type == "openrouter":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {api_key}"})
                return resp.status_code == 200
        elif provider_type == "azure":
            azure_url = (base_url or "").rstrip("/")
            url = f"{azure_url}/openai/deployments?api-version=2024-02-01"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"api-key": api_key})
                return resp.status_code == 200
        elif provider_type == "bedrock":
            # Bedrock uses AWS credentials — litellm handles auth, so we accept the key format
            return bool(api_key and ":" in api_key)  # expects access_key:secret_key format
        elif provider_type == "sarvam":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.sarvam.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "sarvam-m", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}
                )
                return resp.status_code in (200, 400, 429)
    except Exception:
        return False
    return False


def get_litellm_model_name(provider_type: str, model_id: str) -> str:
    prefix_map = {
        "openai": "",
        "anthropic": "anthropic/",
        "google": "gemini/",
        "groq": "groq/",
        "mistral": "mistral/",
        "ollama": "ollama/",
        "openrouter": "openrouter/",
        "azure": "azure/",
        "bedrock": "bedrock/",
        "sarvam": "sarvam/",
    }
    prefix = prefix_map.get(provider_type, "")
    return f"{prefix}{model_id}"
