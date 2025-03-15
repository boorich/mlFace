use crate::mcp::server::{McpServerConfig, SERVER_MANAGER};
use crate::mcp::types::*;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{Runtime, Manager};

/// Command to register an MCP server
#[tauri::command]
pub async fn mcp_register_server(
    name: String,
    command: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let config = McpServerConfig {
        name: name.clone(),
        command,
        args,
        env: env.unwrap_or_default(),
        process: None,
    };
    
    SERVER_MANAGER.0.register_server(config)
        .await
        .map_err(|e| e.to_string())
}

/// Command to unregister an MCP server
#[tauri::command]
pub async fn mcp_unregister_server(name: String) -> Result<(), String> {
    SERVER_MANAGER.0.unregister_server(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Command to start an MCP server
#[tauri::command]
pub async fn mcp_start_server(name: String) -> Result<(), String> {
    SERVER_MANAGER.0.start_server(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Command to stop an MCP server
#[tauri::command]
pub async fn mcp_stop_server(name: String) -> Result<(), String> {
    SERVER_MANAGER.0.stop_server(&name)
        .await
        .map_err(|e| e.to_string())
}

/// Command to get all registered MCP servers
#[tauri::command]
pub async fn mcp_get_servers() -> Result<Vec<McpServerConfig>, String> {
    Ok(SERVER_MANAGER.0.get_servers().await)
}

/// Command to test connection to an MCP server or endpoint
#[tauri::command]
pub async fn mcp_test_connection(url: String) -> Result<bool, String> {
    SERVER_MANAGER.0.test_connection(&url)
        .await
        .map_err(|e| e.to_string())
}

/// Command to discover MCP servers
#[tauri::command]
pub async fn mcp_discover_servers<R: Runtime>(app: tauri::AppHandle<R>, path: Option<String>) -> Result<Vec<McpServerConfig>, String> {
    // If path is None, use default paths
    let search_path = if let Some(p) = path {
        p
    } else {
        // Use the app handle's environment path
        let app_dir = app.path().app_data_dir()
            .map_err(|e| e.to_string())?;
        
        app_dir.to_string_lossy().to_string()
    };
    
    SERVER_MANAGER.0.discover_servers(&search_path)
        .await
        .map_err(|e| e.to_string())
}

/// Command to list tools from an MCP server
#[tauri::command]
pub async fn mcp_list_tools(server_name: String) -> Result<ListToolsResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.list_tools()
        .await
        .map_err(|e| e.to_string())
}

/// Command to call a tool on an MCP server
#[tauri::command]
pub async fn mcp_call_tool(server_name: String, tool_name: String, args: Option<Value>) -> Result<CallToolResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.call_tool(&tool_name, args)
        .await
        .map_err(|e| e.to_string())
}

/// Command to list resources from an MCP server
#[tauri::command]
pub async fn mcp_list_resources(server_name: String) -> Result<ListResourcesResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.list_resources()
        .await
        .map_err(|e| e.to_string())
}

/// Command to read a resource from an MCP server
#[tauri::command]
pub async fn mcp_read_resource(server_name: String, uri: String) -> Result<ReadResourceResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.read_resource(&uri)
        .await
        .map_err(|e| e.to_string())
}

/// Command to list prompts from an MCP server
#[tauri::command]
pub async fn mcp_list_prompts(server_name: String) -> Result<ListPromptsResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.list_prompts()
        .await
        .map_err(|e| e.to_string())
}

/// Command to get a prompt from an MCP server
#[tauri::command]
pub async fn mcp_get_prompt(server_name: String, prompt_id: String, params: Option<Value>) -> Result<GetPromptResult, String> {
    let client = SERVER_MANAGER.0.get_client(&server_name)
        .await
        .map_err(|e| e.to_string())?;
    
    client.get_prompt(&prompt_id, params)
        .await
        .map_err(|e| e.to_string())
}

/// Wrapper type for MCP server configuration with additional connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerStatus {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub is_running: bool,
    pub url: Option<String>,
}

/// Command to get status of all MCP servers
#[tauri::command]
pub async fn mcp_get_server_status() -> Result<Vec<McpServerStatus>, String> {
    let servers = SERVER_MANAGER.0.get_servers().await;
    
    let mut result = Vec::new();
    for server in servers {
        let is_running = SERVER_MANAGER.0.get_client(&server.name).await.is_ok();
        
        // Determine URL for HTTP endpoints
        let url = if server.command.starts_with("http://") || server.command.starts_with("https://") {
            Some(server.command.clone())
        } else {
            None
        };
        
        result.push(McpServerStatus {
            name: server.name,
            command: server.command,
            args: server.args,
            env: server.env,
            is_running,
            url,
        });
    }
    
    Ok(result)
}

/// Command to save MCP server configurations
#[tauri::command]
pub async fn mcp_save_config() -> Result<(), String> {
    SERVER_MANAGER.0.save_default_config()
        .await
        .map_err(|e| e.to_string())
}

/// Command to load MCP server configurations
#[tauri::command]
pub async fn mcp_load_config() -> Result<(), String> {
    SERVER_MANAGER.0.load_default_config()
        .await
        .map_err(|e| e.to_string())
}
