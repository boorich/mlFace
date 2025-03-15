import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { Chat, Message, Model, Settings, ThemeMode } from '../types';
import { generateChatTitle } from '../lib/chat/generate-title';

interface State {
  chats: Chat[];
  activeChat: string | null;
  models: Model[];
  settings: Settings;
  isLoading: boolean;
}

interface Actions {
  setActiveChat: (chatId: string) => void;
  createChat: (modelId: string) => string;
  deleteChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string, isManual?: boolean) => void;
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  addModels: (models: Model[]) => void;
  removeModel: (modelId: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;
  setIsLoading: (isLoading: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  openrouterApiKey: '',
  mcpEndpoints: [],
  defaultModelId: '',
  autoSelectModel: false,
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChat: null,
      models: [],
      settings: DEFAULT_SETTINGS,
      isLoading: false,

      setActiveChat: (chatId) => set({ activeChat: chatId }),
      
      createChat: (modelId) => {
        const chatId = nanoid();
        const newChat: Chat = {
          id: chatId,
          title: 'New Chat',
          messages: [],
          modelId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          titleIsManual: false, // Initially not manually set
        };
        
        set((state) => ({
          chats: [...state.chats, newChat],
          activeChat: chatId,
        }));
        
        return chatId;
      },
      
      deleteChat: (chatId) => {
        set((state) => {
          const newChats = state.chats.filter((chat) => chat.id !== chatId);
          const newActiveChat = state.activeChat === chatId
            ? newChats.length > 0 ? newChats[0].id : null
            : state.activeChat;
            
          return {
            chats: newChats,
            activeChat: newActiveChat,
          };
        });
      },
      
      updateChatTitle: (chatId, title, isManual = true) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { 
                  ...chat, 
                  title, 
                  titleIsManual: isManual, // Set the manual flag
                  updatedAt: new Date().toISOString() 
                }
              : chat
          ),
        }));
      },
      
      addMessage: (chatId, message) => {
        const newMessage: Message = {
          id: nanoid(),
          ...message,
          timestamp: new Date().toISOString(),
        };
        
        set((state) => {
          const targetChat = state.chats.find(chat => chat.id === chatId);
          
          if (!targetChat) {
            return state; // No changes if chat doesn't exist
          }
          
          // Update the chat with the new message
          const updatedMessages = [...targetChat.messages, newMessage];
          const updatedChat = {
            ...targetChat,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
          
          // If we have at least one user message and one assistant reply (or more messages)
          // and the title hasn't been manually set, generate a new title
          const hasUserMessage = updatedMessages.some(msg => msg.role === 'user');
          const hasAssistantResponse = updatedMessages.some(msg => msg.role === 'assistant');
          
          if (
            updatedMessages.length >= 2 && 
            hasUserMessage &&
            hasAssistantResponse &&
            !targetChat.titleIsManual
          ) {
            // Set a new auto-generated title
            updatedChat.title = generateChatTitle(updatedMessages);
          }
          
          // Return updated state
          return {
            chats: state.chats.map(chat => 
              chat.id === chatId ? updatedChat : chat
            ),
          };
        });
      },
      
      addModels: (models) => {
        set((state) => {
          const existingIds = new Set(state.models.map((m) => m.id));
          const newModels = models.filter((m) => !existingIds.has(m.id));
          return {
            models: [...state.models, ...newModels],
          };
        });
      },
      
      removeModel: (modelId) => {
        set((state) => ({
          models: state.models.filter((model) => model.id !== modelId),
        }));
      },
      
      updateSettings: (settings) => {
        set((state) => ({
          settings: { ...state.settings, ...settings },
        }));
      },
      
      setTheme: (theme) => {
        set((state) => ({
          settings: { ...state.settings, theme },
        }));
      },
      
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mlface-storage',
    }
  )
);