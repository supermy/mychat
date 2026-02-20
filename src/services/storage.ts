import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const StorageService = {
  async getApiConfig(): Promise<ApiConfig> {
    try {
      const config = await AsyncStorage.getItem(STORAGE_KEYS.API_CONFIG);
      return config ? JSON.parse(config) : DEFAULT_API_CONFIG;
    } catch (error) {
      console.error('Error loading API config:', error);
      return DEFAULT_API_CONFIG;
    }
  },

  async saveApiConfig(config: ApiConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving API config:', error);
      throw error;
    }
  },

  async getConversations(): Promise<Conversation[]> {
    try {
      const conversations = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return conversations ? JSON.parse(conversations) : [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  },

  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
      throw error;
    }
  },

  async getCurrentConversationId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION);
    } catch (error) {
      console.error('Error loading current conversation ID:', error);
      return null;
    }
  },

  async saveCurrentConversationId(id: string | null): Promise<void> {
    try {
      if (id) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);
      }
    } catch (error) {
      console.error('Error saving current conversation ID:', error);
      throw error;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
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
