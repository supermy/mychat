import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

type EngineType = 'llama' | 'zeroclaw' | 'external';
type WizardStep = 'welcome' | 'select-engine' | 'download' | 'configure' | 'test' | 'complete';

interface EngineStatus {
  installed: boolean;
  path: string;
  version: string;
}

interface WizardProps {
  onComplete: (config: { engine: EngineType; config: any }) => void;
}

declare global {
  interface Window {
    electronAPI?: {
      getEngineStatus: (engine: string) => Promise<EngineStatus>;
      downloadEngine: (engine: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      testEngine: (engine: string, config: any) => Promise<{ success: boolean; message: string }>;
      startEngine: (engine: string, config: any) => Promise<{ success: boolean; port?: number; error?: string }>;
      stopEngine: () => Promise<void>;
      getModelsDir: () => Promise<string>;
      listModels: () => Promise<Array<{ name: string; path: string; size: number }>>;
    };
  }
}

export function SetupWizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [selectedEngine, setSelectedEngine] = useState<EngineType>('llama');
  const [engineStatus, setEngineStatus] = useState<Record<string, EngineStatus>>({});
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [config, setConfig] = useState({
    modelPath: '',
    port: 8080,
    contextSize: 4096,
    gpuLayers: -1,
    threads: 4,
  });
  const [models, setModels] = useState<Array<{ name: string; path: string; size: number }>>([]);

  const colorScheme = 'light';
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    if (window.electronAPI) {
      loadEngineStatus();
      loadModels();
    }
  }, []);

  const loadEngineStatus = async () => {
    if (!window.electronAPI) return;
    
    const status: Record<string, EngineStatus> = {};
    for (const engine of ['llama', 'zeroclaw']) {
      try {
        status[engine] = await window.electronAPI.getEngineStatus(engine);
      } catch (e) {
        status[engine] = { installed: false, path: '', version: '' };
      }
    }
    setEngineStatus(status);
  };

  const loadModels = async () => {
    if (!window.electronAPI) return;
    
    try {
      const modelList = await window.electronAPI.listModels();
      setModels(modelList);
      if (modelList.length > 0) {
        setConfig(prev => ({ ...prev, modelPath: modelList[0].path }));
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  const handleDownload = async () => {
    if (!window.electronAPI) return;
    
    setDownloading(true);
    setDownloadProgress('Starting download...');
    
    try {
      const result = await window.electronAPI.downloadEngine(selectedEngine);
      if (result.success) {
        setDownloadProgress('Download complete!');
        await loadEngineStatus();
        setStep('configure');
      } else {
        setDownloadProgress(`Download failed: ${result.error}`);
      }
    } catch (e) {
      setDownloadProgress(`Error: ${e}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleTest = async () => {
    if (!window.electronAPI) return;
    
    setTestResult(null);
    
    try {
      const result = await window.electronAPI.testEngine(selectedEngine, config);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    }
  };

  const handleComplete = () => {
    onComplete({ engine: selectedEngine, config });
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>欢迎使用 MyChat</Text>
      <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
        本向导将帮助您配置本地 LLM 推理引擎。
      </Text>
      
      <View style={[styles.featureList, { backgroundColor: theme.surface }]}>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          🚀 支持多种推理引擎
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          🤖 自动检测系统配置
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          📦 一键下载和安装
        </Text>
        <Text style={[styles.featureItem, { color: theme.text }]}>
          ⚙️ 灵活的配置选项
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        onPress={() => setStep('select-engine')}
      >
        <Text style={styles.primaryButtonText}>开始配置</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelectEngine = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>选择推理引擎</Text>
      
      <TouchableOpacity
        style={[
          styles.engineCard,
          { backgroundColor: theme.surface },
          selectedEngine === 'llama' && { borderColor: theme.primary, borderWidth: 2 }
        ]}
        onPress={() => setSelectedEngine('llama')}
      >
        <Text style={[styles.engineName, { color: theme.text }]}>🦙 llama.cpp</Text>
        <Text style={[styles.engineDesc, { color: theme.textSecondary }]}>
          最流行的本地 LLM 推理引擎，支持广泛的模型格式
        </Text>
        <Text style={[styles.engineStatus, { color: engineStatus.llama?.installed ? '#28a745' : '#dc3545' }]}>
          {engineStatus.llama?.installed ? '✓ 已安装' : '○ 未安装'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.engineCard,
          { backgroundColor: theme.surface },
          selectedEngine === 'zeroclaw' && { borderColor: theme.primary, borderWidth: 2 }
        ]}
        onPress={() => setSelectedEngine('zeroclaw')}
      >
        <Text style={[styles.engineName, { color: theme.text }]}>⚡ ZeroClaw</Text>
        <Text style={[styles.engineDesc, { color: theme.textSecondary }]}>
          极致性能，内存占用仅 7.8MB，适合资源受限环境
        </Text>
        <Text style={[styles.engineStatus, { color: engineStatus.zeroclaw?.installed ? '#28a745' : '#dc3545' }]}>
          {engineStatus.zeroclaw?.installed ? '✓ 已安装' : '○ 未安装'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.engineCard,
          { backgroundColor: theme.surface },
          selectedEngine === 'external' && { borderColor: theme.primary, borderWidth: 2 }
        ]}
        onPress={() => setSelectedEngine('external')}
      >
        <Text style={[styles.engineName, { color: theme.text }]}>🌐 外部服务</Text>
        <Text style={[styles.engineDesc, { color: theme.textSecondary }]}>
          连接到已运行的 Ollama、llama.cpp server 或其他 OpenAI 兼容 API
        </Text>
        <Text style={[styles.engineStatus, { color: theme.textSecondary }]}>
          无需安装
        </Text>
      </TouchableOpacity>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => setStep('welcome')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            if (selectedEngine === 'external') {
              setStep('configure');
            } else if (engineStatus[selectedEngine]?.installed) {
              setStep('configure');
            } else {
              setStep('download');
            }
          }}
        >
          <Text style={styles.primaryButtonText}>下一步</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDownload = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>
        下载 {selectedEngine === 'llama' ? 'llama.cpp' : 'ZeroClaw'}
      </Text>
      
      <View style={[styles.downloadInfo, { backgroundColor: theme.surface }]}>
        <Text style={[styles.downloadText, { color: theme.text }]}>
          引擎: {selectedEngine === 'llama' ? 'llama.cpp' : 'ZeroClaw'}
        </Text>
        <Text style={[styles.downloadText, { color: theme.text }]}>
          平台: {navigator.platform}
        </Text>
        <Text style={[styles.downloadText, { color: theme.text }]}>
          状态: {downloading ? '下载中...' : '准备就绪'}
        </Text>
      </View>
      
      {downloadProgress ? (
        <View style={[styles.progressBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.progressText, { color: theme.text }]}>{downloadProgress}</Text>
        </View>
      ) : null}
      
      {downloading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
      ) : null}
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => setStep('select-engine')}
          disabled={downloading}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Text style={styles.primaryButtonText}>
            {downloading ? '下载中...' : '开始下载'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfigure = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>配置引擎</Text>
      
      {selectedEngine !== 'external' && (
        <>
          <View style={styles.configField}>
            <Text style={[styles.configLabel, { color: theme.text }]}>模型文件</Text>
            {models.length > 0 ? (
              <View style={[styles.selectBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {models.map(model => (
                  <TouchableOpacity
                    key={model.name}
                    style={[
                      styles.selectOption,
                      config.modelPath === model.path && { backgroundColor: theme.primary + '20' }
                    ]}
                    onPress={() => setConfig(prev => ({ ...prev, modelPath: model.path }))}
                  >
                    <Text style={[styles.selectOptionText, { color: theme.text }]}>
                      {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                请先在「模型」页面下载模型
              </Text>
            )}
          </View>
          
          <View style={styles.configField}>
            <Text style={[styles.configLabel, { color: theme.text }]}>端口</Text>
            <Text style={[styles.configValue, { color: theme.text }]}>{config.port}</Text>
          </View>
          
          <View style={styles.configField}>
            <Text style={[styles.configLabel, { color: theme.text }]}>上下文大小</Text>
            <Text style={[styles.configValue, { color: theme.text }]}>{config.contextSize}</Text>
          </View>
        </>
      )}
      
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
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => setStep(selectedEngine === 'external' ? 'select-engine' : 'download')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.primary }]}
          onPress={handleTest}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>测试连接</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => setStep('complete')}
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
          引擎: {selectedEngine === 'llama' ? 'llama.cpp' : selectedEngine === 'zeroclaw' ? 'ZeroClaw' : '外部服务'}
        </Text>
        {config.modelPath && (
          <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
            模型: {config.modelPath.split('/').pop()}
          </Text>
        )}
        <Text style={[styles.summaryItem, { color: theme.textSecondary }]}>
          端口: {config.port}
        </Text>
      </View>
      
      <Text style={[styles.completeHint, { color: theme.textSecondary }]}>
        点击「完成」开始使用 MyChat！
      </Text>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        onPress={handleComplete}
      >
        <Text style={styles.primaryButtonText}>完成</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome': return renderWelcome();
      case 'select-engine': return renderSelectEngine();
      case 'download': return renderDownload();
      case 'configure': return renderConfigure();
      case 'complete': return renderComplete();
      default: return renderWelcome();
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.progressIndicator}>
        {['welcome', 'select-engine', 'download', 'configure', 'complete'].map((s, i) => (
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
  engineCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  engineName: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  engineDesc: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  engineStatus: {
    ...typography.caption,
  },
  downloadInfo: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  downloadText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  progressBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  progressText: {
    ...typography.body,
  },
  spinner: {
    marginVertical: spacing.lg,
  },
  configField: {
    marginBottom: spacing.md,
  },
  configLabel: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  configValue: {
    ...typography.body,
  },
  selectBox: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  selectOption: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectOptionText: {
    ...typography.body,
  },
  hintText: {
    ...typography.caption,
  },
  resultBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  resultText: {
    ...typography.body,
    textAlign: 'center',
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
});
