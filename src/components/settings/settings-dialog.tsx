import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ModelSelector } from "../sidebar/model-selector";
import { useTheme } from "../theme/theme-provider";
import { ThemeMode } from "../../types";

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
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
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
            <h3 className="text-sm font-medium mb-2">MCP Server Endpoints</h3>
            <div className="space-y-2 mb-2">
              {mcpEndpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No endpoints configured</p>
              ) : (
                mcpEndpoints.map((endpoint) => (
                  <div key={endpoint} className="flex items-center justify-between">
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
            <div className="flex gap-2">
              <Input
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <Button onClick={handleAddEndpoint} disabled={!newEndpoint}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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