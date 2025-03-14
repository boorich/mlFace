/**
 * This adapter file provides access to the MCP SDK library.
 * Since the package doesn't export a root entry point (only subpath exports),
 * we need to import directly from the subpaths.
 */

// Import the Client class from the client subpath
import { Client } from '@modelcontextprotocol/sdk/dist/esm/client/index.js';

// Re-export as MCPClient to keep the same interface
export { Client as MCPClient };

// Export any other types or functions we might need
import { type CompleteParams } from '@modelcontextprotocol/sdk/dist/esm/types.js';
export type { CompleteParams };
