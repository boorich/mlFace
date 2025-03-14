import { MCPClient } from '@modelcontextprotocol/sdk';
import { Message, MCPModel } from '../types';

// Create a cache for MCP clients to avoid creating new connections for each request
const mcpClientCache = new Map<string, MCPClient>();

/**
 * Get or create an MCP client for the given endpoint
 */
export function getMCPClient(endpoint: string): MCPClient {
  if (mcpClientCache.has(endpoint)) {
    return mcpClientCache.get(endpoint)!;
  }
  
  // Create a new client with proper configuration
  const client = new MCPClient({
    name: 'mlFace',
    version: '0.1.0',
  }, {
    // Register capabilities
    capabilities: {
      prompts: true,
    }
  });
  
  mcpClientCache.set(endpoint, client);
  return client;
}

/**
 * Test connection to an MCP server using the MCP SDK
 */
export async function testMCPConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
  try {
    // Validate URL format
    try {
      new URL(endpoint);
    } catch {
      return { success: false, message: 'Invalid URL format' };
    }
    
    // Use a timeout for the test
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), 5000);
    });
    
    // Try to connect and ping the server
    const connectionPromise = (async () => {
      try {
        // We create a new client for testing to avoid caching issues
        const client = new MCPClient({
          uri: endpoint,
          apiKey: '',
        });
        
        // Try to establish a connection
        await client.connect({
          async send(data) {
            const response = await fetch(`${endpoint}/v1/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: data,
            });
            return await response.text();
          },
          close() {
            // Nothing to do for HTTP transport
          },
        });
        
        // Try to get capability information
        const capabilities = client.getServerCapabilities();
        const hasPrompts = capabilities?.prompts || false;
        
        // Try to list models if prompts capability is available
        let modelCount = 0;
        if (hasPrompts) {
          try {
            const promptsResult = await client.listPrompts({});
            modelCount = promptsResult.prompts.length;
          } catch (e) {
            console.warn('Failed to list prompts:', e);
          }
        }
        
        // If we got here, connection was successful
        return { 
          success: true, 
          message: `Connection successful. Found ${modelCount} models.` 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    })();
    
    // Race between the connection attempt and the timeout
    return await Promise.race([connectionPromise, timeoutPromise]);
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    return { 
      success: false, 
      message: error instanceof Error && error.message === 'Connection timed out'
        ? 'Connection timed out'
        : `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Discover MCP servers on the local network
 * (Note: With the SDK, we still have to manually test common endpoints)
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
        const pingResponse = await fetch(`${endpoint}/v1/ping`, {
          method: 'GET',
          signal: AbortSignal.timeout(1000), // 1 second timeout
        });
        
        if (pingResponse.ok) {
          return endpoint;
        }
        
        // As fallback, try regular connection test
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
 * Fetch models from an MCP server using the MCP SDK
 */
export async function fetchMCPModels(endpoint: string): Promise<MCPModel[]> {
  try {
    const client = getMCPClient(endpoint);
    
    // Connect to the server if not already connected
    if (!client.getServerCapabilities()) {
      await client.connect({
        async send(data) {
          const response = await fetch(`${endpoint}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: data,
          });
          return await response.text();
        },
        close() {
          // Nothing to do for HTTP transport
        },
      });
    }
    
    // List prompts (models)
    const promptsResult = await client.listPrompts({});
    
    // Map prompts to our model format
    return promptsResult.prompts.map(prompt => ({
      id: `mcp-${endpoint}-${prompt.id}`,
      name: prompt.name || prompt.id,
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
 * Send a message to an MCP server using the MCP SDK
 */
export async function sendMCPMessage(
  endpoint: string,
  messages: Message[],
  modelId?: string
): Promise<string> {
  try {
    const client = getMCPClient(endpoint);
    
    // Extract the actual model ID if provided (remove the prefix and endpoint)
    const actualModelId = modelId ? modelId.replace(`mcp-${endpoint}-`, '') : undefined;
    
    // Connect to the server if not already connected
    if (!client.getServerCapabilities()) {
      await client.connect({
        async send(data) {
          const response = await fetch(`${endpoint}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: data,
          });
          return await response.text();
        },
        close() {
          // Nothing to do for HTTP transport
        },
      });
    }
    
    // Convert messages to the format expected by the MCP SDK
    const mcpMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    // Make the chat completion request
    const response = await client.complete({
      messages: mcpMessages,
      model: actualModelId,
    });
    
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
