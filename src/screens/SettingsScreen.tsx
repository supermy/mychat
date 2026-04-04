import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { colors, spacing, typography } from '../theme';
import { ApiConfig } from '../types';
import { testApiConnection } from '../services/api';
import '../types/electron';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

type ConfigTab = 'api' | 'params' | 'prompt' | 'advanced';

interface LogEntry {
  message: string;
  type: string;
  timestamp: number;
}

const PRESET_MODELS = [
  { id: 'qwen3:0.6b', name: 'Qwen3 0.6B', description: '轻量级模型，适合简单对话' },
  { id: 'qwen3:1.8b', name: 'Qwen3 1.8B', description: '中等规模，平衡性能与速度' },
  { id: 'qwen3:4b', name: 'Qwen3 4B', description: '较大模型，更强理解能力' },
  { id: 'llama3.2:1b', name: 'Llama 3.2 1B', description: 'Meta 轻量级模型' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: 'Meta 中等规模模型' },
  { id: 'mistral:7b', name: 'Mistral 7B', description: '高性能开源模型' },
];

const TEMPERATURE_PRESETS = [
  { value: 0.3, name: '精确', description: '适合代码、事实性问答' },
  { value: 0.7, name: '平衡', description: '适合日常对话' },
  { value: 1.0, name: '创意', description: '适合创意写作、头脑风暴' },
  { value: 1.5, name: '随机', description: '适合探索性对话' },
];

export function SettingsScreen() {
  const { state, updateApiConfig } = useChat();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [config, setConfig] = useState<ApiConfig>(state.apiConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [configTab, setConfigTab] = useState<ConfigTab>('api');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [engineStatus, setEngineStatus] = useState<{ running: boolean; port: number } | null>(null);
  const [systemInfo, setSystemInfo] = useState<{ platform: string; arch: string; cpuCores: number; totalMemory: number } | null>(null);
  const logScrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setConfig(state.apiConfig);
  }, [state.apiConfig]);

  useEffect(() => {
    loadData();
    
    let cleanupLog: (() => void) | undefined;
    
    if (window.electronAPI) {
      cleanupLog = window.electronAPI.onEngineLog((data) => {
        addLog(data.message, data.type);
      });
      
      checkEngineStatus();
    }
    
    return () => {
      cleanupLog?.();
    };
  }, []);

  const loadData = async () => {
    if (!window.electronAPI) return;

    try {
      const [sysInfo, currentEngine] = await Promise.all([
        window.electronAPI.getSystemInfo(),
        window.electronAPI.getCurrentEngine(),
      ]);

      setSystemInfo({
        platform: sysInfo.platform,
        arch: sysInfo.arch,
        cpuCores: sysInfo.cpuCores,
        totalMemory: 0,
      });
      
      if (currentEngine) {
        setEngineStatus({
          running: currentEngine.running,
          port: currentEngine.port,
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const checkEngineStatus = async () => {
    if (!window.electronAPI) return;
    
    try {
      const currentEngine = await window.electronAPI.getCurrentEngine();
      if (currentEngine) {
        setEngineStatus({
          running: currentEngine.running,
          port: currentEngine.port,
        });
      }
    } catch (error) {
      console.error('Failed to check engine status:', error);
    }
  };

  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev.slice(-100), { message, type, timestamp: Date.now() }]);
  };

  const handleSave = async () => {
    try {
      await updateApiConfig(config);
      addLog('配置已保存', 'success');
      showAlert('成功', '配置已保存');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`保存失败: ${errMsg}`, 'error');
      showAlert('错误', '保存配置失败');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    addLog('正在测试连接...', 'info');
    
    try {
      const success = await testApiConnection(config);
      if (success) {
        setTestResult({ success: true, message: '连接成功!' });
        addLog('连接测试成功', 'success');
      } else {
        setTestResult({ success: false, message: '连接失败，请检查配置' });
        addLog('连接测试失败', 'error');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      setTestResult({ success: false, message: '错误: ' + errMsg });
      addLog(`连接测试错误: ${errMsg}`, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleStartEngine = async () => {
    if (!window.electronAPI) return;
    
    addLog('正在启动本地引擎...', 'info');
    
    try {
      const result = await window.electronAPI.startEngine('llama', {
        modelPath: config.model,
        port: parseInt(config.baseUrl.match(/:(\d+)/)?.[1] || '11434'),
        contextSize: 4096,
        gpuLayers: -1,
      });
      
      if (result.success) {
        addLog(`引擎启动成功，端口: ${result.port}`, 'success');
        setEngineStatus({ running: true, port: result.port });
      } else {
        addLog('引擎启动失败', 'error');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`启动失败: ${errMsg}`, 'error');
    }
  };

  const handleStopEngine = async () => {
    if (!window.electronAPI) return;
    
    addLog('正在停止引擎...', 'info');
    await window.electronAPI.stopEngine();
    addLog('引擎已停止', 'info');
    setEngineStatus({ running: false, port: 0 });
  };

  const updateField = <K extends keyof ApiConfig>(field: K, value: ApiConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'success': return '#28a745';
      default: return theme.textSecondary;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>系统信息</Text>
        {systemInfo && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.infoText, { color: theme.text }]}>
              💻 平台: {systemInfo.platform} ({systemInfo.arch})
            </Text>
            <Text style={[styles.infoText, { color: theme.text }]}>
              🖥️ CPU 核心: {systemInfo.cpuCores}
            </Text>
            {engineStatus && (
              <Text style={[styles.infoText, { color: engineStatus.running ? '#28a745' : theme.textSecondary }]}>
                {engineStatus.running ? '🟢' : '⚪'} 引擎状态: {engineStatus.running ? `运行中 (端口: ${engineStatus.port})` : '未运行'}
              </Text>
            )}
          </View>
        )}
        
        {engineStatus?.running && (
          <View style={[styles.runningCard, { backgroundColor: '#D4EDDA' }]}>
            <Text style={[styles.runningText, { color: '#155724' }]}>
              🟢 本地引擎运行中 - 端口: {engineStatus.port}
            </Text>
            <TouchableOpacity style={styles.stopButton} onPress={handleStopEngine}>
              <Text style={styles.stopButtonText}>停止</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>配置管理</Text>
          <TouchableOpacity onPress={() => setShowLogs(!showLogs)}>
            <Text style={[styles.linkText, { color: theme.primary }]}>
              {showLogs ? '隐藏日志' : '显示日志'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.tab, configTab === 'api' && styles.tabActive]}
            onPress={() => setConfigTab('api')}
          >
            <Text style={[styles.tabText, { color: configTab === 'api' ? theme.primary : theme.textSecondary }]}>
              🔌 API
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, configTab === 'params' && styles.tabActive]}
            onPress={() => setConfigTab('params')}
          >
            <Text style={[styles.tabText, { color: configTab === 'params' ? theme.primary : theme.textSecondary }]}>
              ⚙️ 参数
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, configTab === 'prompt' && styles.tabActive]}
            onPress={() => setConfigTab('prompt')}
          >
            <Text style={[styles.tabText, { color: configTab === 'prompt' ? theme.primary : theme.textSecondary }]}>
              📝 提示词
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, configTab === 'advanced' && styles.tabActive]}
            onPress={() => setConfigTab('advanced')}
          >
            <Text style={[styles.tabText, { color: configTab === 'advanced' ? theme.primary : theme.textSecondary }]}>
              🔧 高级
            </Text>
          </TouchableOpacity>
        </View>

        {configTab === 'api' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>服务器配置</Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>服务器地址</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={config.baseUrl}
                  onChangeText={value => updateField('baseUrl', value)}
                  placeholder="http://localhost:11434/v1"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={config.apiKey}
                  onChangeText={value => updateField('apiKey', value)}
                  placeholder="ollama"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>模型选择</Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>模型名称</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  value={config.model}
                  onChangeText={value => updateField('model', value)}
                  placeholder="qwen3:0.6b"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>预设模型:</Text>
              <View style={styles.modelSuggestions}>
                {PRESET_MODELS.map((model) => (
                  <TouchableOpacity
                    key={model.id}
                    style={[styles.modelChip, { backgroundColor: config.model === model.id ? theme.primary : theme.background }]}
                    onPress={() => updateField('model', model.id)}
                  >
                    <Text style={[styles.modelChipText, { color: config.model === model.id ? '#fff' : theme.text }]}>
                      {model.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {configTab === 'params' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Temperature</Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                控制输出的随机性，值越高越随机
              </Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  当前值: {config.temperature.toFixed(1)}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
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
              <View style={styles.presetGrid}>
                {TEMPERATURE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.presetItem,
                      { backgroundColor: theme.background },
                      Math.abs(config.temperature - preset.value) < 0.01 && { backgroundColor: theme.primary }
                    ]}
                    onPress={() => updateField('temperature', preset.value)}
                  >
                    <Text style={[
                      styles.presetText,
                      { color: Math.abs(config.temperature - preset.value) < 0.01 ? '#fff' : theme.text }
                    ]}>
                      {preset.name}
                    </Text>
                    <Text style={[
                      styles.presetDesc,
                      { color: Math.abs(config.temperature - preset.value) < 0.01 ? '#fff' : theme.textSecondary }
                    ]}>
                      {preset.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>生成参数</Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>最大 Token 数</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
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
          </>
        )}

        {configTab === 'prompt' && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>系统提示词</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              定义 AI 的角色和行为方式
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.background, color: theme.text }]}
              value={config.systemPrompt}
              onChangeText={value => updateField('systemPrompt', value)}
              placeholder="你是一个有帮助的AI助手。"
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        )}

        {configTab === 'advanced' && (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>引擎控制</Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                启动或停止本地推理引擎
              </Text>
              {engineStatus?.running ? (
                <TouchableOpacity style={styles.stopEngineButton} onPress={handleStopEngine}>
                  <Text style={styles.stopEngineButtonText}>停止本地引擎</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.startEngineButton} onPress={handleStartEngine}>
                  <Text style={styles.startEngineButtonText}>启动本地引擎</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>其他设置</Text>
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: theme.text }]}>自动保存配置</Text>
                <Switch
                  value={true}
                  trackColor={{ false: '#767577', true: theme.primary }}
                />
              </View>
            </View>
          </>
        )}

        {showLogs && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>运行日志</Text>
              <TouchableOpacity onPress={() => setLogs([])}>
                <Text style={[styles.logButtonText, { color: theme.primary }]}>清空</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              ref={logScrollViewRef}
              style={styles.logScroll}
              onContentSizeChange={() => logScrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {logs.map((log, index) => (
                <Text key={index} style={[styles.logText, { color: getLogColor(log.type) }]}>
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {testResult && (
        <View style={[
          styles.card,
          { backgroundColor: testResult.success ? '#D4EDDA' : '#F8D7DA', marginHorizontal: spacing.lg }
        ]}>
          <Text style={[
            styles.resultText,
            { color: testResult.success ? '#155724' : '#721C24' }
          ]}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.testButton, { backgroundColor: theme.surface }]}
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
          支持 OpenAI 兼容 API (Ollama, llama.cpp 等)
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
    padding: spacing.lg,
    borderBottomWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.body,
    fontWeight: '600',
  },
  card: {
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  input: {
    ...typography.body,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  textArea: {
    ...typography.body,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: spacing.md,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
  },
  modelSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  modelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  modelChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  presetGrid: {
    marginTop: spacing.md,
  },
  presetItem: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  presetText: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  presetDesc: {
    ...typography.caption,
  },
  runningCard: {
    padding: spacing.lg,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runningText: {
    ...typography.body,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  startEngineButton: {
    backgroundColor: '#28a745',
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  startEngineButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  stopEngineButton: {
    backgroundColor: '#dc3545',
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopEngineButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logButtonText: {
    ...typography.caption,
    fontWeight: '600',
  },
  logScroll: {
    flex: 1,
    maxHeight: 200,
  },
  logText: {
    ...typography.caption,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  resultText: {
    ...typography.body,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButton: {},
  saveButton: {},
  buttonText: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
});
