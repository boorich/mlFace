import { useState, useEffect } from "react";
import { McpServerStatus, CallToolResult, ReadResourceResult } from "./types";
import { McpTools } from "./mcp-tools";
import { McpResources } from "./mcp-resources"; 
import { getServerStatus } from "./api";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
} from "../ui";

interface McpChatPanelProps {
  isVisible: boolean;
  onToolResult?: (result: CallToolResult) => void;
  onResourceContent?: (result: ReadResourceResult) => void;
}

export function McpChatPanel({
  isVisible,
  onToolResult,
  onResourceContent,
}: McpChatPanelProps) {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tools");

  useEffect(() => {
    if (isVisible) {
      loadServers();
    }
  }, [isVisible]);

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

  if (!isVisible) return null;

  const handleToolResult = (result: CallToolResult) => {
    if (onToolResult) {
      onToolResult(result);
    }
  };

  const handleResourceContent = (result: ReadResourceResult) => {
    if (onResourceContent) {
      onResourceContent(result);
    }
  };

  return (
    <div className="border rounded-md p-4 bg-card">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
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

        <TabsContent value="tools">
          <McpTools servers={servers} onToolResult={handleToolResult} />
        </TabsContent>

        <TabsContent value="resources">
          <McpResources servers={servers} onResourceContent={handleResourceContent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
