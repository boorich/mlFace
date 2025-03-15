// MCP types for TypeScript

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface McpServerStatus extends McpServerConfig {
  is_running: boolean;
  url?: string;
}

export interface Tool {
  name: string;
  description?: string;
  input_schema: any; // JSON Schema
}

export interface ListToolsResult {
  tools: Tool[];
}

export interface Content {
  type: "text" | "image" | "embedded_resource";
  text?: string;
  mime_type?: string;
  data?: string;
  uri?: string;
  properties?: Record<string, string>;
}

export interface CallToolResult {
  is_error?: boolean;
  content: Content[];
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
}

export interface ListResourcesResult {
  resources: Resource[];
}

export interface ReadResourceResult {
  content: Content[];
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  parameter_schema?: any; // JSON Schema
}

export interface ListPromptsResult {
  prompts: Prompt[];
}

export interface GetPromptResult {
  content: Content[];
}
