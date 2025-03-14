import { Message, Model, OpenRouterModel, MCPModel } from '../types';

// OpenRouter API
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterModelResponse {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

interface OpenRouterCompletionRequest {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
}

interface OpenRouterCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'mlFace',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.map((model: OpenRouterModelResponse) => ({
    id: `openrouter-${model.id}`,
    name: model.name,
    provider: 'openrouter' as const,
    openrouterId: model.id,
    contextLength: model.context_length,
  }));
}

export async function sendOpenRouterMessage(
  apiKey: string,
  modelId: string,
  messages: Message[]
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required');
  }

  const openrouterId = modelId.replace('openrouter-', '');

  const requestBody: OpenRouterCompletionRequest = {
    model: openrouterId,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'mlFace',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data: OpenRouterCompletionResponse = await response.json();
  return data.choices[0].message.content;
}

// MCP (Model Context Protocol) API
interface MCPCompletionRequest {
  messages: {
    role: string;
    content: string;
  }[];
  model?: string; // Optional model parameter
}

interface MCPCompletionResponse {
  message: {
    role: string;
    content: string;
  };
}

interface MCPModelResponse {
  id: string;
  name: string;
  context_length?: number;
  capabilities?: string[];
}

interface MCPServerInfo {
  version: string;
  models: MCPModelResponse[];
}

// Helper function to check if a URL is valid
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Discover MCP servers on the local network
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
        
        const response = await fetch(`${endpoint}/models`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
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

// Test connection to an MCP server
export async function testMCPConnection(endpoint: string): Promise<{ success: boolean; message: string }> {
  if (!isValidUrl(endpoint)) {
    return { success: false, message: 'Invalid URL format' };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${endpoint}/models`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      const modelCount = data.models?.length || 0;
      return { 
        success: true, 
        message: `Connection successful. Found ${modelCount} models.` 
      };
    } else {
      return { 
        success: false, 
        message: `Server responded with status: ${response.status} ${response.statusText}` 
      };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, message: 'Connection timed out' };
    }
    return { 
      success: false, 
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Fetch models from an MCP server
export async function fetchMCPModels(endpoint: string): Promise<MCPModel[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${endpoint}/models`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP models: ${response.statusText}`);
    }
    
    const data: MCPServerInfo = await response.json();
    
    // Check if response has the expected structure
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error('Invalid response format from MCP server');
    }
    
    return data.models.map((model: MCPModelResponse) => ({
      id: `mcp-${endpoint}-${model.id}`,
      name: model.name || model.id,
      provider: 'mcp' as const,
      endpoint,
      contextLength: model.context_length,
      capabilities: model.capabilities || [],
    }));
  } catch (error) {
    console.error('Error fetching MCP models:', error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Connection to MCP server timed out');
    }
    throw error;
  }
}

export async function sendMCPMessage(
  endpoint: string,
  messages: Message[],
  modelId?: string
): Promise<string> {
  // Extract the actual model ID if provided (remove the prefix and endpoint)
  const actualModelId = modelId ? modelId.replace(`mcp-${endpoint}-`, '') : undefined;
  
  const requestBody: MCPCompletionRequest = {
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  };
  
  // Include model if specified
  if (actualModelId) {
    requestBody.model = actualModelId;
  }

  try {
    const controller = new AbortController();
    // Set a longer timeout for completions (2 minutes)
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`MCP API error (${response.status}): ${errorText || response.statusText}`);
    }

    const data: MCPCompletionResponse = await response.json();
    if (!data.message || !data.message.content) {
      throw new Error('Invalid response format from MCP server');
    }
    
    return data.message.content;
  } catch (error) {
    console.error('Error sending message to MCP server:', error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('MCP server request timed out after 2 minutes');
    }
    throw error;
  }
}

// Generic message sending function
export async function sendMessage(
  model: Model,
  messages: Message[],
  apiKey: string
): Promise<string> {
  if (model.provider === 'openrouter') {
    return sendOpenRouterMessage(apiKey, model.id, messages);
  } else if (model.provider === 'mcp') {
    const mcpModel = model as MCPModel;
    return sendMCPMessage(mcpModel.endpoint, messages, model.id);
  }
  
  throw new Error(`Unsupported model provider: ${model.provider}`);
}