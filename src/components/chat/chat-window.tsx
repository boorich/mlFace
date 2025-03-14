import React, { useState } from "react";
import { useStore } from "../../store/useStore";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { sendMessage } from "../../services/api";
import { selectModelForPrompt } from "../../lib/model-selection";

export function ChatWindow() {
  const { chats, activeChat, addMessage, models, settings, setIsLoading } = useStore();
  const [isTyping, setIsTyping] = useState(false);

  const currentChat = activeChat 
    ? chats.find(chat => chat.id === activeChat) 
    : null;

  const currentModel = currentChat 
    ? models.find(model => model.id === currentChat.modelId) 
    : null;

  if (!currentChat || !currentModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No active chat</p>
          <p className="text-sm">Select a chat from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (content: string) => {
    // Add user message to the chat
    addMessage(currentChat.id, {
      content,
      role: "user",
    });

    // Set typing indicator
    setIsTyping(true);
    setIsLoading(true);

    try {
      // If auto-select is enabled, determine the best model for this message
      let modelToUse = currentModel;
      
      if (settings.autoSelectModel) {
        const autoSelectedModel = selectModelForPrompt(models, content);
        if (autoSelectedModel) {
          modelToUse = autoSelectedModel;
          
          // Add a system message indicating the model change if it's different
          if (modelToUse.id !== currentChat.modelId) {
            addMessage(currentChat.id, {
              content: `Auto-selected model: ${modelToUse.name} based on your message content.`,
              role: "system",
            });
          }
        }
      }

      // Send message to API and get response
      const response = await sendMessage(
        modelToUse,
        [...currentChat.messages, { id: "temp", content, role: "user", timestamp: new Date().toISOString() }],
        settings.openrouterApiKey
      );

      // Add assistant response to the chat
      addMessage(currentChat.id, {
        content: response,
        role: "assistant",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message to chat
      addMessage(currentChat.id, {
        content: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
        role: "system",
      });
    } finally {
      // Hide typing indicator
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 bg-background">
        <h2 className="text-lg font-medium">{currentChat.title}</h2>
        <p className="text-sm text-muted-foreground">
          Model: {currentModel.name}
          {settings.autoSelectModel && " (Auto-select enabled)"}
        </p>
      </div>

      <ChatHistory 
        messages={currentChat.messages} 
        isTyping={isTyping} 
      />

      <ChatInput 
        onSendMessage={handleSendMessage} 
        disabled={isTyping}
      />
    </div>
  );
}