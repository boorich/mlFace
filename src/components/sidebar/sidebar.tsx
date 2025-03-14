import React from "react";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { ChatList } from "./chat-list";
import { Button } from "../ui/button";
import { useTheme } from "../theme/theme-provider";
import { Link } from "react-router-dom";
import { Brand } from "../brand";

interface SidebarProps {
  onSettingsClick: () => void;
}

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  
  const themeIcons = {
    light: <Sun className="h-5 w-5" />,
    dark: <Moon className="h-5 w-5" />,
    system: <Monitor className="h-5 w-5" />,
  };
  
  const nextTheme = {
    light: "dark",
    dark: "system",
    system: "light",
  } as const;

  return (
    <div className="h-full border-r flex flex-col bg-background">
      <div className="p-4 border-b">
        <Brand size="md" />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <ChatList />
      </div>
      
      <div className="p-4 border-t flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(nextTheme[theme])}
          title={`Current theme: ${theme}. Click to switch.`}
        >
          {themeIcons[theme]}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}