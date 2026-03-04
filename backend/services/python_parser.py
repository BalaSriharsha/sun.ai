"""
Python file parser for extracting function definitions as tools.
Uses AST for safe parsing without code execution.
"""

import ast
from typing import List, Dict, Any, Optional


def parse_python_file(content: str, filename: str) -> List[Dict[str, Any]]:
    """
    Parse a Python file and extract function definitions.
    Returns a list of tool definitions.
    """
    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        return [{"error": f"Syntax error in {filename}: {e}"}]

    tools = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef):
            tool = extract_function_metadata(node, filename, content)
            if tool and "error" not in tool:
                tools.append(tool)
        elif isinstance(node, ast.AsyncFunctionDef):
            tool = extract_async_function_metadata(node, filename, content)
            if tool and "error" not in tool:
                tools.append(tool)

    if not tools:
        return [{"error": f"No public functions found in {filename}"}]

    return tools


def extract_function_metadata(node: ast.FunctionDef, filename: str, source: str) -> Optional[Dict[str, Any]]:
    """Extract metadata from a function definition node."""
    name = node.name

    # Skip private/dunder functions
    if name.startswith('_'):
        return None

    # Get docstring
    docstring = ast.get_docstring(node) or f"Function {name} from {filename}"

    # Parse parameters and type hints
    parameters_schema = build_parameters_schema(node)

    # Generate the tool code
    code = generate_tool_code(node, source)

    return {
        "name": name,
        "description": docstring,
        "parameters_schema": parameters_schema,
        "code": code,
        "source_file": filename,
        "is_async": False
    }


def extract_async_function_metadata(node: ast.AsyncFunctionDef, filename: str, source: str) -> Optional[Dict[str, Any]]:
    """Extract metadata from an async function definition node."""
    name = node.name

    # Skip private/dunder functions
    if name.startswith('_'):
        return None

    # Get docstring
    docstring = ast.get_docstring(node) or f"Async function {name} from {filename}"

    # Parse parameters and type hints
    parameters_schema = build_parameters_schema(node)

    # Generate the tool code (async functions need special handling)
    code = generate_async_tool_code(node, source)

    return {
        "name": name,
        "description": docstring,
        "parameters_schema": parameters_schema,
        "code": code,
        "source_file": filename,
        "is_async": True
    }


def build_parameters_schema(node) -> Dict[str, Any]:
    """
    Convert Python type hints to JSON Schema format.
    """
    schema = {
        "type": "object",
        "properties": {},
        "required": []
    }

    args = node.args

    # Calculate which args have defaults
    num_defaults = len(args.defaults)
    num_args = len(args.args)
    first_default_idx = num_args - num_defaults

    for idx, arg in enumerate(args.args):
        param_name = arg.arg
        if param_name == 'self':
            continue

        param_type = "string"  # default
        param_description = param_name

        if arg.annotation:
            param_type, param_description = python_type_to_json_type(arg.annotation, param_name)

        schema["properties"][param_name] = {
            "type": param_type,
            "description": param_description
        }

        # Parameters without defaults are required
        has_default = idx >= first_default_idx
        if not has_default:
            schema["required"].append(param_name)

    # Handle keyword-only arguments
    for idx, arg in enumerate(args.kwonlyargs):
        param_name = arg.arg
        param_type = "string"
        param_description = param_name

        if arg.annotation:
            param_type, param_description = python_type_to_json_type(arg.annotation, param_name)

        schema["properties"][param_name] = {
            "type": param_type,
            "description": param_description
        }

        # Check if has default (kw_defaults can have None for required kwargs)
        if idx < len(args.kw_defaults) and args.kw_defaults[idx] is None:
            schema["required"].append(param_name)

    return schema


def python_type_to_json_type(annotation: ast.AST, param_name: str) -> tuple:
    """Map Python type hints to JSON Schema types. Returns (type, description)."""
    type_map = {
        "str": "string",
        "int": "integer",
        "float": "number",
        "bool": "boolean",
        "list": "array",
        "dict": "object",
        "List": "array",
        "Dict": "object",
        "Any": "string",
        "None": "null",
    }

    if isinstance(annotation, ast.Name):
        json_type = type_map.get(annotation.id, "string")
        return json_type, f"{param_name} ({annotation.id})"

    elif isinstance(annotation, ast.Subscript):
        # Handle List[str], Dict[str, int], Optional[str], etc.
        if isinstance(annotation.value, ast.Name):
            base_type = annotation.value.id

            if base_type == "Optional":
                # Optional[X] - get the inner type
                if isinstance(annotation.slice, ast.Name):
                    inner_type = type_map.get(annotation.slice.id, "string")
                    return inner_type, f"{param_name} (optional {annotation.slice.id})"
                return "string", f"{param_name} (optional)"

            elif base_type == "List":
                return "array", f"{param_name} (list)"

            elif base_type == "Dict":
                return "object", f"{param_name} (dict)"

            elif base_type == "Union":
                return "string", f"{param_name} (union type)"

            return type_map.get(base_type, "string"), f"{param_name} ({base_type})"

    elif isinstance(annotation, ast.Constant):
        # Literal types
        return "string", f"{param_name} (literal)"

    elif isinstance(annotation, ast.BinOp):
        # Union types with | operator (Python 3.10+)
        return "string", f"{param_name} (union type)"

    return "string", param_name


def generate_tool_code(node: ast.FunctionDef, source: str) -> str:
    """
    Generate the tool execution code.
    Wraps the function and sets 'result' variable.
    """
    # Get the function source code
    func_code = ast.unparse(node)

    # Generate parameter extraction
    param_names = [arg.arg for arg in node.args.args if arg.arg != 'self']
    kwonly_names = [arg.arg for arg in node.args.kwonlyargs]
    all_params = param_names + kwonly_names

    if all_params:
        args_str = ", ".join([f'{p}=params.get("{p}")' for p in all_params])
    else:
        args_str = ""

    return f'''{func_code}

# Execute the function with provided parameters
result = {node.name}({args_str})
'''


def generate_async_tool_code(node: ast.AsyncFunctionDef, source: str) -> str:
    """
    Generate the tool execution code for async functions.
    Wraps the async function and runs it synchronously.
    """
    # Get the function source code
    func_code = ast.unparse(node)

    # Generate parameter extraction
    param_names = [arg.arg for arg in node.args.args if arg.arg != 'self']
    kwonly_names = [arg.arg for arg in node.args.kwonlyargs]
    all_params = param_names + kwonly_names

    if all_params:
        args_str = ", ".join([f'{p}=params.get("{p}")' for p in all_params])
    else:
        args_str = ""

    return f'''import asyncio

{func_code}

# Execute the async function with provided parameters
result = asyncio.run({node.name}({args_str}))
'''
