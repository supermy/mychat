import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography } from '../theme';
import { AVAILABLE_MODELS, recommendModels, ModelRecommendation, SystemInfo } from '../services/models';

declare global {
  interface Window {
    electronAPI?: {
      getSystemMemory: () => Promise<SystemInfo>;
      getModelsDir: () => Promise<string>;
      listModels: () => Promise<Array<{ name: string; path: string; size: number }>>;
      startLlama: (options: { modelPath: string; options: any }) => Promise<{ port: number }>;
      stopLlama: () => Promise<void>;
      getLlamaStatus: () => Promise<{ running: boolean; port: number }>;
      downloadModel: (options: { url: string; filename: string }) => Promise<{ path: string; size: number }>;
      deleteModel: (filename: string) => Promise<boolean>;
      onDownloadProgress: (callback: (data: { progress: string; downloaded: number; totalSize: number }) => void) => void;
      removeDownloadProgressListener: () => void;
    };
  }
}

interface DownloadProgress {
  modelId: string;
  progress: number;
  downloaded: number;
  totalSize: number;
}

export function ModelsScreen() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<Array<{ name: string; path: string; size: number }>>([]);
  const [llamaStatus, setLlamaStatus] = useState<{ running: boolean; port: number } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    loadData();
    
    if (window.electronAPI) {
      window.electronAPI.onDownloadProgress((data) => {
        setDownloadProgress(prev => ({
          modelId: prev?.modelId || '',
          progress: parseFloat(data.progress),
          downloaded: data.downloaded,
          totalSize: data.totalSize
        }));
      });
    }
    
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeDownloadProgressListener();
      }
    };
  }, []);

  const loadData = async () => {
    if (!window.electronAPI) {
      setLoading(false);
      return;
    }

    try {
      const [memory, models, status] = await Promise.all([
        window.electronAPI.getSystemMemory(),
        window.electronAPI.listModels(),
        window.electronAPI.getLlamaStatus()
      ]);

      setSystemInfo(memory);
      setDownloadedModels(models);
      setLlamaStatus(status);
      setRecommendations(recommendModels(memory));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (modelId: string, fileName: string) => {
    if (!window.electronAPI) return;

    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model) return;

    setDownloadProgress({ modelId, progress: 0, downloaded: 0, totalSize: 0 });

    try {
      const file = model.files.find(f => f.name === fileName) || model.files[0];
      const url = `${model.baseUrl}/resolve/master/${file.name}`;
      
      await window.electronAPI.downloadModel({ url, filename: file.name });
      await loadData();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadProgress(null);
    }
  };

  const handleStartModel = async (modelPath: string, modelName: string) => {
    if (!window.electronAPI) return;

    try {
      setActiveModel(modelName);
      await window.electronAPI.startLlama({
        modelPath,
        options: {
          ctxSize: 4096,
          gpuLayers: -1,
          threads: 4,
          flashAttention: true
        }
      });
      await loadData();
    } catch (error) {
      console.error('Failed to start model:', error);
      setActiveModel(null);
    }
  };

  const handleStopModel = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.stopLlama();
    setActiveModel(null);
    await loadData();
  };

  const handleDeleteModel = async (fileName: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteModel(fileName);
    await loadData();
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
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
          <Text style={[styles.title, { color: theme.text }]}>模型管理</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            此功能仅在桌面应用中可用
          </Text>
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: spacing.md }]}>
            请使用以下命令启动桌面应用：
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: theme.surface }]}>
            <Text style={[styles.codeText, { color: theme.text }]}>npm run electron:dev</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>系统信息</Text>
        {systemInfo && (
          <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.infoText, { color: theme.text }]}>
              💾 总内存: {systemInfo.totalGB} GB
            </Text>
            <Text style={[styles.infoText, { color: theme.text }]}>
              ✅ 可用内存: {systemInfo.freeGB} GB
            </Text>
            {systemInfo.hasGpu && (
              <Text style={[styles.infoText, { color: theme.text }]}>
                🎮 GPU 显存: {Math.round(systemInfo.vram / (1024 * 1024 * 1024))} GB
              </Text>
            )}
          </View>
        )}
      </View>

      {llamaStatus?.running && (
        <View style={styles.section}>
          <View style={[styles.statusCard, { backgroundColor: '#D4EDDA' }]}>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: '#155724' }]}>
                ✅ 模型运行中
              </Text>
              <Text style={[styles.statusDetail, { color: '#155724' }]}>
                {activeModel} | 端口: {llamaStatus.port}
              </Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={handleStopModel}>
              <Text style={styles.stopButtonText}>停止</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>已下载模型</Text>
        {downloadedModels.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              暂无已下载的模型
            </Text>
            <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
              从下方推荐模型中选择下载
            </Text>
          </View>
        ) : (
          downloadedModels.map((model) => (
            <View key={model.name} style={[styles.modelCard, { backgroundColor: theme.surface }]}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: theme.text }]}>{model.name}</Text>
                <Text style={[styles.modelSize, { color: theme.textSecondary }]}>
                  {formatSize(model.size)}
                </Text>
              </View>
              <View style={styles.modelActions}>
                {!llamaStatus?.running ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleStartModel(model.path, model.name)}
                  >
                    <Text style={styles.actionButtonText}>启动</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#dc3545' }]}
                  onPress={() => handleDeleteModel(model.name)}
                >
                  <Text style={styles.actionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>推荐模型</Text>
        <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
          根据您的系统配置推荐，默认选择 Q4_K_XL 量化
        </Text>
        {recommendations.map((rec) => {
          const isDownloaded = downloadedModels.some(m => m.name.includes(rec.model.id));
          
          return (
            <View key={rec.model.id} style={[
              styles.modelCard, 
              { backgroundColor: theme.surface },
              !rec.canRun && styles.disabledCard
            ]}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: theme.text }]}>{rec.model.name}</Text>
                <Text style={[styles.modelDesc, { color: theme.textSecondary }]}>
                  {rec.model.description}
                </Text>
                <Text style={[styles.modelMeta, { color: theme.textSecondary }]}>
                  参数: {rec.model.parameters} | 上下文: {rec.model.contextLength}
                </Text>
                <Text style={[styles.modelMeta, { color: theme.textSecondary }]}>
                  最小内存: {rec.model.minRam} GB | 推荐: {rec.model.recommendedRam} GB
                </Text>
                <Text style={[
                  styles.modelReason, 
                  { color: rec.canRun ? '#28a745' : '#dc3545' }
                ]}>
                  {rec.reason}
                </Text>
              </View>
              {rec.canRun && !isDownloaded && (
                <TouchableOpacity
                  style={[
                    styles.downloadButton, 
                    { backgroundColor: theme.primary },
                    downloadProgress?.modelId === rec.model.id && styles.downloading
                  ]}
                  onPress={() => handleDownload(rec.model.id, rec.file.name)}
                  disabled={downloadProgress?.modelId === rec.model.id}
                >
                  {downloadProgress?.modelId === rec.model.id ? (
                    <View style={styles.progressContainer}>
                      <Text style={styles.downloadButtonText}>
                        下载中 {downloadProgress.progress.toFixed(1)}%
                      </Text>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${downloadProgress.progress}%` }
                          ]} 
                        />
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.downloadButtonText}>
                      下载 ({formatSize(rec.file.size)})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {isDownloaded && (
                <View style={[styles.downloadedBadge, { backgroundColor: '#28a745' }]}>
                  <Text style={styles.downloadedText}>✓ 已下载</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          模型来源: ModelScope
        </Text>
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
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  hint: {
    ...typography.body,
    textAlign: 'center',
  },
  codeBlock: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  codeText: {
    ...typography.body,
    fontFamily: 'monospace',
  },
  infoCard: {
    padding: spacing.md,
    borderRadius: 8,
  },
  infoText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  statusCard: {
    padding: spacing.md,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  statusDetail: {
    ...typography.caption,
    marginTop: spacing.xs,
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
  emptyCard: {
    padding: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    ...typography.caption,
  },
  modelCard: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  disabledCard: {
    opacity: 0.6,
  },
  modelInfo: {
    marginBottom: spacing.sm,
  },
  modelName: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  modelDesc: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  modelMeta: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  modelSize: {
    ...typography.caption,
  },
  modelReason: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  modelActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  downloadButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  downloading: {
    opacity: 0.8,
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  downloadedBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  downloadedText: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
  },
});
