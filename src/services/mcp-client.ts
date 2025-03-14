/**
 * MCP Client implementation for mlFace
 * 
 * This file provides a lightweight wrapper around the MCP SDK's Client class
 * to handle connecting to MCP servers and making requests.
 */

// Import from the SDK's subpaths as specified in its exports field
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CompleteParams, CompleteResult } from '@modelcontextprotocol/sdk/types.js';
import type { Message, MCPModel } from '../types';

/**
 * Creates an HTTP transport for the MCP client
 * 
 * This implements the Transport interface from the MCP SDK
 */
function createHttpTransport(endpoint: string) {
  return {
    // Implements the Transport interface from MCP SDK
    async send(data: string): Promise<string> {
      try {
        const response = await fetch(`${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP error ${response.status}: ${errorText || response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        console.error('Transport error:', error);
        throw error;
      }
    },
    
    // Required by the MCP Client
    async start() {
      console.log('Starting HTTP transport to:', endpoint);
      // For HTTP transport, we don't need to do anything special to start
      // This just confirms the transport is ready to use
      return Promise.resolve();
    },
    
    close() {
      // Nothing to clean up for fetch-based transport
      console.log('Closing HTTP transport to:', endpoint);
    },
    
    // These will be set by the Client
    onmessage: undefined,
    onclose: undefined,
    onerror: undefined,
  };
}

// Cache MCP clients to avoid creating new ones for each request
const clientCache = new Map<string, Client>();

/**
 * Get or create an MCP client for the given endpoint
 */
async function getMCPClient(endpoint: string): Promise<Client> {
  // Return cached client if available
  if (clientCache.has(endpoint)) {
    return clientCache.get(endpoint)!;
  }
  
  // Create a new client
  const client = new Client(
    // Client info
    {
      name: 'mlFace',
      version: '0.1.0',
    },
    // Client options
    {
      capabilities: {
        prompts: true,
      },
    }
  );
  
  // Create and connect transport
  const transport = createHttpTransport(endpoint);
  await client.connect(transport);
  
  // Cache and return client
  clientCache.set(endpoint, client);
  return client;
}

/**
 * Test connection to an MCP server
 */
export async function testMCPConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
  try {
    // Validate URL format
    try {
      new URL(endpoint);
    } catch {
      return { success: false, message: 'Invalid URL format' };
    }
    
    // Try to connect with a timeout
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), 5000);
    });
    
    const connectionPromise = (async () => {
      try {
        // Create client
        const client = new Client(
          { name: 'mlFace-test', version: '0.1.0' },
          { capabilities: { prompts: true } }
        );
        
        // Connect with transport
        await client.connect(createHttpTransport(endpoint));
        
        // Get capabilities
        const capabilities = client.getServerCapabilities();
        const hasPrompts = capabilities?.prompts || false;
        
        // Try to get model list
        let modelCount = 0;
        try {
          if (hasPrompts) {
            const result = await client.listPrompts({});
            modelCount = result.prompts.length;
          }
        } catch (e) {
          console.warn('Failed to list prompts:', e);
        }
        
        // Close connection
        await client.close();
        
        return {
          success: true,
          message: `Connection successful. Found ${modelCount} models.`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    })();
    
    // Race between connection and timeout
    return await Promise.race([connectionPromise, timeoutPromise]);
    
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    
    if (error instanceof Error && error.message === 'Connection timed out') {
      return { success: false, message: 'Connection timed out' };
    }
    
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
        // Try to ping the server with a short timeout
        const pingResponse = await fetch(`${endpoint}`, {
          signal: AbortSignal.timeout(1000), // 1 second timeout
        });
        
        if (pingResponse.ok) {
          return endpoint;
        }
        
        // Fallback to testing with our connection method
        const testResult = await testMCPConnection(endpoint);
        if (testResult.success) {
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
  try {
    // Get client
    const client = await getMCPClient(endpoint);
    
    // List prompts (models)
    const promptsResult = await client.listPrompts({});
    
    // Map prompts to our model format
    return promptsResult.prompts.map(prompt => ({
      id: `mcp-${endpoint}-${prompt.id || prompt.name}`,
      name: prompt.name || prompt.id || 'Unknown Model',
      provider: 'mcp' as const,
      endpoint,
      contextLength: 4096, // Default value if not specified
      capabilities: [],
    }));
  } catch (error) {
    console.error('Error fetching MCP models:', error);
    throw error;
  }
}

/**
 * Send a message to an MCP server
 */
export async function sendMCPMessage(
  endpoint: string,
  messages: Message[],
  modelId?: string
): Promise<string> {
  try {
    // Get client
    const client = await getMCPClient(endpoint);
    
    // Extract the actual model ID if provided (remove the prefix and endpoint)
    const actualModelId = modelId ? modelId.replace(`mcp-${endpoint}-`, '') : undefined;
    
    // Convert messages to the format expected by the MCP SDK
    const mcpMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    // Create completion params
    const params: CompleteParams = {
      messages: mcpMessages,
    };
    
    // Add model if specified
    if (actualModelId) {
      params.model = actualModelId;
    }
    
    // Make completion request
    const response = await client.complete(params);
    
    // Return the content of the response
    if (!response || !response.message) {
      throw new Error('Invalid response from MCP server: missing message');
    }
    
    return response.message.content;
  } catch (error) {
    console.error('Error sending message to MCP server:', error);
    throw error;
  }
}
