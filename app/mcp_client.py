import os
import json
import asyncio
import subprocess
from typing import Any

def execute_mcp_tool(server_name: str, tool_name: str, arguments: str = "{}") -> str:
    """Connects to a real MCP server configured in mcp_client_config.json and executes a tool.
    
    This function bridges the Google ADK swarm with external MCP servers by launching
    the configured server via stdio and sending a standard JSON-RPC tool call.
    
    Args:
        server_name: The name of the server (e.g., 'github', 'discord', 'google_drive').
        tool_name: The tool to execute on that server.
        arguments: A JSON string containing the tool arguments.
    """
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mcp_client_config.json")
        if not os.path.exists(config_path):
            return "Error: mcp_client_config.json not found."
            
        with open(config_path, "r") as f:
            config = json.load(f)
            
        server_config = config.get("mcpServers", {}).get(server_name)
        if not server_config:
            return f"Error: MCP Server '{server_name}' not found in config."
            
        env = os.environ.copy()
        for k, v in server_config.get("env", {}).items():
            if isinstance(v, str) and v.startswith("${") and v.endswith("}"):
                env_var = v[2:-1]
                env[k] = os.environ.get(env_var, "")
            else:
                env[k] = v
                
        # To avoid the dependency on the `mcp` python SDK and deal with asyncio stdio streams
        # in a blocking tool context, we will use a small inline python snippet to call the tool 
        # using the official SDK.
        
        script = f"""
import sys
import json
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    server_params = StdioServerParameters(
        command={repr(server_config["command"])},
        args={repr(server_config.get("args", []))}
    )
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                args_dict = json.loads({repr(arguments)})
                result = await session.call_tool({repr(tool_name)}, arguments=args_dict)
                
                # Convert CallToolResult to text
                output = []
                for content in result.content:
                    if content.type == "text":
                        output.append(content.text)
                print("\\n".join(output))
    except Exception as e:
        print(f"MCP Tool Execution Error: {{e}}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
"""
        # Execute the wrapper script in a subprocess to handle asyncio cleanly
        result = subprocess.run(
            ["python", "-c", script],
            capture_output=True,
            text=True,
            env=env,
            timeout=30
        )
        
        if result.returncode != 0:
            return f"MCP Subprocess Error:\\n{result.stderr}\\n{result.stdout}"
            
        return result.stdout.strip() or "Tool executed successfully (no output)."
        
    except subprocess.TimeoutExpired:
        return f"Error: MCP server '{server_name}' timed out after 30 seconds."
    except Exception as e:
        return f"MCP Error [{server_name}.{tool_name}]: {str(e)}"
