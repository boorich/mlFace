#!/usr/bin/env node
/**
 * Minimal MCP Bridge: HTTP to stdio proxy with no external dependencies
 * 
 * This script creates an HTTP server that forwards requests to a Docker container
 * running an MCP server in stdio mode.
 * 
 * Usage:
 *   node mcp-bridge-minimal.js --container CONTAINER_NAME --port PORT
 */

import http from 'http';
import { spawn } from 'child_process';

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
  console.error('Usage: node mcp-bridge-minimal.js --container CONTAINER_NAME [--port PORT]');
  process.exit(1);
}

console.log(`Starting MCP bridge for container: ${containerName} on port ${port}`);

// Create an HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Special handling for test connection endpoint
  if (req.method === 'GET' && req.url === '/test') {
    console.log('Received test connection request');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'MCP Bridge is running and connected to container' }));
    return;
  }
  
  // Handle direct test connection with a GET request to root
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    console.log('Received root connection test');
    
    try {
      // Basic test of the docker connection
      const docker = spawn('docker', ['exec', '-i', containerName, 'echo', 'test']);
      let testOutput = '';
      
      docker.stdout.on('data', (data) => {
        testOutput += data.toString();
      });
      
      docker.on('close', (code) => {
        if (code === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Connection successful',
            container: containerName,
            test_output: testOutput.trim()
          }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: `Docker container test failed with code ${code}`,
            container: containerName
          }));
        }
      });
      
      docker.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: err.message,
          container: containerName
        }));
      });
      
      // No need to write to stdin for echo command
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: error.message,
        container: containerName
      }));
    }
    
    return;
  }
  
  // Only handle POST requests for the MCP protocol
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }
  
  // Read the request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    // Improved logging to show full content
    try {
      const parsedRequest = JSON.parse(body);
      console.log('Received request:', JSON.stringify(parsedRequest, null, 2));
    } catch (e) {
      console.log('Received non-JSON request body:', body);
    }
    
    try {
      // Spawn docker exec process
      const docker = spawn('docker', ['exec', '-i', containerName, 'cat']);
      let responseData = '';
      
      // Collect response data
      docker.stdout.on('data', data => {
        const newData = data.toString();
        responseData += newData;
        console.log('Received raw data from container:', newData);
        console.log('Current accumulated response:', responseData);
        
        // Try to parse as JSON when we have complete messages
        try {
          if (responseData.trim().endsWith('}')) {
            // Try to parse it as JSON
            const parsedResponse = JSON.parse(responseData);
            console.log('Successfully parsed complete JSON response:', JSON.stringify(parsedResponse, null, 2));
            
            // Send the response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(responseData);
            
            // Close the process
            docker.kill();
          }
        } catch (e) {
          // Not valid JSON yet, keep collecting
          console.log('Not yet a complete JSON response:', e.message);
        }
      });
      
      // Handle errors
      docker.stderr.on('data', data => {
        console.error(`Docker stderr: ${data}`);
      });
      
      docker.on('error', err => {
        console.error(`Docker process error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Docker error: ${err.message}` }));
      });
      
      // Set a timeout
      const timeout = setTimeout(() => {
        docker.kill();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request timed out' }));
      }, 30000);
      
      docker.on('close', code => {
        clearTimeout(timeout);
        if (code !== 0 && !res.writableEnded) {
          console.error(`Docker process exited with code ${code}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Docker process exited with code ${code}` }));
        }
      });
      
      // Send the request to the container
      docker.stdin.write(body);
      docker.stdin.end();
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`MCP Bridge running at http://localhost:${port}`);
  console.log(`Forwarding requests to Docker container: ${containerName}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
