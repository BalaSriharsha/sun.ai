import json
import uuid
import time
from datetime import datetime
from database import get_db
from services.provider_service import get_litellm_model_name
from services.observability_service import log_llm_call
import litellm

litellm.drop_params = True


async def stream_chat_completion(
    provider_type: str,
    model_id: str,
    messages: list,
    api_key: str,
    base_url: str = None,
    api_version: str = None,
    tools: list = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    provider_id: str = None,
    provider_name: str = None,
    conversation_id: str = None,
    source: str = "chat",
    org_id: str = None,
    workspace_id: str = None,
):
    litellm_model = get_litellm_model_name(provider_type, model_id)
    kwargs = {
        "model": litellm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    # Handle provider-specific authentication
    if provider_type == "bedrock":
        # For Bedrock, api_key is expected as "access_key:secret_key"
        # and base_url contains the region name (e.g., "us-east-1")
        if api_key and ":" in api_key:
            access_key, secret_key = api_key.split(":", 1)
            kwargs["aws_access_key_id"] = access_key
            kwargs["aws_secret_access_key"] = secret_key
        if base_url:
            # base_url for Bedrock should be the region name
            region = base_url.strip("/").replace("https://", "").replace("http://", "")
            kwargs["aws_region_name"] = region
    else:
        # Standard API key authentication for other providers
        kwargs["api_key"] = api_key
        if base_url:
            kwargs["api_base"] = base_url

    if provider_type == "azure":
        kwargs["api_version"] = api_version or "2024-06-01"
    if tools:
        kwargs["tools"] = tools

    start_time = time.time()
    ttfb = None
    full_response = ""
    tool_calls_data = []
    input_text = json.dumps(messages[-3:]) if len(messages) > 3 else json.dumps(messages)

    try:
        response = await litellm.acompletion(**kwargs)
        async for chunk in response:
            if ttfb is None:
                ttfb = int((time.time() - start_time) * 1000)

            delta = chunk.choices[0].delta if chunk.choices else None
            if delta:
                if delta.content:
                    full_response += delta.content
                    yield {"type": "content", "content": delta.content}
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        if tc.index is not None:
                            while len(tool_calls_data) <= tc.index:
                                tool_calls_data.append({"id": "", "function": {"name": "", "arguments": ""}})
                            if tc.id:
                                tool_calls_data[tc.index]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_calls_data[tc.index]["function"]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls_data[tc.index]["function"]["arguments"] += tc.function.arguments

            if chunk.choices and chunk.choices[0].finish_reason:
                yield {"type": "finish", "reason": chunk.choices[0].finish_reason}

        if tool_calls_data:
            yield {"type": "tool_calls", "tool_calls": tool_calls_data}

        total_time = int((time.time() - start_time) * 1000)

        # Calculate tokens (estimate if not available from response)
        input_tokens = _estimate_tokens(json.dumps(messages))
        output_tokens = _estimate_tokens(full_response)

        # Log to observability
        await log_llm_call(
            provider_id=provider_id,
            provider_name=provider_name or provider_type,
            model_id=model_id,
            model_name=model_id,
            input_text=input_text,
            output_text=full_response[:5000],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=0,
            cost=0,
            latency_ms=total_time,
            ttfb_ms=ttfb or 0,
            status="success",
            source=source,
            conversation_id=conversation_id,
            org_id=org_id,
            workspace_id=workspace_id,
        )

        yield {
            "type": "usage",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "latency_ms": total_time,
            "ttfb_ms": ttfb or 0,
        }

    except Exception as e:
        total_time = int((time.time() - start_time) * 1000)
        await log_llm_call(
            provider_id=provider_id,
            provider_name=provider_name or provider_type,
            model_id=model_id,
            model_name=model_id,
            input_text=input_text,
            output_text="",
            input_tokens=0,
            output_tokens=0,
            cached_tokens=0,
            cost=0,
            latency_ms=total_time,
            ttfb_ms=0,
            status="error",
            error=str(e),
            source=source,
            conversation_id=conversation_id,
            org_id=org_id,
            workspace_id=workspace_id,
        )
        yield {"type": "error", "error": str(e)}


async def non_stream_chat_completion(
    provider_type: str,
    model_id: str,
    messages: list,
    api_key: str,
    base_url: str = None,
    api_version: str = None,
    tools: list = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    provider_id: str = None,
    provider_name: str = None,
    conversation_id: str = None,
    source: str = "chat",
    org_id: str = None,
    workspace_id: str = None,
):
    litellm_model = get_litellm_model_name(provider_type, model_id)
    kwargs = {
        "model": litellm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    # Handle provider-specific authentication
    if provider_type == "bedrock":
        # For Bedrock, api_key is expected as "access_key:secret_key"
        # and base_url contains the region name (e.g., "us-east-1")
        if api_key and ":" in api_key:
            access_key, secret_key = api_key.split(":", 1)
            kwargs["aws_access_key_id"] = access_key
            kwargs["aws_secret_access_key"] = secret_key
        if base_url:
            # base_url for Bedrock should be the region name
            region = base_url.strip("/").replace("https://", "").replace("http://", "")
            kwargs["aws_region_name"] = region
    else:
        # Standard API key authentication for other providers
        kwargs["api_key"] = api_key
        if base_url:
            kwargs["api_base"] = base_url

    if provider_type == "azure":
        kwargs["api_version"] = api_version or "2024-06-01"
    if tools:
        kwargs["tools"] = tools

    start_time = time.time()
    input_text = json.dumps(messages[-3:]) if len(messages) > 3 else json.dumps(messages)

    try:
        response = await litellm.acompletion(**kwargs)
        total_time = int((time.time() - start_time) * 1000)

        content = response.choices[0].message.content or ""
        usage = response.usage

        input_tokens = usage.prompt_tokens if usage else _estimate_tokens(json.dumps(messages))
        output_tokens = usage.completion_tokens if usage else _estimate_tokens(content)
        cached_tokens = getattr(usage, 'prompt_tokens_details', {})
        if cached_tokens and hasattr(cached_tokens, 'cached_tokens'):
            cached_tokens = cached_tokens.cached_tokens or 0
        else:
            cached_tokens = 0

        await log_llm_call(
            provider_id=provider_id,
            provider_name=provider_name or provider_type,
            model_id=model_id,
            model_name=model_id,
            input_text=input_text,
            output_text=content[:5000],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            cost=0,
            latency_ms=total_time,
            ttfb_ms=total_time,
            status="success",
            source=source,
            conversation_id=conversation_id,
            org_id=org_id,
            workspace_id=workspace_id,
        )

        tool_calls = None
        if response.choices[0].message.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in response.choices[0].message.tool_calls
            ]

        return {
            "content": content,
            "tool_calls": tool_calls,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cached_tokens": cached_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
            "latency_ms": total_time,
        }

    except Exception as e:
        total_time = int((time.time() - start_time) * 1000)
        await log_llm_call(
            provider_id=provider_id,
            provider_name=provider_name or provider_type,
            model_id=model_id,
            model_name=model_id,
            input_text=input_text,
            output_text="",
            input_tokens=0,
            output_tokens=0,
            cached_tokens=0,
            cost=0,
            latency_ms=total_time,
            ttfb_ms=0,
            status="error",
            error=str(e),
            source=source,
            conversation_id=conversation_id,
            org_id=org_id,
            workspace_id=workspace_id,
        )
        raise


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)
