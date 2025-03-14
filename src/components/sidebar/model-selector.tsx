import React, { useEffect, useState } from "react";
import { ChevronDown, Server, Cloud } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { Model } from "../../types";
import { fetchOpenRouterModels, fetchMCPModels } from "../../services/api";

interface ModelSelectorProps {
  onSelect: (modelId: string) => void;
  selectedModelId?: string;
}

export function ModelSelector({ onSelect, selectedModelId }: ModelSelectorProps) {
  const { models, addModels, settings } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedModel = models.find(model => model.id === selectedModelId);

  // Fetch models on mount
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      
      try {
        // Fetch OpenRouter models if API key is set
        if (settings.openrouterApiKey) {
          const openRouterModels = await fetchOpenRouterModels(settings.openrouterApiKey);
          addModels(openRouterModels);
        }
        
        // Fetch MCP models from configured endpoints
        const mcpModels: Model[] = [];
        for (const endpoint of settings.mcpEndpoints) {
          const endpointModels = await fetchMCPModels(endpoint);
          mcpModels.push(...endpointModels);
        }
        
        if (mcpModels.length > 0) {
          addModels(mcpModels);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchModels();
  }, [settings.openrouterApiKey, settings.mcpEndpoints, addModels]);

  // Group models by provider
  const groupedModels = models.reduce<Record<string, Model[]>>(
    (groups, model) => {
      const providerName = model.provider === 'openrouter' ? 'OpenRouter' : 'Local MCP';
      groups[providerName] = groups[providerName] || [];
      groups[providerName].push(model);
      return groups;
    },
    {}
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || models.length === 0}
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
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-popover border rounded-md shadow-md">
          <div className="p-1 max-h-60 overflow-y-auto">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}