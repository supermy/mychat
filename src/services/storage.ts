import { Platform } from 'react-native';
import { ApiConfig, Conversation } from '../types';

const STORAGE_KEYS = {
  API_CONFIG: '@mychat_api_config',
  CONVERSATIONS: '@mychat_conversations',
  CURRENT_CONVERSATION: '@mychat_current_conversation',
};

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  model: 'qwen3:0.6b',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '你是一个有帮助的AI助手。',
};

// Use AsyncStorage for native platforms, localStorage for web
let storage: any;
if (Platform.OS === 'web') {
  // Web platform - use localStorage
  storage = {
    async getItem(key: string): Promise<string | null> {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('Error getting item from localStorage:', error);
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error setting item in localStorage:', error);
        throw error;
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing item from localStorage:', error);
        throw error;
      }
    },
    async multiRemove(keys: string[]): Promise<void> {
      try {
        keys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.error('Error removing items from localStorage:', error);
        throw error;
      }
    },
  };
} else {
  // Native platforms - use AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

export const StorageService = {
  async getApiConfig(): Promise<ApiConfig> {
    try {
      const config = await storage.getItem(STORAGE_KEYS.API_CONFIG);
      return config ? JSON.parse(config) : DEFAULT_API_CONFIG;
    } catch (error) {
      console.error('Error loading API config:', error);
      return DEFAULT_API_CONFIG;
    }
  },

  async saveApiConfig(config: ApiConfig): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving API config:', error);
      throw error;
    }
  },

  async getConversations(): Promise<Conversation[]> {
    try {
      const conversations = await storage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return conversations ? JSON.parse(conversations) : [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  },

  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
      throw error;
    }
  },

  async getCurrentConversationId(): Promise<string | null> {
    try {
      return await storage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION);
    } catch (error) {
      console.error('Error loading current conversation ID:', error);
      return null;
    }
  },

  async saveCurrentConversationId(id: string | null): Promise<void> {
    try {
      if (id) {
        await storage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id);
      } else {
        await storage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);
      }
    } catch (error) {
      console.error('Error saving current conversation ID:', error);
      throw error;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await storage.multiRemove([
        STORAGE_KEYS.API_CONFIG,
        STORAGE_KEYS.CONVERSATIONS,
        STORAGE_KEYS.CURRENT_CONVERSATION,
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },
};
