use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP Protocol version
pub const MCP_PROTOCOL_VERSION: &str = "0.1.0";

/// JSON-RPC message types for the MCP protocol
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcMessage {
    Request(JsonRpcRequest),
    Response(JsonRpcResponse),
    Notification(JsonRpcNotification),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: serde_json::Value,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// MCP Initialize request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct InitializeParams {
    pub protocol_version: String,
    pub name: String,
    pub version: String,
    pub capabilities: ClientCapabilities,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourcesClientCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsClientCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<PromptsClientCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sampling: Option<SamplingClientCapabilities>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ResourcesClientCapabilities {}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ToolsClientCapabilities {}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PromptsClientCapabilities {}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SamplingClientCapabilities {}

/// MCP Initialize response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InitializeResult {
    pub protocol_version: String,
    pub name: String,
    pub version: String,
    pub capabilities: ServerCapabilities,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ServerCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourcesServerCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsServerCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<PromptsServerCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sampling: Option<SamplingServerCapabilities>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResourcesServerCapabilities {}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ToolsServerCapabilities {}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PromptsServerCapabilities {}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SamplingServerCapabilities {}

/// MCP Tool types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: serde_json::Value, // JSON Schema
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListToolsResult {
    pub tools: Vec<Tool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CallToolParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Content {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { 
        mime_type: String, 
        data: String 
    },
    #[serde(rename = "embedded_resource")]
    EmbeddedResource { 
        uri: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        properties: Option<HashMap<String, String>> 
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallToolResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    pub content: Vec<Content>,
}

/// MCP Resource types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Resource {
    pub uri: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListResourcesResult {
    pub resources: Vec<Resource>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadResourceParams {
    pub uri: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadResourceResult {
    pub content: Vec<Content>,
}

/// MCP Prompt types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prompt {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_schema: Option<serde_json::Value>, // JSON Schema
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListPromptsResult {
    pub prompts: Vec<Prompt>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPromptParams {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GetPromptResult {
    pub content: Vec<Content>,
}

/// MCP error codes
#[derive(Debug, thiserror::Error)]
pub enum McpError {
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Method not found: {0}")]
    MethodNotFound(String),
    #[error("Invalid params: {0}")]
    InvalidParams(String),
    #[error("Internal error: {0}")]
    InternalError(String),
    #[error("Transport error: {0}")]
    TransportError(String),
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    #[error("Timeout error")]
    TimeoutError,
    #[error("Connection closed")]
    ConnectionClosed,
}

impl McpError {
    pub fn to_code(&self) -> i32 {
        match self {
            McpError::ParseError(_) => -32700,
            McpError::InvalidRequest(_) => -32600,
            McpError::MethodNotFound(_) => -32601,
            McpError::InvalidParams(_) => -32602,
            McpError::InternalError(_) => -32603,
            McpError::TransportError(_) => -32000,
            McpError::ProtocolError(_) => -32001,
            McpError::TimeoutError => -32002,
            McpError::ConnectionClosed => -32003,
        }
    }
}

impl From<serde_json::Error> for McpError {
    fn from(err: serde_json::Error) -> Self {
        Self::ParseError(err.to_string())
    }
}
