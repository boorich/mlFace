import { useEffect, useState } from "react";
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
  Switch,
  AlertCircle,
} from "../ui"; // Import your UI components
import {
  registerServer,
  unregisterServer,
  getServerStatus,
  testConnection,
  startServer,
  stopServer,
} from "./api";
import { McpServerStatus } from "./types";

export function McpSettings() {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [isAddServerDialogOpen, setIsAddServerDialogOpen] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    command: "",
    args: "",
    env: "",
  });
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    try {
      setRefreshing(true);
      const status = await getServerStatus();
      setServers(status);
    } catch (error) {
      console.error("Failed to load servers:", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddServer() {
    try {
      const argsArray = newServer.args
        .split(" ")
        .map((arg) => arg.trim())
        .filter((arg) => arg.length > 0);

      // Parse environment variables
      const envMap: Record<string, string> = {};
      if (newServer.env.trim()) {
        newServer.env.split(",").forEach((pair) => {
          const [key, value] = pair.split("=").map((s) => s.trim());
          if (key && value) {
            envMap[key] = value;
          }
        });
      }

      await registerServer(newServer.name, newServer.command, argsArray, envMap);
      setIsAddServerDialogOpen(false);
      setNewServer({ name: "", command: "", args: "", env: "" });
      await loadServers();
    } catch (error) {
      console.error("Failed to add server:", error);
    }
  }

  async function handleRemoveServer(name: string) {
    try {
      await unregisterServer(name);
      await loadServers();
    } catch (error) {
      console.error(`Failed to remove server ${name}:`, error);
    }
  }

  async function handleToggleServer(server: McpServerStatus) {
    try {
      if (server.is_running) {
        await stopServer(server.name);
      } else {
        await startServer(server.name);
      }
      await loadServers();
    } catch (error) {
      console.error(`Failed to toggle server ${server.name}:`, error);
    }
  }

  async function handleTestConnection() {
    try {
      setTestLoading(true);
      setTestResult(null);
      
      const result = await testConnection(testUrl);
      setTestResult(result);
    } catch (error) {
      console.error("Connection test failed:", error);
      setTestResult(false);
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">MCP Server Endpoints</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadServers}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAddServerDialogOpen(true)}
          >
            Add Server
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter an MCP server URL and click the + button to test and add it"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
          />
          <Button
            onClick={handleTestConnection}
            disabled={testLoading || !testUrl}
            size="sm"
          >
            Test
          </Button>
        </div>

        {testResult !== null && (
          <div
            className={`p-3 rounded-md ${
              testResult
                ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
            }`}
          >
            {testResult
              ? "Connection successful!"
              : "Connection failed. Make sure the server is running and accessible."}
          </div>
        )}

        {servers.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No MCP servers configured yet. Add a server to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <div
                key={server.name}
                className="flex justify-between items-center p-3 border rounded-md"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      server.is_running ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{server.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {server.url || server.command}{" "}
                      {server.args.length > 0 && `(${server.args.join(" ")})`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={server.is_running}
                    onCheckedChange={() => handleToggleServer(server)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveServer(server.name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Server Dialog */}
      <Dialog
        open={isAddServerDialogOpen}
        onOpenChange={setIsAddServerDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Configure a new MCP server connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="e.g., filesystem-server"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="command">Command or URL</Label>
              <Input
                id="command"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="e.g., npx -y @modelcontextprotocol/server-filesystem or http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="args">Arguments (space-separated)</Label>
              <Input
                id="args"
                value={newServer.args}
                onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                placeholder="e.g., /Users/username/Documents"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="env">Environment Variables (key=value, comma-separated)</Label>
              <Input
                id="env"
                value={newServer.env}
                onChange={(e) => setNewServer({ ...newServer, env: e.target.value })}
                placeholder="e.g., API_KEY=abc123,DEBUG=true"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddServerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddServer} disabled={!newServer.name || !newServer.command}>
              Add Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
