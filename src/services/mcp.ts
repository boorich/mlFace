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
  
  const client = new MCPClient({
    uri: endpoint,
    apiKey: '', // No API key needed for local MCP servers
  });
  
  mcpClientCache.set(endpoint, client);
  return client;
}

/**
 * Test connection to an MCP server using the MCP SDK
 */
export async function testMCPConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
  try {
    const client = getMCPClient(endpoint);
    
    // Attempt to fetch models to verify the connection
    const models = await client.getModels();
    
    return { 
      success: true, 
      message: `Connection successful. Found ${models.length} models.` 
    };
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    return { 
      success: false, 
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
        const client = new MCPClient({
          uri: endpoint,
          apiKey: '',
        });
        
        // Set a timeout of 1 second for discovery
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 1000);
        });
        
        // Race between the model fetch and the timeout
        await Promise.race([
          client.getModels(),
          timeoutPromise
        ]);
        
        return endpoint;
      } catch {
        // Ignore connection errors
        return null;
      }
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
    const models = await client.getModels();
    
    return models.map(model => ({
      id: `mcp-${endpoint}-${model.id}`,
      name: model.name || model.id,
      provider: 'mcp' as const,
      endpoint,
      contextLength: model.contextLength,
      capabilities: model.capabilities || [],
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
    
    // Convert messages to the format expected by the MCP SDK
    const mcpMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    // Make the chat completion request
    const response = await client.createChatCompletion({
      messages: mcpMessages,
      model: actualModelId,
    });
    
    // Return the content of the response
    return response.message.content;
  } catch (error) {
    console.error('Error sending message to MCP server:', error);
    throw error;
  }
}
