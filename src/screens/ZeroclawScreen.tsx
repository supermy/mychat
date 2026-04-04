import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '../theme';
import '../types/electron';

interface ZeroclawConfig {
  server: {
    host: string;
    port: number;
  };
  llama: {
    enabled: boolean;
    host: string;
    port: number;
    model: string;
  };
  channels: {
    feishu: {
      enabled: boolean;
      appId: string;
      appSecret: string;
      encryptKey: string;
      verificationToken: string;
    };
    qq: {
      enabled: boolean;
      appId: string;
      appSecret: string;
      token: string;
    };
  };
  providers: {
    openai: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
    };
    claude: {
      enabled: boolean;
      apiKey: string;
    };
  };
}

const DEFAULT_CONFIG: ZeroclawConfig = {
  server: {
    host: '127.0.0.1',
    port: 3000
  },
  llama: {
    enabled: true,
    host: '127.0.0.1',
    port: 8080,
    model: ''
  },
  channels: {
    feishu: {
      enabled: false,
      appId: '',
      appSecret: '',
      encryptKey: '',
      verificationToken: ''
    },
    qq: {
      enabled: false,
      appId: '',
      appSecret: '',
      token: ''
    }
  },
  providers: {
    openai: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1'
    },
    claude: {
      enabled: false,
      apiKey: ''
    }
  }
};

interface LogEntry {
  message: string;
  type: string;
  timestamp: number;
}

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', description: '多模型聚合平台（推荐）' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude系列模型' },
  { id: 'openai', name: 'OpenAI', description: 'GPT系列模型' },
  { id: 'ollama', name: 'Ollama', description: '本地模型运行' },
  { id: 'groq', name: 'Groq', description: '高速推理' },
  { id: 'mistral', name: 'Mistral', description: 'Mistral系列模型' },
  { id: 'xai', name: 'xAI', description: 'Grok系列模型' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek系列模型' },
  { id: 'llamacpp', name: 'LLaMA.cpp', description: '本地模型' },
];

const MEMORY_BACKENDS = [
  { id: 'sqlite', name: 'SQLite', description: '轻量级数据库（推荐）' },
  { id: 'markdown', name: 'Markdown', description: '文件存储' },
  { id: 'lucid', name: 'Lucid', description: '高级内存系统' },
  { id: 'none', name: 'None', description: '不使用内存' },
];

interface WizardConfig {
  provider: string;
  apiKey: string;
  model: string;
  memory: string;
  proxyUrl: string;
  interruptOnNewMessage: boolean;
  channels: {
    telegram: { enabled: boolean; token: string };
    discord: { enabled: boolean; token: string };
    slack: { enabled: boolean; token: string };
    whatsapp: { enabled: boolean; token: string };
    signal: { enabled: boolean; token: string };
    matrix: { enabled: boolean; token: string };
    email: { enabled: boolean; token: string };
  };
}

const DEFAULT_WIZARD_CONFIG: WizardConfig = {
  provider: 'openrouter',
  apiKey: '',
  model: '',
  memory: 'sqlite',
  proxyUrl: '',
  interruptOnNewMessage: false,
  channels: {
    telegram: { enabled: false, token: '' },
    discord: { enabled: false, token: '' },
    slack: { enabled: false, token: '' },
    whatsapp: { enabled: false, token: '' },
    signal: { enabled: false, token: '' },
    matrix: { enabled: false, token: '' },
    email: { enabled: false, token: '' },
  },
};

export function ZeroclawScreen() {
  const [config, setConfig] = useState<ZeroclawConfig>(DEFAULT_CONFIG);
  const [wizardConfig, setWizardConfig] = useState<WizardConfig>(DEFAULT_WIZARD_CONFIG);
  const [engineStatus, setEngineStatus] = useState<{ installed: boolean; path: string; version: string } | null>(null);
  const [runningStatus, setRunningStatus] = useState<{ running: boolean; port: number } | null>(null);
  const [detailedSystemInfo, setDetailedSystemInfo] = useState<{ platform: string; arch: string; cpuCores: number; cpuModel: string; gpuInfo: { hasGpu: boolean; vendor: string; model: string; vram: number } } | null>(null);
  const [engineCompatibility, setEngineCompatibility] = useState<{ installed: boolean; compatible: boolean; engineArch: string; systemArch: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [configText, setConfigText] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<{ progress: number; downloaded: number; total: number } | null>(null);
  const [engineUpdateInfo, setEngineUpdateInfo] = useState<{ currentVersion: string | null; latestVersion: string | null; hasUpdate: boolean; checking: boolean; error?: string } | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const logScrollViewRef = useRef<ScrollView>(null);

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    loadData();
    
    let cleanupLog: (() => void) | undefined;
    let cleanupProgress: (() => void) | undefined;
    
    if (window.electronAPI) {
      cleanupLog = window.electronAPI.onEngineLog((data) => {
        addLog(data.message, data.type);
      });
      
      cleanupProgress = window.electronAPI.onEngineDownloadProgress((data) => {
        if (data.engine === 'zeroclaw') {
          setDownloadProgress({
            progress: parseFloat(data.progress),
            downloaded: data.downloaded,
            total: data.total
          });
        }
      });
    }
    
    return () => {
      cleanupLog?.();
      cleanupProgress?.();
    };
  }, []);

  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev.slice(-100), { message, type, timestamp: Date.now() }]);
  };

  const loadData = async () => {
    if (!window.electronAPI) {
      setLoading(false);
      return;
    }

    try {
      const [status, runStatus, savedConfig, sysInfo, compat] = await Promise.all([
        window.electronAPI.getEngineStatus('zeroclaw'),
        window.electronAPI.getZeroclawStatus(),
        window.electronAPI.getZeroclawConfig(),
        window.electronAPI.getSystemInfo(),
        window.electronAPI.checkEngineCompatibility('zeroclaw')
      ]);

      setEngineStatus(status);
      setRunningStatus(runStatus);
      setDetailedSystemInfo(sysInfo);
      setEngineCompatibility(compat);
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!window.electronAPI) return;
    
    setSaving(true);
    try {
      await window.electronAPI.saveZeroclawConfig(config);
      addLog('配置已保存', 'success');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`保存失败: ${errMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadConfigText = async () => {
    if (!window.electronAPI) return;
    
    try {
      const savedConfig = await window.electronAPI.getZeroclawConfig();
      if (savedConfig) {
        setConfigText(JSON.stringify(savedConfig, null, 2));
      } else {
        setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
      }
    } catch (error) {
      setConfigText(JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
  };

  const handleSaveConfigText = async () => {
    if (!window.electronAPI) return;
    
    try {
      const parsedConfig = JSON.parse(configText);
      await window.electronAPI.saveZeroclawConfig(parsedConfig);
      setConfig(parsedConfig);
      addLog('配置文件已保存', 'success');
      setShowConfigEditor(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`配置文件保存失败: ${errMsg}`, 'error');
      Alert.alert('保存失败', '请检查JSON格式是否正确');
    }
  };

  const handleOpenConfigEditor = async () => {
    await handleLoadConfigText();
    setShowConfigEditor(true);
  };

  const handleStart = async () => {
    if (!window.electronAPI) return;
    
    if (!config.server || !config.server.port) {
      addLog('缺少服务器配置，请先配置端口', 'error');
      return;
    }
    
    setStarting(true);
    addLog('正在启动 ZeroClaw...', 'info');
    
    try {
      const result = await window.electronAPI.startZeroclaw(config);
      addLog(`ZeroClaw 启动成功，端口: ${result.port}`, 'success');
      await loadData();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`启动失败: ${errMsg}`, 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleDoctor = async () => {
    if (!window.electronAPI) return;
    
    addLog('运行 ZeroClaw Doctor...', 'info');
    
    try {
      const result = await window.electronAPI.zeroclawDoctor();
      if (result.success) {
        addLog('Doctor 检查完成', 'success');
      } else {
        addLog('Doctor 检查发现问题', 'warning');
      }
      addLog(result.output, 'info');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`Doctor 运行失败: ${errMsg}`, 'error');
    }
  };

  const handleStatus = async () => {
    if (!window.electronAPI) return;
    
    addLog('获取 ZeroClaw 状态...', 'info');
    
    try {
      const result = await window.electronAPI.zeroclawStatus();
      if (result.success) {
        addLog('状态获取成功', 'success');
      } else {
        addLog('状态获取失败', 'warning');
      }
      addLog(result.output, 'info');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`状态获取失败: ${errMsg}`, 'error');
    }
  };

  const handleStop = async () => {
    if (!window.electronAPI) return;
    
    addLog('正在停止 ZeroClaw...', 'info');
    await window.electronAPI.stopZeroclaw();
    addLog('ZeroClaw 已停止', 'info');
    await loadData();
  };

  const handleCheckEngineUpdate = async () => {
    if (!window.electronAPI) return;
    
    setEngineUpdateInfo({ currentVersion: null, latestVersion: null, hasUpdate: false, checking: true });
    addLog('正在检查 ZeroClaw 更新...', 'info');
    
    try {
      const info = await window.electronAPI.checkEngineUpdate('zeroclaw');
      setEngineUpdateInfo({
        currentVersion: info.currentVersion,
        latestVersion: info.latestVersion,
        hasUpdate: info.hasUpdate,
        checking: false,
        error: info.error
      });
      
      if (info.hasUpdate) {
        addLog(`发现新版本: ${info.latestVersion} (当前: ${info.currentVersion || '未安装'})`, 'success');
      } else if (!info.error) {
        addLog(`已是最新版本: ${info.currentVersion}`, 'info');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`检查更新失败: ${errMsg}`, 'error');
      setEngineUpdateInfo(prev => prev ? { ...prev, checking: false, error: errMsg } : null);
    }
  };

  const handleDownload = async () => {
    if (!window.electronAPI) return;
    
    addLog('开始下载 ZeroClaw...', 'info');
    
    try {
      const result = await window.electronAPI.downloadEngineUpdate({ engine: 'zeroclaw' });
      addLog(`ZeroClaw ${result.version} 下载完成`, 'success');
      setDownloadProgress(null);
      setEngineUpdateInfo(null);
      await loadData();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`下载失败: ${errMsg}`, 'error');
    }
  };

  const handleDownloadEngineUpdate = async () => {
    if (!window.electronAPI || !engineUpdateInfo?.latestVersion) return;
    
    addLog(`开始下载 ZeroClaw 更新: ${engineUpdateInfo.latestVersion}`, 'info');
    
    try {
      const result = await window.electronAPI.downloadEngineUpdate({
        engine: 'zeroclaw',
        version: engineUpdateInfo.latestVersion
      });
      
      addLog(`ZeroClaw 更新完成: ${result.version}`, 'success');
      setDownloadProgress(null);
      setEngineUpdateInfo(null);
      await loadData();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`ZeroClaw 更新失败: ${errMsg}`, 'error');
    }
  };

  const handleWizardComplete = async () => {
    if (!window.electronAPI) return;
    
    setWizardLoading(true);
    try {
      const zeroclawConfig = {
        provider: wizardConfig.provider,
        api_key: wizardConfig.apiKey,
        model: wizardConfig.model,
        memory: { backend: wizardConfig.memory },
        proxy_url: wizardConfig.proxyUrl || undefined,
        interrupt_on_new_message: wizardConfig.interruptOnNewMessage,
        channels: wizardConfig.channels,
      };
      
      await window.electronAPI.saveZeroclawConfig(zeroclawConfig);
      addLog('向导配置已保存', 'success');
      await loadData();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`保存失败: ${errMsg}`, 'error');
      Alert.alert('保存失败', errMsg);
    } finally {
      setWizardLoading(false);
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'success': return '#28a745';
      default: return theme.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!window.electronAPI) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.section}>
          <Text style={[styles.title, { color: theme.text }]}>ZeroClaw 配置</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            此功能仅在桌面应用中可用
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>系统信息</Text>
        {detailedSystemInfo && (
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.infoText, { color: theme.text }]}>
              🖥️ CPU: {detailedSystemInfo.cpuModel} ({detailedSystemInfo.cpuCores}核)
            </Text>
            <Text style={[styles.infoText, { color: theme.text }]}>
              💻 架构: {detailedSystemInfo.arch} ({detailedSystemInfo.platform})
            </Text>
            {detailedSystemInfo.gpuInfo.hasGpu && (
              <Text style={[styles.infoText, { color: '#28a745' }]}>
                🎮 GPU: {detailedSystemInfo.gpuInfo.vendor} {detailedSystemInfo.gpuInfo.model} ({detailedSystemInfo.gpuInfo.vram}GB)
              </Text>
            )}
          </View>
        )}
        
        {engineCompatibility && !engineCompatibility.compatible && (
          <View style={[styles.warningCard, { backgroundColor: '#f8d7da', borderColor: '#dc3545' }]}>
            <Text style={[styles.warningTitle, { color: '#721c24' }]}>
              ⚠️ 引擎架构不匹配
            </Text>
            <Text style={[styles.warningText, { color: '#721c24' }]}>
              {engineCompatibility.message}
            </Text>
            <Text style={[styles.warningDetail, { color: '#721c24' }]}>
              当前引擎: {engineCompatibility.engineArch} | 系统: {engineCompatibility.systemArch}
            </Text>
            <TouchableOpacity 
              style={styles.fixButton}
              onPress={() => handleDownload()}
            >
              <Text style={styles.fixButtonText}>升级更新</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>ZeroClaw 状态</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleCheckEngineUpdate}>
              <Text style={[styles.configToggle, { color: theme.primary }]}>
                {engineUpdateInfo?.checking ? '检查中...' : '检查更新'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLogs(!showLogs)} style={{ marginLeft: spacing.md }}>
              <Text style={[styles.configToggle, { color: theme.primary }]}>
                {showLogs ? '隐藏日志' : '显示日志'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {engineStatus?.installed ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.statusText, { color: theme.text }]}>
              ✅ 已安装版本: {engineStatus.version}
            </Text>
          </View>
        ) : (
          <View style={[styles.statusCard, { backgroundColor: '#f8d7da' }]}>
            <Text style={[styles.statusText, { color: '#721c24' }]}>
              ❌ 未安装 ZeroClaw
            </Text>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Text style={styles.downloadButtonText}>下载 ZeroClaw</Text>
            </TouchableOpacity>
          </View>
        )}

        {engineUpdateInfo?.hasUpdate && (
          <View style={[styles.updateCard, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
            <View style={styles.updateInfo}>
              <Text style={[styles.updateTitle, { color: '#856404' }]}>
                🔄 发现新版本
              </Text>
              <Text style={[styles.updateDetail, { color: '#856404' }]}>
                {engineUpdateInfo.currentVersion || '未安装'} → {engineUpdateInfo.latestVersion}
              </Text>
            </View>
            {!downloadProgress ? (
              <TouchableOpacity 
                style={styles.updateButton} 
                onPress={handleDownloadEngineUpdate}
              >
                <Text style={styles.updateButtonText}>立即更新</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.updateProgress, { color: '#856404' }]}>
                {downloadProgress.progress.toFixed(1)}%
              </Text>
            )}
          </View>
        )}

        {downloadProgress && (
          <View style={[styles.downloadProgressCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.downloadProgressTitle, { color: theme.text }]}>
              正在下载 ZeroClaw
            </Text>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.primary, width: `${downloadProgress.progress}%` }
                ]} 
              />
            </View>
            <Text style={[styles.downloadProgressText, { color: theme.textSecondary }]}>
              {downloadProgress.progress.toFixed(1)}% - {(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
            </Text>
          </View>
        )}

        {runningStatus?.running && (
          <View style={[styles.runningCard, { backgroundColor: '#d4edda' }]}>
            <Text style={[styles.runningText, { color: '#155724' }]}>
              🟢 运行中 - 端口: {runningStatus.port}
            </Text>
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.stopButtonText}>停止</Text>
            </TouchableOpacity>
          </View>
        )}

        {showLogs && (
          <View style={[styles.logCard, { backgroundColor: theme.surface }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.logTitle, { color: theme.text }]}>运行日志</Text>
              <View style={styles.logButtons}>
                {engineStatus?.installed && (
                  <>
                    <TouchableOpacity onPress={handleDoctor} style={styles.logButton}>
                      <Text style={[styles.logButtonText, { color: theme.primary }]}>Doctor</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleStatus} style={styles.logButton}>
                      <Text style={[styles.logButtonText, { color: theme.primary }]}>Status</Text>
                    </TouchableOpacity>
                  </>
                )}
                {engineStatus?.installed && !runningStatus?.running && (!engineCompatibility || engineCompatibility.compatible) && (
                  <TouchableOpacity onPress={handleStart} style={styles.logButton} disabled={starting}>
                    <Text style={[styles.logButtonText, { color: '#28a745' }]}>
                      {starting ? '启动中...' : '启动'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setLogs([])} style={styles.logButton}>
                  <Text style={[styles.logButtonText, { color: theme.primary }]}>清空</Text>
                </TouchableOpacity>
              </View>
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>AI 提供商</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          {PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={[
                styles.optionCard,
                wizardConfig.provider === provider.id && { borderColor: theme.primary, borderWidth: 2 }
              ]}
              onPress={() => setWizardConfig({ ...wizardConfig, provider: provider.id })}
            >
              <Text style={[styles.optionName, { color: theme.text }]}>{provider.name}</Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {provider.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>API Key</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>API Key:</Text>
            <TextInput
              style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={wizardConfig.apiKey}
              onChangeText={(text) => setWizardConfig({ ...wizardConfig, apiKey: text })}
              placeholder="sk-..."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {wizardConfig.provider === 'llamacpp' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              使用本地模型不需要 API Key
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>模型选择</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>模型:</Text>
            <TextInput
              style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={wizardConfig.model}
              onChangeText={(text) => setWizardConfig({ ...wizardConfig, model: text })}
              placeholder="模型 ID（如：openai/gpt-4）"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {wizardConfig.provider === 'openrouter' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              格式：provider/model（如：openai/gpt-4、anthropic/claude-3-opus）
            </Text>
          )}
          {wizardConfig.provider === 'anthropic' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：claude-sonnet-4-6、claude-3-5-sonnet、claude-3-opus
            </Text>
          )}
          {wizardConfig.provider === 'openai' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：gpt-4、gpt-4-turbo、gpt-3.5-turbo
            </Text>
          )}
          {wizardConfig.provider === 'ollama' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              输入Ollama模型名称（如：llama3、qwen2）
            </Text>
          )}
          {wizardConfig.provider === 'groq' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：llama-3.1-70b-versatile、mixtral-8x7b-32768
            </Text>
          )}
          {wizardConfig.provider === 'mistral' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：mistral-large、mistral-medium、codestral
            </Text>
          )}
          {wizardConfig.provider === 'xai' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：grok-beta
            </Text>
          )}
          {wizardConfig.provider === 'deepseek' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              模型：deepseek-chat、deepseek-coder
            </Text>
          )}
          {wizardConfig.provider === 'llamacpp' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              输入本地模型名称（如：qwen3-35b）
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>内存系统</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          {MEMORY_BACKENDS.map((memory) => (
            <TouchableOpacity
              key={memory.id}
              style={[
                styles.optionCard,
                wizardConfig.memory === memory.id && { borderColor: theme.primary, borderWidth: 2 }
              ]}
              onPress={() => setWizardConfig({ ...wizardConfig, memory: memory.id })}
            >
              <Text style={[styles.optionName, { color: theme.text }]}>{memory.name}</Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {memory.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>高级选项</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>代理 URL:</Text>
            <TextInput
              style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={wizardConfig.proxyUrl}
              onChangeText={(text) => setWizardConfig({ ...wizardConfig, proxyUrl: text })}
              placeholder="http://proxy:8080"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            支持 HTTP/SOCKS5 代理（可选）
          </Text>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>新消息中断:</Text>
            <Switch
              value={wizardConfig.interruptOnNewMessage}
              onValueChange={(value) => setWizardConfig({ ...wizardConfig, interruptOnNewMessage: value })}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            收到新消息时中断当前任务（Discord/Mattermost）
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>消息渠道</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, telegram: { ...wizardConfig.channels.telegram, enabled: !wizardConfig.channels.telegram.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>📱 Telegram</Text>
              <View style={[styles.checkbox, wizardConfig.channels.telegram.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.telegram.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.telegram.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.telegram.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, telegram: { ...wizardConfig.channels.telegram, token: text } }
                })}
                placeholder="Bot Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, discord: { ...wizardConfig.channels.discord, enabled: !wizardConfig.channels.discord.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>💬 Discord</Text>
              <View style={[styles.checkbox, wizardConfig.channels.discord.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.discord.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.discord.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.discord.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, discord: { ...wizardConfig.channels.discord, token: text } }
                })}
                placeholder="Bot Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, slack: { ...wizardConfig.channels.slack, enabled: !wizardConfig.channels.slack.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>💼 Slack</Text>
              <View style={[styles.checkbox, wizardConfig.channels.slack.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.slack.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.slack.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.slack.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, slack: { ...wizardConfig.channels.slack, token: text } }
                })}
                placeholder="Bot Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, whatsapp: { ...wizardConfig.channels.whatsapp, enabled: !wizardConfig.channels.whatsapp.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>📱 WhatsApp</Text>
              <View style={[styles.checkbox, wizardConfig.channels.whatsapp.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.whatsapp.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.whatsapp.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.whatsapp.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, whatsapp: { ...wizardConfig.channels.whatsapp, token: text } }
                })}
                placeholder="API Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, signal: { ...wizardConfig.channels.signal, enabled: !wizardConfig.channels.signal.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>🔐 Signal</Text>
              <View style={[styles.checkbox, wizardConfig.channels.signal.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.signal.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.signal.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.signal.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, signal: { ...wizardConfig.channels.signal, token: text } }
                })}
                placeholder="API Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, matrix: { ...wizardConfig.channels.matrix, enabled: !wizardConfig.channels.matrix.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>🏠 Matrix</Text>
              <View style={[styles.checkbox, wizardConfig.channels.matrix.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.matrix.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.matrix.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.matrix.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, matrix: { ...wizardConfig.channels.matrix, token: text } }
                })}
                placeholder="Access Token"
                secureTextEntry
              />
            )}
          </View>
          
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelToggle}
              onPress={() => setWizardConfig({
                ...wizardConfig,
                channels: { ...wizardConfig.channels, email: { ...wizardConfig.channels.email, enabled: !wizardConfig.channels.email.enabled } }
              })}
            >
              <Text style={[styles.channelName, { color: theme.text }]}>📧 Email</Text>
              <View style={[styles.checkbox, wizardConfig.channels.email.enabled && { backgroundColor: theme.primary }]}>
                {wizardConfig.channels.email.enabled && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
            {wizardConfig.channels.email.enabled && (
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginTop: spacing.sm }]}
                value={wizardConfig.channels.email.token}
                onChangeText={(text) => setWizardConfig({
                  ...wizardConfig,
                  channels: { ...wizardConfig.channels, email: { ...wizardConfig.channels.email, token: text } }
                })}
                placeholder="SMTP Config"
                secureTextEntry
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>服务器配置</Text>
          <TouchableOpacity onPress={handleOpenConfigEditor}>
            <Text style={[styles.configToggle, { color: theme.primary }]}>
              {showConfigEditor ? '隐藏配置文件' : '编辑配置文件'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {showConfigEditor ? (
          <View style={[styles.configEditorCard, { backgroundColor: theme.surface }]}>
            <View style={styles.configEditorHeader}>
              <Text style={[styles.configEditorTitle, { color: theme.text }]}>配置文件 (JSON)</Text>
              <View style={styles.configEditorButtons}>
                <TouchableOpacity 
                  style={[styles.configEditorButton, { backgroundColor: theme.primary }]}
                  onPress={handleSaveConfigText}
                >
                  <Text style={styles.configEditorButtonText}>保存</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.configEditorButton, { backgroundColor: '#6c757d', marginLeft: spacing.sm }]}
                  onPress={() => setShowConfigEditor(false)}
                >
                  <Text style={styles.configEditorButtonText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={[styles.configEditorInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={configText}
              onChangeText={setConfigText}
              multiline
              placeholder="JSON 配置"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : (
          <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
            <View style={styles.configRow}>
              <Text style={[styles.configLabel, { color: theme.text }]}>主机:</Text>
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={config.server.host}
                onChangeText={(text) => setConfig({ ...config, server: { ...config.server, host: text } })}
                placeholder="127.0.0.1"
              />
            </View>
            <View style={styles.configRow}>
              <Text style={[styles.configLabel, { color: theme.text }]}>端口:</Text>
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={String(config.server.port)}
                onChangeText={(text) => setConfig({ ...config, server: { ...config.server, port: parseInt(text) || 3000 } })}
                keyboardType="numeric"
                placeholder="3000"
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>LLaMA 后端</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>启用:</Text>
            <Switch
              value={config.llama.enabled}
              onValueChange={(value) => setConfig({ ...config, llama: { ...config.llama, enabled: value } })}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          {config.llama.enabled && (
            <>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>主机:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={config.llama.host}
                  onChangeText={(text) => setConfig({ ...config, llama: { ...config.llama, host: text } })}
                  placeholder="127.0.0.1"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>端口:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={String(config.llama.port)}
                  onChangeText={(text) => setConfig({ ...config, llama: { ...config.llama, port: parseInt(text) || 8080 } })}
                  keyboardType="numeric"
                  placeholder="8080"
                />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>飞书渠道</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>启用:</Text>
            <Switch
              value={config.channels.feishu.enabled}
              onValueChange={(value) => setConfig({ 
                ...config, 
                channels: { ...config.channels, feishu: { ...config.channels.feishu, enabled: value } } 
              })}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          {config.channels.feishu.enabled && (
            <>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>App ID:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={config.channels.feishu.appId}
                  onChangeText={(text) => setConfig({ 
                    ...config, 
                    channels: { ...config.channels, feishu: { ...config.channels.feishu, appId: text } } 
                  })}
                  placeholder="cli_xxx"
                  secureTextEntry
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>App Secret:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={config.channels.feishu.appSecret}
                  onChangeText={(text) => setConfig({ 
                    ...config, 
                    channels: { ...config.channels, feishu: { ...config.channels.feishu, appSecret: text } } 
                  })}
                  placeholder="xxx"
                  secureTextEntry
                />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>QQ 渠道</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>启用:</Text>
            <Switch
              value={config.channels.qq.enabled}
              onValueChange={(value) => setConfig({ 
                ...config, 
                channels: { ...config.channels, qq: { ...config.channels.qq, enabled: value } } 
              })}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          {config.channels.qq.enabled && (
            <>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>App ID:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={config.channels.qq.appId}
                  onChangeText={(text) => setConfig({ 
                    ...config, 
                    channels: { ...config.channels, qq: { ...config.channels.qq, appId: text } } 
                  })}
                  placeholder="xxx"
                  secureTextEntry
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>Token:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={config.channels.qq.token}
                  onChangeText={(text) => setConfig({ 
                    ...config, 
                    channels: { ...config.channels, qq: { ...config.channels.qq, token: text } } 
                  })}
                  placeholder="xxx"
                  secureTextEntry
                />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>云端 API (备用)</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>OpenAI:</Text>
            <Switch
              value={config.providers.openai.enabled}
              onValueChange={(value) => setConfig({ 
                ...config, 
                providers: { ...config.providers, openai: { ...config.providers.openai, enabled: value } } 
              })}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          {config.providers.openai.enabled && (
            <View style={styles.configRow}>
              <Text style={[styles.configLabel, { color: theme.text }]}>API Key:</Text>
              <TextInput
                style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={config.providers.openai.apiKey}
                onChangeText={(text) => setConfig({ 
                  ...config, 
                  providers: { ...config.providers, openai: { ...config.providers.openai, apiKey: text } } 
                })}
                placeholder="sk-xxx"
                secureTextEntry
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.primary }, wizardLoading && styles.buttonDisabled]} 
          onPress={handleWizardComplete}
          disabled={wizardLoading}
        >
          {wizardLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存向导配置</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#28a745' }, saving && styles.buttonDisabled]} 
          onPress={handleSaveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存服务器配置</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  configToggle: {
    ...typography.body,
    fontWeight: '600',
  },
  infoCard: {
    padding: spacing.md,
    borderRadius: 8,
  },
  infoText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  warningCard: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  warningTitle: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  warningText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  warningDetail: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  fixButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  fixButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  statusText: {
    ...typography.body,
  },
  runningCard: {
    padding: spacing.md,
    borderRadius: 8,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  updateCard: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateInfo: {
    flex: 1,
  },
  updateTitle: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  updateDetail: {
    ...typography.caption,
  },
  updateButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  updateButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  updateProgress: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  downloadProgressCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  downloadProgressTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  downloadProgressText: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  configCard: {
    padding: spacing.md,
    borderRadius: 8,
  },
  configEditorCard: {
    padding: spacing.md,
    borderRadius: 8,
  },
  configEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  configEditorTitle: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  configEditorButtons: {
    flexDirection: 'row',
  },
  configEditorButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  configEditorButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  configEditorInput: {
    ...typography.body,
    padding: spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 300,
    fontFamily: 'monospace',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  configLabel: {
    ...typography.body,
    flex: 1,
  },
  configInput: {
    ...typography.body,
    padding: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    width: 200,
    textAlign: 'right',
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
  channelRow: {
    marginBottom: spacing.md,
  },
  channelToggle: {
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
  logCard: {
    padding: spacing.md,
    borderRadius: 8,
    maxHeight: 200,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logTitle: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  logButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
  },
  logButtonText: {
    ...typography.caption,
    fontWeight: '600',
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    ...typography.caption,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  buttonSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
