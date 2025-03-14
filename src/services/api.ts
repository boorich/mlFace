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
// Import MCP functions from the dedicated module
import { 
  testMCPConnection, 
  discoverMCPServers, 
  fetchMCPModels, 
  sendMCPMessage 
} from './mcp';

// Helper function to check if a URL is valid
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Re-export the MCP functions
export { testMCPConnection, discoverMCPServers, fetchMCPModels, sendMCPMessage };

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