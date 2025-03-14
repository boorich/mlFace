/**
 * MCP Client implementation for mlFace
 * 
 * This file provides functions to connect to MCP servers.
 */

import type { Message, MCPModel } from '../types';

/**
 * Test connection to an MCP server
 */
export async function testMCPConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
  try {
    // Simple endpoint validation
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      return { 
        success: false, 
        message: 'Invalid URL format - must start with http:// or https://' 
      };
    }

    // Try a basic ping
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      return { 
        success: true, 
        message: 'Connection successful' 
      };
    }
    
    return {
      success: false,
      message: `Connection failed with status ${response.status}`
    };
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Discover MCP servers on the local network
 */
export async function discoverMCPServers(): Promise<string[]> {
  // Try common local MCP server addresses
  const potentialEndpoints = [
    'http://localhost:11434',
    'http://localhost:8000',
    'http://localhost:8080',
    'http://localhost:5000',
  ];
  
  const foundEndpoints: string[] = [];
  
  // Test each endpoint in parallel
  const results = await Promise.allSettled(
    potentialEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(1000), // 1 second timeout
        });
        
        if (response.ok) {
          return endpoint;
        }
      } catch {
        // Ignore connection errors
      }
      return null;
    })
  );
  
  // Collect successful endpoints
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      foundEndpoints.push(result.value);
    }
  });
  
  return foundEndpoints;
}

/**
 * Fetch models from an MCP server
 */
export async function fetchMCPModels(endpoint: string): Promise<MCPModel[]> {
  // For now, just return a dummy model for each endpoint
  return [{
    id: `mcp-${endpoint}-default`,
    name: 'Default MCP Model',
    provider: 'mcp' as const,
    endpoint,
    contextLength: 4096,
    capabilities: [],
  }];
}

/**
 * Send a message to an MCP server
 */
export async function sendMCPMessage(
  endpoint: string,
  messages: Message[],
  modelId?: string
): Promise<string> {
  // This is just a placeholder implementation
  try {
    // Simple HTTP-based MCP implementation
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || 'No response from MCP server';
  } catch (error) {
    console.error('Error sending MCP message:', error);
    throw error;
  }
}
