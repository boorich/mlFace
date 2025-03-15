import { useState, useEffect } from "react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger,
  Button,
} from "../ui"; // Import your UI components
import { McpSettings } from "./mcp-settings";
import { McpTools } from "./mcp-tools";
import { McpResources } from "./mcp-resources";
import { McpServerStatus, CallToolResult, ReadResourceResult } from "./types";
import { getServerStatus } from "./api";

interface McpManagerProps {
  onToolResult?: (result: CallToolResult) => void;
  onResourceContent?: (result: ReadResourceResult) => void;
}

export function McpManager({ onToolResult, onResourceContent }: McpManagerProps) {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("settings");

  useEffect(() => {
    loadServers();
    
    // Refresh servers every 30 seconds
    const interval = setInterval(loadServers, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadServers() {
    try {
      setLoading(true);
      const status = await getServerStatus();
      setServers(status);
    } catch (error) {
      console.error("Failed to load server status:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={loadServers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <TabsContent value="settings">
          <McpSettings />
        </TabsContent>

        <TabsContent value="tools">
          <McpTools servers={servers} onToolResult={onToolResult} />
        </TabsContent>

        <TabsContent value="resources">
          <McpResources servers={servers} onResourceContent={onResourceContent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
