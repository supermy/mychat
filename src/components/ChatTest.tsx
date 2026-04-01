import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatTestProps {
  modelName: string;
  alias: string;
  port: number;
  onClose: () => void;
}

interface GenerationStats {
  tokens: number;
  tokensPerSecond: number;
  promptTokens: number;
  promptTokensPerSecond: number;
  predictedTokens: number;
  predictedTokensPerSecond: number;
  totalDuration: number;
  loadDuration: number;
  promptEvalDuration: number;
  evalDuration: number;
}

export function ChatTest({ modelName, alias, port, onClose }: ChatTestProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    const welcomeMessage: Message = {
      role: 'assistant',
      content: `你好！我是 ${modelName || alias}，已准备就绪。你可以开始向我提问了！\n\n💡 发送 "/stats" 查看性能指标`,
    };
    setMessages([welcomeMessage]);
  }, [modelName, alias]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStats(null);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: alias,
          messages: messages.concat(userMessage).map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || '无响应',
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      if (data.usage) {
        setStats({
          tokens: data.usage.total_tokens || 0,
          tokensPerSecond: 0,
          promptTokens: data.usage.prompt_tokens || 0,
          promptTokensPerSecond: 0,
          predictedTokens: data.usage.completion_tokens || 0,
          predictedTokensPerSecond: 0,
          totalDuration: 0,
          loadDuration: 0,
          promptEvalDuration: 0,
          evalDuration: 0,
        });
      }
      
      if (data.eval_rate) {
        setStats(prev => prev ? {
          ...prev,
          predictedTokensPerSecond: data.eval_rate,
          tokensPerSecond: data.eval_rate,
        } : null);
      }

      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ 错误: ${errMsg}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/models`);
      const data = await response.json();
      
      const statsMessage: Message = {
        role: 'assistant',
        content: `📊 模型信息:\n${JSON.stringify(data, null, 2)}`,
      };
      setMessages(prev => [...prev, statsMessage]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      Alert.alert('获取统计信息失败', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    if (text.trim() === '/stats') {
      handleStats();
      setInput('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          测试 {modelName || alias}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeButton, { color: theme.primary }]}>关闭</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
      >
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text style={[
              styles.messageRole,
              { color: msg.role === 'user' ? theme.primary : '#28a745' }
            ]}>
              {msg.role === 'user' ? '👤 你' : '🤖 AI'}
            </Text>
            <Text style={[styles.messageContent, { color: theme.text }]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.loadingContainer, styles.assistantMessage]}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              生成中...
            </Text>
          </View>
        )}
      </ScrollView>

      {stats && (
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>📊 性能指标</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Tokens</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.tokens}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Tokens/s</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.predictedTokensPerSecond.toFixed(1)}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Prompt</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.promptTokens}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>生成</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.predictedTokens}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.inputContainer, { borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          value={input}
          onChangeText={handleInputChange}
          placeholder="输入消息... (输入 /stats 查看模型信息)"
          placeholderTextColor={theme.textSecondary}
          multiline
          editable={!loading}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: theme.primary }, loading && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={loading || !input.trim()}
        >
          <Text style={styles.sendButtonText}>发送</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.title,
  },
  closeButton: {
    ...typography.body,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
  },
  messageRole: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  messageContent: {
    ...typography.body,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    maxWidth: '85%',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
  },
  statsCard: {
    padding: spacing.md,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  statsTitle: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '50%',
    paddingVertical: spacing.xs,
  },
  statsLabel: {
    ...typography.caption,
  },
  statsValue: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
