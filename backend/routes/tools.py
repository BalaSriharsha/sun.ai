from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from services.tool_service import execute_tool, get_tool_schema_for_llm
from services.python_parser import parse_python_file
import uuid
import json
import zipfile
import io

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


class ToolPackGenerateRequest(BaseModel):
    name: str
    description: str
    provider_id: str
    model_id: str


TOOL_PACK_GENERATION_PROMPT = """You are an expert Python developer creating a tool pack for an AI agent platform.

Based on the following description, generate a Python file containing utility functions that can be used as tools by AI agents.

Tool Pack Name: {name}
Description: {description}

REQUIREMENTS:
1. Create 3-6 useful functions based on the description
2. Each function MUST have:
   - A clear, descriptive name (snake_case)
   - Type hints for all parameters and return type
   - A detailed docstring explaining what it does
   - The function must return a result (not just print)

3. Use only standard library imports when possible
4. Keep functions focused and practical
5. Include error handling where appropriate

EXAMPLE FORMAT:
```python
\"\"\"
Tool pack description here.
\"\"\"

def function_name(param1: str, param2: int = 10) -> str:
    \"\"\"
    Description of what this function does.

    Args:
        param1: Description of first parameter
        param2: Description of second parameter (optional)

    Returns:
        Description of return value
    \"\"\"
    # Implementation
    result = f"Processed {{param1}}"
    return result
```

Generate ONLY the Python code, no markdown code blocks, no explanations. Start directly with a module docstring describing the tool pack."""


SAMPLE_TOOL_PACK = {
    "string_tools.py": '''"""
String manipulation tools for text processing.
"""

def reverse_string(text: str) -> str:
    """
    Reverse a string and return the result.

    Args:
        text: The input string to reverse

    Returns:
        The reversed string
    """
    result = text[::-1]
    return result


def count_words(text: str) -> int:
    """
    Count the number of words in a text string.

    Args:
        text: The input text to count words in

    Returns:
        The number of words
    """
    words = text.split()
    result = len(words)
    return result


def to_title_case(text: str) -> str:
    """
    Convert a string to title case (capitalize first letter of each word).

    Args:
        text: The input string to convert

    Returns:
        The title-cased string
    """
    result = text.title()
    return result
''',
    "math_tools.py": '''"""
Mathematical utility tools for calculations.
"""
from typing import List, Optional


def calculate_average(numbers: List[float]) -> float:
    """
    Calculate the average of a list of numbers.

    Args:
        numbers: A list of numbers to average

    Returns:
        The arithmetic mean of the numbers
    """
    if not numbers:
        return 0.0
    result = sum(numbers) / len(numbers)
    return result


def fibonacci(n: int) -> List[int]:
    """
    Generate the first n numbers in the Fibonacci sequence.

    Args:
        n: How many Fibonacci numbers to generate

    Returns:
        A list of Fibonacci numbers
    """
    if n <= 0:
        return []
    if n == 1:
        return [0]

    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])

    result = fib[:n]
    return result


def is_prime(number: int) -> bool:
    """
    Check if a number is prime.

    Args:
        number: The integer to check for primality

    Returns:
        True if the number is prime, False otherwise
    """
    if number < 2:
        return False
    for i in range(2, int(number ** 0.5) + 1):
        if number % i == 0:
            return False
    result = True
    return result
''',
    "README.txt": '''TOOL PACK TEMPLATE
==================

This is a sample tool pack demonstrating how to create custom tools.

STRUCTURE:
- Each .py file can contain multiple functions
- Each public function (not starting with _) becomes a tool
- Private functions (starting with _) are ignored

REQUIREMENTS:
1. Add a docstring to each function describing what it does
2. Use type hints for parameters (str, int, float, bool, List, Dict, Optional)
3. The function must set or return a 'result' value

EXAMPLE FUNCTION:

def my_tool(param1: str, param2: int = 10) -> str:
    """
    Description of what this tool does.

    Args:
        param1: Description of first parameter
        param2: Description of second parameter (optional, default: 10)

    Returns:
        Description of the return value
    """
    # Your tool logic here
    result = f"Processed {param1} with {param2}"
    return result

SUPPORTED TYPES:
- str -> string
- int -> integer
- float -> number
- bool -> boolean
- List[X] -> array
- Dict[str, X] -> object
- Optional[X] -> nullable type

Edit these files and rezip to create your own tool pack!
'''
}


# Built-in Tool Packs organized by category
BUILTIN_TOOL_PACKS = {
    "search": {
        "name": "Search Tools",
        "description": "Web search and information retrieval tools",
        "file": "search_tools.py",
        "code": '''"""
Search tools for web search and information retrieval.
Requires: duckduckgo-search package
"""
from typing import List, Dict, Optional


def web_search(query: str, max_results: int = 5) -> Dict:
    """
    Search the web using DuckDuckGo and return relevant results.

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default: 5)

    Returns:
        Dictionary with search results, query, and count
    """
    from duckduckgo_search import DDGS

    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))

    result = {"results": results, "query": query, "count": len(results)}
    return result
'''
    },
    "network": {
        "name": "Network Tools",
        "description": "HTTP requests and network operations",
        "file": "network_tools.py",
        "code": '''"""
Network tools for making HTTP requests.
Requires: httpx package
"""
from typing import Dict, Optional
import httpx


def http_request(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[str] = None
) -> Dict:
    """
    Make an HTTP request to any URL and return the response.

    Args:
        url: URL to request
        method: HTTP method (GET, POST, PUT, DELETE, PATCH)
        headers: Optional request headers
        body: Optional request body for POST/PUT/PATCH

    Returns:
        Dictionary with status_code, headers, body, and url
    """
    headers = headers or {}
    method = method.upper()

    with httpx.Client(timeout=30.0) as client:
        kwargs = {"headers": headers}
        if body and method in ("POST", "PUT", "PATCH"):
            kwargs["content"] = body

        response = getattr(client, method.lower())(url, **kwargs)

    result = {
        "status_code": response.status_code,
        "headers": dict(response.headers),
        "body": response.text[:10000],
        "url": str(response.url)
    }
    return result
'''
    },
    "compute": {
        "name": "Compute Tools",
        "description": "Code execution and shell commands",
        "file": "compute_tools.py",
        "code": '''"""
Compute tools for executing code and shell commands.
"""
from typing import Dict, Optional
import subprocess
import sys


def code_execute(code: str, timeout: int = 30) -> Dict:
    """
    Execute Python code in a subprocess and return the output.

    Args:
        code: Python code to execute
        timeout: Execution timeout in seconds (default: 30)

    Returns:
        Dictionary with stdout, stderr, and return_code
    """
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        result = {
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "return_code": proc.returncode
        }
    except subprocess.TimeoutExpired:
        result = {"error": "Code execution timed out"}

    return result


def shell_execute(command: str, timeout: int = 30, cwd: str = ".") -> Dict:
    """
    Execute a shell command and return stdout/stderr.

    Args:
        command: Shell command to execute
        timeout: Timeout in seconds (default: 30)
        cwd: Working directory (default: current directory)

    Returns:
        Dictionary with stdout, stderr, and return_code
    """
    try:
        proc = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd
        )
        result = {
            "stdout": proc.stdout[:10000],
            "stderr": proc.stderr[:5000],
            "return_code": proc.returncode
        }
    except subprocess.TimeoutExpired:
        result = {"error": "Command timed out"}

    return result
'''
    },
    "data": {
        "name": "Data Tools",
        "description": "JSON transformation, text extraction, and CSV parsing",
        "file": "data_tools.py",
        "code": '''"""
Data processing tools for JSON, text, and CSV.
Requires: httpx, beautifulsoup4 packages
"""
from typing import Dict, List, Optional
import json
import csv
import io


def json_transform(data: str, expression: str) -> Dict:
    """
    Transform JSON data using a Python expression.

    Args:
        data: JSON string to transform
        expression: Python expression for transformation (use 'data' as variable)

    Returns:
        Dictionary with the transformed result
    """
    parsed_data = json.loads(data)

    safe_builtins = {
        "len": len, "str": str, "int": int, "float": float,
        "list": list, "dict": dict, "sorted": sorted,
        "filter": filter, "map": map, "sum": sum,
        "min": min, "max": max, "enumerate": enumerate,
        "zip": zip, "range": range, "bool": bool,
        "True": True, "False": False, "None": None
    }

    transformed = eval(expression, {"__builtins__": safe_builtins}, {"data": parsed_data})
    result = {"result": transformed}
    return result


def text_extract(url: str, selector: Optional[str] = None) -> Dict:
    """
    Extract and parse text from a URL (HTML to plain text).

    Args:
        url: URL to extract text from
        selector: Optional CSS selector to target specific content

    Returns:
        Dictionary with extracted text, url, and length
    """
    import httpx
    from bs4 import BeautifulSoup

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script, style, nav, footer, header tags
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    if selector:
        elements = soup.select(selector)
        text = "\\n".join(el.get_text(strip=True) for el in elements)
    else:
        text = soup.get_text(separator="\\n", strip=True)

    result = {"text": text[:20000], "url": url, "length": len(text)}
    return result


def csv_parse(csv_text: str, delimiter: str = ",", max_rows: int = 100) -> Dict:
    """
    Parse CSV text into structured JSON records.

    Args:
        csv_text: CSV content as a string
        delimiter: Delimiter character (default: comma)
        max_rows: Maximum rows to return (default: 100)

    Returns:
        Dictionary with records, columns, and count
    """
    reader = csv.DictReader(io.StringIO(csv_text), delimiter=delimiter)
    rows = []

    for i, row in enumerate(reader):
        if i >= max_rows:
            break
        rows.append(dict(row))

    result = {
        "records": rows,
        "columns": list(rows[0].keys()) if rows else [],
        "count": len(rows)
    }
    return result
'''
    },
    "math": {
        "name": "Math Tools",
        "description": "Mathematical calculations and expressions",
        "file": "math_tools.py",
        "code": '''"""
Mathematical tools for calculations and expressions.
"""
from typing import Union
import math


def calculator(expression: str) -> dict:
    """
    Evaluate mathematical expressions safely.
    Supports arithmetic, trigonometry, logarithms, and more.

    Args:
        expression: Math expression to evaluate (e.g. '2**10 + sqrt(144)')

    Returns:
        Dictionary with result and original expression
    """
    safe_functions = {
        "abs": abs, "round": round, "min": min, "max": max,
        "sum": sum, "pow": pow, "sqrt": math.sqrt,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10, "log2": math.log2,
        "pi": math.pi, "e": math.e,
        "ceil": math.ceil, "floor": math.floor,
        "factorial": math.factorial,
        "asin": math.asin, "acos": math.acos, "atan": math.atan,
        "sinh": math.sinh, "cosh": math.cosh, "tanh": math.tanh,
        "degrees": math.degrees, "radians": math.radians,
    }

    calculated = eval(expression, {"__builtins__": {}}, safe_functions)
    result = {"result": calculated, "expression": expression}
    return result
'''
    },
    "utility": {
        "name": "Utility Tools",
        "description": "Date/time, base64, and hashing utilities",
        "file": "utility_tools.py",
        "code": '''"""
Utility tools for common operations like date/time, encoding, and hashing.
"""
from typing import Dict, Optional
from datetime import datetime, timezone
import base64
import hashlib


def date_time(
    action: str = "now",
    tz: str = "UTC",
    date1: Optional[str] = None,
    date2: Optional[str] = None
) -> Dict:
    """
    Get the current date/time, convert timezones, or calculate date differences.

    Args:
        action: Action to perform - "now", "convert", or "diff"
        tz: IANA timezone name (default: UTC)
        date1: First date (ISO 8601) for diff calculation
        date2: Second date (ISO 8601) for diff calculation

    Returns:
        Dictionary with date/time information
    """
    if action == "now":
        now = datetime.now(timezone.utc)
        result = {
            "utc": now.isoformat(),
            "timezone": tz,
            "unix": int(now.timestamp())
        }
    elif action == "diff" and date1 and date2:
        d1 = datetime.fromisoformat(date1)
        d2 = datetime.fromisoformat(date2)
        diff = d2 - d1
        result = {
            "days": diff.days,
            "seconds": diff.total_seconds(),
            "human": str(diff)
        }
    else:
        result = {"error": f"Unknown action or missing parameters: {action}"}

    return result


def base64_encode_decode(action: str, text: str) -> Dict:
    """
    Encode text to base64 or decode base64 to text.

    Args:
        action: "encode" or "decode"
        text: Text to encode or base64 string to decode

    Returns:
        Dictionary with the result
    """
    if action == "encode":
        encoded = base64.b64encode(text.encode()).decode()
        result = {"result": encoded, "action": "encode"}
    elif action == "decode":
        decoded = base64.b64decode(text.encode()).decode()
        result = {"result": decoded, "action": "decode"}
    else:
        result = {"error": f"Unknown action: {action}"}

    return result


def hash_generate(text: str, algorithm: str = "sha256") -> Dict:
    """
    Generate a hash (MD5, SHA-256, SHA-512) of the given text.

    Args:
        text: Text to hash
        algorithm: Hash algorithm - "md5", "sha256", or "sha512" (default: sha256)

    Returns:
        Dictionary with hash result and algorithm used
    """
    if algorithm == "md5":
        hash_obj = hashlib.md5(text.encode())
    elif algorithm == "sha256":
        hash_obj = hashlib.sha256(text.encode())
    elif algorithm == "sha512":
        hash_obj = hashlib.sha512(text.encode())
    else:
        return {"error": f"Unknown algorithm: {algorithm}"}

    result = {"hash": hash_obj.hexdigest(), "algorithm": algorithm}
    return result
'''
    },
    "filesystem": {
        "name": "Filesystem Tools",
        "description": "File reading and writing operations",
        "file": "filesystem_tools.py",
        "code": '''"""
Filesystem tools for reading and writing files.
"""
from typing import Dict
import os


def file_read(path: str, encoding: str = "utf-8", max_bytes: int = 100000) -> Dict:
    """
    Read the contents of a local file.

    Args:
        path: File path to read
        encoding: File encoding (default: utf-8)
        max_bytes: Maximum bytes to read (default: 100000)

    Returns:
        Dictionary with content, path, and length
    """
    if not os.path.isfile(path):
        return {"error": f"File not found: {path}"}

    with open(path, "r", encoding=encoding) as f:
        content = f.read(max_bytes)

    result = {"content": content, "path": path, "length": len(content)}
    return result


def file_write(path: str, content: str, mode: str = "write") -> Dict:
    """
    Write content to a local file (creates or overwrites).

    Args:
        path: File path to write
        content: Content to write
        mode: "write" to overwrite or "append" to add to existing (default: write)

    Returns:
        Dictionary with success status, path, and bytes written
    """
    file_mode = "a" if mode == "append" else "w"

    with open(path, file_mode) as f:
        f.write(content)

    result = {"success": True, "path": path, "bytes_written": len(content)}
    return result
'''
    },
    "text": {
        "name": "Text Tools",
        "description": "Regex matching and text summarization",
        "file": "text_tools.py",
        "code": '''"""
Text processing tools for regex and summarization.
"""
from typing import Dict, List
import re


def regex_match(text: str, pattern: str, flags: str = "") -> Dict:
    """
    Apply a regex pattern to text and return all matches with groups.

    Args:
        text: Text to search
        pattern: Regex pattern
        flags: Regex flags - "i" for case-insensitive, "m" for multiline, "s" for dotall

    Returns:
        Dictionary with matches, count, and pattern
    """
    regex_flags = 0
    if "i" in flags:
        regex_flags |= re.IGNORECASE
    if "m" in flags:
        regex_flags |= re.MULTILINE
    if "s" in flags:
        regex_flags |= re.DOTALL

    matches = []
    for m in re.finditer(pattern, text, regex_flags):
        matches.append({
            "match": m.group(),
            "groups": m.groups(),
            "start": m.start(),
            "end": m.end()
        })

    result = {"matches": matches[:50], "count": len(matches), "pattern": pattern}
    return result


def text_summarize(text: str, max_sentences: int = 5) -> Dict:
    """
    Summarize a block of text by extracting the most important sentences.

    Args:
        text: Text to summarize
        max_sentences: Maximum sentences in summary (default: 5)

    Returns:
        Dictionary with summary and sentence counts
    """
    sentences = re.split(r"(?<=[.!?])\\s+", text.strip())

    if len(sentences) <= max_sentences:
        return {"summary": text, "sentence_count": len(sentences)}

    # Score sentences by length (simple heuristic)
    scored = [(s, len(s.split())) for s in sentences]
    scored.sort(key=lambda x: x[1], reverse=True)

    top_sentences = [s[0] for s in scored[:max_sentences]]

    # Maintain original order
    ordered = [s for s in sentences if s in top_sentences]

    result = {
        "summary": " ".join(ordered),
        "original_sentences": len(sentences),
        "summary_sentences": len(ordered)
    }
    return result
'''
    }
}


@router.get("/builtin-packs")
async def list_builtin_tool_packs():
    """List all available built-in tool packs."""
    import re
    packs = []
    for key, pack in BUILTIN_TOOL_PACKS.items():
        # Count public functions (those not starting with underscore)
        code = pack.get("code", "")
        func_matches = re.findall(r'^def ([a-zA-Z][a-zA-Z0-9_]*)\(', code, re.MULTILINE)
        tool_count = len([f for f in func_matches if not f.startswith('_')])

        packs.append({
            "id": key,
            "name": pack["name"],
            "description": pack["description"],
            "file": pack["file"],
            "tool_count": tool_count
        })
    return {"packs": packs}


@router.get("/builtin-packs/{pack_id}")
async def download_builtin_tool_pack(pack_id: str):
    """Download a specific built-in tool pack as a .zip file."""
    if pack_id not in BUILTIN_TOOL_PACKS:
        raise HTTPException(status_code=404, detail=f"Tool pack '{pack_id}' not found")

    pack = BUILTIN_TOOL_PACKS[pack_id]

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Add the Python file
        zip_file.writestr(pack["file"], pack["code"])

        # Add a README
        readme = f"""# {pack["name"]}

## Description
{pack["description"]}

## Usage
1. Review and customize the code in `{pack["file"]}`
2. Zip the file(s) and upload using "Upload Tool Pack"
3. Each function will become a separate tool

## Functions
See `{pack["file"]}` for available functions and their documentation.
"""
        zip_file.writestr("README.md", readme)

    zip_buffer.seek(0)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={pack_id}_tools.zip"
        }
    )


@router.get("/sample-pack")
async def download_sample_tool_pack():
    """Download a sample tool pack template as a .zip file."""
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for filename, content in SAMPLE_TOOL_PACK.items():
            zip_file.writestr(filename, content)

    zip_buffer.seek(0)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=sample_tool_pack.zip"
        }
    )


@router.post("/generate-pack")
async def generate_tool_pack(req: ToolPackGenerateRequest):
    """Generate a tool pack using LLM based on description."""
    from services.chat_service import non_stream_chat_completion
    import time
    import re

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

        # Build the prompt
        prompt = TOOL_PACK_GENERATION_PROMPT.format(
            name=req.name,
            description=req.description
        )

        messages = [
            {"role": "system", "content": "You are an expert Python developer. Generate clean, well-documented Python code."},
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
            max_tokens=4000,
            provider_id=provider["id"],
            provider_name=provider["name"],
            source="tool_pack_generation",
        )

        generated_code = result.get("content", "")

        # Clean up the response - remove markdown code blocks if present
        if "```python" in generated_code:
            match = re.search(r'```python\s*(.*?)\s*```', generated_code, re.DOTALL)
            if match:
                generated_code = match.group(1)
        elif "```" in generated_code:
            match = re.search(r'```\s*(.*?)\s*```', generated_code, re.DOTALL)
            if match:
                generated_code = match.group(1)

        # Create safe filename from name
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', req.name.lower().strip())
        if not safe_name:
            safe_name = "tool_pack"

        # Create zip file with the generated code
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add the main Python file
            zip_file.writestr(f"{safe_name}.py", generated_code)

            # Add a README
            readme_content = f"""# {req.name}

## Description
{req.description}

## Generated Tool Pack

This tool pack was generated by AI based on the description above.

## Usage
1. Review the generated code in `{safe_name}.py`
2. Edit and customize as needed
3. Upload the zip file to create tools

## Functions
Review `{safe_name}.py` for available functions and their documentation.
"""
            zip_file.writestr("README.md", readme_content)

        zip_buffer.seek(0)
        elapsed = int((time.time() - start) * 1000)

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={safe_name}.zip",
                "X-Generation-Time-Ms": str(elapsed)
            }
        )

    finally:
        await db.close()


@router.post("/upload-pack")
async def upload_tool_pack(file: UploadFile = File(...)):
    """
    Upload a .zip file containing Python files to create tools.
    Each public function in each .py file becomes a separate tool.
    """
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")

    db = await get_db()
    created_tools = []
    errors = []

    try:
        # Read the zip file
        zip_content = await file.read()
        zip_buffer = io.BytesIO(zip_content)

        try:
            with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                # Get list of .py files in the zip
                py_files = [f for f in zip_file.namelist()
                           if f.endswith('.py') and not f.startswith('__')]

                if not py_files:
                    raise HTTPException(
                        status_code=400,
                        detail="No Python files found in the zip archive"
                    )

                for py_filename in py_files:
                    try:
                        content = zip_file.read(py_filename).decode('utf-8')
                    except Exception as e:
                        errors.append({
                            "file": py_filename,
                            "error": f"Failed to read file: {str(e)}"
                        })
                        continue

                    # Parse Python file
                    parsed_tools = parse_python_file(content, py_filename)

                    for tool_def in parsed_tools:
                        if "error" in tool_def:
                            errors.append({
                                "file": py_filename,
                                "error": tool_def["error"]
                            })
                            continue

                        # Check if tool name already exists
                        cursor = await db.execute(
                            "SELECT id FROM tools WHERE name = ?",
                            (tool_def["name"],)
                        )
                        if await cursor.fetchone():
                            errors.append({
                                "file": py_filename,
                                "function": tool_def["name"],
                                "error": f"Tool '{tool_def['name']}' already exists"
                            })
                            continue

                        # Create the tool
                        tool_id = str(uuid.uuid4())
                        now = datetime.utcnow().isoformat()

                        await db.execute(
                            """INSERT INTO tools (id, name, description, type, category,
                               parameters_schema, code, is_enabled, created_at, updated_at)
                               VALUES (?, ?, ?, 'custom', 'uploaded', ?, ?, 1, ?, ?)""",
                            (tool_id, tool_def["name"], tool_def["description"],
                             json.dumps(tool_def["parameters_schema"]),
                             tool_def["code"], now, now)
                        )

                        created_tools.append({
                            "id": tool_id,
                            "name": tool_def["name"],
                            "description": tool_def["description"][:200] if tool_def["description"] else "",
                            "source_file": py_filename
                        })

        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file")

        await db.commit()

        return {
            "created_tools": created_tools,
            "errors": errors,
            "total_created": len(created_tools),
            "total_skipped": len(errors)
        }
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


@router.get("/{tool_id}/download")
async def download_tool_as_pack(tool_id: str):
    """Download a tool as a .zip file that can be edited and re-uploaded."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tool not found")
        tool = dict(row)

        # Parse parameters_schema safely
        params_schema_raw = tool.get("parameters_schema", "{}")
        if isinstance(params_schema_raw, str):
            try:
                params_schema = json.loads(params_schema_raw)
            except:
                params_schema = {}
        else:
            params_schema = params_schema_raw or {}

        # Ensure params_schema is a dict
        if not isinstance(params_schema, dict):
            params_schema = {}

        tool_code = tool.get("code") or ""
        tool_name = tool.get("name", "unnamed_tool")
        tool_description = tool.get("description") or "No description"
        tool_category = tool.get("category") or "custom"

        # Build type hints from schema
        param_hints = []
        param_docs = []
        for param_name, param_info in params_schema.items():
            if isinstance(param_info, dict):
                param_type = param_info.get("type", "string")
                param_desc = param_info.get("description", "")
            else:
                param_type = "string"
                param_desc = ""
            py_type = {"string": "str", "integer": "int", "number": "float", "boolean": "bool", "array": "list", "object": "dict"}.get(param_type, "str")
            param_hints.append(f"{param_name}: {py_type}")
            param_docs.append((param_name, param_type, param_desc))

        params_str = ", ".join(param_hints) if param_hints else ""

        # Build docstring
        docstring_lines = [f'"""{tool_description}']
        if param_docs:
            docstring_lines.append("")
            docstring_lines.append("    Args:")
            for pname, ptype, pdesc in param_docs:
                docstring_lines.append(f"        {pname}: {pdesc}")
        docstring_lines.append('    """')
        docstring = "\n".join(docstring_lines)

        # Build function body
        if tool_code:
            code_lines = tool_code.strip().split("\n")
            indented_code = "\n".join("    " + line for line in code_lines)
        else:
            indented_code = "    # Add your implementation here\n    result = {}\n    return result"

        # Generate the Python file content
        python_content = f'''"""
Tool: {tool_name}
Category: {tool_category}

This tool was exported from the Agentic Platform.
Edit the function below and re-upload to update the tool.
"""
from typing import Dict, List, Optional, Any


def {tool_name}({params_str}) -> Dict:
    {docstring}
{indented_code}
'''

        # Create zip file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr(f"{tool_name}.py", python_content)

            # Add parameters_schema.json
            zip_file.writestr("parameters_schema.json", json.dumps(params_schema, indent=2))

            # Build example test parameters
            example_params = {}
            for pname, ptype, pdesc in param_docs:
                if ptype == "string":
                    example_params[pname] = "example_value"
                elif ptype == "integer":
                    example_params[pname] = 0
                elif ptype == "number":
                    example_params[pname] = 0.0
                elif ptype == "boolean":
                    example_params[pname] = True
                elif ptype == "array":
                    example_params[pname] = []
                elif ptype == "object":
                    example_params[pname] = {}
                else:
                    example_params[pname] = ""

            # Add README
            readme_lines = [
                f"# {tool_name}",
                "",
                "## Description",
                tool_description,
                "",
                "## Category",
                tool_category,
                "",
                "## Files",
                f"- `{tool_name}.py` - The tool implementation",
                "- `parameters_schema.json` - JSON Schema defining the tool's parameters",
                "- `README.md` - This file",
                "",
                "## Parameters",
            ]
            for pname, ptype, pdesc in param_docs:
                readme_lines.append(f"- **{pname}** ({ptype}): {pdesc}")

            if not param_docs:
                readme_lines.append("No parameters defined.")

            readme_lines.extend([
                "",
                "## Testing the Tool",
                "",
                "### From the Application",
                "1. Go to the **Tools** page in the application",
                f"2. Find the `{tool_name}` tool in the list",
                "3. Click the **Play** button (▶) to test the tool",
                "4. Enter test parameters as JSON when prompted:",
                "```json",
                json.dumps(example_params, indent=2),
                "```",
                "5. Click OK to execute and see the results",
                "",
                "### Editing and Re-uploading",
                f"1. Edit `{tool_name}.py` to customize the tool logic",
                "2. Optionally update `parameters_schema.json` to modify parameters",
                "3. Zip all files together",
                "4. Go to **Tools** page and click **Upload**",
                "5. Upload the zip file to update the tool",
            ])

            zip_file.writestr("README.md", "\n".join(readme_lines))

        zip_buffer.seek(0)

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={tool_name}_tool.zip"
            }
        )
    finally:
        await db.close()