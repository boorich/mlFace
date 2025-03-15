// MCP integration module
mod mcp;
use tauri::Manager;

// Re-export the MCP commands for use in the app
use mcp::commands::*;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Setup the MCP config directory
            let app_data_dir_result = app.path().app_data_dir();
            if let Ok(app_data_dir) = app_data_dir_result {
                let config_dir = app_data_dir.join("config");
                let server_config_path = config_dir.join("mcp_servers.json");
                
                // Create config directory if it doesn't exist
                if !config_dir.exists() {
                    let _ = std::fs::create_dir_all(&config_dir); // Ignore error
                }
                
                // Create an empty server config file if it doesn't exist yet
                if !server_config_path.exists() {
                    let empty_config = serde_json::json!({});
                    let _ = std::fs::write(&server_config_path, empty_config.to_string()); // Ignore error
                }
                
                // Set MCP_CONFIG_PATH environment variable for the Rust backend to access
                std::env::set_var("MCP_CONFIG_PATH", server_config_path.to_string_lossy().to_string());
            }
            Ok(())
        });
        
    // Register MCP commands
    builder = builder.invoke_handler(tauri::generate_handler![
        mcp_register_server,
        mcp_unregister_server,
        mcp_start_server,
        mcp_stop_server,
        mcp_get_servers,
        mcp_test_connection,
        mcp_discover_servers,
        mcp_list_tools,
        mcp_call_tool,
        mcp_list_resources,
        mcp_read_resource,
        mcp_list_prompts,
        mcp_get_prompt,
        mcp_get_server_status,
        mcp_save_config,
        mcp_load_config
    ]);
    
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
