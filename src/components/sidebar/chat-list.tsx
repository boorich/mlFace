import React from "react";
import { PlusIcon, MessageSquare, Trash2, Edit, MoreVertical } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function ChatList() {
  const { chats, activeChat, setActiveChat, createChat, deleteChat, updateChatTitle, settings } = useStore();
  const [editingChatId, setEditingChatId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  
  const handleCreateChat = () => {
    const defaultModelId = settings.defaultModelId || 
      (settings.openrouterApiKey ? "openrouter-anthropic/claude-3-opus" : "");
    
    if (!defaultModelId) {
      // Should show a notification that no model is available
      console.error("No default model selected");
      return;
    }
    
    createChat(defaultModelId);
  };
  
  const startEditingChat = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };
  
  const saveEditedTitle = (chatId: string) => {
    if (editingTitle.trim()) {
      updateChatTitle(chatId, editingTitle);
    }
    setEditingChatId(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === "Enter") {
      saveEditedTitle(chatId);
    } else if (e.key === "Escape") {
      setEditingChatId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button 
          className="w-full justify-start gap-2" 
          onClick={handleCreateChat}
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {chats.length === 0 ? (
          <div className="text-center text-muted-foreground p-4">
            <p>No chats yet</p>
            <p className="text-sm">Create a new chat to get started</p>
          </div>
        ) : (
          <ul className="space-y-1 px-2">
            {chats.map((chat) => (
              <li key={chat.id}>
                {editingChatId === chat.id ? (
                  <div className="flex items-center px-2 py-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => saveEditedTitle(chat.id)}
                      onKeyDown={(e) => handleKeyDown(e, chat.id)}
                      className="w-full px-2 py-1 rounded border text-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted text-left",
                      activeChat === chat.id && "bg-muted"
                    )}
                    onClick={() => setActiveChat(chat.id)}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{chat.title}</span>
                    
                    <div className="flex opacity-0 group-hover:opacity-100 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingChat(chat.id, chat.title);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}