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
        // Try a few different endpoint paths
        const endpoints = [
          `${endpoint}`,
          `${endpoint}/v1/messages`,
          `${endpoint}/chat/completions`,
          `${endpoint}/messages`
        ];
        
        let lastError: Error | null = null;
        
        // Try each endpoint in order
        for (const url of endpoints) {
          try {
            console.log(`Trying to send to: ${url}`);
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: data,
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => '');
              console.warn(`Error response from ${url}:`, response.status, errorText);
              continue; // Try next endpoint
            }

            const responseText = await response.text();
            console.log(`Successful response from ${url}:`, responseText.substring(0, 100)); // First 100 chars
            return responseText;
          } catch (err) {
            console.warn(`Failed to send to ${url}:`, err);
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }
        
        // If we get here, all endpoints failed
        throw lastError || new Error('All endpoints failed');
      } catch (error) {
        console.error('Transport send error:', error);
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
    } catch (err) {
      return { success: false, message: 'Invalid URL format' };
    }
    
    console.log('Testing connection to MCP server:', endpoint);
    
    // Try to connect with a timeout
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), 10000); // Increased timeout
    });
    
    const connectionPromise = (async () => {
      try {
        // First, try a basic fetch to check if the server is responding
        console.log('Attempting basic fetch to:', endpoint);
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          
          console.log('Server response status:', response.status);
          const responseText = await response.text();
          console.log('Server response body:', responseText.substring(0, 200)); // Log first 200 chars
        } catch (fetchError) {
          console.warn('Basic fetch failed:', fetchError);
          // Continue with client creation even if fetch fails
        }
        
        // Create client
        console.log('Creating MCP client...');
        const client = new Client(
          { name: 'mlFace-test', version: '0.1.0' },
          { capabilities: { prompts: true } }
        );
        
        // Connect with transport
        const transport = createHttpTransport(endpoint);
        console.log('Connecting to transport...');
        await client.connect(transport);
        console.log('Connected successfully!');
        
        // Get capabilities
        const capabilities = client.getServerCapabilities();
        console.log('Server capabilities:', capabilities);
        const hasPrompts = capabilities?.prompts || false;
        
        // Try to get model list
        let modelCount = 0;
        try {
          if (hasPrompts) {
            console.log('Listing prompts...');
            const result = await client.listPrompts({});
            modelCount = result.prompts.length;
            console.log('Found prompts:', result.prompts);
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
        console.error('Connection test error:', error);
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          console.error('Error stack:', error.stack);
          
          // Check for specific error types
          if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = 'Network error - Make sure the MCP server is running and accessible';
          } else if (error.message.includes('JSON')) {
            errorMessage = 'Invalid response from server - Not a valid MCP server';
          }
        }
        
        return {
          success: false,
          message: `Connection failed: ${errorMessage}`,
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
    'http://localhost:3000'
  ];
  
  console.log('Starting MCP server discovery...');
  const foundEndpoints: string[] = [];
  
  // Test each endpoint in parallel
  const results = await Promise.allSettled(
    potentialEndpoints.map(async (endpoint) => {
      console.log(`Checking endpoint: ${endpoint}`);
      try {
        // Try several paths to check for MCP server
        const paths = ['', '/ping', '/v1', '/models', '/v1/models'];
        
        for (const path of paths) {
          const url = `${endpoint}${path}`;
          console.log(`Trying: ${url}`);
          
          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(1000), // 1 second timeout
              headers: { Accept: 'application/json, text/plain, */*' }
            });
            
            if (response.ok) {
              console.log(`Found responsive endpoint at: ${url}`);
              return endpoint;
            }
          } catch (err) {
            // Ignore individual path errors
          }
        }
        
        // Last resort: try a more thorough connection test
        console.log(`Trying connection test to: ${endpoint}`);
        const testResult = await testMCPConnection(endpoint);
        if (testResult.success) {
          console.log(`Connection test succeeded for: ${endpoint}`);
          return endpoint;
        }
      } catch (err) {
        console.warn(`Error checking ${endpoint}:`, err);
        // Ignore connection errors
      }
      
      console.log(`No MCP server found at: ${endpoint}`);
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
