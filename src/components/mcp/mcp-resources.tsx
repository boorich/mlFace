import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Separator,
} from "../ui"; // Import your UI components
import { listResources, readResource } from "./api";
import { McpServerStatus, Resource, Content, ReadResourceResult } from "./types";

interface McpResourcesProps {
  servers: McpServerStatus[];
  onResourceContent?: (result: ReadResourceResult) => void;
}

export function McpResources({ servers, onResourceContent }: McpResourcesProps) {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceContent, setResourceContent] = useState<ReadResourceResult | null>(null);

  // Filter to only running servers
  const runningServers = servers.filter((server) => server.is_running);

  // Load resources when server is selected
  useEffect(() => {
    if (selectedServer) {
      loadResources(selectedServer);
    } else {
      setResources([]);
    }
  }, [selectedServer]);

  async function loadResources(serverName: string) {
    try {
      setLoading(true);
      setError(null);
      const result = await listResources(serverName);
      setResources(result.resources);
    } catch (error) {
      console.error("Failed to load resources:", error);
      setError("Failed to load resources from server");
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReadResource(resource: Resource) {
    if (!selectedServer) return;
    
    setSelectedResource(resource);
    setIsResourceDialogOpen(true);
    setResourceContent(null);
    
    try {
      setResourceLoading(true);
      const result = await readResource(selectedServer, resource.uri);
      setResourceContent(result);
      
      // Notify parent if callback provided
      if (onResourceContent) {
        onResourceContent(result);
      }
    } catch (error) {
      console.error("Failed to read resource:", error);
      setError("Failed to read resource");
    } finally {
      setResourceLoading(false);
    }
  }

  function renderResourceContent() {
    if (!resourceContent) return null;

    return (
      <div className="space-y-4 mt-4">
        <Separator />
        <h3 className="font-medium">Content:</h3>
        <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-800">
          {resourceContent.content.map((content, index) => (
            <div key={index} className="mb-2">
              {content.type === "text" && <div>{content.text}</div>}
              {content.type === "image" && (
                <img
                  src={`data:${content.mime_type};base64,${content.data}`}
                  alt="Resource content"
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
          onClick={() => selectedServer && loadResources(selectedServer)}
          disabled={!selectedServer || loading}
        >
          Refresh
        </Button>
      </div>

      {loading && <div className="text-center p-4">Loading resources...</div>}

      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
          {error}
        </div>
      )}

      {!selectedServer && (
        <div className="text-center p-8 text-muted-foreground">
          Select a running MCP server to see available resources.
        </div>
      )}

      {selectedServer && !loading && resources.length === 0 && !error && (
        <div className="text-center p-8 text-muted-foreground">
          No resources available on this server.
        </div>
      )}

      {resources.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <Card key={resource.uri} className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>{resource.name}</CardTitle>
                {resource.description && (
                  <CardDescription>{resource.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">URI:</span> {resource.uri}
                  </div>
                  {resource.mime_type && (
                    <div>
                      <span className="font-medium">Type:</span> {resource.mime_type}
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="p-4 pt-0 mt-auto">
                <Button
                  onClick={() => handleReadResource(resource)}
                  className="w-full"
                  variant="outline"
                >
                  View Resource
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resource Dialog */}
      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedResource?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedResource?.description}
              <div className="mt-1">
                <span className="font-medium">URI:</span> {selectedResource?.uri}
              </div>
              {selectedResource?.mime_type && (
                <div>
                  <span className="font-medium">Type:</span> {selectedResource?.mime_type}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {resourceLoading ? (
              <div className="text-center p-4">Loading resource content...</div>
            ) : (
              renderResourceContent()
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResourceDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
