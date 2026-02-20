import { Platform } from 'react-native';
import { ApiConfig, Message } from '../types';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIStreamChoice {
  delta: {
    content?: string;
    role?: string;
  };
  finish_reason: string | null;
}

interface OpenAIStreamResponse {
  choices: OpenAIStreamChoice[];
}

function parseSSE(text: string): OpenAIStreamResponse | null {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        return null;
      }
      try {
        return JSON.parse(data);
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
}

async function* streamChatCompletionWeb(
  url: string,
  body: string,
  headers: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API请求失败: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') {
          continue;
        }

        const parsed = parseSSE(line);
        if (parsed && parsed.choices && parsed.choices.length > 0) {
          const content = parsed.choices[0].delta?.content;
          if (content) {
            yield content;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* streamChatCompletionNative(
  url: string,
  body: string,
  headers: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    let buffer = '';
    let lastEventIndex = 0;

    xhr.onprogress = () => {
      const responseText = xhr.responseText;
      const newText = responseText.slice(lastEventIndex);
      lastEventIndex = responseText.length;

      buffer += newText;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') {
          continue;
        }

        const parsed = parseSSE(line);
        if (parsed && parsed.choices && parsed.choices.length > 0) {
          const content = parsed.choices[0].delta?.content;
          if (content) {
            // 在 React Native 中，我们无法真正使用 generator
            // 这里需要通过回调方式处理
          }
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`API请求失败: ${xhr.status} - ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('网络请求失败'));
    };

    xhr.send(body);
  }) as any;
}

async function nonStreamChatCompletion(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function* streamChatCompletion(
  config: ApiConfig,
  messages: Message[]
): AsyncGenerator<string, void, unknown> {
  const openaiMessages: OpenAIMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (config.systemPrompt) {
    openaiMessages.unshift({
      role: 'system',
      content: config.systemPrompt,
    });
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = `${baseUrl}/v1/chat/completions`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body = JSON.stringify({
    model: config.model,
    messages: openaiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: Platform.OS === 'web',
  });

  console.log('Requesting:', url);
  console.log('Model:', config.model);
  console.log('Platform:', Platform.OS);

  if (Platform.OS === 'web') {
    yield* streamChatCompletionWeb(url, body, headers);
  } else {
    // React Native: 使用非流式请求
    const content = await nonStreamChatCompletion(url, body, headers);
    yield content;
  }
}

export async function testApiConnection(config: ApiConfig): Promise<boolean> {
  try {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const url = `${baseUrl}/v1/models`;
    console.log('Testing connection:', url);
    
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    console.log('Test result:', response.status);
    return response.ok;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
}
