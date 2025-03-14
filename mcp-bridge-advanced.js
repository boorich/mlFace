#!/usr/bin/env node
/**
 * Advanced MCP Bridge: HTTP to stdio proxy with proper protocol handling
 * 
 * This script creates an HTTP server that forwards MCP protocol messages
 * to a Docker container running an MCP server in stdio mode.
 * 
 * Usage:
 *   node mcp-bridge-advanced.js --container CONTAINER_NAME --port PORT
 */

const http = require('http');
const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const { randomUUID } = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
let containerName = null;
let port = 11434;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--container' && i + 1 < args.length) {
    containerName = args[i + 1];
    i++;
  } else if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1], 10);
    i++;
  }
}

if (!containerName) {
  console.error('Error: Container name is required');
  console.error('Usage: node mcp-bridge-advanced.js --container CONTAINER_NAME [--port PORT]');
  process.exit(1);
}

// Set up Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Keep track of active connections
const activeConnections = new Map();

// Create a Docker container connection
function createDockerConnection(containerId) {
  console.log(`Creating connection to Docker container: ${containerId}`);
  
  const docker = spawn('docker', ['exec', '-i', containerId, 'cat']);
  
  const connection = {
    id: randomUUID(),
    process: docker,
    messageQueue: [],
    pending: new Map(),
    isReady: false
  };
  
  docker.stdout.on('data', (data) => {
    const text = data.toString();
    console.log(`[${connection.id}] Received from Docker:`, text);
    
    // Process any complete JSON messages
    let remaining = text;
    let jsonStart = remaining.indexOf('{');
    
    while (jsonStart !== -1) {
      // Find the end of the JSON object
      let jsonEnd = -1;
      let depth = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = jsonStart; i < remaining.length; i++) {
        const char = remaining[i];
        
        if (inString) {
          if (char === '\\' && !escaped) {
            escaped = true;
          } else if (char === '"' && !escaped) {
            inString = false;
          } else {
            escaped = false;
          }
        } else if (char === '"') {
          inString = true;
        } else if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd !== -1) {
        const jsonStr = remaining.substring(jsonStart, jsonEnd);
        try {
          const message = JSON.parse(jsonStr);
          
          // Process the message
          if (message.id && connection.pending.has(message.id)) {
            // This is a response to a request
            const { resolve } = connection.pending.get(message.id);
            connection.pending.delete(message.id);
            resolve(message);
          } else if (message.method === 'initialize' && message.id) {
            // This is an initialization request from the server
            // Send a response to initialize the connection
            const response = {
              id: message.id,
              result: {
                protocolVersion: '0.9',
                capabilities: {
                  prompts: {},
                  resources: {},
                  tools: {}
                },
                serverInfo: {
                  name: 'MCP Bridge',
                  version: '1.0.0'
                }
              }
            };
            
            docker.stdin.write(JSON.stringify(response) + '\n');
            connection.isReady = true;
            
            // Process any queued messages
            while (connection.messageQueue.length > 0) {
              const { message, resolve, reject } = connection.messageQueue.shift();
              sendMessage(connection, message).then(resolve).catch(reject);
            }
          }
        } catch (e) {
          console.error(`[${connection.id}] Error parsing JSON:`, e);
        }
        
        // Move to the next potential JSON object
        remaining = remaining.substring(jsonEnd);
        jsonStart = remaining.indexOf('{');
      } else {
        // Incomplete JSON, wait for more data
        break;
      }
    }
  });
  
  docker.stderr.on('data', (data) => {
    console.error(`[${connection.id}] Docker stderr:`, data.toString());
  });
  
  docker.on('error', (error) => {
    console.error(`[${connection.id}] Docker error:`, error.message);
    // Clean up pending requests
    for (const [id, { reject }] of connection.pending.entries()) {
      reject(new Error(`Docker connection error: ${error.message}`));
    }
    connection.pending.clear();
    activeConnections.delete(connection.id);
  });
  
  docker.on('close', (code) => {
    console.log(`[${connection.id}] Docker process exited with code ${code}`);
    // Clean up pending requests
    for (const [id, { reject }] of connection.pending.entries()) {
      reject(new Error(`Docker connection closed with code ${code}`));
    }
    connection.pending.clear();
    activeConnections.delete(connection.id);
  });
  
  // Initialize with empty message to get things started
  docker.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'ping',
    id: randomUUID()
  }) + '\n');
  
  // Store the connection
  activeConnections.set(connection.id, connection);
  
  return connection;
}

// Send a message to the Docker container
async function sendMessage(connection, message) {
  return new Promise((resolve, reject) => {
    if (!connection.isReady) {
      // Queue the message for later
      connection.messageQueue.push({ message, resolve, reject });
      return;
    }
    
    // Add a unique ID to the message
    const id = randomUUID();
    const messageWithId = { ...message, id };
    
    // Store the promise callbacks
    connection.pending.set(id, { resolve, reject });
    
    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (connection.pending.has(id)) {
        connection.pending.delete(id);
        reject(new Error('Timeout waiting for response'));
      }
    }, 30000); // 30 second timeout
    
    // Send the message
    console.log(`[${connection.id}] Sending to Docker:`, JSON.stringify(messageWithId));
    connection.process.stdin.write(JSON.stringify(messageWithId) + '\n');
  });
}

// Get or create a connection
function getConnection() {
  // Use an existing connection if available
  for (const [id, connection] of activeConnections.entries()) {
    if (connection.isReady) {
      return connection;
    }
  }
  
  // Create a new connection
  return createDockerConnection(containerName);
}

// Handle HTTP requests
app.post('/', async (req, res) => {
  console.log('Received HTTP request:', req.body);
  
  try {
    const connection = getConnection();
    const response = await sendMessage(connection, req.body);
    
    console.log('Sending HTTP response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple ping endpoint
app.get('/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  console.log(`Advanced MCP Bridge running on http://localhost:${port}`);
  console.log(`Forwarding requests to Docker container: ${containerName}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  // Close all connections
  for (const [id, connection] of activeConnections.entries()) {
    connection.process.kill();
  }
  
  process.exit(0);
});
