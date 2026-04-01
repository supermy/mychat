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

interface CodexConfig {
  server: {
    host: string;
    port: number;
  };
  provider: string;
  model: string;
  apiKey: string;
  approvalMode: string;
  sandboxPermissions: string[];
}

const DEFAULT_CONFIG: CodexConfig = {
  server: {
    host: '127.0.0.1',
    port: 8080
  },
  provider: 'openai',
  model: 'o4-mini',
  apiKey: '',
  approvalMode: 'suggest',
  sandboxPermissions: []
};

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, o1, o3, o4 系列模型' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 系列模型' },
  { id: 'openrouter', name: 'OpenRouter', description: '多模型聚合平台' },
];

const APPROVAL_MODES = [
  { id: 'suggest', name: '建议模式', description: 'AI 提出建议，用户确认执行' },
  { id: 'auto-edit', name: '自动编辑', description: 'AI 自动编辑文件，用户确认' },
  { id: 'full-auto', name: '全自动', description: 'AI 完全自动执行（谨慎使用）' },
];

interface LogEntry {
  message: string;
  type: string;
  timestamp: number;
}

export function CodexScreen() {
  const [config, setConfig] = useState<CodexConfig>(DEFAULT_CONFIG);
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
        if (data.engine === 'codex') {
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
        window.electronAPI.getEngineStatus('codex'),
        window.electronAPI.getCodexStatus(),
        window.electronAPI.getCodexConfig(),
        window.electronAPI.getSystemInfo(),
        window.electronAPI.checkEngineCompatibility('codex')
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
      await window.electronAPI.saveCodexConfig(config);
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
      const savedConfig = await window.electronAPI.getCodexConfig();
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
      await window.electronAPI.saveCodexConfig(parsedConfig);
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
    addLog('正在启动 Codex...', 'info');
    
    try {
      const result = await window.electronAPI.startCodex(config);
      addLog(`Codex 启动成功，端口: ${result.port}`, 'success');
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
    
    addLog('运行 Codex Doctor...', 'info');
    
    try {
      const result = await window.electronAPI.codexDoctor();
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
    
    addLog('获取 Codex 状态...', 'info');
    
    try {
      const result = await window.electronAPI.codexStatus();
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
    
    addLog('正在停止 Codex...', 'info');
    await window.electronAPI.stopCodex();
    addLog('Codex 已停止', 'info');
    await loadData();
  };

  const handleCheckEngineUpdate = async () => {
    if (!window.electronAPI) return;
    
    setEngineUpdateInfo({ currentVersion: null, latestVersion: null, hasUpdate: false, checking: true });
    addLog('正在检查 Codex 更新...', 'info');
    
    try {
      const info = await window.electronAPI.checkEngineUpdate('codex');
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
    
    addLog('开始下载 Codex...', 'info');
    
    try {
      const result = await window.electronAPI.downloadEngineUpdate({ engine: 'codex' });
      addLog(`Codex ${result.version} 下载完成`, 'success');
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
    
    addLog(`开始下载 Codex 更新: ${engineUpdateInfo.latestVersion}`, 'info');
    
    try {
      const result = await window.electronAPI.downloadEngineUpdate({
        engine: 'codex',
        version: engineUpdateInfo.latestVersion
      });
      
      addLog(`Codex 更新完成: ${result.version}`, 'success');
      setDownloadProgress(null);
      setEngineUpdateInfo(null);
      await loadData();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      addLog(`Codex 更新失败: ${errMsg}`, 'error');
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
          <Text style={[styles.title, { color: theme.text }]}>Codex 配置</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Codex 状态</Text>
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
              ❌ 未安装 Codex
            </Text>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Text style={styles.downloadButtonText}>下载 Codex</Text>
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
              正在下载 Codex
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>API Key</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>API Key:</Text>
            <TextInput
              style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={config.apiKey}
              onChangeText={(text) => setConfig({ ...config, apiKey: text })}
              placeholder="sk-..."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>模型选择</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: theme.text }]}>模型:</Text>
            <TextInput
              style={[styles.configInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={config.model}
              onChangeText={(text) => setConfig({ ...config, model: text })}
              placeholder="o4-mini, gpt-4, claude-3-opus..."
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {config.provider === 'openai' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              推荐: o4-mini, o3-mini, gpt-4o, gpt-4-turbo
            </Text>
          )}
          {config.provider === 'anthropic' && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              推荐: claude-3-opus, claude-3-sonnet, claude-3-haiku
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>审批模式</Text>
        <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
          {APPROVAL_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.optionCard,
                config.approvalMode === mode.id && { borderColor: theme.primary, borderWidth: 2 }
              ]}
              onPress={() => setConfig({ ...config, approvalMode: mode.id })}
            >
              <Text style={[styles.optionName, { color: theme.text }]}>{mode.name}</Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {mode.description}
              </Text>
            </TouchableOpacity>
          ))}
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
                onChangeText={(text) => setConfig({ ...config, server: { ...config.server, port: parseInt(text) || 8080 } })}
                keyboardType="numeric"
                placeholder="8080"
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.primary }, saving && styles.buttonDisabled]} 
          onPress={handleSaveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存配置</Text>
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
