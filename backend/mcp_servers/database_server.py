#!/usr/bin/env python3
"""Built-in MCP Server: Database Operations (SQLite)"""
import json
import sys
import sqlite3
import os


def handle_request(method, params):
    db_path = params.get("db_path", "test.db")

    if method == "execute_query":
        query = params.get("query", "")
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query)
            if query.strip().upper().startswith("SELECT") or query.strip().upper().startswith("PRAGMA"):
                rows = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                result_rows = [dict(zip(columns, row)) for row in rows]
                conn.close()
                return {"rows": result_rows, "columns": columns, "count": len(result_rows)}
            else:
                conn.commit()
                affected = cursor.rowcount
                conn.close()
                return {"affected_rows": affected}
        except Exception as e:
            return {"error": str(e)}

    elif method == "list_tables":
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            return {"tables": tables, "count": len(tables)}
        except Exception as e:
            return {"error": str(e)}

    elif method == "describe_table":
        table_name = params.get("table_name", "")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.execute(f"PRAGMA table_info({table_name})")
            columns = []
            for row in cursor.fetchall():
                columns.append({
                    "cid": row[0], "name": row[1], "type": row[2],
                    "notnull": bool(row[3]), "default_value": row[4], "pk": bool(row[5])
                })
            conn.close()
            return {"table": table_name, "columns": columns}
        except Exception as e:
            return {"error": str(e)}

    return {"error": f"Unknown method: {method}"}


if __name__ == "__main__":
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
