// unused import: use crate::mcp::types::*;
use crate::mcp::transport::{StdioTransport, SseTransport, Transport};
use crate::mcp::client::McpClient;
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::{Child, Command};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::sync::RwLock;

/// Configuration for an MCP server
#[derive(Debug, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(skip)]
    pub process: Option<Child>,
}

impl Clone for McpServerConfig {
    fn clone(&self) -> Self {
        Self {
            name: self.name.clone(),
            command: self.command.clone(),
            args: self.args.clone(),
            env: self.env.clone(),
            process: None, // Don't clone the process
        }
    }
}

/// Manager for MCP servers
pub struct McpServerManager {
    servers: RwLock<HashMap<String, McpServerConfig>>,
    clients: RwLock<HashMap<String, Arc<McpClient>>>,
}

impl McpServerManager {
    pub fn new() -> Self {
        Self {
            servers: RwLock::new(HashMap::new()),
            clients: RwLock::new(HashMap::new()),
        }
    }
    
    /// Register a new server configuration
    pub async fn register_server(&self, config: McpServerConfig) -> Result<()> {
        let mut servers = self.servers.write().await;
        servers.insert(config.name.clone(), config);
        Ok(())
    }
    
    /// Unregister a server
    pub async fn unregister_server(&self, name: &str) -> Result<()> {
        // Stop the server if running
        self.stop_server(name).await?;
        
        // Remove from registry
        let mut servers = self.servers.write().await;
        servers.remove(name);
        
        // Remove client if exists
        let mut clients = self.clients.write().await;
        clients.remove(name);
        
        Ok(())
    }
    
    /// Start an MCP server by name
    pub async fn start_server(&self, name: &str) -> Result<()> {
        // Get the server configuration
        let mut servers = self.servers.write().await;
        let config = servers.get_mut(name).ok_or_else(|| {
            anyhow::anyhow!("Server {} not found", name)
        })?;
        
        // Don't start if already running
        if config.process.is_some() {
            return Ok(());
        }
        
        // Tauri 2.0 compatibility mode
        {
            log::warn!("Starting process in Tauri 2.0 compatibility mode");
            // Prepare the command
            let mut cmd = Command::new(&config.command);
            cmd.args(&config.args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            
            // Add environment variables
            for (key, value) in &config.env {
                cmd.env(key, value);
            }
            
            // Start the process
            let child = cmd.spawn()?;
            config.process = Some(child);
        }
        
        Ok(())
    }
    
    /// Stop an MCP server by name
    pub async fn stop_server(&self, name: &str) -> Result<()> {
        // Remove the client first
        {
            let mut clients = self.clients.write().await;
            if let Some(client) = clients.remove(name) {
                // Try to close gracefully
                let _ = client.close().await;
            }
        }
        
        // Then stop the process
        let mut servers = self.servers.write().await;
        if let Some(config) = servers.get_mut(name) {
            // Tauri 2.0 compatibility mode
            if let Some(mut child) = config.process.take() {
                let _ = child.kill().await;
            }
        }
        
        Ok(())
    }
    
    /// Get or create a client for a server
    pub async fn get_client(&self, name: &str) -> Result<Arc<McpClient>> {
        // Check if we already have a client
        {
            let clients = self.clients.read().await;
            if let Some(client) = clients.get(name) {
                return Ok(client.clone());
            }
        }
        
        // Get the server configuration
        let servers = self.servers.read().await;
        let config = servers.get(name).ok_or_else(|| {
            anyhow::anyhow!("Server {} not found", name)
        })?;
        
        // Create the appropriate transport
        let transport = if config.command.starts_with("http://") || config.command.starts_with("https://") {
            // HTTP/SSE transport
            let transport = SseTransport::new(&config.command).await?;
            Arc::new(transport) as Arc<dyn Transport>
        } else {
            // Stdio transport - make sure the server is running
            self.start_server(name).await?;
            
            // Create transport using command and args
            let transport = StdioTransport::new(&config.command, config.args.iter().map(|s| s.as_str()).collect()).await?;
            Arc::new(transport) as Arc<dyn Transport>
        };
        
        // Create the client
        let client = McpClient::new(transport, "mlFace", "1.0.0").await?;
        
        // Initialize the client
        client.initialize().await?;
        
        // Store the client
        let client_arc = Arc::new(client);
        {
            let mut clients = self.clients.write().await;
            clients.insert(name.to_string(), client_arc.clone());
        }
        
        Ok(client_arc)
    }
    
    /// Test a connection to a server
    pub async fn test_connection(&self, url: &str) -> Result<bool> {
        // For HTTP URLs, try to create an SSE transport
        if url.starts_with("http://") || url.starts_with("https://") {
            let transport = SseTransport::new(url).await?;
            let transport_arc = Arc::new(transport) as Arc<dyn Transport>;
            
            // Create a temporary client
            let client = McpClient::new(transport_arc, "mlFace_test", "1.0.0").await?;
            
            // Try to initialize
            match client.initialize().await {
                Ok(_) => {
                    // Clean up
                    let _ = client.close().await;
                    Ok(true)
                }
                Err(e) => {
                    // Clean up
                    let _ = client.close().await;
                    eprintln!("Failed to initialize MCP client: {}", e);
                    Ok(false)
                }
            }
        } else {
            // For local commands, try to execute with --help or -h to see if it exists
            let mut cmd = Command::new(url);
            cmd.arg("--help")
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            
            match cmd.spawn() {
                Ok(_) => Ok(true),
                Err(_) => {
                    // Try with -h
                    let mut cmd = Command::new(url);
                    cmd.arg("-h")
                        .stdout(Stdio::null())
                        .stderr(Stdio::null());
                    
                    match cmd.spawn() {
                        Ok(_) => Ok(true),
                        Err(_) => Ok(false),
                    }
                }
            }
        }
    }
    
    /// Load server configurations from a JSON file
    pub async fn load_from_file(&self, path: &str) -> Result<()> {
        let content = tokio::fs::read_to_string(path).await?;
        let configs: HashMap<String, McpServerConfig> = serde_json::from_str(&content)?;
        
        let mut servers = self.servers.write().await;
        for (name, mut config) in configs {
            config.name = name.clone();
            servers.insert(name, config);
        }
        
        Ok(())
    }
    
    /// Save server configurations to a JSON file
    pub async fn save_to_file(&self, path: &str) -> Result<()> {
        let servers = self.servers.read().await;
        let json = serde_json::to_string_pretty(&*servers)?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }
    
    /// Load server configurations from the default location
    pub async fn load_default_config(&self) -> Result<()> {
        if let Ok(config_path) = std::env::var("MCP_CONFIG_PATH") {
            self.load_from_file(&config_path).await
        } else {
            // No env var set, try default location
            Ok(())
        }
    }

    /// Save server configurations to the default location
    pub async fn save_default_config(&self) -> Result<()> {
        if let Ok(config_path) = std::env::var("MCP_CONFIG_PATH") {
            self.save_to_file(&config_path).await
        } else {
            // No env var set, nothing to do
            Ok(())
        }
    }
    
    /// Get all server configurations
    pub async fn get_servers(&self) -> Vec<McpServerConfig> {
        let servers = self.servers.read().await;
        servers.values().cloned().collect()
    }
    
    /// Discover MCP servers in a directory
    pub async fn discover_servers(&self, dir: &str) -> Result<Vec<McpServerConfig>> {
        let mut configs = Vec::new();
        
        // Read directory
        let entries = tokio::fs::read_dir(dir).await?;
        let mut entry_paths = Vec::new();
        
        // Collect entries
        let mut entries = entries;
        while let Some(entry) = entries.next_entry().await? {
            entry_paths.push(entry.path());
        }
        
        // Process entries
        for path in entry_paths {
            if !path.is_file() {
                continue;
            }
            
            // Check if it's executable
            #[cfg(unix)]
            let is_executable = {
                use std::os::unix::fs::PermissionsExt;
                let metadata = tokio::fs::metadata(&path).await?;
                let permissions = metadata.permissions();
                permissions.mode() & 0o111 != 0
            };
            
            #[cfg(not(unix))]
            let is_executable = path.extension().map_or(false, |ext| {
                ext == "exe" || ext == "bat" || ext == "cmd"
            });
            
            if !is_executable {
                continue;
            }
            
            // Try to test if it's an MCP server
            let path_str = path.to_string_lossy().to_string();
            if self.test_connection(&path_str).await? {
                // Create a server configuration
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                
                configs.push(McpServerConfig {
                    name,
                    command: path_str,
                    args: Vec::new(),
                    env: HashMap::new(),
                    process: None,
                });
            }
        }
        
        Ok(configs)
    }
}

// Singleton instance of the server manager
pub struct McpServerManagerInstance(pub Arc<McpServerManager>);

impl Default for McpServerManagerInstance {
    fn default() -> Self {
        Self(Arc::new(McpServerManager::new()))
    }
}

lazy_static::lazy_static! {
    pub static ref SERVER_MANAGER: McpServerManagerInstance = McpServerManagerInstance::default();
}
