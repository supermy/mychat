import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { generateUUID } from '../utils/uuid';
import { ChatState, Message, Conversation, ApiConfig } from '../types';
import { StorageService } from '../services/storage';
import { streamChatCompletion } from '../services/api';

type Action =
  | { type: 'LOAD_STATE'; payload: Partial<ChatState> }
  | { type: 'SET_API_CONFIG'; payload: ApiConfig }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CREATE_CONVERSATION' }
  | { type: 'SELECT_CONVERSATION'; payload: string }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; content: string; isStreaming?: boolean } }
  | { type: 'RENAME_CONVERSATION'; payload: { id: string; title: string } };

const initialState: ChatState = {
  conversations: [],
  currentConversationId: null,
  apiConfig: {
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    model: 'qwen3:0.6b',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: '你是一个有帮助的AI助手。',
  },
  isLoading: false,
};

function chatReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'SET_API_CONFIG':
      return { ...state, apiConfig: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'CREATE_CONVERSATION': {
      const newConversation: Conversation = {
        id: generateUUID(),
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        ...state,
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newConversation.id,
      };
    }

    case 'SELECT_CONVERSATION':
      return { ...state, currentConversationId: action.payload };

    case 'DELETE_CONVERSATION': {
      const filtered = state.conversations.filter(c => c.id !== action.payload);
      const newCurrentId = state.currentConversationId === action.payload
        ? (filtered.length > 0 ? filtered[0].id : null)
        : state.currentConversationId;
      return {
        ...state,
        conversations: filtered,
        currentConversationId: newCurrentId,
      };
    }

    case 'ADD_MESSAGE': {
      const { conversationId, message } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(c => {
          if (c.id === conversationId) {
            const updatedMessages = [...c.messages, message];
            const title = c.messages.length === 0 && message.role === 'user'
              ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
              : c.title;
            return {
              ...c,
              messages: updatedMessages,
              title,
              updatedAt: Date.now(),
            };
          }
          return c;
        }),
      };
    }

    case 'UPDATE_MESSAGE': {
      const { conversationId, messageId, content, isStreaming } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === messageId) {
                  return { ...m, content, isStreaming };
                }
                return m;
              }),
              updatedAt: Date.now(),
            };
          }
          return c;
        }),
      };
    }

    case 'RENAME_CONVERSATION': {
      return {
        ...state,
        conversations: state.conversations.map(c => {
          if (c.id === action.payload.id) {
            return { ...c, title: action.payload.title };
          }
          return c;
        }),
      };
    }

    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<Action>;
  sendMessage: (content: string) => Promise<void>;
  createConversation: () => void;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
  updateApiConfig: (config: ApiConfig) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    loadState();
  }, []);

  useEffect(() => {
    if (state.conversations.length > 0 || state.apiConfig.baseUrl !== initialState.apiConfig.baseUrl) {
      StorageService.saveConversations(state.conversations);
      StorageService.saveApiConfig(state.apiConfig);
      if (state.currentConversationId) {
        StorageService.saveCurrentConversationId(state.currentConversationId);
      }
    }
  }, [state.conversations, state.apiConfig, state.currentConversationId]);

  async function loadState() {
    const [apiConfig, conversations, currentId] = await Promise.all([
      StorageService.getApiConfig(),
      StorageService.getConversations(),
      StorageService.getCurrentConversationId(),
    ]);

    dispatch({
      type: 'LOAD_STATE',
      payload: {
        apiConfig,
        conversations,
        currentConversationId: currentId || (conversations.length > 0 ? conversations[0].id : null),
      },
    });
  }

  async function sendMessage(content: string) {
    if (!state.currentConversationId || !content.trim()) {
      return;
    }

    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: state.currentConversationId, message: userMessage } });
    dispatch({ type: 'SET_LOADING', payload: true });

    const assistantMessage: Message = {
      id: generateUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: state.currentConversationId, message: assistantMessage } });

    try {
      const conversation = state.conversations.find(c => c.id === state.currentConversationId);
      const messages = conversation ? [...conversation.messages, userMessage] : [userMessage];

      let fullContent = '';
      for await (const chunk of streamChatCompletion(state.apiConfig, messages)) {
        fullContent += chunk;
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: state.currentConversationId!,
            messageId: assistantMessage.id,
            content: fullContent,
            isStreaming: true,
          },
        });
      }

      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: state.currentConversationId!,
          messageId: assistantMessage.id,
          content: fullContent,
          isStreaming: false,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发生未知错误';
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: state.currentConversationId!,
          messageId: assistantMessage.id,
          content: `错误: ${errorMessage}`,
          isStreaming: false,
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  function createConversation() {
    dispatch({ type: 'CREATE_CONVERSATION' });
  }

  function deleteConversation(id: string) {
    dispatch({ type: 'DELETE_CONVERSATION', payload: id });
  }

  function selectConversation(id: string) {
    dispatch({ type: 'SELECT_CONVERSATION', payload: id });
  }

  async function updateApiConfig(config: ApiConfig) {
    dispatch({ type: 'SET_API_CONFIG', payload: config });
    await StorageService.saveApiConfig(config);
  }

  return (
    <ChatContext.Provider
      value={{
        state,
        dispatch,
        sendMessage,
        createConversation,
        deleteConversation,
        selectConversation,
        updateApiConfig,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
