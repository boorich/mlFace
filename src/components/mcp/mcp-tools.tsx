import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Input,
  Label,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Separator,
} from "../ui"; // Import your UI components
import { listTools, callTool } from "./api";
import { McpServerStatus, Tool, Content, CallToolResult } from "./types";

interface McpToolsProps {
  servers: McpServerStatus[];
  onToolResult?: (result: CallToolResult) => void;
}

export function McpTools({ servers, onToolResult }: McpToolsProps) {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({});
  const [executingTool, setExecutingTool] = useState(false);
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);

  // Filter to only running servers
  const runningServers = servers.filter((server) => server.is_running);

  // Load tools when server is selected
  useEffect(() => {
    if (selectedServer) {
      loadTools(selectedServer);
    } else {
      setTools([]);
    }
  }, [selectedServer]);

  async function loadTools(serverName: string) {
    try {
      setLoading(true);
      setError(null);
      const result = await listTools(serverName);
      setTools(result.tools);
    } catch (error) {
      console.error("Failed to load tools:", error);
      setError("Failed to load tools from server");
      setTools([]);
    } finally {
      setLoading(false);
    }
  }

  function openToolDialog(tool: Tool) {
    setSelectedTool(tool);
    
    // Initialize arguments based on schema
    const initialArgs: Record<string, any> = {};
    if (tool.input_schema?.properties) {
      Object.entries(tool.input_schema.properties).forEach(([key, schema]) => {
        // Set default values based on type
        if (schema.type === "string") {
          initialArgs[key] = "";
        } else if (schema.type === "number" || schema.type === "integer") {
          initialArgs[key] = 0;
        } else if (schema.type === "boolean") {
          initialArgs[key] = false;
        } else if (schema.type === "array") {
          initialArgs[key] = [];
        } else if (schema.type === "object") {
          initialArgs[key] = {};
        }
      });
    }
    
    setToolArgs(initialArgs);
    setIsToolDialogOpen(true);
    setToolResult(null);
  }

  async function handleExecuteTool() {
    if (!selectedServer || !selectedTool) return;
    
    try {
      setExecutingTool(true);
      setError(null);
      
      const result = await callTool(selectedServer, selectedTool.name, toolArgs);
      setToolResult(result);
      
      // Notify parent if callback provided
      if (onToolResult) {
        onToolResult(result);
      }
    } catch (error) {
      console.error("Failed to execute tool:", error);
      setError("Failed to execute tool");
    } finally {
      setExecutingTool(false);
    }
  }

  function renderToolArgsForm() {
    if (!selectedTool || !selectedTool.input_schema?.properties) {
      return <p>This tool doesn't require any arguments.</p>;
    }

    return (
      <div className="space-y-4">
        {Object.entries(selectedTool.input_schema.properties).map(([key, schema]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`arg-${key}`}>
              {schema.description || key}
              {selectedTool.input_schema?.required?.includes(key) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
            {schema.type === "boolean" ? (
              <div className="flex items-center space-x-2">
                <input
                  id={`arg-${key}`}
                  type="checkbox"
                  checked={!!toolArgs[key]}
                  onChange={(e) =>
                    setToolArgs({ ...toolArgs, [key]: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <label htmlFor={`arg-${key}`} className="text-sm">
                  {schema.description || key}
                </label>
              </div>
            ) : schema.type === "number" || schema.type === "integer" ? (
              <Input
                id={`arg-${key}`}
                type="number"
                value={toolArgs[key] || ""}
                onChange={(e) =>
                  setToolArgs({
                    ...toolArgs,
                    [key]: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder={schema.description || ""}
              />
            ) : (
              <Input
                id={`arg-${key}`}
                value={toolArgs[key] || ""}
                onChange={(e) =>
                  setToolArgs({ ...toolArgs, [key]: e.target.value })
                }
                placeholder={schema.description || ""}
              />
            )}
            {schema.enum && (
              <div className="text-xs text-muted-foreground mt-1">
                Allowed values: {schema.enum.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderToolResult() {
    if (!toolResult) return null;

    return (
      <div className="space-y-4 mt-4">
        <Separator />
        <h3 className="font-medium">Result:</h3>
        <div
          className={`p-4 rounded-md ${
            toolResult.is_error
              ? "bg-red-50 dark:bg-red-900 dark:bg-opacity-20"
              : "bg-gray-50 dark:bg-gray-800"
          }`}
        >
          {toolResult.content.map((content, index) => (
            <div key={index} className="mb-2">
              {content.type === "text" && <div>{content.text}</div>}
              {content.type === "image" && (
                <img
                  src={`data:${content.mime_type};base64,${content.data}`}
                  alt="Tool result"
                  className="max-w-full max-h-96 object-contain"
                />
              )}
              {content.type === "embedded_resource" && (
                <div className="p-2 border rounded">
                  <div className="font-medium">Embedded Resource</div>
                  <div className="text-sm">{content.uri}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <select
          className="border rounded p-2 flex-1 bg-background"
          value={selectedServer || ""}
          onChange={(e) => setSelectedServer(e.target.value || null)}
        >
          <option value="">Select a server</option>
          {runningServers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => selectedServer && loadTools(selectedServer)}
          disabled={!selectedServer || loading}
        >
          Refresh
        </Button>
      </div>

      {loading && <div className="text-center p-4">Loading tools...</div>}

      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
          {error}
        </div>
      )}

      {!selectedServer && (
        <div className="text-center p-8 text-muted-foreground">
          Select a running MCP server to see available tools.
        </div>
      )}

      {selectedServer && !loading && tools.length === 0 && !error && (
        <div className="text-center p-8 text-muted-foreground">
          No tools available on this server.
        </div>
      )}

      {tools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Card key={tool.name} className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>{tool.name}</CardTitle>
                {tool.description && (
                  <CardDescription>{tool.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                {tool.input_schema?.properties && (
                  <div className="text-sm">
                    <span className="font-medium">Arguments:</span>
                    <ul className="list-disc list-inside mt-1">
                      {Object.entries(tool.input_schema.properties).map(
                        ([key, schema]) => (
                          <li key={key}>
                            {key}
                            {tool.input_schema?.required?.includes(key) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                            {schema.description && (
                              <span className="text-muted-foreground ml-1">
                                - {schema.description}
                              </span>
                            )}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
              <div className="p-4 pt-0 mt-auto">
                <Button
                  onClick={() => openToolDialog(tool)}
                  className="w-full"
                  variant="outline"
                >
                  Execute Tool
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tool Execution Dialog */}
      <Dialog open={isToolDialogOpen} onOpenChange={setIsToolDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTool?.name}{" "}
              {selectedTool?.description && (
                <span className="font-normal text-sm text-muted-foreground ml-2">
                  {selectedTool.description}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Configure arguments and execute the tool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderToolArgsForm()}
            {renderToolResult()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsToolDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleExecuteTool}
              disabled={executingTool}
            >
              {executingTool ? "Executing..." : "Execute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
