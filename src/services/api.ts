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
}

interface MCPCompletionResponse {
  message: {
    role: string;
    content: string;
  };
}

export async function discoverMCPServers(): Promise<string[]> {
  // This would normally involve some local network discovery
  // For now, we'll use a simple mock implementation
  return [];
}

export async function fetchMCPModels(endpoint: string): Promise<MCPModel[]> {
  try {
    const response = await fetch(`${endpoint}/models`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP models: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.models.map((model: any) => ({
      id: `mcp-${endpoint}-${model.id}`,
      name: model.name,
      provider: 'mcp' as const,
      endpoint,
      contextLength: model.context_length,
      capabilities: model.capabilities || [],
    }));
  } catch (error) {
    console.error('Error fetching MCP models:', error);
    return [];
  }
}

export async function sendMCPMessage(
  endpoint: string,
  messages: Message[]
): Promise<string> {
  const requestBody: MCPCompletionRequest = {
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  };

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`MCP API error: ${response.statusText}`);
  }

  const data: MCPCompletionResponse = await response.json();
  return data.message.content;
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
    return sendMCPMessage(mcpModel.endpoint, messages);
  }
  
  throw new Error(`Unsupported model provider: ${model.provider}`);
}