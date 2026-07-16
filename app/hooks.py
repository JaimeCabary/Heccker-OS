"""
app/hooks.py — Heccker-OS Pre-Tool and Post-Tool Hook System

Implements ADK tool callbacks that form a runtime security and observability
layer. Every tool call in the Heccker swarm passes through before_tool_hook
before execution, and through after_tool_hook after completion.

Security behaviors enforced:
  - before_tool_hook:
      1. Validates tool name is on the explicit allowlist.
      2. Scans string arguments for injection markers.
      3. Hard-blocks destructive shell commands regardless of agent intent.
  - after_tool_hook:
      Accumulates an in-session audit log of all tool calls and outcomes.
      This trail is accessible in the session state under 'audit_log'.

Design note:
  This hook system is what replaces naive semgrep-style static scanning.
  Real security happens at runtime, not at commit time.
"""

import re
from typing import Any, Optional

# ==========================================
# TOOL ALLOWLIST
# Only tools explicitly registered here may execute.
# Any tool not on this list is hard-blocked.
# ==========================================
_TOOL_ALLOWLIST = {
    "read_workspace_file",
    "write_workspace_file",
    "run_terminal_command",
    "scan_file_for_secrets",
    "check_gitignore_for_secrets",
    "detect_prompt_injection",
    "add_to_cart",
    "view_cart",
    "remove_from_cart",
    "clear_cart",
    "compare_prices",
    "web_search",
    "add_calendar_event",
    "delete_calendar_event",
    "add_todo_item",
    "delete_todo",
    "get_schedule",
    "check_emails",
    "send_email",
    "check_wellbeing",
    "launch_application",
    "search_flights",
    "get_street_view",
    "get_weather",
    "execute_mcp_tool",
    "write_memory",
    "read_memory",
    "remove_memory",
    "exit_loop",
    "set_timer",
    "lock_screen",
    "search_spotify",
    # ADK internal routing (sub-agent delegation) — always allowed
    "transfer_to_agent",
}

# ==========================================
# SECONDARY INJECTION PATTERNS
# These catch injection attempts that have leaked into tool arguments
# after passing the initial security_agent prompt check.
# ==========================================
_ARG_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"forget\s+(your\s+)?(system\s+prompt|instructions)",
    r"you\s+are\s+now\s+(dan|jailbroken|unrestricted)",
    r"override\s+your\s+(system|core)\s+(prompt|directives)",
    r"(reveal|print|output)\s+(your\s+)?system\s+prompt",
]

# ==========================================
# HARD-BLOCKED COMMAND PATTERNS
# These are blocked even if run_terminal_command itself has its own guard.
# Defense-in-depth: two layers for the most destructive commands.
# ==========================================
_HARD_BLOCKED_COMMANDS = [
    r"rm\s+-rf\s+[/~]",
    r"format\s+[a-zA-Z]:",
    r"del\s+/s\s+/q",
    r"shutdown\s+(/[srh]|-[srh])",
    r"reboot",
    r"mkfs\.",
    r":\(\)\{\s*:\|\:&\s*\};:",  # fork bomb
    r"dd\s+if=/dev/",
    r"(cat|less|more|head|tail|grep|vi|nano|vim|echo)\s+.*(app/|frontend/|\.env|firebase|credentials|pyproject\.toml)",
    r"print\(.*db\.collection"
]


def before_tool_hook(
    tool: Any,
    args: dict[str, Any],
    tool_context: Any,
) -> Optional[dict[str, Any]]:
    """Pre-tool hook: validates every tool call before Heccker executes it.

    Called by ADK automatically before each tool invocation across all agents
    in the swarm. Returns None to allow execution, or a dict with an 'error'
    key to block it and surface the reason to the orchestrator.

    Args:
        tool: The ADK BaseTool object about to be called.
        args: The keyword arguments being passed to the tool.
        tool_context: ADK ToolContext (session state, agent info, etc.).

    Returns:
        None to allow execution, or {'error': str} to block.
    """
    tool_name = getattr(tool, "name", str(tool))

    # Check 1: Allowlist — reject any unregistered tool
    if tool_name not in _TOOL_ALLOWLIST:
        return {
            "error": (
                f"BLOCKED by Heccker security hook: "
                f"Tool '{tool_name}' is not on the approved allowlist. "
                f"Approved tools: {sorted(_TOOL_ALLOWLIST)}"
            )
        }

    # Check 2: Scan string arguments for injection markers
    for key, val in args.items():
        if not isinstance(val, str):
            continue
        for pattern in _ARG_INJECTION_PATTERNS:
            if re.search(pattern, val, re.IGNORECASE):
                return {
                    "error": (
                        f"BLOCKED: Argument '{key}' in tool '{tool_name}' "
                        f"contains a potential injection pattern. "
                        f"Matched: '{pattern}'"
                    )
                }

    # Check 3: Hard command block (defense-in-depth for shell commands)
    if tool_name == "run_terminal_command":
        command = args.get("command", "")
        for pattern in _HARD_BLOCKED_COMMANDS:
            if re.search(pattern, command, re.IGNORECASE):
                return {
                    "error": (
                        f"BLOCKED: Shell command matches hard-blocked pattern '{pattern}'. "
                        f"Prevented by the HALO security gate."
                    )
                }
                
        # Absolute path/keyword blocking for terminal commands (prevents python/node bypasses)
        command_lower = command.lower().replace("\\", "/")
        restricted_keywords = [".env", "firebase", "credentials", "pyproject.toml", "app/", "frontend/", "storage.py"]
        for kw in restricted_keywords:
            if kw in command_lower:
                return {
                    "error": (
                        f"BLOCKED by HALO gate: Shell command contains restricted keyword '{kw}'. "
                        "You may not interact with core codebase files or credentials via the terminal."
                    )
                }

    # Check 4: Workspace File access (block core codebase and secure keys)
    if tool_name in ("read_workspace_file", "write_workspace_file"):
        path = args.get("path", "").replace("\\", "/").lower()
        
        # Block access to the core engine code
        if "/app/" in path or "/frontend/" in path or path.startswith("app/") or path.startswith("frontend/"):
            return {
                "error": (
                    f"BLOCKED by HALO gate: Access to '{path}' is strictly prohibited. "
                    f"You may not read or modify the core Heccker source code (app/ or frontend/)."
                )
            }
            
        # Block access to configuration and credentials
        if ".env" in path or "firebase" in path or "credentials" in path or "pyproject.toml" in path:
            return {
                "error": (
                    f"BLOCKED by HALO gate: Access to '{path}' is strictly prohibited. "
                    f"You may not read or modify secure configuration or credential files."
                )
            }

    # All checks passed — execution is allowed
    return None


def after_tool_hook(
    tool: Any,
    args: dict[str, Any],
    tool_context: Any,
    tool_response: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """Post-tool hook: logs tool execution outcome to the session audit trail.

    Appends a structured log entry to 'audit_log' in session state after
    every tool call. Creates a complete audit trail of every action taken
    by the Heccker swarm during a session.

    Args:
        tool: The ADK BaseTool that was called.
        args: The arguments that were passed to the tool.
        tool_context: ADK ToolContext.
        tool_response: The output returned by the tool.

    Returns:
        None — does not modify the tool response.
    """
    tool_name = getattr(tool, "name", str(tool))
    response_str = str(tool_response)

    # Classify the outcome based on response content
    if "BLOCKED" in response_str or "error" in response_str.lower():
        status = "blocked_or_error"
    elif "Success" in response_str or "Added" in response_str or "Scheduled" in response_str:
        status = "success"
    else:
        status = "completed"

    log_entry = {"tool": tool_name, "status": status}

    # Write to session state audit log if context is available
    try:
        if tool_context is not None and hasattr(tool_context, "state"):
            audit_log = tool_context.state.get("audit_log", [])
            audit_log.append(log_entry)
            tool_context.state["audit_log"] = audit_log
    except Exception:
        # Never let the hook itself crash the agent
        pass

    return None
