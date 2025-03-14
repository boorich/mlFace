/**
 * A Vite plugin to fix import resolution for the @modelcontextprotocol/sdk package.
 * 
 * The MCP SDK package lacks a root export in its package.json, causing Vite to fail
 * when trying to import it directly. This plugin intercepts those imports and
 * rewrites them to use the correct subpath imports.
 */
export default function mcpResolverPlugin() {
  const SDK_PACKAGE = '@modelcontextprotocol/sdk';
  
  return {
    name: 'vite:mcp-resolver',
    
    // This hook runs when Vite attempts to resolve an import
    resolveId(id, importer) {
      // If this is a direct import of the MCP SDK package
      if (id === SDK_PACKAGE) {
        // Rewrite it to use the client subpath instead
        return {
          id: `${SDK_PACKAGE}/dist/esm/client/index.js`,
          external: false
        };
      }
      
      return null; // Let Vite handle other imports
    }
  };
}
