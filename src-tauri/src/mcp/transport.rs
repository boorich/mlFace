use crate::mcp::types::{JsonRpcMessage, McpError};
use async_trait::async_trait;
use eventsource_stream::Eventsource;
use futures::{
    channel::mpsc,
    SinkExt, StreamExt,
};
use reqwest::Client as HttpClient;
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child as TokioChild, Command as TokioCommand},
    sync::{mpsc as tokio_mpsc, oneshot},
    time::timeout,
};
use std::process::Stdio;

const TRANSPORT_TIMEOUT: Duration = Duration::from_secs(30);

#[async_trait]
pub trait Transport: Send + Sync {
    async fn send(&self, message: JsonRpcMessage) -> Result<(), McpError>;
    async fn receive(&self) -> Result<JsonRpcMessage, McpError>;
    async fn close(&self) -> Result<(), McpError>;
}

/// Stdio transport that uses a spawned process
pub struct StdioTransport {
    child: Arc<Mutex<Option<TokioChild>>>,
    input_tx: tokio_mpsc::Sender<String>,
    shutdown_tx: tokio_mpsc::Sender<()>,
    receive_tx: tokio_mpsc::Sender<oneshot::Sender<Result<JsonRpcMessage, McpError>>>,
}

impl StdioTransport {
    pub async fn new(command: &str, args: Vec<&str>) -> Result<Self, McpError> {
        // In Tauri 2.0, we don't rely on feature flags for this functionality
        // Creating a shim to handle process operations in a cross-platform way
        {
            log::warn!("Creating process in Tauri 2.0 compatibility mode");
            let mut cmd = TokioCommand::new(command);
            cmd.args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| {
                McpError::TransportError(format!("Failed to spawn process: {}", e))
            })?;

            let stdin = child.stdin.take().ok_or_else(|| {
                McpError::TransportError("Failed to open stdin".to_string())
            })?;

            let stdout = child.stdout.take().ok_or_else(|| {
                McpError::TransportError("Failed to open stdout".to_string())
            })?;

            let stderr = child.stderr.take().ok_or_else(|| {
                McpError::TransportError("Failed to open stderr".to_string())
            })?;

            let (message_tx, _message_rx) = mpsc::channel::<JsonRpcMessage>(100);
            let (shutdown_tx, mut shutdown_rx) = tokio_mpsc::channel(1);
            let (input_tx, mut input_rx) = tokio_mpsc::channel::<String>(100);
            
            // For the receive operation (tokio oneshot channels)
            let (receive_tx, mut receive_rx) = tokio_mpsc::channel::<oneshot::Sender<Result<JsonRpcMessage, McpError>>>(10);
            
            let child_arc = Arc::new(Mutex::new(Some(child)));
            let child_clone = child_arc.clone();

            // Spawn a task to handle stdin writes
            tokio::spawn(async move {
                let mut stdin = stdin;
                while let Some(data) = input_rx.recv().await {
                    if let Err(e) = stdin.write_all(data.as_bytes()).await {
                        eprintln!("Error writing to stdin: {}", e);
                        break;
                    }
                }
            });

            // Spawn a task to read messages from the process's stdout
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                let mut stderr_reader = BufReader::new(stderr).lines();
                
                // List of pending receive requests
                let mut receivers: Vec<oneshot::Sender<Result<JsonRpcMessage, McpError>>> = Vec::new();
                
                loop {
                    tokio::select! {
                        _ = shutdown_rx.recv() => {
                            break;
                        }
                        
                        // Check for new receive requests
                        Some(response_tx) = receive_rx.recv() => {
                            receivers.push(response_tx);
                        }
                        
                        // Read stdout
                        line = reader.next_line() => {
                            match line {
                                Ok(Some(line)) => {
                                    match serde_json::from_str::<JsonRpcMessage>(&line) {
                                        Ok(message) => {
                                            // Respond to the next waiting receiver if any
                                            if let Some(tx) = receivers.pop() {
                                                let _ = tx.send(Ok(message));
                                            } else {
                                                // Buffer the message if no one is waiting
                                                if message_tx.clone().send(message).await.is_err() {
                                                    break;
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Error parsing JSON-RPC message: {}", e);
                                        }
                                    }
                                }
                                Ok(None) => {
                                    // EOF
                                    break;
                                }
                                Err(e) => {
                                    eprintln!("Error reading from stdout: {}", e);
                                    break;
                                }
                            }
                        }
                        
                        // Read stderr
                        stderr_line = stderr_reader.next_line() => {
                            if let Ok(Some(line)) = stderr_line {
                                eprintln!("Process stderr: {}", line);
                            }
                        }
                    }
                }
                
                // Kill the process - we need to handle this carefully to avoid Send issues
                let child_clone2 = child_clone.clone();
                tokio::task::spawn_blocking(move || {
                    if let Ok(mut guard) = child_clone2.lock() {
                        if let Some(child) = guard.take() {
                            // Blocking kill to avoid Send issues
                            std::process::Command::new("kill")
                                .arg(child.id().unwrap_or(0).to_string())
                                .output()
                                .ok();
                        }
                    }
                });
            });

            return Ok(Self {
                child: child_arc,
                input_tx,
                shutdown_tx,
                receive_tx,
            });
        }
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&self, message: JsonRpcMessage) -> Result<(), McpError> {
        let json = serde_json::to_string(&message)
            .map_err(|e| McpError::TransportError(format!("JSON serialization error: {}", e)))?;
        
        // Add a newline to the message
        let formatted_json = format!("{}\n", json);
        
        // Send to the stdin channel
        self.input_tx.send(formatted_json).await.map_err(|e| {
            McpError::TransportError(format!("Failed to send message to stdin: {}", e))
        })?;
        
        Ok(())
    }

    async fn receive(&self) -> Result<JsonRpcMessage, McpError> {
        // Create a oneshot channel for this receive operation
        let (tx, rx) = oneshot::channel();
        
        // Send the transmitter to the message processing task
        self.receive_tx.send(tx).await.map_err(|_| {
            McpError::TransportError("Failed to send receive request".to_string())
        })?;
        
        // Wait for response with timeout
        timeout(TRANSPORT_TIMEOUT, rx).await
            .map_err(|_| McpError::TimeoutError)?
            .map_err(|_| McpError::ConnectionClosed)?
    }

    async fn close(&self) -> Result<(), McpError> {
        // Signal the reader task to shut down
        if let Err(e) = self.shutdown_tx.send(()).await {
            eprintln!("Failed to send shutdown signal: {}", e);
        }
        
        // Kill the process with a blocking task to avoid Send issues
        let child_arc = self.child.clone();
        tokio::task::spawn_blocking(move || {
            if let Ok(mut guard) = child_arc.lock() {
                if let Some(child) = guard.take() {
                    // Use blocking kill to avoid Send issues
                    std::process::Command::new("kill")
                        .arg(child.id().unwrap_or(0).to_string())
                        .output()
                        .ok(); // Ignore any errors
                }
            }
            
            Ok(())
        }).await.map_err(|e| {
            McpError::TransportError(format!("Task join error: {}", e))
        })?
    }
}

/// HTTP/SSE transport that uses Server-Sent Events for server-to-client communication
/// and HTTP POST for client-to-server communication
pub struct SseTransport {
    http_client: HttpClient,
    base_url: String,
    shutdown_tx: tokio_mpsc::Sender<()>,
    receive_tx: tokio_mpsc::Sender<oneshot::Sender<Result<JsonRpcMessage, McpError>>>,
}

impl SseTransport {
    pub async fn new(url: &str) -> Result<Self, McpError> {
        let http_client = HttpClient::builder()
            .timeout(TRANSPORT_TIMEOUT)
            .build()
            .map_err(|e| McpError::TransportError(format!("Failed to create HTTP client: {}", e)))?;
        
        let (shutdown_tx, mut shutdown_rx) = tokio_mpsc::channel(1);
        let (receive_tx, mut receive_rx) = tokio_mpsc::channel::<oneshot::Sender<Result<JsonRpcMessage, McpError>>>(10);
        
        let url_clone = url.to_string();
        let http_client_clone = http_client.clone();
        
        // Spawn a task to read SSE events
        tokio::spawn(async move {
            let mut retry_delay = Duration::from_millis(100);
            let max_retry_delay = Duration::from_secs(5);
            let mut receivers: Vec<oneshot::Sender<Result<JsonRpcMessage, McpError>>> = Vec::new();
            
            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                    
                    // Check for new receive requests
                    Some(response_tx) = receive_rx.recv() => {
                        receivers.push(response_tx);
                    }
                    
                    _ = async {
                        let response = match http_client_clone.get(&url_clone).send().await {
                            Ok(res) => res,
                            Err(e) => {
                                eprintln!("Failed to connect to SSE endpoint: {}", e);
                                tokio::time::sleep(retry_delay).await;
                                retry_delay = std::cmp::min(retry_delay * 2, max_retry_delay);
                                return;
                            }
                        };
                        
                        // Reset retry delay on successful connection
                        retry_delay = Duration::from_millis(100);
                        
                        let mut event_stream = response.bytes_stream().eventsource();
                        
                        while let Some(event_result) = event_stream.next().await {
                            match event_result {
                                Ok(event) => {
                                    // event.data contains the data
                                    let data = event.data;
                                    match serde_json::from_str::<JsonRpcMessage>(&data) {
                                        Ok(message) => {
                                            // Respond to the next waiting receiver if any
                                            if let Some(tx) = receivers.pop() {
                                                let _ = tx.send(Ok(message));
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Error parsing SSE JSON-RPC message: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("SSE event error: {}", e);
                                    break;
                                }
                            }
                        }
                        
                        // If we got here, the connection was closed - attempt to reconnect
                        tokio::time::sleep(retry_delay).await;
                        retry_delay = std::cmp::min(retry_delay * 2, max_retry_delay);
                    } => {}
                }
            }
        });

        Ok(Self {
            http_client,
            base_url: url.to_string(),
            shutdown_tx,
            receive_tx,
        })
    }
}

#[async_trait]
impl Transport for SseTransport {
    async fn send(&self, message: JsonRpcMessage) -> Result<(), McpError> {
        let json = serde_json::to_string(&message)
            .map_err(|e| McpError::TransportError(format!("JSON serialization error: {}", e)))?;
        
        // Determine the endpoint for POST requests
        let post_url = if self.base_url.ends_with("/sse") {
            self.base_url.replace("/sse", "/messages")
        } else {
            // Default to /messages if not specified
            format!("{}/messages", self.base_url.trim_end_matches('/'))
        };
        
        let response = self.http_client
            .post(&post_url)
            .header("Content-Type", "application/json")
            .body(json)
            .send()
            .await
            .map_err(|e| McpError::TransportError(format!("HTTP request failed: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(McpError::TransportError(
                format!("HTTP error: {}", response.status())
            ));
        }
        
        Ok(())
    }

    async fn receive(&self) -> Result<JsonRpcMessage, McpError> {
        // Create a oneshot channel for this receive operation
        let (tx, rx) = oneshot::channel();
        
        // Send the transmitter to the message processing task
        self.receive_tx.send(tx).await.map_err(|_| {
            McpError::TransportError("Failed to send receive request".to_string())
        })?;
        
        // Wait for response with timeout
        timeout(TRANSPORT_TIMEOUT, rx).await
            .map_err(|_| McpError::TimeoutError)?
            .map_err(|_| McpError::ConnectionClosed)?
    }

    async fn close(&self) -> Result<(), McpError> {
        // Signal the reader task to shut down
        if let Err(e) = self.shutdown_tx.send(()).await {
            eprintln!("Failed to send shutdown signal: {}", e);
        }
        
        Ok(())
    }
}
