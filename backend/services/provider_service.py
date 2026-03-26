import httpx
import json
from datetime import datetime
from database import get_db
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Thread pool for running boto3 synchronous calls
_executor = ThreadPoolExecutor(max_workers=4)


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
    # AWS Bedrock models - Anthropic Claude
    "anthropic.claude-3-5-sonnet-20241022-v2:0": {"input": 0.003, "output": 0.015},
    "anthropic.claude-3-5-haiku-20241022-v1:0": {"input": 0.001, "output": 0.005},
    "anthropic.claude-3-opus-20240229-v1:0": {"input": 0.015, "output": 0.075},
    "anthropic.claude-3-sonnet-20240229-v1:0": {"input": 0.003, "output": 0.015},
    "anthropic.claude-3-haiku-20240307-v1:0": {"input": 0.00025, "output": 0.00125},
    "anthropic.claude-v2:1": {"input": 0.008, "output": 0.024},
    "anthropic.claude-v2": {"input": 0.008, "output": 0.024},
    "anthropic.claude-instant-v1": {"input": 0.0008, "output": 0.0024},
    # AWS Bedrock models - Amazon Titan
    "amazon.titan-text-premier-v1:0": {"input": 0.0005, "output": 0.0015},
    "amazon.titan-text-express-v1": {"input": 0.0002, "output": 0.0006},
    "amazon.titan-text-lite-v1": {"input": 0.00015, "output": 0.0002},
    "amazon.titan-embed-text-v1": {"input": 0.0001, "output": 0.0},
    "amazon.titan-embed-text-v2:0": {"input": 0.00002, "output": 0.0},
    # AWS Bedrock models - Meta Llama
    "meta.llama3-2-90b-instruct-v1:0": {"input": 0.002, "output": 0.002},
    "meta.llama3-2-11b-instruct-v1:0": {"input": 0.00035, "output": 0.00035},
    "meta.llama3-2-3b-instruct-v1:0": {"input": 0.00015, "output": 0.00015},
    "meta.llama3-2-1b-instruct-v1:0": {"input": 0.0001, "output": 0.0001},
    "meta.llama3-1-405b-instruct-v1:0": {"input": 0.00532, "output": 0.016},
    "meta.llama3-1-70b-instruct-v1:0": {"input": 0.00099, "output": 0.00099},
    "meta.llama3-1-8b-instruct-v1:0": {"input": 0.00022, "output": 0.00022},
    "meta.llama3-70b-instruct-v1:0": {"input": 0.00265, "output": 0.0035},
    "meta.llama3-8b-instruct-v1:0": {"input": 0.0003, "output": 0.0006},
    "meta.llama2-70b-chat-v1": {"input": 0.00195, "output": 0.00256},
    "meta.llama2-13b-chat-v1": {"input": 0.00075, "output": 0.001},
    # AWS Bedrock models - Mistral
    "mistral.mistral-large-2407-v1:0": {"input": 0.002, "output": 0.006},
    "mistral.mistral-large-2402-v1:0": {"input": 0.002, "output": 0.006},
    "mistral.mistral-small-2402-v1:0": {"input": 0.0001, "output": 0.0003},
    "mistral.mixtral-8x7b-instruct-v0:1": {"input": 0.00045, "output": 0.0007},
    "mistral.mistral-7b-instruct-v0:2": {"input": 0.00015, "output": 0.0002},
    # AWS Bedrock models - Cohere
    "cohere.command-r-plus-v1:0": {"input": 0.003, "output": 0.015},
    "cohere.command-r-v1:0": {"input": 0.0005, "output": 0.0015},
    "cohere.command-text-v14": {"input": 0.0015, "output": 0.002},
    "cohere.command-light-text-v14": {"input": 0.0003, "output": 0.0006},
    "cohere.embed-english-v3": {"input": 0.0001, "output": 0.0},
    "cohere.embed-multilingual-v3": {"input": 0.0001, "output": 0.0},
    # AWS Bedrock models - AI21
    "ai21.jamba-1-5-large-v1:0": {"input": 0.002, "output": 0.008},
    "ai21.jamba-1-5-mini-v1:0": {"input": 0.0002, "output": 0.0004},
    "ai21.jamba-instruct-v1:0": {"input": 0.0005, "output": 0.0007},
    "ai21.j2-ultra-v1": {"input": 0.0188, "output": 0.0188},
    "ai21.j2-mid-v1": {"input": 0.0125, "output": 0.0125},
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
    # Bedrock Claude vision models
    "anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-opus-20240229-v1:0", "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    # Bedrock Llama 3.2 vision models
    "meta.llama3-2-90b-instruct-v1:0", "meta.llama3-2-11b-instruct-v1:0",
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


async def discover_models(provider_id: str, provider_type: str, api_key: str, base_url: str = None, api_version: str = None):
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
            # Azure OpenAI — discover models via /openai/models endpoint
            azure_url = (base_url or "").rstrip("/")
            # If URL contains /openai/, extract just the base endpoint
            if "/openai/" in azure_url:
                azure_url = azure_url.split("/openai/")[0]
            # Remove query parameters if present
            if "?" in azure_url:
                azure_url = azure_url.split("?")[0]
            # Convert cognitiveservices.azure.com to openai.azure.com
            if "cognitiveservices.azure.com" in azure_url:
                azure_url = azure_url.replace("cognitiveservices.azure.com", "openai.azure.com")
            # Use 2024-10-21 for model listing (stable GA version that supports /openai/models)
            models_api_version = "2024-10-21"
            url = f"{azure_url}/openai/models?api-version={models_api_version}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers={"api-key": api_key})
                if resp.status_code == 200:
                    data = resp.json()
                    for d in data.get("data", []):
                        mid = d.get("id", "")
                        # Only include chat-capable models
                        caps = d.get("capabilities", {})
                        if caps.get("chat_completion") or caps.get("completion") or mid.startswith("gpt"):
                            models.append(_build_model(provider_id, mid, mid))
                else:
                    # Fallback: add common Azure deployment names
                    for mid in ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-35-turbo"]:
                        models.append(_build_model(provider_id, mid, mid))

        elif provider_type == "bedrock":
            # AWS Bedrock — dynamically discover models using boto3
            bedrock_models = await _discover_bedrock_models(api_key, base_url)
            for model_info in bedrock_models:
                models.append(_build_model(
                    provider_id,
                    model_info["model_id"],
                    model_info["name"],
                    context_window=model_info.get("context_window", 4096),
                    input_price=model_info.get("input_price"),
                    output_price=model_info.get("output_price"),
                ))

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


def _list_bedrock_models_sync(access_key: str, secret_key: str, region: str):
    """Synchronous function to list Bedrock models using boto3."""
    import boto3

    client = boto3.client(
        'bedrock',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region
    )

    models = []
    inference_profile_models = set()  # Track models that have inference profiles

    # FIRST: List inference profiles (required for cross-region inference)
    # These should be prioritized as many newer models ONLY work via inference profiles
    try:
        profiles_response = client.list_inference_profiles()
        for profile in profiles_response.get('inferenceProfileSummaries', []):
            profile_id = profile.get('inferenceProfileId', '')
            profile_name = profile.get('inferenceProfileName', profile_id)
            profile_type = profile.get('type', 'SYSTEM_DEFINED')
            status = profile.get('status', 'ACTIVE')

            if status != 'ACTIVE':
                continue

            # Extract the underlying model from the profile ID
            # Profile IDs look like: us.anthropic.claude-3-5-sonnet-20241022-v2:0
            # or eu.meta.llama3-2-90b-instruct-v1:0
            underlying_model = profile_id
            if '.' in profile_id:
                # Remove region prefix (e.g., "us." or "eu.")
                parts = profile_id.split('.', 1)
                if len(parts) == 2 and len(parts[0]) <= 3:  # region prefix is short like "us", "eu"
                    underlying_model = parts[1]

            # Track that this model has an inference profile
            inference_profile_models.add(underlying_model)

            # Determine context window based on the model
            context_window = _get_bedrock_context_window(profile_id)

            # Determine if it's a cross-region profile
            is_cross_region = profile_type == 'SYSTEM_DEFINED' and profile_id.startswith(('us.', 'eu.', 'ap.'))

            # Build display name
            if is_cross_region:
                display_name = f"{profile_name} (Cross-Region)"
            else:
                display_name = profile_name

            models.append({
                'model_id': profile_id,  # Use the full inference profile ID
                'name': display_name,
                'context_window': context_window,
                'supports_streaming': True,
                'is_inference_profile': True,
                'underlying_model': underlying_model,
            })
    except Exception as e:
        print(f"Error listing Bedrock inference profiles: {e}")

    # SECOND: List foundation models (for on-demand access where supported)
    try:
        response = client.list_foundation_models(
            byOutputModality='TEXT'  # Focus on text generation models
        )

        for model in response.get('modelSummaries', []):
            model_id = model.get('modelId', '')
            model_name = model.get('modelName', model_id)
            provider_name = model.get('providerName', '')
            inference_types = model.get('inferenceTypesSupported', [])

            # Skip embedding-only models for chat
            if 'embed' in model_id.lower() and 'text' not in model_name.lower():
                continue

            # Skip models that don't support ON_DEMAND if they have an inference profile
            # (prefer the inference profile for those)
            supports_on_demand = 'ON_DEMAND' in inference_types
            has_profile = model_id in inference_profile_models

            if not supports_on_demand and has_profile:
                # Skip - we already have the inference profile for this model
                continue

            # Determine capabilities
            input_modalities = model.get('inputModalities', [])
            output_modalities = model.get('outputModalities', [])
            supports_streaming = model.get('responseStreamingSupported', False)
            context_window = _get_bedrock_context_window(model_id)

            # Build friendly display name
            display_name = f"{provider_name} {model_name}" if provider_name else model_name

            # If model doesn't support ON_DEMAND and has no profile, mark it clearly
            if not supports_on_demand and not has_profile:
                display_name = f"{display_name} (Provisioned Only)"

            models.append({
                'model_id': model_id,
                'name': display_name,
                'context_window': context_window,
                'supports_streaming': supports_streaming,
                'input_modalities': input_modalities,
                'output_modalities': output_modalities,
                'supports_on_demand': supports_on_demand,
                'is_inference_profile': False,
            })
    except Exception as e:
        print(f"Error listing Bedrock foundation models: {e}")

    return models


def _get_bedrock_context_window(model_id: str) -> int:
    """Determine context window size based on model ID."""
    # Normalize to handle cross-region inference profile IDs
    normalized = _normalize_model_id(model_id)
    model_lower = normalized.lower()

    # Claude models
    if 'claude-3' in model_lower or 'claude-opus-4' in model_lower or 'claude-sonnet-4' in model_lower:
        return 200000
    elif 'claude' in model_lower:
        return 100000

    # Llama models
    if 'llama3-1' in model_lower or 'llama3-2' in model_lower or 'llama-3.1' in model_lower or 'llama-3.2' in model_lower:
        return 128000
    elif 'llama3' in model_lower or 'llama-3' in model_lower:
        return 8192
    elif 'llama' in model_lower:
        return 4096

    # Mistral models
    if 'mistral-large' in model_lower:
        return 128000
    elif 'mistral' in model_lower or 'mixtral' in model_lower:
        return 32000

    # Cohere models
    if 'command-r' in model_lower:
        return 128000
    elif 'command' in model_lower:
        return 4096

    # AI21 models
    if 'jamba' in model_lower:
        return 256000

    # Amazon Titan
    if 'titan-text-premier' in model_lower:
        return 32000
    elif 'titan' in model_lower:
        return 8192

    return 4096  # Default


def _normalize_model_id(model_id: str) -> str:
    """Remove region prefixes from cross-region inference profile IDs."""
    # Cross-region inference profiles have format: us.anthropic.claude-3-5-sonnet...
    # or eu.meta.llama3-2-90b... etc.
    if '.' in model_id:
        parts = model_id.split('.', 1)
        # Check if first part is a region prefix (2-3 chars like 'us', 'eu', 'ap')
        if len(parts) == 2 and len(parts[0]) <= 3 and parts[0].isalpha():
            return parts[1]
    return model_id


async def _discover_bedrock_models(api_key: str, base_url: str) -> list:
    """Dynamically discover AWS Bedrock models using boto3."""

    # Parse credentials: api_key should be "access_key:secret_key"
    if not api_key or ":" not in api_key:
        print("Bedrock: Invalid API key format. Expected 'access_key:secret_key'")
        return _get_fallback_bedrock_models()

    access_key, secret_key = api_key.split(":", 1)

    # Get region from base_url (e.g., "us-east-1")
    region = (base_url or "us-east-1").strip("/").replace("https://", "").replace("http://", "")
    if not region:
        region = "us-east-1"

    try:
        # Run boto3 call in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        models = await loop.run_in_executor(
            _executor,
            _list_bedrock_models_sync,
            access_key,
            secret_key,
            region
        )

        if models:
            print(f"Bedrock: Discovered {len(models)} models dynamically")
            return models
        else:
            print("Bedrock: No models found, using fallback list")
            return _get_fallback_bedrock_models()

    except Exception as e:
        print(f"Bedrock: Error discovering models dynamically: {e}")
        return _get_fallback_bedrock_models()


def _get_fallback_bedrock_models() -> list:
    """Return fallback list of common Bedrock models when dynamic discovery fails.

    Includes both:
    - Cross-region inference profile IDs (us.* prefix) for newer models
    - Direct model IDs for models that support on-demand access
    """
    return [
        # Cross-region inference profiles (required for newer models like Claude Opus 4)
        {"model_id": "us.anthropic.claude-opus-4-0-v1:0", "name": "Claude Opus 4 (Cross-Region)", "context_window": 200000},
        {"model_id": "us.anthropic.claude-sonnet-4-0-v1:0", "name": "Claude Sonnet 4 (Cross-Region)", "context_window": 200000},
        {"model_id": "us.anthropic.claude-3-7-sonnet-20250219-v1:0", "name": "Claude 3.7 Sonnet (Cross-Region)", "context_window": 200000},
        {"model_id": "us.anthropic.claude-3-5-sonnet-20241022-v2:0", "name": "Claude 3.5 Sonnet v2 (Cross-Region)", "context_window": 200000},
        {"model_id": "us.anthropic.claude-3-5-haiku-20241022-v1:0", "name": "Claude 3.5 Haiku (Cross-Region)", "context_window": 200000},
        {"model_id": "us.anthropic.claude-3-opus-20240229-v1:0", "name": "Claude 3 Opus (Cross-Region)", "context_window": 200000},
        {"model_id": "us.meta.llama3-2-90b-instruct-v1:0", "name": "Llama 3.2 90B (Cross-Region)", "context_window": 128000},
        {"model_id": "us.meta.llama3-2-11b-instruct-v1:0", "name": "Llama 3.2 11B (Cross-Region)", "context_window": 128000},
        {"model_id": "us.meta.llama3-1-405b-instruct-v1:0", "name": "Llama 3.1 405B (Cross-Region)", "context_window": 128000},

        # Direct model IDs (for on-demand access)
        {"model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0", "name": "Claude 3.5 Sonnet v2", "context_window": 200000},
        {"model_id": "anthropic.claude-3-5-haiku-20241022-v1:0", "name": "Claude 3.5 Haiku", "context_window": 200000},
        {"model_id": "anthropic.claude-3-sonnet-20240229-v1:0", "name": "Claude 3 Sonnet", "context_window": 200000},
        {"model_id": "anthropic.claude-3-haiku-20240307-v1:0", "name": "Claude 3 Haiku", "context_window": 200000},
        {"model_id": "meta.llama3-1-70b-instruct-v1:0", "name": "Llama 3.1 70B", "context_window": 128000},
        {"model_id": "meta.llama3-1-8b-instruct-v1:0", "name": "Llama 3.1 8B", "context_window": 128000},
        {"model_id": "mistral.mistral-large-2407-v1:0", "name": "Mistral Large", "context_window": 128000},
        {"model_id": "amazon.titan-text-premier-v1:0", "name": "Titan Text Premier", "context_window": 32000},
        {"model_id": "amazon.titan-text-express-v1", "name": "Titan Text Express", "context_window": 8192},
        {"model_id": "cohere.command-r-plus-v1:0", "name": "Command R+", "context_window": 128000},
        {"model_id": "cohere.command-r-v1:0", "name": "Command R", "context_window": 128000},
        {"model_id": "ai21.jamba-1-5-large-v1:0", "name": "Jamba 1.5 Large", "context_window": 256000},
    ]


def _build_model(provider_id, model_id, name, context_window=None, input_price=None, output_price=None):
    pricing = MODEL_PRICING.get(model_id, {})

    # Dynamic tool support detection
    supports_tools = 0
    if model_id in TOOL_MODELS:
        supports_tools = 1
    elif _model_supports_tools(model_id):
        supports_tools = 1

    # Dynamic vision support detection
    supports_vision = 0
    if model_id in VISION_MODELS:
        supports_vision = 1
    elif _model_supports_vision(model_id):
        supports_vision = 1

    return {
        "id": str(uuid.uuid4()),
        "provider_id": provider_id,
        "model_id": model_id,
        "name": name,
        "context_window": context_window or MODEL_CONTEXT_WINDOWS.get(model_id, 4096),
        "input_price_per_1k": input_price if input_price is not None else pricing.get("input", 0.0),
        "output_price_per_1k": output_price if output_price is not None else pricing.get("output", 0.0),
        "supports_tools": supports_tools,
        "supports_vision": supports_vision,
        "supports_streaming": 1,
        "metadata": {},
    }


def _model_supports_tools(model_id: str) -> bool:
    """Dynamically detect if a model supports tool/function calling."""
    # Normalize to handle cross-region inference profile IDs
    normalized = _normalize_model_id(model_id)
    model_lower = normalized.lower()

    # Claude 3+, Claude 4 models support tools
    if 'claude-3' in model_lower or 'claude-opus-4' in model_lower or 'claude-sonnet-4' in model_lower:
        return True

    # GPT-4 and GPT-3.5-turbo support tools
    if 'gpt-4' in model_lower or 'gpt-3.5-turbo' in model_lower:
        return True

    # Llama 3.1+ models support tools
    if 'llama3-1' in model_lower or 'llama3-2' in model_lower or 'llama-3.1' in model_lower:
        return True

    # Mistral large models support tools
    if 'mistral-large' in model_lower or 'mistral.mistral-large' in model_lower:
        return True

    # Cohere Command R models support tools
    if 'command-r' in model_lower:
        return True

    # Gemini models support tools
    if 'gemini' in model_lower:
        return True

    # AI21 Jamba models support tools
    if 'jamba' in model_lower:
        return True

    return False


def _model_supports_vision(model_id: str) -> bool:
    """Dynamically detect if a model supports vision/image input."""
    # Normalize to handle cross-region inference profile IDs
    normalized = _normalize_model_id(model_id)
    model_lower = normalized.lower()

    # Claude 3+, Claude 4 models support vision
    if 'claude-3' in model_lower or 'claude-opus-4' in model_lower or 'claude-sonnet-4' in model_lower:
        return True

    # GPT-4 vision models
    if 'gpt-4o' in model_lower or 'gpt-4-turbo' in model_lower or 'gpt-4-vision' in model_lower:
        return True

    # Llama 3.2 vision models (11B and 90B)
    if 'llama3-2-90b' in model_lower or 'llama3-2-11b' in model_lower:
        return True
    if 'llama-3.2-90b' in model_lower or 'llama-3.2-11b' in model_lower:
        return True

    # Gemini models support vision
    if 'gemini' in model_lower and 'nano' not in model_lower:
        return True

    return False


async def validate_api_key(provider_type: str, api_key: str, base_url: str = None, api_version: str = None) -> bool:
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
            # Extract clean Azure endpoint from potentially full URL
            azure_url = (base_url or "").rstrip("/")
            # If URL contains /openai/, extract just the base endpoint
            if "/openai/" in azure_url:
                azure_url = azure_url.split("/openai/")[0]
            # Remove query parameters if present
            if "?" in azure_url:
                azure_url = azure_url.split("?")[0]
            # Convert cognitiveservices.azure.com to openai.azure.com
            if "cognitiveservices.azure.com" in azure_url:
                azure_url = azure_url.replace("cognitiveservices.azure.com", "openai.azure.com")
            # Use 2024-10-21 for model listing (stable GA version that supports /openai/models)
            models_api_version = "2024-10-21"
            url = f"{azure_url}/openai/models?api-version={models_api_version}"
            print(f"[Azure Validation] URL: {url}")
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"api-key": api_key})
                print(f"[Azure Validation] Response status: {resp.status_code}")
                if resp.status_code != 200:
                    print(f"[Azure Validation] Response body: {resp.text[:500]}")
                return resp.status_code == 200
        elif provider_type == "bedrock":
            # Bedrock uses AWS credentials — validate by calling boto3
            if not api_key or ":" not in api_key:
                return False
            access_key, secret_key = api_key.split(":", 1)
            region = (base_url or "us-east-1").strip("/").replace("https://", "").replace("http://", "") or "us-east-1"

            def _validate_bedrock_sync():
                import boto3
                # Use STS GetCallerIdentity — always permitted for any valid credential,
                # no Bedrock-specific IAM policy required, and very lightweight.
                sts = boto3.client(
                    'sts',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region
                )
                sts.get_caller_identity()
                return True

            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(_executor, _validate_bedrock_sync)
            except Exception as e:
                print(f"[Bedrock Validation] Error: {e}")
                return False
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
