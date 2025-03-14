#!/usr/bin/env node
/**
 * MCP Bridge: HTTP to stdio proxy
 * 
 * This script creates an HTTP server that forwards requests to a Docker container
 * running an MCP server in stdio mode, and returns the responses back to the client.
 * 
 * Usage:
 *   node mcp-bridge.js --container CONTAINER_NAME --port PORT
 */

import http from 'http';
import { spawn } from 'child_process';
import { parse } from 'url';

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
  console.error('Usage: node mcp-bridge.js --container CONTAINER_NAME [--port PORT]');
  process.exit(1);
}

// Function to create a stream from Docker exec
function createDockerStream() {
  console.log(`Connecting to Docker container: ${containerName}`);
  const docker = spawn('docker', ['exec', '-i', containerName, 'sh', '-c', 'cat > /dev/null']);
  
  docker.stdout.on('data', (data) => {
    console.log(`Docker stdout: ${data}`);
  });
  
  docker.stderr.on('data', (data) => {
    console.error(`Docker stderr: ${data}`);
  });
  
  docker.on('error', (error) => {
    console.error(`Docker error: ${error.message}`);
  });
  
  docker.on('close', (code) => {
    console.log(`Docker process exited with code ${code}`);
  });
  
  return docker;
}

// Create an HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // Only handle POST requests for the MCP protocol
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  
  try {
    // Read the request body
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
    
    console.log('Request body:', body);
    
    // Send the request to the Docker container
    const docker = createDockerStream();
    
    // Create a promise to get the response
    const response = await new Promise((resolve, reject) => {
      let output = '';
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for response from Docker container'));
      }, 30000); // 30 second timeout
      
      docker.stdout.on('data', (data) => {
        output += data.toString();
        if (isValidJSON(output)) {
          clearTimeout(timeoutId);
          resolve(output);
        }
      });
      
      docker.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
      
      docker.on('close', (code) => {
        if (code !== 0) {
          clearTimeout(timeoutId);
          reject(new Error(`Docker process exited with code ${code}`));
        }
      });
      
      // Write the request to the Docker container's stdin
      docker.stdin.write(body);
      docker.stdin.end();
    });
    
    console.log('Response:', response);
    
    // Send the response back to the client
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(response);
  } catch (error) {
    console.error('Error processing request:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message }));
  }
});

// Helper function to check if a string is valid JSON
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// Start the server
server.listen(port, () => {
  console.log(`MCP Bridge running on http://localhost:${port}`);
  console.log(`Forwarding requests to Docker container: ${containerName}`);
});
