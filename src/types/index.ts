export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  name: string;
  provider: 'openrouter' | 'mcp';
  contextLength?: number;
  capabilities?: string[];
}

export interface OpenRouterModel extends Model {
  provider: 'openrouter';
  openrouterId: string;
}

export interface MCPModel extends Model {
  provider: 'mcp';
  endpoint: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  openrouterApiKey: string;
  mcpEndpoints: string[];
  defaultModelId: string;
  autoSelectModel: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';