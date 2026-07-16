"""
app/mcp_server.py — Heccker-OS Model Context Protocol (MCP) Server

Exposes Heccker's core tools as a real MCP server running over stdio transport.
Compatible with Claude Desktop, Cursor, VS Code Copilot, and any MCP host client.

This server bridges Heccker-OS into the broader MCP ecosystem, allowing external
AI tools to invoke our prompt injection detection, shopping cart, security scanning,
and developer productivity tools directly.

Quick Start:
  uv run python app/mcp_server.py

Claude Desktop config (~/.claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "heccker": {
        "command": "uv",
        "args": ["run", "python", "app/mcp_server.py"],
        "cwd": "/absolute/path/to/heccker-agents"
      }
    }
  }

Cursor / VS Code (.cursor/mcp.json):
  {
    "heccker": {
      "command": "uv",
      "args": ["run", "python", "app/mcp_server.py"],
      "cwd": "/absolute/path/to/heccker-agents"
    }
  }

Exposed Tools:
  Security:
    mcp_detect_prompt_injection  — validate text for jailbreak/injection attempts
    mcp_scan_file_for_secrets    — static scan of a file for exposed credentials
    mcp_check_gitignore          — verify .gitignore covers sensitive paths

  Shopping:
    mcp_add_to_cart              — stage a product to shopping_cart.json (no auto-buy)
    mcp_view_cart                — show all staged cart items with checkout URLs
    mcp_clear_cart               — empty the cart

  OS:
    mcp_run_command              — run a sandboxed shell command in the workspace

  Concierge:
    mcp_get_schedule             — return all calendar events
    mcp_add_calendar_event       — add a new event to the calendar
    mcp_add_todo                 — add a task to the developer todo list
"""

from mcp.server.fastmcp import FastMCP

# Import the real tool functions from the agent module.
# These are the same functions used by the ADK sub-agents — no duplication.
from app.agent import (
    detect_prompt_injection,
    scan_file_for_secrets,
    check_gitignore_for_secrets,
    add_to_cart,
    view_cart,
    clear_cart,
    run_terminal_command,
    add_todo_item,
    get_schedule,
    add_calendar_event,
    write_memory,
    check_emails,
    check_wellbeing,
)

# Initialize the FastMCP server.
# "heccker" is the server name that MCP host clients will display.
mcp = FastMCP("heccker")


# ── Security Tools ────────────────────────────────────────────────────────

@mcp.tool()
def mcp_detect_prompt_injection(user_input: str) -> str:
    """Validate text for prompt injection and jailbreak attempts.

    Run this on any user-supplied text before processing it with an LLM.
    Returns a security clearance message or a detailed threat report with
    the matched injection patterns.

    Args:
        user_input: The raw text to inspect.
    """
    return detect_prompt_injection(user_input)


@mcp.tool()
def mcp_scan_file_for_secrets(path: str) -> str:
    """Scan a workspace file for exposed API keys and credentials.

    Checks for Google API keys, OpenAI API keys, GitHub personal access tokens,
    Slack tokens, and generic credential assignments. Safe to run pre-commit.

    Args:
        path: Path to the file to scan (relative or absolute).
    """
    return scan_file_for_secrets(path)


@mcp.tool()
def mcp_check_gitignore() -> str:
    """Verify that .gitignore properly excludes sensitive files.

    Checks that .env, secrets.json, .venv, __pycache__, and *.pyc are
    covered. Call this before any git push or publish operation.
    """
    return check_gitignore_for_secrets()


# ── Shopping Tools ────────────────────────────────────────────────────────

@mcp.tool()
def mcp_add_to_cart(item_name: str, price: str, source_url: str) -> str:
    """Stage a product in the persistent shopping cart (shopping_cart.json).

    Does NOT purchase anything. Queues the item with its price and checkout
    URL for the user to visit manually. Safe to call multiple times to build
    a comparison cart before deciding.

    Args:
        item_name: Product name (e.g. "Dell XPS 15 9530").
        price: Price string (e.g. "$1,299", "€899").
        source_url: Direct product page or checkout URL.
    """
    return add_to_cart(item_name, price, source_url)


@mcp.tool()
def mcp_view_cart() -> str:
    """Return all items currently staged in the shopping cart.

    Shows item names, prices, and checkout URLs. Nothing is purchased
    until the user manually visits each checkout URL.
    """
    return view_cart()


@mcp.tool()
def mcp_clear_cart() -> str:
    """Clear all items from the shopping cart (shopping_cart.json)."""
    return clear_cart()


# ── OS Tools ─────────────────────────────────────────────────────────────

@mcp.tool()
def mcp_run_command(command: str) -> str:
    """Run a sandboxed shell command in the Heccker workspace.

    Destructive patterns (rm -rf /, format, mkfs, fork bombs) are blocked
    before execution. Commands time out after 30 seconds.

    Args:
        command: The shell command to execute.
    """
    return run_terminal_command(command)


# ── Concierge Tools ───────────────────────────────────────────────────────

@mcp.tool()
def mcp_get_schedule() -> str:
    """Return all events in the developer calendar (calendar.json)."""
    return get_schedule()


@mcp.tool()
def mcp_add_calendar_event(title: str, date_time: str) -> str:
    """Add an event to the developer calendar (calendar.json).

    Args:
        title: Event title.
        date_time: Date/time string in YYYY-MM-DD HH:MM format.
    """
    return add_calendar_event(title, date_time)


@mcp.tool()
def mcp_add_todo(task: str) -> str:
    """Add a task to the developer todo list (todo.json).

    Args:
        task: Actionable task description.
    """
    return add_todo_item(task)


# ── Hikari / Concierge Additions ──────────────────────────────────────────

@mcp.tool()
def mcp_write_memory(fact: str) -> str:
    """Commit a fact, preference, or schedule to Heccker's long-term memory (CONTEXT.md).
    
    Args:
        fact: The fact to memorize.
    """
    return write_memory(fact)


@mcp.tool()
def mcp_check_emails() -> str:
    """Fetch unread emails securely via Cloud ID."""
    return check_emails()


@mcp.tool()
def mcp_check_wellbeing() -> str:
    """Check if the user is working past their scheduled bedtimes based on memory."""
    return check_wellbeing()


if __name__ == "__main__":
    # Run over stdio transport — the standard MCP transport for local servers.
    # The MCP host client (Claude Desktop, Cursor, etc.) spawns this process
    # and communicates via stdin/stdout using the MCP protocol.
    mcp.run(transport="stdio")
