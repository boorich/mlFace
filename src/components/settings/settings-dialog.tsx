import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, RefreshCw, Search, Check, Info, AlertCircle } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ModelSelector } from "../sidebar/model-selector";
import { useTheme } from "../theme/theme-provider";
import { ThemeMode } from "../../types";
import { testMCPConnection, discoverMCPServers } from "../../services/api";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useStore();
  const { theme, setTheme } = useTheme();
  
  const [apiKey, setApiKey] = useState(settings.openrouterApiKey || "");
  const [mcpEndpoints, setMcpEndpoints] = useState<string[]>(settings.mcpEndpoints || []);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [selectedDefaultModel, setSelectedDefaultModel] = useState(settings.defaultModelId || "");
  const [autoSelectModel, setAutoSelectModel] = useState(settings.autoSelectModel || false);
  
  // MCP specific state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    endpoint: string;
    status: 'success' | 'error' | 'testing';
    message: string;
  } | null>(null);

  // Update local state when settings change
  useEffect(() => {
    setApiKey(settings.openrouterApiKey || "");
    setMcpEndpoints(settings.mcpEndpoints || []);
    setSelectedDefaultModel(settings.defaultModelId || "");
    setAutoSelectModel(settings.autoSelectModel || false);
  }, [settings]);

  // If the dialog is not open, don't render anything
  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings({
      openrouterApiKey: apiKey,
      mcpEndpoints,
      defaultModelId: selectedDefaultModel,
      autoSelectModel,
    });
    onClose();
  };

  const handleAddEndpoint = () => {
    if (newEndpoint && !mcpEndpoints.includes(newEndpoint)) {
      setMcpEndpoints([...mcpEndpoints, newEndpoint]);
      setNewEndpoint("");
    }
  };

  const handleRemoveEndpoint = (endpoint: string) => {
    setMcpEndpoints(mcpEndpoints.filter((e) => e !== endpoint));
    // Clear connection status if it was for this endpoint
    if (connectionStatus?.endpoint === endpoint) {
      setConnectionStatus(null);
    }
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };
  
  // Test connection to an MCP server endpoint
  const handleTestConnection = async () => {
    if (!newEndpoint) return;
    
    setIsTesting(true);
    setConnectionStatus({
      endpoint: newEndpoint,
      status: 'testing',
      message: 'Testing connection...',
    });
    
    try {
      const result = await testMCPConnection(newEndpoint);
      
      setConnectionStatus({
        endpoint: newEndpoint,
        status: result.success ? 'success' : 'error',
        message: result.message,
      });
      
      // If successful, enable the add button
      if (result.success) {
        // Auto-add the endpoint if it's not already in the list
        if (!mcpEndpoints.includes(newEndpoint)) {
          setMcpEndpoints([...mcpEndpoints, newEndpoint]);
          setNewEndpoint('');
          setConnectionStatus(null); // Clear status after adding
        }
      }
    } catch (error) {
      setConnectionStatus({
        endpoint: newEndpoint,
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  // Discover MCP servers on the local network
  const handleDiscoverServers = async () => {
    setIsDiscovering(true);
    
    try {
      const discoveredEndpoints = await discoverMCPServers();
      
      if (discoveredEndpoints.length > 0) {
        // Add any new endpoints that aren't already in the list
        const newEndpoints = discoveredEndpoints.filter(
          endpoint => !mcpEndpoints.includes(endpoint)
        );
        
        if (newEndpoints.length > 0) {
          setMcpEndpoints([...mcpEndpoints, ...newEndpoints]);
          // Set feedback message
          setConnectionStatus({
            endpoint: 'discovery',
            status: 'success',
            message: `Found ${newEndpoints.length} new MCP server${newEndpoints.length > 1 ? 's' : ''}.`,
          });
        } else {
          // No new endpoints found
          setConnectionStatus({
            endpoint: 'discovery',
            status: 'info',
            message: 'No new MCP servers found.',
          });
        }
      } else {
        // No endpoints found
        setConnectionStatus({
          endpoint: 'discovery',
          status: 'error',
          message: 'No MCP servers found on the network.',
        });
      }
    } catch (error) {
      setConnectionStatus({
        endpoint: 'discovery',
        status: 'error',
        message: `Discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-md bg-background border rounded-lg shadow-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Theme settings */}
          <div>
            <h3 className="text-sm font-medium mb-2">Theme</h3>
            <div className="flex space-x-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => handleThemeChange("light")}
              >
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => handleThemeChange("dark")}
              >
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => handleThemeChange("system")}
              >
                System
              </Button>
            </div>
          </div>

          {/* OpenRouter API Key */}
          <div>
            <h3 className="text-sm font-medium mb-2">OpenRouter API Key</h3>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenRouter API key"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get an API key from{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                openrouter.ai
              </a>
            </p>
          </div>

          {/* MCP Endpoints */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">MCP Server Endpoints</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDiscoverServers}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Discover
              </Button>
            </div>
            
            {/* Endpoint list */}
            <div className="space-y-2 mb-3 max-h-36 overflow-y-auto border rounded-md p-2">
              {mcpEndpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No endpoints configured</p>
              ) : (
                mcpEndpoints.map((endpoint) => (
                  <div key={endpoint} className="flex items-center justify-between bg-muted/30 rounded p-1 pl-2">
                    <span className="text-sm truncate flex-1">{endpoint}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveEndpoint(endpoint)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            
            {/* Connection status message */}
            {connectionStatus && (
              <div className={`mb-2 p-2 rounded text-sm ${
                connectionStatus.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                connectionStatus.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                <div className="flex items-start gap-2">
                  {connectionStatus.status === 'success' ? (
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : connectionStatus.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{connectionStatus.message}</span>
                </div>
              </div>
            )}
            
            {/* Add new endpoint */}
            <div className="flex gap-2">
              <Input
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                onKeyDown={(e) => e.key === 'Enter' && handleTestConnection()}
              />
              <Button 
                onClick={handleTestConnection} 
                disabled={!newEndpoint || isTesting}
                variant="outline"
              >
                {isTesting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter an MCP server URL and click the + button to test and add it
            </p>
          </div>

          {/* Default Model and Auto Select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Default Model</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-select</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={autoSelectModel}
                    onChange={(e) => setAutoSelectModel(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            <div className={autoSelectModel ? "opacity-50 pointer-events-none" : ""}>
              <ModelSelector
                selectedModelId={selectedDefaultModel}
                onSelect={setSelectedDefaultModel}
                disabled={autoSelectModel}
              />
            </div>
            {autoSelectModel && (
              <p className="text-xs text-muted-foreground mt-2">
                When enabled, the app will automatically select the most appropriate model based on your message content.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end p-4 border-t gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}