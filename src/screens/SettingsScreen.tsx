import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { colors, spacing, typography } from '../theme';
import { ApiConfig } from '../types';
import { testApiConnection } from '../services/api';
import {
  AVAILABLE_MODELS,
  recommendModels,
  getRecommendedModel,
  formatBytes,
  getModelDefaultConfig,
  HardwareCapabilities,
} from '../services/models';
import { llamaServer, LlamaServerStatus } from '../services/llamaServer';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

interface Model {
  id: string;
  name: string;
  description: string;
  vramRequirement: number;
  size: number;
}

export function SettingsScreen() {
  const { state, updateApiConfig } = useChat();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [config, setConfig] = useState<ApiConfig>(state.apiConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [serverStatus, setServerStatus] = useState<LlamaServerStatus>({ isRunning: false, port: 8080 });
  const [isStarting, setIsStarting] = useState(false);

  const capabilities: HardwareCapabilities = {
    ram: 16_000_000_000,
    vram: 8_000_000_000,
    hasGPU: true,
    cores: 8,
  };

  const recommendedModels = recommendModels(capabilities);
  const recommendedModel = getRecommendedModel(capabilities);

  useEffect(() => {
    const unsubscribe = llamaServer.onStatusChange((status) => {
      setServerStatus(status);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setConfig(state.apiConfig);
  }, [state.apiConfig]);

  const handleSave = async () => {
    try {
      await updateApiConfig(config);
      showAlert('成功', '配置已保存');
    } catch (error) {
      showAlert('错误', '保存配置失败');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const success = await testApiConnection(config);
      if (success) {
        setTestResult({ success: true, message: '连接成功!' });
      } else {
        setTestResult({ success: false, message: '连接失败，请检查配置' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: '错误: ' + (error instanceof Error ? error.message : '未知错误') 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSelectModel = async (model: typeof AVAILABLE_MODELS[0]) => {
    setSelectedModel({
      id: model.id,
      name: model.name,
      description: model.description,
      vramRequirement: model.vramRequirement,
      size: model.size,
    });

    const modelConfig = getModelDefaultConfig(model.id);
    setConfig(prev => ({
      ...prev,
      model: model.id,
      maxTokens: modelConfig.maxTokens || 2048,
    }));

    showAlert('模型已选择', `已选择 ${model.name}\n\n显存要求: ${formatBytes(model.vramRequirement)}\n大小: ${formatBytes(model.size)}\n\n点击"启动本地服务"开始下载并运行模型`);
  };

  const handleStartServer = async () => {
    if (!selectedModel) {
      showAlert('请先选择模型', '请从下方列表选择一个模型');
      return;
    }

    setIsStarting(true);
    const modelConfig = getModelDefaultConfig(selectedModel.id);

    const success = await llamaServer.start({
      binaryPath: '',
      modelPath: selectedModel.id,
      port: 8080,
      contextSize: modelConfig.contextSize || 2048,
      threads: modelConfig.threads || 4,
      gpuLayers: modelConfig.gpuLayers || 20,
    });

    setIsStarting(false);

    if (success) {
      setConfig(prev => ({
        ...prev,
        baseUrl: 'http://localhost:8080/v1',
        apiKey: '',
      }));
      showAlert('服务已启动', `服务器已在 http://localhost:8080 启动\n模型: ${selectedModel.name}`);
    }
  };

  const handleStopServer = async () => {
    await llamaServer.stop();
    showAlert('服务已停止', 'llama.cpp 服务器已停止');
  };

  const updateField = <K extends keyof ApiConfig>(field: K, value: ApiConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🤖 本地模型服务</Text>
        
        <View style={[styles.statusBox, { backgroundColor: serverStatus.isRunning ? '#D4EDDA' : '#F8D7DA' }]}>
          <Text style={[styles.statusText, { color: serverStatus.isRunning ? '#155724' : '#721C24' }]}>
            {serverStatus.isRunning ? '🟢 服务运行中' : '🔴 服务未运行'}
          </Text>
          {serverStatus.isRunning && (
            <Text style={styles.statusDetail}>
              端口: {serverStatus.port} | 模型: {serverStatus.model || selectedModel?.name || '-'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, serverStatus.isRunning ? styles.stopButton : styles.startButton]}
          onPress={serverStatus.isRunning ? handleStopServer : handleStartServer}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {serverStatus.isRunning ? '停止服务' : '启动本地服务'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>💾 推荐模型</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          根据您的设备配置 ({formatBytes(capabilities.ram)} RAM, {capabilities.vram > 0 ? formatBytes(capabilities.vram) : '无独立显存'})
        </Text>

        {recommendedModel && (
          <View style={[styles.recommendedBox, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
            <Text style={[styles.recommendedLabel, { color: theme.primary }]}>⭐ 推荐</Text>
            <Text style={[styles.recommendedName, { color: theme.text }]}>{recommendedModel.name}</Text>
            <Text style={[styles.recommendedDesc, { color: theme.textSecondary }]}>{recommendedModel.description}</Text>
            <Text style={[styles.recommendedReq, { color: theme.textSecondary }]}>
              显存要求: {formatBytes(recommendedModel.vramRequirement)} | 大小: {formatBytes(recommendedModel.size)}
            </Text>
          </View>
        )}

        <View style={styles.modelList}>
          {AVAILABLE_MODELS.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelItem,
                { backgroundColor: theme.surface, borderColor: theme.border },
                selectedModel?.id === model.id && { borderColor: theme.primary, borderWidth: 2 },
              ]}
              onPress={() => handleSelectModel(model)}
            >
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: theme.text }]}>{model.name}</Text>
                <Text style={[styles.modelDesc, { color: theme.textSecondary }]}>{model.description}</Text>
                <Text style={[styles.modelReq, { color: theme.textSecondary }]}>
                  💾 {formatBytes(model.vramRequirement)} | 📦 {formatBytes(model.size)}
                </Text>
              </View>
              {selectedModel?.id === model.id && (
                <Text style={[styles.selectedCheck, { color: theme.primary }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>⚙️ API 配置</Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>服务器地址</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.baseUrl}
            onChangeText={value => updateField('baseUrl', value)}
            placeholder="http://localhost:8080/v1"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.apiKey}
            onChangeText={value => updateField('apiKey', value)}
            placeholder="留空"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>模型名称</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.model}
            onChangeText={value => updateField('model', value)}
            placeholder="qwen3:0.6b"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>🎛️ 生成参数</Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Temperature: {config.temperature.toFixed(1)}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.temperature.toString()}
            onChangeText={value => {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0 && num <= 2) {
                updateField('temperature', num);
              }
            }}
            placeholder="0.7"
            placeholderTextColor={theme.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>最大Token数</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.maxTokens.toString()}
            onChangeText={value => {
              const num = parseInt(value);
              if (!isNaN(num) && num > 0) {
                updateField('maxTokens', num);
              }
            }}
            placeholder="2048"
            placeholderTextColor={theme.placeholder}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>💬 系统提示词</Text>

        <View style={styles.field}>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.systemPrompt}
            onChangeText={value => updateField('systemPrompt', value)}
            placeholder="你是一个有帮助的AI助手。"
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>

      {testResult && (
        <View style={[
          styles.resultBox,
          { backgroundColor: testResult.success ? '#D4EDDA' : '#F8D7DA' }
        ]}>
          <Text style={[
            styles.resultText,
            { color: testResult.success ? '#155724' : '#721C24' }
          ]}>
            {testResult.message}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.testButton, { borderColor: theme.primary }]}
          onPress={handleTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.primary }]}>测试连接</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>保存配置</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          MyChat v1.0.0
        </Text>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          支持 Ollama / llama.cpp / OpenAI API
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  statusBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  statusText: {
    ...typography.subtitle,
    textAlign: 'center',
  },
  statusDetail: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  startButton: {
    backgroundColor: '#28a745',
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  recommendedBox: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  recommendedLabel: {
    ...typography.caption,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  recommendedName: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  recommendedDesc: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  recommendedReq: {
    ...typography.caption,
  },
  modelList: {
    gap: spacing.sm,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modelDesc: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  modelReq: {
    ...typography.caption,
  },
  selectedCheck: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textArea: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 100,
  },
  resultBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
  },
  resultText: {
    ...typography.body,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    ...typography.subtitle,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
});
