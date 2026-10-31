"""Read-only MCP server (Round 3, improvement 1). See docs/MCP.md and `server.py`."""

from brandlens_worker.mcp.server import build_router
from brandlens_worker.mcp.store import PgMcpStore

__all__ = ["PgMcpStore", "build_router"]
