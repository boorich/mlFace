import React, { useState } from "react";
import { Sidebar } from "../sidebar/sidebar";
import { ChatWindow } from "../chat/chat-window";
import { SettingsDialog } from "../settings/settings-dialog";

export function MainLayout() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280); // Default sidebar width
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = startWidth + e.clientX - startX;
        // Limit the minimum and maximum width
        if (newWidth > 200 && newWidth < 400) {
          setSidebarWidth(newWidth);
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div 
        className="h-full"
        style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
      >
        <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />
      </div>
      
      {/* Resize handle */}
      <div
        className="w-1 bg-border hover:bg-accent cursor-col-resize relative z-10"
        onMouseDown={handleResizeStart}
      >
        {isResizing && (
          <div className="fixed inset-0 z-20" />
        )}
      </div>
      
      {/* Main content */}
      <div className="flex-1 h-full overflow-hidden">
        <ChatWindow />
      </div>
      
      {/* Settings dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}