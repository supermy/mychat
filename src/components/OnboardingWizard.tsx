import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  TextInput,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '../theme';
import '../types/electron';

type WizardStep = 'welcome' | 'provider' | 'apikey' | 'model' | 'memory' | 'channels' | 'complete';

interface OnboardingConfig {
  provider: string;
  apiKey: string;
  model: string;
  memory: string;
  channels: {
    telegram: { enabled: boolean; token: string };
    discord: { enabled: boolean; token: string };
    slack: { enabled: boolean; token: string };
  };
}

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', description: '多模型聚合平台' },
  { id: 'openai', name: 'OpenAI', description: 'GPT系列模型' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude系列模型' },
  { id: 'llamacpp', name: 'LLaMA.cpp', description: '本地模型' },
];

const MEMORY_BACKENDS = [
  { id: 'sqlite', name: 'SQLite', description: '轻量级数据库（推荐）' },
  { id: 'markdown', name: 'Markdown', description: '文件存储' },
  { id: 'lucid', name: 'Lucid', description: '高级内存系统' },
  { id: 'none', name: 'None', description: '不使用内存' },
];

const DEFAULT_CONFIG: OnboardingConfig = {
  provider: 'openrouter',
  apiKey: '',
  model: '',
  memory: 'sqlite',
  channels: {
    telegram: { enabled: false, token: '' },
    discord: { enabled: false, token: '' },
    slack: { enabled: false, token: '' },
  },
};

interface OnboardingWizardProps {
  onComplete: (config: OnboardingConfig) => void;
  onCancel: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [config, setConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    if (step === 'model' && config.provider !== 'llamacpp') {
      loadModels();
    }
  }, [step, config.provider]);

  const loadModels = async () => {
    if (!window.electronAPI) return;
    
    setLoading(true);
    try {
      const result = await window.electronAPI.zeroclawStatus();
      if (result.success) {
        // Parse models from status output
        const modelMatch = result.output.match(/Model:\s*(\S+)/);
        if (modelMatch) {
          setModels([modelMatch[1]]);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const steps: WizardStep[] = ['welcome', 'provider', 'apikey', 'model', 'memory', 'channels', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ['welcome', 'provider', 'apikey', 'model', 'memory', 'channels', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleComplete = async () => {
    if (!window.electronAPI) return;
    
    setLoading(true);
    try {
      const zeroclawConfig = {
        provider: config.provider,
        api_key: config.apiKey,
        model: config.model,
        memory: { backend: config.memory },
        channels: config.channels,
      };
      
      await window.electronAPI.saveZeroclawConfig(zeroclawConfig);
      onComplete(config);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      Alert.alert('保存失败', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>欢迎使用 ZeroClaw</Text>
      <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
        本向导将帮助您配置 ZeroClaw AI 助手。
      </Text>
      
      <View style={[styles.featureList, { backgroundColor: theme.surface }]}>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          🤖 配置 AI 提供商和模型
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          💾 设置内存系统
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          📱 配置消息渠道
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          ⚡ 快速开始使用
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        onPress={handleNext}
      >
        <Text style={styles.primaryButtonText}>开始配置</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProvider = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>选择 AI 提供商</Text>
      
      {PROVIDERS.map((provider) => (
        <TouchableOpacity
          key={provider.id}
          style={[
            styles.optionCard,
            { backgroundColor: theme.surface },
            config.provider === provider.id && { borderColor: theme.primary, borderWidth: 2 }
          ]}
          onPress={() => setConfig({ ...config, provider: provider.id })}
        >
          <Text style={[styles.optionName, { color: theme.text }]}>{provider.name}</Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            {provider.description}
          </Text>
        </TouchableOpacity>
      ))}
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApiKey = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>输入 API Key</Text>
      <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
        请输入您的 {PROVIDERS.find(p => p.id === config.provider)?.name} API Key
      </Text>
      
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        value={config.apiKey}
        onChangeText={(text) => setConfig({ ...config, apiKey: text })}
        placeholder="sk-..."
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      {config.provider === 'llamacpp' && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          使用本地模型不需要 API Key
        </Text>
      )}
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderModel = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>选择模型</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
      ) : (
        <>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.model}
            onChangeText={(text) => setConfig({ ...config, model: text })}
            placeholder="模型 ID（如：openai/gpt-4）"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {config.provider === 'openrouter' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              格式：provider/model（如：openai/gpt-4、anthropic/claude-3-opus）
            </Text>
          )}
          
          {config.provider === 'llamacpp' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              输入本地模型名称（如：qwen3-35b）
            </Text>
          )}
        </>
      )}
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMemory = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>选择内存系统</Text>
      
      {MEMORY_BACKENDS.map((memory) => (
        <TouchableOpacity
          key={memory.id}
          style={[
            styles.optionCard,
            { backgroundColor: theme.surface },
            config.memory === memory.id && { borderColor: theme.primary, borderWidth: 2 }
          ]}
          onPress={() => setConfig({ ...config, memory: memory.id })}
        >
          <Text style={[styles.optionName, { color: theme.text }]}>{memory.name}</Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            {memory.description}
          </Text>
        </TouchableOpacity>
      ))}
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderChannels = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>配置消息渠道（可选）</Text>
      <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
        选择您想要启用的消息渠道
      </Text>
      
      <View style={[styles.channelCard, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.channelRow}
          onPress={() => setConfig({
            ...config,
            channels: { ...config.channels, telegram: { ...config.channels.telegram, enabled: !config.channels.telegram.enabled } }
          })}
        >
          <Text style={[styles.channelName, { color: theme.text }]}>📱 Telegram</Text>
          <View style={[styles.checkbox, config.channels.telegram.enabled && { backgroundColor: theme.primary }]}>
            {config.channels.telegram.enabled && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        {config.channels.telegram.enabled && (
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={config.channels.telegram.token}
            onChangeText={(text) => setConfig({
              ...config,
              channels: { ...config.channels, telegram: { ...config.channels.telegram, token: text } }
            })}
            placeholder="Bot Token"
            secureTextEntry
          />
        )}
      </View>
      
      <View style={[styles.channelCard, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.channelRow}
          onPress={() => setConfig({
            ...config,
            channels: { ...config.channels, discord: { ...config.channels.discord, enabled: !config.channels.discord.enabled } }
          })}
        >
          <Text style={[styles.channelName, { color: theme.text }]}>💬 Discord</Text>
          <View style={[styles.checkbox, config.channels.discord.enabled && { backgroundColor: theme.primary }]}>
            {config.channels.discord.enabled && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        {config.channels.discord.enabled && (
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={config.channels.discord.token}
            onChangeText={(text) => setConfig({
              ...config,
              channels: { ...config.channels, discord: { ...config.channels.discord, token: text } }
            })}
            placeholder="Bot Token"
            secureTextEntry
          />
        )}
      </View>
      
      <View style={[styles.channelCard, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.channelRow}
          onPress={() => setConfig({
            ...config,
            channels: { ...config.channels, slack: { ...config.channels.slack, enabled: !config.channels.slack.enabled } }
          })}
        >
          <Text style={[styles.channelName, { color: theme.text }]}>💼 Slack</Text>
          <View style={[styles.checkbox, config.channels.slack.enabled && { backgroundColor: theme.primary }]}>
            {config.channels.slack.enabled && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        {config.channels.slack.enabled && (
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={config.channels.slack.token}
            onChangeText={(text) => setConfig({
              ...config,
              channels: { ...config.channels, slack: { ...config.channels.slack, token: text } }
            })}
            placeholder="Bot Token"
            secureTextEntry
          />
        )}
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>配置完成！</Text>
      
      <View style={[styles.summaryBox, { backgroundColor: theme.surface }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>配置摘要</Text>
        <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
          提供商: {PROVIDERS.find(p => p.id === config.provider)?.name}
        </Text>
        <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
          模型: {config.model || '未设置'}
        </Text>
        <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
          内存: {MEMORY_BACKENDS.find(m => m.id === config.memory)?.name}
        </Text>
        <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
          渠道: {Object.entries(config.channels).filter(([_, v]) => v.enabled).map(([k]) => k).join(', ') || '无'}
        </Text>
      </View>
      
      <Text style={[styles.completeHint, { color: theme.textSecondary }]}>
        点击「完成」保存配置并开始使用 ZeroClaw！
      </Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>完成</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome': return renderWelcome();
      case 'provider': return renderProvider();
      case 'apikey': return renderApiKey();
      case 'model': return renderModel();
      case 'memory': return renderMemory();
      case 'channels': return renderChannels();
      case 'complete': return renderComplete();
      default: return renderWelcome();
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.progressIndicator}>
        {['welcome', 'provider', 'apikey', 'model', 'memory', 'channels', 'complete'].map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              { backgroundColor: step === s ? theme.primary : theme.border }
            ]}
          />
        ))}
      </View>
      
      {renderStep()}
      
      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: theme.border }]}
        onPress={onCancel}
      >
        <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>取消</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: spacing.xs,
  },
  stepContainer: {
    maxWidth: 600,
    alignSelf: 'center',
  },
  stepTitle: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  stepDescription: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  featureList: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  featureItem: {
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  optionCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  optionName: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  optionDesc: {
    ...typography.body,
  },
  input: {
    ...typography.body,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  spinner: {
    marginVertical: spacing.lg,
  },
  channelCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelName: {
    ...typography.subtitle,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  completeHint: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    ...typography.subtitle,
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...typography.subtitle,
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
  cancelButtonText: {
    ...typography.subtitle,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
