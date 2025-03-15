import { invoke } from "@tauri-apps/api/tauri";
import {
  McpServerConfig,
  McpServerStatus,
  ListToolsResult,
  CallToolResult,
  ListResourcesResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
} from "./types";

// Helper function to check if the Tauri backend has MCP commands
let mcpEnabled: boolean | null = null;

async function checkMcpEnabled(): Promise<boolean> {
  if (mcpEnabled !== null) {
    return mcpEnabled;
  }
  
  try {
    // Try a simple MCP command
    await invoke("mcp_get_servers");
    mcpEnabled = true;
    return true;
  } catch (e) {
    console.warn("MCP commands not available in this build:", e);
    mcpEnabled = false;
    return false;
  }
}

// MCP server management with fallbacks
export async function registerServer(
  name: string,
  command: string,
  args: string[] = [],
  env: Record<string, string> = {}
): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_register_server", { name, command, args, env });
  }
  
  // Fallback: store in localStorage
  const servers = JSON.parse(localStorage.getItem("mcp_servers") || "{}");
  servers[name] = { name, command, args, env };
  localStorage.setItem("mcp_servers", JSON.stringify(servers));
}

export async function unregisterServer(name: string): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_unregister_server", { name });
  }
  
  // Fallback: remove from localStorage
  const servers = JSON.parse(localStorage.getItem("mcp_servers") || "{}");
  delete servers[name];
  localStorage.setItem("mcp_servers", JSON.stringify(servers));
}

export async function startServer(name: string): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_start_server", { name });
  }
  
  // Fallback: no-op, can't start servers without Tauri
  console.warn("Unable to start server in this build");
}

export async function stopServer(name: string): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_stop_server", { name });
  }
  
  // Fallback: no-op, can't stop servers without Tauri
  console.warn("Unable to stop server in this build");
}

export async function getServers(): Promise<McpServerConfig[]> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_get_servers");
  }
  
  // Fallback: get from localStorage
  const servers = JSON.parse(localStorage.getItem("mcp_servers") || "{}");
  return Object.values(servers);
}

export async function testConnection(url: string): Promise<boolean> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_test_connection", { url });
  }
  
  // Fallback: simplified test via fetch
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.error('Error testing connection:', error);
    return false;
  }
}

export async function discoverServers(path?: string): Promise<McpServerConfig[]> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_discover_servers", { path });
  }
  
  // Fallback: try some common local endpoints
  const commonEndpoints = [
    "http://localhost:11434",
    "http://localhost:8000",
    "http://localhost:8080",
  ];
  
  const foundServers: McpServerConfig[] = [];
  
  for (let i = 0; i < commonEndpoints.length; i++) {
    const url = commonEndpoints[i];
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      });
      
      if (response.ok) {
        foundServers.push({
          name: `discovered-${i}`,
          command: url,
          args: [],
          env: {}
        });
      }
    } catch (e) {
      // Ignore connection errors
    }
  }
  
  return foundServers;
}

export async function getServerStatus(): Promise<McpServerStatus[]> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_get_server_status");
  }
  
  // Fallback: create statuses based on localStorage
  const servers = JSON.parse(localStorage.getItem("mcp_servers") || "{}");
  const statuses: McpServerStatus[] = [];
  
  for (const [name, server] of Object.entries(servers)) {
    const serverConfig = server as McpServerConfig;
    let isRunning = false;
    
    // Check if the server is running by trying to connect
    if (serverConfig.command.startsWith('http://') || serverConfig.command.startsWith('https://')) {
      try {
        const response = await fetch(serverConfig.command, {
          signal: AbortSignal.timeout(1000),
        });
        isRunning = response.ok;
      } catch (e) {
        isRunning = false;
      }
    }
    
    statuses.push({
      name: serverConfig.name,
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env,
      is_running: isRunning,
      url: serverConfig.command.startsWith('http') ? serverConfig.command : undefined,
    });
  }
  
  return statuses;
}

// MCP tools
export async function listTools(serverName: string): Promise<ListToolsResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_list_tools", { serverName });
  }
  
  // Fallback: no tools available
  return { tools: [] };
}

export async function callTool(
  serverName: string,
  toolName: string,
  args?: any
): Promise<CallToolResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_call_tool", { serverName, toolName, args });
  }
  
  // Fallback: error message
  return {
    is_error: true,
    content: [
      {
        type: "text",
        text: "Tool execution is not available in this build. Please rebuild with process-command-api feature enabled."
      }
    ]
  };
}

// MCP resources
export async function listResources(serverName: string): Promise<ListResourcesResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_list_resources", { serverName });
  }
  
  // Fallback: no resources available
  return { resources: [] };
}

export async function readResource(
  serverName: string,
  uri: string
): Promise<ReadResourceResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_read_resource", { serverName, uri });
  }
  
  // Fallback: error message
  return {
    content: [
      {
        type: "text",
        text: "Resource reading is not available in this build. Please rebuild with process-command-api feature enabled."
      }
    ]
  };
}

// MCP prompts
export async function listPrompts(serverName: string): Promise<ListPromptsResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_list_prompts", { serverName });
  }
  
  // Fallback: no prompts available
  return { prompts: [] };
}

export async function getPrompt(
  serverName: string,
  promptId: string,
  params?: any
): Promise<GetPromptResult> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_get_prompt", { serverName, promptId, params });
  }
  
  // Fallback: error message
  return {
    content: [
      {
        type: "text",
        text: "Prompt retrieval is not available in this build. Please rebuild with process-command-api feature enabled."
      }
    ]
  };
}

// Configuration saving/loading
export async function saveConfig(): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_save_config");
  }
  
  // Already saved to localStorage in other methods
}

export async function loadConfig(): Promise<void> {
  if (await checkMcpEnabled()) {
    return invoke("mcp_load_config");
  }
  
  // Already loaded from localStorage in other methods
}
