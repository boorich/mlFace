use crate::mcp::types::*;
use crate::mcp::transport::Transport;
use futures::channel::oneshot;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::Mutex as TokioMutex;
use tokio::time::{timeout, Duration};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

/// The MCP client that handles the protocol communication
pub struct McpClient {
    transport: Arc<dyn Transport>,
    next_id: AtomicU64,
    pending_requests: Arc<Mutex<HashMap<String, oneshot::Sender<Result<JsonRpcResponse, McpError>>>>>,
    server_info: Arc<TokioMutex<Option<InitializeResult>>>,
    client_name: String,
    client_version: String,
}

impl McpClient {
    pub async fn new(
        transport: Arc<dyn Transport>, 
        client_name: &str, 
        client_version: &str
    ) -> Result<Self, McpError> {
        let client = Self {
            transport,
            next_id: AtomicU64::new(1),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            server_info: Arc::new(TokioMutex::new(None)),
            client_name: client_name.to_string(),
            client_version: client_version.to_string(),
        };
        
        // Spawn a task to handle incoming messages
        client.start_message_handler();
        
        Ok(client)
    }
    
    /// Initialize the connection with the server
    pub async fn initialize(&self) -> Result<InitializeResult, McpError> {
        // If we already have server info, return it
        {
            let server_info = self.server_info.lock().await;
            if let Some(ref info) = *server_info {
                return Ok(info.clone());
            }
        }
        
        // Create initialize request
        let params = InitializeParams {
            protocol_version: MCP_PROTOCOL_VERSION.to_string(),
            name: self.client_name.clone(),
            version: self.client_version.clone(),
            capabilities: ClientCapabilities {
                resources: Some(ResourcesClientCapabilities::default()),
                tools: Some(ToolsClientCapabilities::default()),
                prompts: Some(PromptsClientCapabilities::default()),
                sampling: Some(SamplingClientCapabilities::default()),
            },
        };
        
        // Send initialize request
        let params_value = serde_json::to_value(params).map_err(|e| McpError::from(e))?;
        let result: Value = self.send_request("initialize", Some(params_value)).await?;
        
        // Parse and store result
        let server_info: InitializeResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        *self.server_info.lock().await = Some(server_info.clone());
        
        // Send initialized notification
        self.send_notification("initialized", None).await?;
        
        Ok(server_info)
    }
    
    /// Get available tools from the server
    pub async fn list_tools(&self) -> Result<ListToolsResult, McpError> {
        let result: Value = self.send_request("tools/list", None).await?;
        let tools: ListToolsResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(tools)
    }
    
    /// Call a tool on the server
    pub async fn call_tool(&self, name: &str, arguments: Option<Value>) -> Result<CallToolResult, McpError> {
        let params = CallToolParams {
            name: name.to_string(),
            arguments,
        };
        
        let params_value = serde_json::to_value(params).map_err(|e| McpError::from(e))?;
        let result: Value = self.send_request("tools/call", Some(params_value)).await?;
        let call_result: CallToolResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(call_result)
    }
    
    /// List available resources on the server
    pub async fn list_resources(&self) -> Result<ListResourcesResult, McpError> {
        let result: Value = self.send_request("resources/list", None).await?;
        let resources: ListResourcesResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(resources)
    }
    
    /// Read a resource from the server
    pub async fn read_resource(&self, uri: &str) -> Result<ReadResourceResult, McpError> {
        let params = ReadResourceParams {
            uri: uri.to_string(),
        };
        
        let params_value = serde_json::to_value(params).map_err(|e| McpError::from(e))?;
        let result: Value = self.send_request("resources/read", Some(params_value)).await?;
        let read_result: ReadResourceResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(read_result)
    }
    
    /// List available prompts on the server
    pub async fn list_prompts(&self) -> Result<ListPromptsResult, McpError> {
        let result: Value = self.send_request("prompts/list", None).await?;
        let prompts: ListPromptsResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(prompts)
    }
    
    /// Get a prompt from the server
    pub async fn get_prompt(&self, id: &str, parameters: Option<Value>) -> Result<GetPromptResult, McpError> {
        let params = GetPromptParams {
            id: id.to_string(),
            parameters,
        };
        
        let params_value = serde_json::to_value(params).map_err(|e| McpError::from(e))?;
        let result: Value = self.send_request("prompts/get", Some(params_value)).await?;
        let prompt_result: GetPromptResult = serde_json::from_value(result).map_err(|e| McpError::from(e))?;
        Ok(prompt_result)
    }
    
    /// Close the connection gracefully
    pub async fn close(&self) -> Result<(), McpError> {
        // Send shutdown request
        self.send_request::<Value>("shutdown", None).await?;
        
        // Send exit notification
        self.send_notification("exit", None).await?;
        
        // Close transport
        self.transport.close().await
    }
    
    /// Generate a unique request ID
    fn next_id(&self) -> String {
        self.next_id.fetch_add(1, Ordering::SeqCst).to_string()
    }
    
    /// Send a request and wait for response
    async fn send_request<T: for<'de> serde::Deserialize<'de>>(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<T, McpError> {
        let id = self.next_id();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: serde_json::Value::String(id.clone()),
            method: method.to_string(),
            params,
        };
        
        let (tx, rx) = oneshot::channel();
        
        // Register the request
        {
            let mut pending = self.pending_requests.lock().map_err(|e| {
                McpError::InternalError(format!("Failed to lock pending_requests: {}", e))
            })?;
            pending.insert(id.clone(), tx);
        }
        
        // Send the request
        self.transport.send(JsonRpcMessage::Request(request)).await?;
        
        // Wait for response with timeout
        let response = match timeout(REQUEST_TIMEOUT, rx).await {
            Ok(result) => match result {
                Ok(response) => response,
                Err(_) => return Err(McpError::InternalError("Response channel closed".to_string())),
            },
            Err(_) => {
                // Clean up the pending request
                let mut pending = self.pending_requests.lock().map_err(|e| {
                    McpError::InternalError(format!("Failed to lock pending_requests: {}", e))
                })?;
                pending.remove(&id);
                
                return Err(McpError::TimeoutError);
            }
        }?;
        
        // Extract result
        if let Some(error) = response.error {
            return Err(McpError::ProtocolError(format!("Error {}: {}", error.code, error.message)));
        }
        
        if let Some(result) = response.result {
            match serde_json::from_value(result) {
                Ok(value) => Ok(value),
                Err(e) => Err(McpError::ParseError(format!("Failed to parse result: {}", e))),
            }
        } else {
            Err(McpError::ProtocolError("Response missing result".to_string()))
        }
    }
    
    /// Send a notification (one-way message)
    async fn send_notification(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), McpError> {
        let notification = JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };
        
        self.transport.send(JsonRpcMessage::Notification(notification)).await
    }
    
    /// Start a background task to handle incoming messages
    fn start_message_handler(&self) {
        let transport = self.transport.clone();
        let pending_requests = self.pending_requests.clone();
        
        tokio::spawn(async move {
            loop {
                match transport.receive().await {
                    Ok(message) => {
                        match message {
                            JsonRpcMessage::Response(response) => {
                                // Get the request ID
                                let id = match &response.id {
                                    Value::String(s) => s.clone(),
                                    Value::Number(n) => n.to_string(),
                                    _ => {
                                        eprintln!("Invalid response ID type");
                                        continue;
                                    }
                                };
                                
                                // Find and complete the pending request
                                let sender = {
                                    let mut pending = match pending_requests.lock() {
                                        Ok(guard) => guard,
                                        Err(e) => {
                                            eprintln!("Failed to lock pending_requests: {}", e);
                                            continue;
                                        }
                                    };
                                    
                                    pending.remove(&id)
                                };
                                
                                if let Some(sender) = sender {
                                    let _ = sender.send(Ok(response));
                                } else {
                                    eprintln!("Received response for unknown request ID: {}", id);
                                }
                            }
                            JsonRpcMessage::Notification(notification) => {
                                // TODO: Handle server notifications
                                match notification.method.as_str() {
                                    // Handle specific notifications
                                    _ => {}
                                }
                            }
                            _ => {
                                // Ignore other message types
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Error receiving message: {}", e);
                        
                        // If connection was closed, complete all pending requests with error
                        if matches!(e, McpError::ConnectionClosed) {
                            let mut pending = match pending_requests.lock() {
                                Ok(guard) => guard,
                                Err(e) => {
                                    eprintln!("Failed to lock pending_requests: {}", e);
                                    break;
                                }
                            };
                            
                            for (_, sender) in pending.drain() {
                                let _ = sender.send(Err(McpError::ConnectionClosed));
                            }
                            
                            break;
                        }
                    }
                }
            }
        });
    }
}
