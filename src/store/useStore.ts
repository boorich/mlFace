import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { Chat, Message, Model, Settings, ThemeMode } from '../types';

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
  updateChatTitle: (chatId: string, title: string) => void;
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
      
      updateChatTitle: (chatId, title) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, title, updatedAt: new Date().toISOString() }
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
        
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  updatedAt: new Date().toISOString(),
                }
              : chat
          ),
        }));
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