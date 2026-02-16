#!/usr/bin/env python3
"""Built-in MCP Server: Filesystem Operations"""
import json
import sys
import os
import glob


def handle_request(method, params):
    if method == "read_file":
        path = params.get("path", "")
        if not os.path.exists(path):
            return {"error": f"File not found: {path}"}
        try:
            with open(path, "r") as f:
                content = f.read()
            return {"content": content[:50000], "path": path, "size": os.path.getsize(path)}
        except Exception as e:
            return {"error": str(e)}

    elif method == "write_file":
        path = params.get("path", "")
        content = params.get("content", "")
        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w") as f:
                f.write(content)
            return {"written": True, "path": path, "size": len(content)}
        except Exception as e:
            return {"error": str(e)}

    elif method == "list_directory":
        path = params.get("path", ".")
        if not os.path.isdir(path):
            return {"error": f"Not a directory: {path}"}
        try:
            entries = []
            for entry in os.scandir(path):
                info = {
                    "name": entry.name,
                    "type": "directory" if entry.is_dir() else "file",
                    "path": entry.path
                }
                if entry.is_file():
                    info["size"] = entry.stat().st_size
                entries.append(info)
            return {"entries": sorted(entries, key=lambda x: (x["type"] != "directory", x["name"])), "count": len(entries)}
        except Exception as e:
            return {"error": str(e)}

    elif method == "search_files":
        path = params.get("path", ".")
        pattern = params.get("pattern", "*")
        try:
            matches = glob.glob(os.path.join(path, "**", pattern), recursive=True)
            return {"matches": matches[:100], "count": len(matches)}
        except Exception as e:
            return {"error": str(e)}

    return {"error": f"Unknown method: {method}"}


if __name__ == "__main__":
    # Simple stdio MCP-like server
    for line in sys.stdin:
        try:
            req = json.loads(line.strip())
            method = req.get("method", "")
            params = req.get("params", {})
            result = handle_request(method, params)
            print(json.dumps({"id": req.get("id"), "result": result}))
            sys.stdout.flush()
        except json.JSONDecodeError:
            pass
