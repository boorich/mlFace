import React, { useEffect, useState } from "react";
import { ChevronDown, Server, Cloud, RefreshCw } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { Model, MCPModel } from "../../types";
import { fetchOpenRouterModels, fetchMCPModels } from "../../services/api";

interface ModelSelectorProps {
  onSelect: (modelId: string) => void;
  selectedModelId?: string;
  disabled?: boolean;
}

export function ModelSelector({ onSelect, selectedModelId, disabled = false }: ModelSelectorProps) {
  const { models, addModels, settings, updateSettings } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedModel = models.find(model => model.id === selectedModelId);

  const [mcpErrors, setMcpErrors] = useState<Record<string, string>>({});

  // Fetch models on mount and when settings change
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      setMcpErrors({});
      
      try {
        // Fetch OpenRouter models if API key is set
        if (settings.openrouterApiKey) {
          try {
            const openRouterModels = await fetchOpenRouterModels(settings.openrouterApiKey);
            addModels(openRouterModels);
          } catch (error) {
            console.error("Error fetching OpenRouter models:", error);
          }
        }
        
        // Fetch MCP models from configured endpoints
        const mcpModelPromises = settings.mcpEndpoints.map(async (endpoint) => {
          try {
            const endpointModels = await fetchMCPModels(endpoint);
            return { endpoint, models: endpointModels, error: null };
          } catch (error) {
            console.error(`Error fetching models from ${endpoint}:`, error);
            return { 
              endpoint, 
              models: [], 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        });
        
        const mcpResults = await Promise.all(mcpModelPromises);
        
        // Add all successfully fetched models
        const allMcpModels: Model[] = [];
        const errors: Record<string, string> = {};
        
        mcpResults.forEach(result => {
          if (result.models.length > 0) {
            allMcpModels.push(...result.models);
          }
          if (result.error) {
            errors[result.endpoint] = result.error;
          }
        });
        
        if (allMcpModels.length > 0) {
          addModels(allMcpModels);
        }
        
        setMcpErrors(errors);
      } catch (error) {
        console.error("Error in model fetching:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchModels();
  }, [settings.openrouterApiKey, settings.mcpEndpoints, addModels]);

  // Add a refresh function
  const refreshModels = () => {
    // Simply trigger the useEffect by forcing a new reference to mcpEndpoints
    const tempEndpoints = [...settings.mcpEndpoints];
    addModels([]);
    setTimeout(() => {
      updateSettings({ mcpEndpoints: tempEndpoints });
    }, 100);
  };

  // Group models by provider
  const groupedModels = models.reduce<Record<string, Model[]>>(
    (groups, model) => {
      let providerName;
      if (model.provider === 'openrouter') {
        providerName = 'OpenRouter';
      } else if (model.provider === 'mcp') {
        // Extract the endpoint from the id to group by server
        const mcpModel = model as MCPModel;
        providerName = `MCP: ${mcpModel.endpoint}`;
      } else {
        providerName = 'Other';
      }
      groups[providerName] = groups[providerName] || [];
      groups[providerName].push(model);
      return groups;
    },
    {}
  );

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || isLoading || models.length === 0}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedModel ? (
              <>
                {selectedModel.provider === 'openrouter' ? (
                  <Cloud className="h-4 w-4" />
                ) : (
                  <Server className="h-4 w-4" />
                )}
                <span className="truncate">{selectedModel.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {isLoading ? "Loading models..." : "Select a model"}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
        
        {!disabled && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-1 h-9 w-9" 
            onClick={refreshModels}
            disabled={isLoading}
            title="Refresh models"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>
      
      {/* Display error messages */}
      {Object.keys(mcpErrors).length > 0 && !disabled && (
        <div className="mb-3 text-xs text-red-500 dark:text-red-400">
          <p className="font-semibold">Failed to connect to some MCP servers:</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            {Object.entries(mcpErrors).map(([endpoint, error]) => (
              <li key={endpoint} className="truncate" title={`${endpoint}: ${error}`}>
                <span className="font-medium">{endpoint}</span>: {error}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md">
          <div className="p-1 max-h-60 overflow-y-auto">
            {Object.entries(groupedModels).length > 0 ? (
              Object.entries(groupedModels).map(([provider, providerModels]) => (
                <div key={provider} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {provider}
                  </div>
                  <div className="space-y-1">
                    {providerModels.map((model) => (
                      <button
                        key={model.id}
                        className={cn(
                          "flex items-center gap-2 w-full px-2 py-1 text-left text-sm rounded hover:bg-accent",
                          selectedModelId === model.id && "bg-accent"
                        )}
                        onClick={() => {
                          onSelect(model.id);
                          setIsOpen(false);
                        }}
                      >
                        {model.provider === 'openrouter' ? (
                          <Cloud className="h-4 w-4" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                        <span className="truncate flex-1">{model.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-2 text-center text-sm text-muted-foreground">
                No models available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}