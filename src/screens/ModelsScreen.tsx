import React, { useState, useEffect } from 'react';
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
  Linking,
  Platform,
} from 'react-native';
import { colors, spacing, typography } from '../theme';
import { AVAILABLE_MODELS, recommendModels, ModelRecommendation, SystemInfo } from '../services/models';
import '../types/electron';

type OSType = 'darwin' | 'linux' | 'windows';
type InstallTarget = 'local' | 'ssh';
type DownloadTab = 'model' | 'engine';
type MainTab = 'download' | 'config' | 'pool';

interface DownloadProgress {
  modelId: string;
  progress: number;
  downloaded: number;
  totalSize: number;
}

interface EngineProgress {
  progress: number;
  speed: string;
}

interface ModelPoolConfig {
  port: number;
  host: string;
  maxModels: number;
  contextSize: number;
  gpuLayers: number;
  threads: number;
  modelsDir: string;
  modelsPreset: string;
  logFile: string;
}

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  keyPath: string;
  modelsPath: string;
}

interface SystemInfoData {
  platform: OSType;
  arch: string;
  osName: string;
}

interface PoolLog {
  id: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}

interface SSHProbeResult {
  connected: boolean;
  error?: string;
  system?: {
    hostname: string;
    os: string;
    kernel: string;
    arch: string;
  };
  cpu?: {
    model: string;
    cores: number;
    threads: number;
  };
  memory?: {
    total: number;
    available: number;
    used: number;
  };
  gpu?: {
    available: boolean;
    vendor?: string;
    devices: Array<{
      name: string;
      memory?: number;
      driver?: string;
    }>;
  };
  disk?: {
    total: number;
    available: number;
    used: number;
    path: string;
  };
  disks?: Array<{
    filesystem: string;
    total: number;
    available: number;
    used: number;
    path: string;
    usePercent: string;
  }>;
  models?: Array<{
    name: string;
    size: string;
    modifiedTime: string;
    path: string;
  }>;
  timestamp: string;
}

export function ModelsScreen() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemData, setSystemData] = useState<SystemInfoData | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<Array<{ name: string; path: string; size: number; isDefault?: boolean }>>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [engineProgress, setEngineProgress] = useState<EngineProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>('pool');
  const [downloadTab, setDownloadTab] = useState<DownloadTab>('model');
  const [installTarget, setInstallTarget] = useState<InstallTarget>('local');
  const [sshConfig, setSshConfig] = useState<SSHConfig>({
    host: '192.168.0.1',
    port: 22,
    username: 'my',
    password: '',
    keyPath: '',
    modelsPath: '~/.mychat/models/gguf',
  });
  const [useSSHKey, setUseSSHKey] = useState(false);
  const [modelPoolConfig, setModelPoolConfig] = useState<ModelPoolConfig>({
    port: 8080,
    host: '0.0.0.0',
    maxModels: 2,
    contextSize: 32768,
    gpuLayers: -1,
    threads: 4,
    modelsDir: '~/.mychat/models/gguf',
    modelsPreset: '~/.mychat/gguf/model-config.ini',
    logFile: '~/.mychat/logs/llama_server.log',
  });
  const [modelPoolStatus, setModelPoolStatus] = useState<{ running: boolean; port: number } | null>(null);
  const [startingModelPool, setStartingModelPool] = useState(false);
  const [engineInstalling, setEngineInstalling] = useState(false);
  const [poolLogs, setPoolLogs] = useState<PoolLog[]>([]);
  const [engineLogs, setEngineLogs] = useState<PoolLog[]>([]);
  const [engineVersion, setEngineVersion] = useState<string | null>(null);
  const [engineLatestVersion, setEngineLatestVersion] = useState<string | null>(null);
  const [engineDownloadUrl, setEngineDownloadUrl] = useState<string | null>(null);
  const [remoteEngineVersion, setRemoteEngineVersion] = useState<string | null>(null);
  const [checkingRemoteEngine, setCheckingRemoteEngine] = useState(false);
  const [showEmbeddedUI, setShowEmbeddedUI] = useState(false);
  const [loadedModels, setLoadedModels] = useState<string[]>([]);
  const [sshProbing, setSshProbing] = useState(false);
  const [sshProbeResult, setSshProbeResult] = useState<SSHProbeResult | null>(null);
  const [remoteModels, setRemoteModels] = useState<Array<{ name: string; size: string; modifiedTime: string; path: string }>>([]);
  const [loadingRemoteModels, setLoadingRemoteModels] = useState(false);
  const [remoteServiceStatus, setRemoteServiceStatus] = useState<{
    installed: boolean;
    running: boolean;
    enabled: boolean;
    pid: string | null;
    port: number | null;
  } | null>(null);
  const [loadingServiceStatus, setLoadingServiceStatus] = useState(false);
  const [serviceOperation, setServiceOperation] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    loadData();
    detectOS();
    checkEngineStatus();
    checkLocalEngineVersion();
    loadSavedConfig();
    
    const api = window.electronAPI;
    if (api) {
      api.onDownloadProgress((data) => {
        setDownloadProgress(prev => ({
          modelId: prev?.modelId || '',
          progress: parseFloat(data.progress),
          downloaded: data.downloaded,
          totalSize: data.totalSize
        }));
      });

      const unsubscribeEngineLog = api.onEngineLog((data) => {
        const timestamp = new Date(data.timestamp || Date.now()).toLocaleTimeString();
        let level: PoolLog['level'] = 'info';
        if (data.type === 'error' || data.type === 'stderr') {
          level = 'error';
        } else if (data.type === 'warning' || data.type === 'warn') {
          level = 'warn';
        } else if (data.type === 'success') {
          level = 'success';
        } else if (data.type === 'info' || data.type === 'stdout') {
          level = 'info';
        }
        setPoolLogs(prev => [...prev, { 
          id: data.timestamp || Date.now(), 
          level, 
          message: data.message, 
          timestamp 
        }]);
      });

      return () => {
        unsubscribeEngineLog();
        api.removeDownloadListeners();
      };
    }
  }, []);

  const loadSavedConfig = async () => {
    if (!window.electronAPI?.loadAppConfig) return;
    try {
      const savedConfig = await window.electronAPI.loadAppConfig();
      if (savedConfig) {
        if (savedConfig.sshConfig) {
          setSshConfig(savedConfig.sshConfig);
        }
        if (savedConfig.modelPoolConfig) {
          setModelPoolConfig(savedConfig.modelPoolConfig);
        }
      }
    } catch (error) {
      console.error('Failed to load saved config:', error);
    }
  };

  const saveConfig = async () => {
    if (!window.electronAPI?.saveAppConfig) return;
    try {
      await window.electronAPI.saveAppConfig({
        sshConfig,
        modelPoolConfig,
      });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  useEffect(() => {
    saveConfig();
  }, [sshConfig, modelPoolConfig]);

  useEffect(() => {
    setModelPoolStatus(null);
    setShowEmbeddedUI(false);
    setPoolLogs([]);
    
    if (installTarget === 'ssh') {
      loadRemoteModels();
      checkRemoteEngine();
      checkRemoteEngineStatus();
    } else {
      checkLocalEngineVersion();
      checkEngineStatus();
    }
  }, [installTarget]);

  const getRemoteModelsPath = (): string => {
    return modelPoolConfig.modelsDir || sshConfig.modelsPath || '~/.mychat/models/gguf';
  };

  const getRemoteSystemInfo = (): SystemInfo | null => {
    if (!sshProbeResult?.connected || !sshProbeResult.memory) {
      return null;
    }
    return {
      total: sshProbeResult.memory.total,
      free: sshProbeResult.memory.available,
      totalGB: sshProbeResult.memory.total / (1024 * 1024 * 1024),
      freeGB: sshProbeResult.memory.available / (1024 * 1024 * 1024),
      hasGpu: sshProbeResult.gpu?.available || false,
      vram: sshProbeResult.gpu?.devices?.[0]?.memory || 0,
    };
  };

  useEffect(() => {
    if (installTarget === 'ssh') {
      const remoteInfo = getRemoteSystemInfo();
      if (remoteInfo) {
        console.log('Remote recommendations - Memory:', remoteInfo.freeGB.toFixed(1), 'GB, GPU:', remoteInfo.hasGpu);
        setRecommendations(recommendModels(remoteInfo));
      } else {
        console.log('Remote mode but no probe result - clearing recommendations');
        setRecommendations([]);
      }
    } else if (systemInfo) {
      console.log('Local recommendations - Memory:', systemInfo.freeGB.toFixed(1), 'GB');
      setRecommendations(recommendModels(systemInfo));
    }
  }, [installTarget, sshProbeResult, systemInfo]);

  const checkRemoteEngine = async () => {
    if (!window.electronAPI?.executeSSHCommand) return;
    if (!sshConfig.host) return;
    
    setCheckingRemoteEngine(true);
    try {
      const result = await window.electronAPI.executeSSHCommand({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      }, 'test -f ~/.mychat/engines/llama-server && echo "EXISTS" || echo "NOT_EXISTS"');
      
      if (result.success && result.stdout?.trim() === 'EXISTS') {
        const versionResult = await window.electronAPI.executeSSHCommand({
          host: sshConfig.host,
          port: sshConfig.port,
          username: sshConfig.username,
          password: sshConfig.password,
          keyPath: sshConfig.keyPath,
          useKey: useSSHKey,
        }, '~/.mychat/engines/llama-server --version 2>&1 | head -5');
        
        if (versionResult.success && versionResult.stdout) {
          const versionMatch = versionResult.stdout.match(/version:\s*(\d+)/i);
          if (versionMatch) {
            setRemoteEngineVersion('b' + versionMatch[1]);
          } else {
            const altMatch = versionResult.stdout.match(/(\d{4,5})/);
            if (altMatch) {
              setRemoteEngineVersion('b' + altMatch[1]);
            } else {
              setRemoteEngineVersion('installed');
            }
          }
          
          const output = versionResult.stdout.toLowerCase();
          const hasGpuSupport = output.includes('vulkan') || output.includes('cuda') || output.includes('hipblas');
          if (hasGpuSupport) {
            addLog('info', `🎮 远程引擎支持 GPU 加速`);
          }
        } else {
          setRemoteEngineVersion('installed');
        }
      } else {
        setRemoteEngineVersion(null);
      }
      
      try {
        const latestResult = await window.electronAPI.executeSSHCommand({
          host: sshConfig.host,
          port: sshConfig.port,
          username: sshConfig.username,
          password: sshConfig.password,
          keyPath: sshConfig.keyPath,
          useKey: useSSHKey,
        }, `curl -s https://api.github.com/repos/ggml-org/llama.cpp/releases/latest 2>/dev/null | grep -o '"tag_name": "[^"]*"' | head -1`);
        
        if (latestResult.success && latestResult.stdout) {
          const tagMatch = latestResult.stdout.match(/"tag_name":\s*"([^"]+)"/);
          if (tagMatch) {
            setEngineLatestVersion(tagMatch[1]);
          }
        }
      } catch (e) {
        console.log('Failed to fetch latest version:', e);
      }
    } catch (error) {
      console.error('Failed to check remote engine:', error);
      setRemoteEngineVersion(null);
    } finally {
      setCheckingRemoteEngine(false);
    }
  };

  const loadRemoteModels = async () => {
    if (!window.electronAPI?.executeSSHCommand) return;
    
    setLoadingRemoteModels(true);
    try {
      const modelsPath = getRemoteModelsPath();
      const expandCmd = `echo "${modelsPath}"`;
      const expandResult = await window.electronAPI.executeSSHCommand({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      }, expandCmd);
      
      const expandedPath = expandResult.success && expandResult.stdout 
        ? expandResult.stdout.trim() 
        : modelsPath;
      
      const cmd = `ls -lh "${expandedPath}"/*.gguf 2>/dev/null || echo "NO_MODELS"`;
      
      const result = await window.electronAPI.executeSSHCommand({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      }, cmd);
      
      if (result.success && result.stdout && result.stdout !== 'NO_MODELS') {
        const lines = result.stdout.trim().split('\n');
        const models: Array<{ name: string; size: string; modifiedTime: string; path: string }> = [];
        
        for (const line of lines) {
          if (line.trim() && !line.startsWith('total')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 9) {
              const size = parts[4];
              const filename = parts[parts.length - 1];
              const datePart = parts[5];
              const dayOrTime = parts[6];
              const yearOrTime = parts[7];
              
              let modifiedTime = '';
              if (yearOrTime && yearOrTime.includes(':')) {
                modifiedTime = `${datePart} ${dayOrTime} ${yearOrTime}`;
              } else if (yearOrTime) {
                modifiedTime = `${datePart} ${dayOrTime} ${yearOrTime}`;
              } else {
                modifiedTime = `${datePart} ${dayOrTime}`;
              }
              
              if (filename && filename.endsWith('.gguf')) {
                models.push({
                  name: filename,
                  size: size,
                  modifiedTime: modifiedTime,
                  path: `${expandedPath}/${filename}`
                });
              }
            }
          }
        }
        
        models.sort((a, b) => a.name.localeCompare(b.name));
        setRemoteModels(models);
      } else {
        setRemoteModels([]);
      }
    } catch (error) {
      console.error('Failed to load remote models:', error);
      setRemoteModels([]);
    } finally {
      setLoadingRemoteModels(false);
    }
  };

  useEffect(() => {
    if (!modelPoolStatus?.running) {
      setLoadedModels([]);
      return;
    }

    const interval = setInterval(() => {
      fetchLoadedModels(modelPoolStatus.port);
    }, 3000);

    return () => clearInterval(interval);
  }, [modelPoolStatus?.running, modelPoolStatus?.port]);

  const checkEngineStatus = async () => {
    if (!window.electronAPI) return;
    try {
      const status = await window.electronAPI.getCurrentEngine();
      if (status?.running) {
        setModelPoolStatus({ running: true, port: status.port });
        fetchLoadedModels(status.port);
      }
    } catch (error) {
      console.error('Failed to check engine status:', error);
    }
  };

  const checkRemoteEngineStatus = async () => {
    if (!window.electronAPI?.executeSSHCommand) return;
    if (!sshConfig.host) return;
    
    try {
      const result = await window.electronAPI.executeSSHCommand({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      }, `ps aux | grep llama-server | grep -v grep`);
      
      const stdoutStr = result?.stdout || '';
      
      if (result?.success && stdoutStr.trim().length > 0) {
        const lines = stdoutStr.trim().split('\n');
        const targetLine = lines.find(line => line.includes(`--port`) && line.includes(`${modelPoolConfig.port}`));
        
        if (targetLine) {
          const pidMatch = targetLine.match(/^\S+\s+(\d+)/);
          const pid = pidMatch?.[1] || 'unknown';
          setModelPoolStatus({ running: true, port: modelPoolConfig.port });
          addLog('success', `✅ 远程模型池运行中 | PID: ${pid} | 端口: ${modelPoolConfig.port}`);
          return;
        }
      }
      setModelPoolStatus(null);
    } catch (error) {
      console.error('Failed to check remote engine status:', error);
      setModelPoolStatus(null);
    }
  };

  const checkLocalEngineVersion = async () => {
    if (!window.electronAPI?.checkEngineUpdate) return;
    try {
      const updateInfo = await window.electronAPI.checkEngineUpdate('llama');
      if (updateInfo?.currentVersion) {
        setEngineVersion(updateInfo.currentVersion);
      }
      if (updateInfo?.latestVersion) {
        setEngineLatestVersion(updateInfo.latestVersion);
      }
    } catch (error) {
      console.error('Failed to check local engine version:', error);
    }
  };

  const fetchLoadedModels = async (port: number) => {
    try {
      const host = installTarget === 'ssh' ? sshConfig.host : 'localhost';
      const response = await fetch(`http://${host}:${port}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          const modelIds = data.data.map((m: any) => m.id || m.name || '');
          setLoadedModels(modelIds);
        }
      }
    } catch (error) {
      console.log('Failed to fetch loaded models:', error);
    }
  };

  const detectOS = async () => {
    if (window.electronAPI) {
      try {
        const info = await window.electronAPI.getSystemInfo();
        const platform = info.platform.toLowerCase().includes('darwin') ? 'darwin' 
          : info.platform.toLowerCase().includes('linux') ? 'linux' 
          : 'windows';
        setSystemData({
          platform,
          arch: info.arch,
          osName: info.platform,
        });
      } catch (error) {
        setSystemData({
          platform: 'darwin',
          arch: 'x64',
          osName: 'macOS',
        });
      }
    } else {
      setSystemData({
        platform: 'darwin',
        arch: 'x64',
        osName: 'macOS',
      });
    }
  };

  const loadData = async () => {
    if (!window.electronAPI) {
      setLoading(false);
      return;
    }

    try {
      const [memory, models] = await Promise.all([
        window.electronAPI.getSystemMemory(),
        window.electronAPI.listModels(),
      ]);

      setSystemInfo(memory);
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (level: PoolLog['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setPoolLogs(prev => [...prev, { id: Date.now(), level, message, timestamp }]);
  };

  const addEngineLog = (level: PoolLog['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEngineLogs(prev => [...prev, { id: Date.now(), level, message, timestamp }]);
  };

  const handleDownload = async (modelId: string, fileName: string) => {
    if (!window.electronAPI) return;

    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model) return;

    setDownloadProgress({ modelId, progress: 0, downloaded: 0, totalSize: 0 });

    try {
      const file = model.files.find(f => f.name === fileName) || model.files[0];
      const url = `${model.baseUrl}/resolve/master/${file.name}`;
      
      if (installTarget === 'local') {
        await window.electronAPI.downloadModel({ url, filename: file.name });
      } else {
        const sshCmd = buildSSHDownloadCommand(url, fileName, true);
        await executeRemoteCommand(sshCmd);
      }
      await loadData();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadProgress(null);
    }
  };

  const handleDownloadEngine = async () => {
    setEngineInstalling(true);
    setEngineProgress({ progress: 0, speed: '0 MB/s' });
    setEngineLogs([]);
    setEngineDownloadUrl(null);

    addEngineLog('info', `🚀 开始下载引擎...`);
    addEngineLog('info', `📍 目标: ${installTarget === 'local' ? '本机' : sshConfig.host}`);

    try {
      if (installTarget === 'local') {
        addEngineLog('info', `💻 平台: ${systemData?.platform || 'unknown'} | 架构: ${systemData?.arch || 'unknown'}`);
        
        if (!window.electronAPI) {
          addEngineLog('error', '❌ Electron API 不可用');
          setEngineInstalling(false);
          return;
        }

        addEngineLog('info', '🔍 检查引擎版本信息...');
        
        let latestVer: string | null = null;
        try {
          const updateInfo = await window.electronAPI.checkEngineUpdate?.('llama');
          addEngineLog('info', `📋 版本信息: ${JSON.stringify(updateInfo)}`);
          
          if (updateInfo?.currentVersion) {
            setEngineVersion(updateInfo.currentVersion);
            addEngineLog('info', `📌 当前已安装版本: ${updateInfo.currentVersion}`);
          }
          
          if (updateInfo?.latestVersion) {
            latestVer = updateInfo.latestVersion;
            setEngineLatestVersion(updateInfo.latestVersion);
            addEngineLog('info', `🆕 最新版本: ${updateInfo.latestVersion}`);
          }
          
          if (updateInfo?.hasUpdate) {
            addEngineLog('warn', `⬆️ 发现新版本可用!`);
          }
          
          if (updateInfo?.releaseInfo?.assets) {
            const asset = updateInfo.releaseInfo.assets.find((a: any) => 
              a.name.includes(systemData?.platform || '') && a.name.includes(systemData?.arch || 'x64')
            );
            if (asset?.browser_download_url) {
              setEngineDownloadUrl(asset.browser_download_url);
              addEngineLog('info', `🌐 下载地址: ${asset.browser_download_url}`);
            }
          }
        } catch (checkError: any) {
          addEngineLog('warn', `⚠️ 无法获取版本信息: ${checkError?.message || checkError}`);
        }

        addEngineLog('info', '📦 开始下载引擎...');
        
        const targetVersion = latestVer;
        if (targetVersion) {
          addEngineLog('info', `🎯 目标版本: ${targetVersion}`);
        } else {
          addEngineLog('warn', `⚠️ 未获取到最新版本，将使用默认版本`);
        }
        
        try {
          const result = await window.electronAPI.downloadEngineUpdate?.({ 
            engine: 'llama', 
            version: targetVersion || undefined
          });
          addEngineLog('info', `📨 API 返回: ${JSON.stringify(result)}`);
          
          if (result) {
            addEngineLog('success', `✅ 引擎下载完成!`);
            addEngineLog('info', `📁 安装路径: ${result.path || 'N/A'}`);
            if (result.version) {
              setEngineVersion(result.version);
              addEngineLog('info', `📌 已安装版本: ${result.version}`);
            }
            if (result.alreadyInstalled) {
              addEngineLog('info', `ℹ️ 该版本已安装，跳过下载`);
            }
          } else {
            addEngineLog('error', `❌ 下载失败: 无返回结果`);
          }
        } catch (apiError: any) {
          addEngineLog('error', `❌ API 调用异常: ${apiError?.message || apiError}`);
          if (apiError?.stack) {
            addEngineLog('error', `   堆栈: ${apiError.stack.split('\n').slice(0, 3).join(' | ')}`);
          }
        }
      } else {
        if (!sshProbeResult?.connected) {
          addEngineLog('error', '❌ 请先测试 SSH 连接');
          setEngineInstalling(false);
          return;
        }
        
        const remoteOs = sshProbeResult.system?.os?.toLowerCase() || 'linux';
        const remoteArch = sshProbeResult.system?.arch || 'x64';
        
        let osName = 'ubuntu';
        if (remoteOs.includes('darwin') || remoteOs.includes('mac')) {
          osName = 'macos';
        } else if (remoteOs.includes('linux')) {
          osName = 'ubuntu';
        }
        
        let archName = 'x64';
        if (remoteArch.includes('arm') || remoteArch.includes('aarch')) {
          archName = 'arm64';
        }
        
        const gpuVendor = sshProbeResult?.gpu?.vendor;
        const hasGpu = sshProbeResult?.gpu?.available && gpuVendor;
        
        addEngineLog('info', `💻 远程平台: ${osName} | 架构: ${archName}`);
        if (hasGpu) {
          addEngineLog('info', `🎮 GPU 厂商: ${gpuVendor} - 将下载 Vulkan GPU 加速版本`);
          addEngineLog('warn', `⚠️ 使用 GPU 加速需要安装 Vulkan 运行时`);
          addEngineLog('info', `   安装命令: sudo apt install vulkan-tools`);
        } else {
          addEngineLog('info', `💻 无 GPU 或未检测到 - 将下载 CPU 版本`);
        }
        
        let version = engineLatestVersion || 'b8606';
        addEngineLog('info', `📌 目标版本: ${version}`);
        
        if (!engineLatestVersion) {
          addEngineLog('warn', `⚠️ 未获取到最新版本，使用默认版本 ${version}`);
          try {
            const latestResult = await window.electronAPI?.executeSSHCommand?.({
              host: sshConfig.host,
              port: sshConfig.port,
              username: sshConfig.username,
              password: sshConfig.password,
              keyPath: sshConfig.keyPath,
              useKey: useSSHKey,
            }, `curl -s https://api.github.com/repos/ggml-org/llama.cpp/releases/latest 2>/dev/null | grep -o '"tag_name": "[^"]*"' | head -1`);
            
            if (latestResult?.stdout) {
              const tagMatch = latestResult.stdout.match(/"tag_name":\s*"([^"]+)"/);
              if (tagMatch) {
                version = tagMatch[1];
                setEngineLatestVersion(version);
                addEngineLog('info', `📌 从 GitHub 获取最新版本: ${version}`);
              }
            }
          } catch (e) {
            addEngineLog('warn', `⚠️ 获取最新版本失败: ${e}`);
          }
        }
        
        let url: string;
        
        if (hasGpu && osName === 'ubuntu' && archName === 'x64') {
          url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-ubuntu-vulkan-x64.tar.gz`;
        } else {
          url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-${osName}-${archName}.tar.gz`;
        }
        
        setEngineDownloadUrl(url);
        addEngineLog('info', `🌐 下载地址: ${url}`);
        
        if (hasGpu) {
          addEngineLog('info', `🔧 检查 Vulkan 环境...`);
          const vulkanCheck = await window.electronAPI?.executeSSHCommand?.({
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
            password: sshConfig.password,
            keyPath: sshConfig.keyPath,
            useKey: useSSHKey,
          }, `vulkaninfo --summary 2>/dev/null | head -5 || echo "VULKAN_NOT_INSTALLED"`);
          
          if (vulkanCheck?.stdout?.includes('VULKAN_NOT_INSTALLED')) {
            addEngineLog('warn', `⚠️ Vulkan 未安装，正在尝试安装...`);
            const installVulkan = await window.electronAPI?.executeSSHCommand?.({
              host: sshConfig.host,
              port: sshConfig.port,
              username: sshConfig.username,
              password: sshConfig.password,
              keyPath: sshConfig.keyPath,
              useKey: useSSHKey,
            }, `echo "${sshConfig.password}" | sudo -S apt install -y vulkan-tools 2>&1 || echo "INSTALL_FAILED"`);
            
            if (installVulkan?.stdout?.includes('INSTALL_FAILED')) {
              addEngineLog('error', `❌ Vulkan 安装失败，请手动安装: sudo apt install vulkan-tools`);
            } else {
              addEngineLog('success', `✅ Vulkan 已安装`);
            }
          } else {
            addEngineLog('success', `✅ Vulkan 环境已就绪`);
          }
        }
        
        const sshCmd = buildSSHDownloadCommand(url, 'llama-engine.tar.gz');
        addEngineLog('info', `📡 执行远程命令...`);
        await executeRemoteCommand(sshCmd);
        
        addEngineLog('info', `📦 解压引擎...`);
        const extractCmd = `cd ~/.mychat/engines && tar -xzf llama-engine.tar.gz --strip-components 1 && chmod +x llama-server && rm llama-engine.tar.gz`;
        await executeRemoteCommand(extractCmd);
        
        addEngineLog('success', `✅ 引擎已安装到远程服务器 ${sshConfig.host}`);
        addEngineLog('info', `📁 安装路径: ~/.mychat/engines/llama-server`);
        setRemoteEngineVersion(version);
        setEngineLatestVersion(version);
      }
    } catch (error: any) {
      addEngineLog('error', `❌ 引擎下载失败: ${error?.message || error}`);
    } finally {
      setEngineInstalling(false);
      setEngineProgress(null);
    }
  };

  const buildSSHDownloadCommand = (url: string, filename: string, isModel: boolean = false): string => {
    const targetDir = isModel ? getRemoteModelsPath() : '~/.mychat/engines';
    return `mkdir -p ${targetDir} && curl -L -o ${targetDir}/${filename} '${url}'`;
  };

  const executeRemoteCommand = async (command: string): Promise<string> => {
    addLog('info', `执行远程命令: ${command.substring(0, 80)}...`);
    
    if (!window.electronAPI?.executeSSHCommand) {
      addLog('error', '❌ SSH API 不可用');
      throw new Error('SSH API 不可用');
    }
    
    try {
      const result = await window.electronAPI.executeSSHCommand({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      }, command);
      
      if (result.success) {
        addLog('success', '✅ 命令执行成功');
        if (result.stdout) {
          addLog('info', `输出: ${result.stdout.substring(0, 200)}`);
        }
        return result.stdout;
      } else {
        addLog('error', `❌ 命令执行失败: ${result.error || result.stderr}`);
        throw new Error(result.error || result.stderr || '命令执行失败');
      }
    } catch (error: any) {
      addLog('error', `❌ 执行异常: ${error?.message || error}`);
      throw error;
    }
  };

  const probeSSHHost = async () => {
    setSshProbing(true);
    setSshProbeResult(null);

    try {
      if (!window.electronAPI?.probeSSHHost) {
        setSshProbeResult({
          connected: false,
          error: 'Electron API 不可用，请重启应用',
          timestamp: new Date().toLocaleString(),
        });
        return;
      }

      const result = await window.electronAPI.probeSSHHost({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
        modelsPath: getRemoteModelsPath(),
      });

      setSshProbeResult(result);
      
      if (result.connected && result.models) {
        setRemoteModels(result.models);
      }
      
      if (result.connected) {
        checkRemoteEngine();
      }
    } catch (error: any) {
      setSshProbeResult({
        connected: false,
        error: error?.message || '探测失败',
        timestamp: new Date().toLocaleString(),
      });
    } finally {
      setSshProbing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openWebUI = () => {
    setShowEmbeddedUI(!showEmbeddedUI);
  };

  const handleStartModelPool = async () => {
    setStartingModelPool(true);
    setPoolLogs([]);
    setModelPoolStatus(null);
    setShowEmbeddedUI(false);

    const targetInfo = installTarget === 'local' ? '本机' : `${sshConfig.host}`;
    addLog('info', `🚀 准备启动模型池 (${targetInfo})...`);
    addLog('info', `📋 配置: 端口=${modelPoolConfig.port}, 最大模型=${modelPoolConfig.maxModels}`);

    try {
      if (installTarget === 'local') {
        if (!window.electronAPI) {
          addLog('error', '❌ Electron API 不可用');
          setStartingModelPool(false);
          return;
        }

        addLog('info', `📦 调用 startModelPool API...`);
        addLog('info', `   参数: ${JSON.stringify(modelPoolConfig)}`);

        let result: any;
        try {
          result = await window.electronAPI.startModelPool({
            port: modelPoolConfig.port,
            host: modelPoolConfig.host,
            maxModels: modelPoolConfig.maxModels,
            contextSize: modelPoolConfig.contextSize,
            gpuLayers: modelPoolConfig.gpuLayers,
          });
          addLog('info', `📨 API 返回结果: ${JSON.stringify(result)}`);
        } catch (apiError: any) {
          addLog('error', `❌ API 调用异常: ${apiError?.message || apiError}`);
          if (apiError?.stack) {
            addLog('error', `   堆栈: ${apiError.stack.split('\n').slice(0, 3).join(' | ')}`);
          }
          setStartingModelPool(false);
          return;
        }

        if (!result) {
          addLog('error', `❌ API 返回空结果`);
          setStartingModelPool(false);
          return;
        }

        if (!result.success) {
          addLog('error', `❌ 启动失败: ${result.message || '未知错误'}`);
          setStartingModelPool(false);
          return;
        }

        const actualPort = result?.port || modelPoolConfig.port;
        addLog('info', `🔍 验证引擎状态 (期望端口: ${actualPort})...`);

        let currentStatus: any;
        try {
          currentStatus = await window.electronAPI.getCurrentEngine();
          addLog('info', `📊 当前引擎状态: ${JSON.stringify(currentStatus)}`);
        } catch (statusError: any) {
          addLog('error', `❌ 获取状态失败: ${statusError?.message || statusError}`);
        }

        if (currentStatus?.running) {
          setModelPoolStatus({ running: true, port: actualPort });
          addLog('success', `✅ 模型池运行中 | 端口: ${actualPort}`);
          addLog('info', `🌐 Web UI: http://localhost:${actualPort}`);
        } else {
          addLog('error', `❌ 引擎未成功启动`);
          addLog('warn', `💡 可能原因:`);
          addLog('warn', `   1. llama-server 可执行文件不存在`);
          addLog('warn', `   2. 模型配置文件不存在，请先生成配置`);
          addLog('warn', `   3. 端口 ${actualPort} 已被占用`);
          addLog('info', `💡 请检查 Electron 主进程日志获取详细错误信息`);
        }
      } else {
        let pid = 'unknown';
        const startCmd = buildRemotePoolStartCommand();
        addLog('info', `📨 发送远程启动命令...`);
        addLog('info', `完整命令:`);
        addLog('info', startCmd);

        try {
          const result = await executeRemoteCommand(startCmd);
          if (result) {
            addLog('info', `命令输出: ${result.substring(0, 200)}`);
            const pidMatch = result.match(/Started with PID:\s*(\d+)/);
            if (pidMatch) {
              pid = pidMatch[1];
              addLog('info', `启动进程 PID: ${pid}`);
            }
          }
        } catch (cmdError: any) {
          addLog('error', `命令执行异常: ${cmdError?.message || cmdError}`);
        }

        addLog('info', `⏳ 等待远程引擎启动...`);
        
        let isRunning = false;
        
        for (let retry = 0; retry < 3; retry++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          addLog('info', `🔍 检查远程引擎状态 (尝试 ${retry + 1}/3)...`);
          
          const checkResult = await window.electronAPI?.executeSSHCommand?.({
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
            password: sshConfig.password,
            keyPath: sshConfig.keyPath,
            useKey: useSSHKey,
          }, `ps aux | grep llama-server | grep -v grep`);
          
          const stdoutStr = checkResult?.stdout || '';
          const hasProcess = stdoutStr.trim().length > 0;
          
          if (checkResult?.success && hasProcess) {
            const lines = stdoutStr.trim().split('\n');
            const targetLine = lines.find(line => line.includes(`--port`) && line.includes(`${modelPoolConfig.port}`));
            
            if (targetLine) {
              const pidMatch = targetLine.match(/^\S+\s+(\d+)/);
              pid = pidMatch?.[1] || pid;
              isRunning = true;
              addLog('success', `✅ 找到目标进程 PID: ${pid}`);
              break;
            }
          }
        }
        
        if (isRunning) {
          setModelPoolStatus({ running: true, port: modelPoolConfig.port });
          addLog('success', `✅ 模型池运行中 | PID: ${pid} | 端口: ${modelPoolConfig.port}`);
          addLog('info', `🌐 Web UI: http://${sshConfig.host}:${modelPoolConfig.port}`);
          addLog('info', `📄 日志文件: ${modelPoolConfig.logFile || '~/.mychat/logs/llama_server.log'}`);
        } else {
          addLog('error', `❌ 远程引擎启动失败`);
          addLog('info', `💡 请检查:`);
          addLog('info', `   1. 引擎文件是否存在: ~/.mychat/engines/llama-server`);
          addLog('info', `   2. 模型目录是否存在: ${modelPoolConfig.modelsDir || sshConfig.modelsPath}`);
          addLog('info', `   3. 模型预设文件是否存在: ${modelPoolConfig.modelsPreset}`);
          addLog('info', `   4. 查看远程日志: tail -f ${modelPoolConfig.logFile || '~/.mychat/logs/llama_server.log'}`);
          
          const logPath = modelPoolConfig.logFile || '~/.mychat/logs/llama_server.log';
          addLog('info', `📄 获取远程日志最后 20 行...`);
          const logResult = await window.electronAPI?.executeSSHCommand?.({
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
            password: sshConfig.password,
            keyPath: sshConfig.keyPath,
            useKey: useSSHKey,
          }, `tail -20 ${logPath} 2>/dev/null || echo "日志文件不存在"`);
          
          if (logResult?.success && logResult.stdout) {
            addLog('info', `--- 远程日志 ---`);
            logResult.stdout.split('\n').forEach((line: string) => {
              if (line.trim()) addLog('info', line);
            });
            addLog('info', `--- 日志结束 ---`);
          }
          
          setModelPoolStatus(null);
        }
      }
    } catch (error) {
      addLog('error', `❌ 启动失败: ${error}`);
      setModelPoolStatus(null);
    } finally {
      setStartingModelPool(false);
    }
  };

  const buildRemotePoolStartCommand = (): string => {
    const enginePath = '~/.mychat/engines/llama-server';
    const modelsDir = modelPoolConfig.modelsDir || sshConfig.modelsPath || '~/.mychat/models/gguf';
    const modelsPreset = modelPoolConfig.modelsPreset || '~/.mychat/gguf/model-config.ini';
    const logFile = modelPoolConfig.logFile || '~/.mychat/logs/llama_server.log';
    
    const logDir = logFile.substring(0, logFile.lastIndexOf('/'));
    
    const cmd = `${enginePath} --models-dir ${modelsDir} --models-max ${modelPoolConfig.maxModels} --port ${modelPoolConfig.port} --host ${modelPoolConfig.host} --ctx-size ${modelPoolConfig.contextSize} --log-file ${logFile}`;
    const presetCheck = `if [ -f "${modelsPreset}" ]; then PRESET_ARG="--models-preset ${modelsPreset}"; else PRESET_ARG=""; fi`;
    
    return `mkdir -p ${logDir} && ${presetCheck} && nohup ${cmd} \${PRESET_ARG} >> ${logFile} 2>&1 </dev/null & echo "Started with PID: \$!"`;
  };

  const handleStopModelPool = async () => {
    try {
      if (installTarget === 'local') {
        if (window.electronAPI) {
          await window.electronAPI.stopEngine();
        }
      } else {
        addLog('info', `🛑 停止远程模型池...`);
        
        const stopCmd = `pkill -f "llama-server" 2>/dev/null; sleep 1; ps aux | grep llama-server | grep -v grep || echo "STOPPED"`;
        const result = await executeRemoteCommand(stopCmd);
        
        if (result?.includes('STOPPED') || !result?.includes('llama-server')) {
          addLog('success', `✅ 远程模型池已停止`);
        } else {
          addLog('warn', `⚠️ 可能未完全停止，请检查进程`);
        }
      }
      setModelPoolStatus(null);
      addLog('warn', '⚠️ 模型池已停止');
    } catch (error: any) {
      addLog('error', `停止模型池失败: ${error?.message || error}`);
      setModelPoolStatus(null);
    }
  };

  const checkRemoteServiceStatus = async () => {
    if (!window.electronAPI?.getRemoteServiceStatus || installTarget !== 'ssh') return;
    
    setLoadingServiceStatus(true);
    try {
      const status = await window.electronAPI.getRemoteServiceStatus({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      });
      
      setRemoteServiceStatus({
        installed: status.installed,
        running: status.running,
        enabled: status.enabled,
        pid: status.pid,
        port: status.port,
      });
      
      addLog('info', `📋 服务状态: ${status.installed ? '已安装' : '未安装'} | ${status.running ? '运行中' : '已停止'}`);
    } catch (error: any) {
      addLog('error', `获取服务状态失败: ${error?.message || error}`);
    } finally {
      setLoadingServiceStatus(false);
    }
  };

  const handleInstallRemoteService = async () => {
    if (!window.electronAPI?.installRemoteService || installTarget !== 'ssh') return;
    
    setServiceOperation('installing');
    addLog('info', '📦 安装远程服务...');
    
    try {
      const result = await window.electronAPI.installRemoteService(
        {
          host: sshConfig.host,
          port: sshConfig.port,
          username: sshConfig.username,
          password: sshConfig.password,
          keyPath: sshConfig.keyPath,
          useKey: useSSHKey,
        },
        {
          homeDir: '~',
          modelsDir: modelPoolConfig.modelsDir,
          modelsPreset: modelPoolConfig.modelsPreset,
          port: modelPoolConfig.port,
          maxModels: modelPoolConfig.maxModels,
          host: modelPoolConfig.host,
          contextSize: modelPoolConfig.contextSize,
        }
      );
      
      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        await checkRemoteServiceStatus();
      } else {
        addLog('error', `❌ ${result.message}`);
        if (result.output) {
          addLog('info', `输出: ${result.output}`);
        }
      }
    } catch (error: any) {
      addLog('error', `安装服务失败: ${error?.message || error}`);
    } finally {
      setServiceOperation(null);
    }
  };

  const handleRestartRemoteService = async () => {
    if (!window.electronAPI?.restartRemoteService || installTarget !== 'ssh') return;
    
    setServiceOperation('restarting');
    addLog('info', '🔄 重启远程服务...');
    
    try {
      const result = await window.electronAPI.restartRemoteService({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      });
      
      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        await checkRemoteServiceStatus();
      } else {
        addLog('error', `❌ ${result.message}`);
        if (result.output) {
          addLog('info', `输出: ${result.output}`);
        }
      }
    } catch (error: any) {
      addLog('error', `重启服务失败: ${error?.message || error}`);
    } finally {
      setServiceOperation(null);
    }
  };

  const handleUninstallRemoteService = async () => {
    if (!window.electronAPI?.uninstallRemoteService || installTarget !== 'ssh') return;
    
    setServiceOperation('uninstalling');
    addLog('info', '🗑️ 卸载远程服务...');
    
    try {
      const result = await window.electronAPI.uninstallRemoteService({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password,
        keyPath: sshConfig.keyPath,
        useKey: useSSHKey,
      });
      
      if (result.success) {
        addLog('success', `✅ ${result.message}`);
        setRemoteServiceStatus(null);
      } else {
        addLog('error', `❌ ${result.message}`);
        if (result.output) {
          addLog('info', `输出: ${result.output}`);
        }
      }
    } catch (error: any) {
      addLog('error', `卸载服务失败: ${error?.message || error}`);
    } finally {
      setServiceOperation(null);
    }
  };

  const handleDeleteModel = async (fileName: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteModel(fileName);
    await loadData();
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getOSDisplayName = (os: OSType | undefined) => {
    switch (os) {
      case 'darwin': return '🍎 macOS';
      case 'linux': return '🐧 Linux';
      case 'windows': return '🪟 Windows';
      default: return '❓ Unknown';
    }
  };

  const getLogColor = (level: PoolLog['level']) => {
    switch (level) {
      case 'info': return '#6BA3BE';
      case 'warn': return '#F4A261';
      case 'error': return '#E76F51';
      case 'success': return '#5B8C5A';
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
          <Text style={[styles.title, { color: theme.text }]}>模型管理</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            此功能仅在桌面应用中可用
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: theme.surface }]}>
            <Text style={[styles.codeText, { color: theme.text }]}>npm run electron:dev</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'pool' && styles.tabActive]}
          onPress={() => setMainTab('pool')}
        >
          <Text style={[styles.tabText, { color: mainTab === 'pool' ? theme.primary : theme.textSecondary }]}>
            🏊 模型池
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'download' && styles.tabActive]}
          onPress={() => setMainTab('download')}
        >
          <Text style={[styles.tabText, { color: mainTab === 'download' ? theme.primary : theme.textSecondary }]}>
            📥 下载
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'config' && styles.tabActive]}
          onPress={() => setMainTab('config')}
        >
          <Text style={[styles.tabText, { color: mainTab === 'config' ? theme.primary : theme.textSecondary }]}>
            ⚙️ 配置
          </Text>
        </TouchableOpacity>
      </View>

      {mainTab === 'pool' && (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.targetSelectorContainer}>
            <Text style={[styles.targetSelectorLabel, { color: theme.text }]}>运行目标:</Text>
            <TouchableOpacity
              style={[styles.targetButton, installTarget === 'local' && styles.targetButtonActive]}
              onPress={() => setInstallTarget('local')}
            >
              <Text style={[styles.targetButtonText, { color: installTarget === 'local' ? '#FFFFFF' : '#636E72' }]}>
                💻 本机
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.targetButton, installTarget === 'ssh' && styles.targetButtonActive]}
              onPress={() => setInstallTarget('ssh')}
            >
              <Text style={[styles.targetButtonText, { color: installTarget === 'ssh' ? '#FFFFFF' : '#636E72' }]}>
                🌐 远程 ({sshConfig.host})
              </Text>
            </TouchableOpacity>
          </View>

          {installTarget === 'ssh' && (
            <View style={[styles.serviceCard, { backgroundColor: theme.surface }]}>
              <View style={styles.serviceHeader}>
                <Text style={[styles.serviceTitle, { color: theme.text }]}>🔧 服务管理</Text>
                <TouchableOpacity
                  style={[styles.refreshButton, { backgroundColor: '#6BA3BE' }]}
                  onPress={checkRemoteServiceStatus}
                  disabled={loadingServiceStatus}
                >
                  {loadingServiceStatus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.refreshButtonText}>🔄 刷新</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              {remoteServiceStatus ? (
                <View style={styles.serviceStatusContainer}>
                  <View style={styles.serviceStatusRow}>
                    <Text style={[styles.serviceStatusLabel, { color: theme.textSecondary }]}>状态:</Text>
                    <Text style={[styles.serviceStatusValue, { color: remoteServiceStatus.running ? '#5B8C5A' : '#E76F51' }]}>
                      {remoteServiceStatus.running ? '✅ 运行中' : '⏹ 已停止'}
                    </Text>
                  </View>
                  <View style={styles.serviceStatusRow}>
                    <Text style={[styles.serviceStatusLabel, { color: theme.textSecondary }]}>服务:</Text>
                    <Text style={[styles.serviceStatusValue, { color: remoteServiceStatus.installed ? '#6BA3BE' : '#F4A261' }]}>
                      {remoteServiceStatus.installed ? '✅ 已安装' : '❌ 未安装'}
                    </Text>
                  </View>
                  {remoteServiceStatus.pid && (
                    <View style={styles.serviceStatusRow}>
                      <Text style={[styles.serviceStatusLabel, { color: theme.textSecondary }]}>PID:</Text>
                      <Text style={[styles.serviceStatusValue, { color: theme.text }]}>{remoteServiceStatus.pid}</Text>
                    </View>
                  )}
                  {remoteServiceStatus.port && (
                    <View style={styles.serviceStatusRow}>
                      <Text style={[styles.serviceStatusLabel, { color: theme.textSecondary }]}>端口:</Text>
                      <Text style={[styles.serviceStatusValue, { color: theme.text }]}>{remoteServiceStatus.port}</Text>
                    </View>
                  )}
                  <View style={styles.serviceButtons}>
                    {!remoteServiceStatus.installed ? (
                      <TouchableOpacity
                        style={[styles.serviceButton, { backgroundColor: '#5B8C5A' }]}
                        onPress={handleInstallRemoteService}
                        disabled={!!serviceOperation}
                      >
                        {serviceOperation === 'installing' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.serviceButtonText}>📦 安装服务</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.serviceButton, { backgroundColor: '#6BA3BE' }]}
                          onPress={handleRestartRemoteService}
                          disabled={!!serviceOperation}
                        >
                          {serviceOperation === 'restarting' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.serviceButtonText}>🔄 重启</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.serviceButton, { backgroundColor: '#E76F51' }]}
                          onPress={handleUninstallRemoteService}
                          disabled={!!serviceOperation}
                        >
                          {serviceOperation === 'uninstalling' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.serviceButtonText}>🗑️ 卸载</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.serviceHint}>
                  <Text style={[styles.serviceHintText, { color: theme.textSecondary }]}>
                    点击"刷新"获取服务状态
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.poolControlCard}>
            <View style={styles.poolControlButtons}>
              {!modelPoolStatus?.running ? (
                <TouchableOpacity
                  style={[styles.poolButton, { backgroundColor: '#5B8C5A' }]}
                  onPress={handleStartModelPool}
                  disabled={startingModelPool}
                >
                  {startingModelPool ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.poolButtonText}>🚀 启动模型池</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.poolButton, { backgroundColor: '#E76F51', flex: 0.5 }]}
                    onPress={handleStopModelPool}
                  >
                    <Text style={styles.poolButtonText}>⏹ 停止</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.poolButton, { backgroundColor: showEmbeddedUI ? '#F4A261' : '#6BA3BE', flex: 0.5 }]}
                    onPress={openWebUI}
                  >
                    <Text style={styles.poolButtonText}>{showEmbeddedUI ? '📋 日志' : '🌐 Web UI'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {modelPoolStatus?.running && (
              <View style={styles.poolStatusInfo}>
                <Text style={[styles.poolStatusText, { color: '#5B8C5A' }]}>
                  ✅ 运行中 | 端口: {modelPoolStatus.port}
                </Text>
                <Text style={[styles.poolStatusTarget, { color: theme.textSecondary }]}>
                  点击 "Web UI" 在应用内管理模型
                </Text>
              </View>
            )}
          </View>

          {showEmbeddedUI && modelPoolStatus?.running && (
            <View style={styles.embeddedWebContainer}>
              <iframe
                src={`http://${installTarget === 'ssh' ? sshConfig.host : 'localhost'}:${modelPoolStatus.port}`}
                style={{ width: '100%', height: 'calc(100vh - 280px)', minHeight: '400px', border: 'none' }}
                title="Model Pool Web UI"
              />
            </View>
          )}

          {!showEmbeddedUI && (modelPoolStatus?.running || startingModelPool || poolLogs.length > 0) && (
            <View style={[styles.logCard, { backgroundColor: '#1E1E1E' }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logTitle, { color: '#FFFFFF' }]}>📜 日志</Text>
                {startingModelPool && <Text style={[styles.logFetching, { color: '#F4A261' }]}>启动中...</Text>}
              </View>
              <ScrollView style={styles.logScroll}>
                {poolLogs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <Text style={[styles.logTime, { color: '#6B7280' }]}>{log.timestamp}</Text>
                    <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>[{log.level}]</Text>
                    <Text style={[styles.logMessage, { color: '#E5E7EB' }]}>{log.message}</Text>
                  </View>
                ))}
                {poolLogs.length === 0 && (
                  <View style={styles.logLoadingContainer}>
                    {startingModelPool ? (
                      <>
                        <ActivityIndicator size="small" color="#6BA3BE" />
                        <Text style={[styles.logLoadingText, { color: '#6B7280' }]}>
                          正在初始化...
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.logLoadingText, { color: '#6B7280' }]}>
                        暂无日志
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {!modelPoolStatus?.running && poolLogs.length === 0 && (
            <View style={[styles.hintCard, { backgroundColor: theme.surface }]}>
              <Text style={styles.hintIcon}>💡</Text>
              <Text style={[styles.hintTitle, { color: theme.text }]}>使用说明</Text>
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                1. 在"下载"页面下载模型文件
              </Text>
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                2. 点击"启动模型池"启动服务
              </Text>
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                3. 点击"打开 Web UI"在浏览器中管理模型
              </Text>
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                4. 模型池会自动探测已下载的模型
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {mainTab === 'download' && (
        <ScrollView style={styles.scrollView}>
          <View style={[styles.subTabContainer, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={[styles.subTab, downloadTab === 'model' && styles.subTabActive]}
              onPress={() => setDownloadTab('model')}
            >
              <Text style={[styles.subTabText, { color: downloadTab === 'model' ? theme.primary : theme.textSecondary }]}>
                📦 模型下载
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTab, downloadTab === 'engine' && styles.subTabActive]}
              onPress={() => setDownloadTab('engine')}
            >
              <Text style={[styles.subTabText, { color: downloadTab === 'engine' ? theme.primary : theme.textSecondary }]}>
                ⚙️ 引擎下载
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.targetSelectorContainer}>
            <Text style={[styles.targetSelectorLabel, { color: theme.text }]}>安装目标:</Text>
            <TouchableOpacity
              style={[styles.targetButton, installTarget === 'local' && styles.targetButtonActive]}
              onPress={() => setInstallTarget('local')}
            >
              <Text style={[styles.targetButtonText, { color: installTarget === 'local' ? '#FFFFFF' : '#636E72' }]}>
                💻 本机
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.targetButton, installTarget === 'ssh' && styles.targetButtonActive]}
              onPress={() => setInstallTarget('ssh')}
            >
              <Text style={[styles.targetButtonText, { color: installTarget === 'ssh' ? '#FFFFFF' : '#636E72' }]}>
                🌐 远程 ({sshConfig.host})
              </Text>
            </TouchableOpacity>
          </View>

          {downloadTab === 'model' && (
            <View style={styles.section}>
              {installTarget === 'local' ? (
                downloadedModels.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>💻 本机已下载模型 ({downloadedModels.length})</Text>
                    {downloadedModels.map((model) => {
                      const isLoaded = loadedModels.some(m => model.name.includes(m));
                      const canDelete = !modelPoolStatus?.running || !isLoaded;
                      
                      return (
                        <View key={model.name} style={[styles.modelCard, { backgroundColor: theme.surface }]}>
                          <View style={styles.modelInfo}>
                            <View style={styles.modelHeaderRow}>
                              <Text style={[styles.modelName, { color: theme.text }]}>{model.name}</Text>
                              {isLoaded && modelPoolStatus?.running && (
                                <Text style={[styles.modelStatusBadge, { color: '#6BA3BE' }]}>
                                  📤 已加载
                                </Text>
                              )}
                            </View>
                            <Text style={[styles.modelSize, { color: theme.textSecondary }]}>
                              {formatSize(model.size)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.deleteButton, 
                              { backgroundColor: canDelete ? '#E76F51' : '#B2BEC3' }
                            ]}
                            onPress={() => canDelete && handleDeleteModel(model.name)}
                            disabled={!canDelete}
                          >
                            <Text style={styles.deleteButtonText}>
                              {canDelete ? '🗑 删除' : '使用中'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )
              ) : (
                <View style={styles.section}>
                  <View style={styles.remoteModelHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      🌐 远程已下载模型 ({remoteModels.length})
                    </Text>
                    <TouchableOpacity
                      style={[styles.refreshButton, { backgroundColor: '#6BA3BE' }]}
                      onPress={loadRemoteModels}
                      disabled={loadingRemoteModels}
                    >
                      <Text style={styles.refreshButtonText}>
                        {loadingRemoteModels ? '⏳ 加载中...' : '🔄 刷新'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {loadingRemoteModels ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#6BA3BE" />
                      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                        正在加载远程模型列表...
                      </Text>
                    </View>
                  ) : remoteModels.length > 0 ? (
                    remoteModels.map((model, index) => (
                      <View key={index} style={[styles.modelCard, { backgroundColor: theme.surface }]}>
                        <View style={styles.modelInfo}>
                          <View style={styles.modelHeaderRow}>
                            <Text style={[styles.modelName, { color: theme.text }]} numberOfLines={1}>
                              {model.name}
                            </Text>
                          </View>
                          <Text style={[styles.modelSize, { color: theme.textSecondary }]}>
                            {model.size} | {model.modifiedTime}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.deleteButton, { backgroundColor: '#E76F51' }]}
                          onPress={async () => {
                            if (window.electronAPI?.executeSSHCommand) {
                              const result = await window.electronAPI.executeSSHCommand({
                                host: sshConfig.host,
                                port: sshConfig.port,
                                username: sshConfig.username,
                                password: sshConfig.password,
                                keyPath: sshConfig.keyPath,
                                useKey: useSSHKey,
                              }, `rm -f "${model.path}"`);
                              if (result.success) {
                                loadRemoteModels();
                              }
                            }
                          }}
                        >
                          <Text style={styles.deleteButtonText}>🗑 删除</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        暂无远程模型文件
                      </Text>
                      <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
                        路径: {getRemoteModelsPath()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>推荐模型</Text>
                {installTarget === 'ssh' && !sshProbeResult?.connected && (
                  <View style={[styles.engineWarning, { backgroundColor: '#FFF3E0', marginBottom: spacing.sm }]}>
                    <Text style={styles.engineWarningText}>
                      ⚠️ 请先测试 SSH 连接以获取远程资源信息
                    </Text>
                  </View>
                )}
                {installTarget === 'ssh' && sshProbeResult?.connected && (
                  <View style={[styles.memoryInfoCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.memoryInfoText, { color: theme.text }]}>
                      💾 可用内存: {((sshProbeResult.memory?.available || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB RAM
                      {sshProbeResult.gpu?.available && sshProbeResult.gpu.devices?.length > 0 && sshProbeResult.gpu.devices[0].memory && (
                        <> + {(sshProbeResult.gpu.devices[0].memory / (1024 * 1024 * 1024)).toFixed(1)} GB VRAM</>
                      )}
                    </Text>
                  </View>
                )}
                {installTarget === 'local' && systemInfo && (
                  <View style={[styles.memoryInfoCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.memoryInfoText, { color: theme.text }]}>
                      💾 可用内存: {systemInfo.freeGB.toFixed(1)} GB RAM
                      {systemInfo.hasGpu && systemInfo.vram > 0 && (
                        <> + {(systemInfo.vram / (1024 * 1024 * 1024)).toFixed(1)} GB VRAM</>
                      )}
                    </Text>
                  </View>
                )}
                <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                  根据内存自动推荐，下载后模型池会自动探测
                </Text>
                {recommendations.length === 0 && installTarget === 'ssh' && !sshProbeResult?.connected ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      请先测试 SSH 连接
                    </Text>
                  </View>
                ) : recommendations
                    .filter((rec: ModelRecommendation) => {
                      if (installTarget === 'ssh') {
                        const remoteFileExists = remoteModels.some(m => 
                          m.name.includes(rec.model.id) || m.name.includes(rec.file.name.replace('.gguf', ''))
                        );
                        return !remoteFileExists;
                      }
                      const downloadedModel = downloadedModels.find(m => m.name.includes(rec.model.id));
                      return !downloadedModel;
                    })
                    .map((rec: ModelRecommendation) => (
                      <View key={rec.model.id} style={[
                        styles.modelCard, 
                        { backgroundColor: theme.surface },
                        !rec.canRun && styles.disabledCard
                      ]}>
                        <View style={styles.modelInfo}>
                          <View style={styles.modelHeaderRow}>
                            <Text style={[styles.modelName, { color: theme.text }]}>{rec.model.name}</Text>
                            <Text style={[styles.modelReason, { color: rec.canRun ? '#5B8C5A' : '#E76F51' }]}>
                              {rec.reason}
                            </Text>
                          </View>
                          <Text style={[styles.modelDesc, { color: theme.textSecondary }]}>
                            {rec.model.description}
                          </Text>
                          <Text style={[styles.modelMeta, { color: theme.textSecondary }]}>
                            参数: {rec.model.parameters} | 大小: {formatSize(rec.file.size)} | 量化: {rec.file.quantization}
                          </Text>
                        </View>
                        <View style={styles.modelActions}>
                          {installTarget === 'local' && downloadedModels.find(m => m.name.includes(rec.model.id)) ? (
                            <>
                              <View style={[styles.downloadedBadge, { backgroundColor: '#5B8C5A' }]}>
                                <Text style={styles.downloadedText}>✓ 已下载</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.deleteButton, { backgroundColor: '#E76F51' }]}
                                onPress={() => handleDeleteModel(downloadedModels.find(m => m.name.includes(rec.model.id))!.name)}
                              >
                                <Text style={styles.deleteButtonText}>🗑 删除</Text>
                              </TouchableOpacity>
                            </>
                          ) : rec.canRun ? (
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
                                    {downloadProgress!.progress.toFixed(1)}%
                                  </Text>
                                  <View style={styles.progressBar}>
                                    <View 
                                      style={[
                                        styles.progressFill, 
                                        { width: `${downloadProgress!.progress}%` }
                                      ]} 
                                    />
                                  </View>
                                </View>
                              ) : (
                                <Text style={styles.downloadButtonText}>📥 下载</Text>
                              )}
                            </TouchableOpacity>
                          ) : (
                            <View style={[styles.disabledButton, { backgroundColor: '#B2BEC3' }]}>
                              <Text style={styles.disabledButtonText}>内存不足</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                }
              </View>
            </View>
          )}

          {downloadTab === 'engine' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {installTarget === 'local' ? '💻 本机引擎管理' : '🌐 远程引擎管理'}
              </Text>
              
              <View style={[styles.engineCard, { backgroundColor: theme.surface }]}>
                <View style={styles.engineInfo}>
                  <Text style={[styles.engineName, { color: theme.text }]}>LLAMA Server</Text>
                  
                  {installTarget === 'local' ? (
                    <>
                      <View style={styles.engineVersionRow}>
                        <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                          当前版本:
                        </Text>
                        <Text style={[styles.engineVersionValue, { color: engineVersion ? '#5B8C5A' : '#E76F51' }]}>
                          {engineVersion || '未安装'}
                        </Text>
                      </View>
                      {engineLatestVersion && (
                        <View style={styles.engineVersionRow}>
                          <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                            最新版本:
                          </Text>
                          <Text style={[styles.engineVersionValue, { color: '#6BA3BE' }]}>
                            {engineLatestVersion}
                          </Text>
                        </View>
                      )}
                      {engineVersion && engineLatestVersion && (
                        <View style={styles.engineVersionRow}>
                          <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                            状态:
                          </Text>
                          <Text style={[styles.engineVersionValue, { color: engineVersion === engineLatestVersion ? '#5B8C5A' : '#F4A261' }]}>
                            {engineVersion === engineLatestVersion ? '✅ 已是最新版本' : '⬆️ 有新版本可用'}
                          </Text>
                        </View>
                      )}
                      {systemData && (
                        <Text style={[styles.enginePlatform, { color: theme.textSecondary }]}>
                          平台: {getOSDisplayName(systemData.platform)} | 架构: {systemData.arch}
                          {systemInfo?.hasGpu && ' | GPU: 已检测'}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.engineVersionRow}>
                        <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                          目标主机:
                        </Text>
                        <Text style={[styles.engineVersionValue, { color: '#6BA3BE' }]}>
                          {sshConfig.host}
                        </Text>
                      </View>
                      {sshProbeResult?.connected && sshProbeResult.system && (
                        <>
                          <View style={styles.engineVersionRow}>
                            <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                              远程系统:
                            </Text>
                            <Text style={[styles.engineVersionValue, { color: theme.text }]}>
                              {sshProbeResult.system.os} {sshProbeResult.system.arch}
                            </Text>
                          </View>
                          {sshProbeResult.cpu?.model && (
                            <View style={styles.engineVersionRow}>
                              <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                                CPU:
                              </Text>
                              <Text style={[styles.engineVersionValue, { color: theme.text }]} numberOfLines={1}>
                                {sshProbeResult.cpu.model}
                              </Text>
                            </View>
                          )}
                          {sshProbeResult.gpu?.available && sshProbeResult.gpu.devices?.length > 0 && (
                            <View style={styles.engineVersionRow}>
                              <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                                GPU:
                              </Text>
                              <Text style={[styles.engineVersionValue, { color: theme.text }]} numberOfLines={1}>
                                {sshProbeResult.gpu.devices.map(d => d.name).join(', ')}
                              </Text>
                            </View>
                          )}
                          <Text style={[styles.enginePlatform, { color: theme.textSecondary }]}>
                            内核: {sshProbeResult.system.kernel}
                          </Text>
                        </>
                      )}
                      <View style={styles.engineVersionRow}>
                        <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                          当前版本:
                        </Text>
                        <Text style={[styles.engineVersionValue, { color: remoteEngineVersion ? '#5B8C5A' : '#E76F51' }]}>
                          {checkingRemoteEngine ? '检查中...' : (remoteEngineVersion || '未安装')}
                        </Text>
                      </View>
                      <View style={styles.engineVersionRow}>
                        <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                          最新版本:
                        </Text>
                        <Text style={[styles.engineVersionValue, { color: '#6BA3BE' }]}>
                          {engineLatestVersion || '获取中...'}
                        </Text>
                      </View>
                      {remoteEngineVersion && engineLatestVersion && (
                        <View style={styles.engineVersionRow}>
                          <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                            状态:
                          </Text>
                          <Text style={[styles.engineVersionValue, { color: remoteEngineVersion === engineLatestVersion ? '#5B8C5A' : '#F4A261' }]}>
                            {remoteEngineVersion === engineLatestVersion ? '✅ 已是最新版本' : '⬆️ 有新版本可用'}
                          </Text>
                        </View>
                      )}
                      {sshProbeResult?.gpu?.available && (
                        <View style={styles.engineVersionRow}>
                          <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                            GPU 支持:
                          </Text>
                          <Text style={[styles.engineVersionValue, { color: '#6BA3BE' }]}>
                            Vulkan ({sshProbeResult.gpu.vendor})
                          </Text>
                        </View>
                      )}
                      <View style={styles.engineVersionRow}>
                        <Text style={[styles.engineVersionLabel, { color: theme.textSecondary }]}>
                          安装路径:
                        </Text>
                        <Text style={[styles.engineVersionValue, { color: theme.text }]}>
                          ~/.mychat/engines
                        </Text>
                      </View>
                      {!sshProbeResult?.connected && (
                        <View style={[styles.engineWarning, { backgroundColor: '#FFF3E0', marginTop: spacing.sm }]}>
                          <Text style={styles.engineWarningText}>
                            ⚠️ 请先测试 SSH 连接
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
                
                {installTarget === 'local' && modelPoolStatus?.running && (
                  <View style={[styles.engineWarning, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={styles.engineWarningText}>
                      ⚠️ 模型池运行中，请先停止后再更新引擎
                    </Text>
                  </View>
                )}
                
                {engineDownloadUrl && engineInstalling && (
                  <View style={styles.engineUrlContainer}>
                    <Text style={[styles.engineUrlLabel, { color: theme.textSecondary }]}>下载地址:</Text>
                    <Text style={[styles.engineUrlText, { color: '#6BA3BE' }]} numberOfLines={2}>
                      {engineDownloadUrl}
                    </Text>
                  </View>
                )}
                
                {engineInstalling ? (
                  <View style={styles.engineProgressContainer}>
                    <Text style={[styles.engineProgressText, { color: theme.text }]}>
                      下载中 {engineProgress?.progress.toFixed(1)}%
                    </Text>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${engineProgress?.progress || 0}%`, backgroundColor: '#5B8C5A' }
                        ]} 
                      />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.engineDownloadButton, 
                      { 
                        backgroundColor: (installTarget === 'local' && modelPoolStatus?.running) 
                          ? '#B2BEC3' 
                          : (installTarget === 'ssh' && !sshProbeResult?.connected) 
                            ? '#B2BEC3' 
                            : '#5B8C5A' 
                      }
                    ]}
                    onPress={handleDownloadEngine}
                    disabled={(installTarget === 'local' && modelPoolStatus?.running) || (installTarget === 'ssh' && !sshProbeResult?.connected)}
                  >
                    <Text style={styles.engineDownloadButtonText}>
                      ⚙️ {installTarget === 'local' 
                        ? (modelPoolStatus?.running 
                          ? '运行中无法更新' 
                          : (engineVersion 
                            ? (engineVersion === engineLatestVersion ? '重新下载' : '更新引擎')
                            : '下载引擎'))
                        : (sshProbeResult?.connected 
                          ? (remoteEngineVersion 
                            ? (remoteEngineVersion === engineLatestVersion ? '重新下载' : '更新引擎')
                            : '下载引擎') 
                          : '请先测试连接')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.engineCard, { backgroundColor: theme.surface }]}>
                <Text style={[styles.engineDescTitle, { color: theme.text }]}>引擎说明</Text>
                <Text style={[styles.engineDesc, { color: theme.textSecondary }]}>
                  llama-server 是模型池的核心引擎，支持多模型管理、GPU 加速、动态加载等功能。
                  启动后会自动探测已下载的模型文件。
                </Text>
                <Text style={[styles.engineDesc, { color: theme.textSecondary }]}>
                  {installTarget === 'local' 
                    ? '引擎会根据您的操作系统和硬件自动选择匹配的版本。'
                    : '远程引擎会根据目标服务器的系统架构自动选择匹配的版本。'}
                </Text>
              </View>

              {(engineInstalling || engineLogs.length > 0) && (
                <View style={[styles.logCard, { backgroundColor: '#1E1E1E' }]}>
                  <View style={styles.logHeader}>
                    <Text style={[styles.logTitle, { color: '#FFFFFF' }]}>📜 下载日志</Text>
                    {engineInstalling && <Text style={[styles.logFetching, { color: '#F4A261' }]}>下载中...</Text>}
                  </View>
                  <ScrollView style={styles.logScroll}>
                    {engineLogs.map((log) => (
                      <View key={log.id} style={styles.logItem}>
                        <Text style={[styles.logTime, { color: '#6B7280' }]}>{log.timestamp}</Text>
                        <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>[{log.level}]</Text>
                        <Text style={[styles.logMessage, { color: '#E5E7EB' }]}>{log.message}</Text>
                      </View>
                    ))}
                    {engineLogs.length === 0 && engineInstalling && (
                      <View style={styles.logLoadingContainer}>
                        <ActivityIndicator size="small" color="#6BA3BE" />
                        <Text style={[styles.logLoadingText, { color: '#6B7280' }]}>
                          正在初始化...
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {mainTab === 'config' && (
        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>模型池配置</Text>
            <View style={[styles.configCard, { backgroundColor: theme.surface }]}>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>端口:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={String(modelPoolConfig.port)}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, port: parseInt(text) || 8080})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>主机:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={modelPoolConfig.host}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, host: text})}
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>最大模型数:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={String(modelPoolConfig.maxModels)}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, maxModels: parseInt(text) || 2})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>上下文大小:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={String(modelPoolConfig.contextSize)}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, contextSize: parseInt(text) || 32768})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>GPU 层数:</Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={String(modelPoolConfig.gpuLayers)}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, gpuLayers: parseInt(text) || -1})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>模型目录:</Text>
                <TextInput
                  style={[styles.configInputWide, { backgroundColor: theme.background, color: theme.text }]}
                  value={modelPoolConfig.modelsDir}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, modelsDir: text})}
                  placeholder="~/.mychat/models/gguf"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>模型预设:</Text>
                <TextInput
                  style={[styles.configInputWide, { backgroundColor: theme.background, color: theme.text }]}
                  value={modelPoolConfig.modelsPreset}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, modelsPreset: text})}
                  placeholder="~/.mychat/gguf/model-config.ini"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text }]}>日志文件:</Text>
                <TextInput
                  style={[styles.configInputWide, { backgroundColor: theme.background, color: theme.text }]}
                  value={modelPoolConfig.logFile}
                  onChangeText={(text) => setModelPoolConfig({...modelPoolConfig, logFile: text})}
                  placeholder="~/.mychat/logs/llama_server.log"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>SSH 远程配置</Text>
            <View style={[styles.sshCard, { backgroundColor: theme.surface }]}>
              <View style={styles.sshRow}>
                <Text style={[styles.sshLabel, { color: theme.text }]}>主机:</Text>
                <TextInput
                  style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={sshConfig.host}
                  onChangeText={(text) => setSshConfig({...sshConfig, host: text})}
                  placeholder="localhost"
                />
              </View>
              <View style={styles.sshRow}>
                <Text style={[styles.sshLabel, { color: theme.text }]}>端口:</Text>
                <TextInput
                  style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={String(sshConfig.port)}
                  onChangeText={(text) => setSshConfig({...sshConfig, port: parseInt(text) || 22})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.sshRow}>
                <Text style={[styles.sshLabel, { color: theme.text }]}>用户:</Text>
                <TextInput
                  style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={sshConfig.username}
                  onChangeText={(text) => setSshConfig({...sshConfig, username: text})}
                  placeholder="root"
                />
              </View>
              <View style={styles.sshRow}>
                <View style={styles.sshLabelRow}>
                  <Text style={[styles.sshLabel, { color: theme.text }]}>使用密钥</Text>
                  <Switch
                    value={useSSHKey}
                    onValueChange={setUseSSHKey}
                    trackColor={{ false: theme.border, true: theme.primary }}
                  />
                </View>
              </View>
              {useSSHKey ? (
                <View style={styles.sshRow}>
                  <Text style={[styles.sshLabel, { color: theme.text }]}>密钥路径:</Text>
                  <TextInput
                    style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                    value={sshConfig.keyPath}
                    onChangeText={(text) => setSshConfig({...sshConfig, keyPath: text})}
                    placeholder="~/.ssh/id_rsa"
                  />
                </View>
              ) : (
                <View style={styles.sshRow}>
                  <Text style={[styles.sshLabel, { color: theme.text }]}>密码:</Text>
                  <TextInput
                    style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                    value={sshConfig.password}
                    onChangeText={(text) => setSshConfig({...sshConfig, password: text})}
                    secureTextEntry
                    placeholder="密码"
                  />
                </View>
              )}
              
              <View style={styles.sshRow}>
                <Text style={[styles.sshLabel, { color: theme.text }]}>模型路径:</Text>
                <TextInput
                  style={[styles.sshInput, { backgroundColor: theme.background, color: theme.text }]}
                  value={sshConfig.modelsPath}
                  onChangeText={(text) => setSshConfig({...sshConfig, modelsPath: text})}
                  placeholder="~/.mychat/models/gguf"
                />
              </View>
              
              <TouchableOpacity
                style={[styles.probeButton, { backgroundColor: sshProbing ? theme.border : '#6BA3BE' }]}
                onPress={probeSSHHost}
                disabled={sshProbing}
              >
                <Text style={styles.probeButtonText}>
                  {sshProbing ? '🔍 探测中...' : '🔍 测试连接'}
                </Text>
              </TouchableOpacity>
              
              {sshProbeResult && (
                <View style={[styles.probeResultCard, { backgroundColor: theme.background }]}>
                  <View style={styles.probeResultHeader}>
                    <Text style={[styles.probeResultTitle, { color: theme.text }]}>
                      {sshProbeResult.connected ? '✅ 连接成功' : '❌ 连接失败'}
                    </Text>
                    <Text style={[styles.probeResultTime, { color: theme.textSecondary }]}>
                      {sshProbeResult.timestamp}
                    </Text>
                  </View>
                  
                  {sshProbeResult.error && (
                    <Text style={[styles.probeError, { color: '#E76F51' }]}>
                      错误: {sshProbeResult.error}
                    </Text>
                  )}
                  
                  {sshProbeResult.connected && sshProbeResult.system && (
                    <>
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>🖥️ 系统</Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          主机名: {sshProbeResult.system.hostname}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          系统: {sshProbeResult.system.os}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          内核: {sshProbeResult.system.kernel}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          架构: {sshProbeResult.system.arch}
                        </Text>
                      </View>
                      
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>💻 CPU</Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          型号: {sshProbeResult.cpu?.model || 'N/A'}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          核心: {sshProbeResult.cpu?.cores || 0} 核 / {sshProbeResult.cpu?.threads || 0} 线程
                        </Text>
                      </View>
                      
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>🧠 内存</Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          总计: {formatBytes(sshProbeResult.memory?.total || 0)}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          可用: {formatBytes(sshProbeResult.memory?.available || 0)}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          已用: {formatBytes(sshProbeResult.memory?.used || 0)}
                        </Text>
                      </View>
                      
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>🎮 GPU</Text>
                        {sshProbeResult.gpu?.available ? (
                          sshProbeResult.gpu.devices.map((device, index) => (
                            <View key={index}>
                              <Text style={[styles.probeText, { color: theme.text }]}>
                                设备: {device.name}
                              </Text>
                              {device.memory && (
                                <Text style={[styles.probeText, { color: theme.text }]}>
                                  显存: {formatBytes(device.memory)}
                                </Text>
                              )}
                            </View>
                          ))
                        ) : (
                          <Text style={[styles.probeText, { color: theme.textSecondary }]}>无GPU设备</Text>
                        )}
                      </View>
                      
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>💾 磁盘 (点击选择存储路径)</Text>
                        {sshProbeResult.disks && sshProbeResult.disks.length > 0 ? (
                          sshProbeResult.disks.map((disk, index) => (
                            <TouchableOpacity 
                              key={index}
                              style={[
                                styles.diskItem, 
                                { 
                                  backgroundColor: sshConfig.modelsPath.startsWith(disk.path) ? 'rgba(107, 163, 190, 0.2)' : 'transparent',
                                  borderColor: sshConfig.modelsPath.startsWith(disk.path) ? '#6BA3BE' : 'transparent',
                                  borderWidth: 1,
                                }
                              ]}
                              onPress={() => {
                                const newPath = `${disk.path}/.mychat/models/gguf`;
                                setSshConfig({...sshConfig, modelsPath: newPath});
                              }}
                            >
                              <View style={styles.diskHeader}>
                                <Text style={[styles.probeText, { color: theme.text, fontWeight: '600' }]}>
                                  {disk.path}
                                </Text>
                                <Text style={[styles.probeText, { color: '#5B8C5A', fontWeight: '600' }]}>
                                  可用: {formatBytes(disk.available)}
                                </Text>
                              </View>
                              <Text style={[styles.probeText, { color: theme.textSecondary, fontSize: 11 }]}>
                                总计: {formatBytes(disk.total)} | 已用: {disk.usePercent}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text style={[styles.probeText, { color: theme.textSecondary }]}>无磁盘信息</Text>
                        )}
                        <Text style={[styles.probeText, { color: theme.textSecondary, marginTop: 8, fontStyle: 'italic' }]}>
                          当前模型路径: {getRemoteModelsPath()}
                        </Text>
                      </View>
                      
                      <View style={styles.probeSection}>
                        <Text style={[styles.probeSectionTitle, { color: theme.primary }]}>📦 已有模型 ({sshProbeResult.models?.length || 0})</Text>
                        {sshProbeResult.models && sshProbeResult.models.length > 0 ? (
                          sshProbeResult.models.map((model, index) => (
                            <View key={index} style={styles.modelItem}>
                              <View style={styles.modelItemHeader}>
                                <Text style={[styles.probeModelName, { color: theme.text }]} numberOfLines={1}>
                                  {model.name}
                                </Text>
                                <Text style={[styles.probeModelSize, { color: '#5B8C5A' }]}>
                                  {model.size}
                                </Text>
                              </View>
                              <Text style={[styles.probeModelTime, { color: theme.textSecondary }]}>
                                修改时间: {model.modifiedTime}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={[styles.probeText, { color: theme.textSecondary }]}>
                            暂无模型文件，请下载模型
                          </Text>
                        )}
                      </View>
                      
                      <View style={styles.probeRecommendation}>
                        <Text style={[styles.probeSectionTitle, { color: '#5B8C5A' }]}>📊 模型推荐</Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          可用内存: {formatBytes((sshProbeResult.memory?.available || 0) + 
                            (sshProbeResult.gpu?.available ? (sshProbeResult.gpu.devices[0]?.memory || 0) : 0))}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.text }]}>
                          可用磁盘: {formatBytes(sshProbeResult.disk?.available || 0)}
                        </Text>
                        <Text style={[styles.probeText, { color: theme.textSecondary }]}>
                          建议选择模型大小不超过可用内存的 80%
                        </Text>
                        <Text style={[styles.probeText, { color: theme.textSecondary, marginTop: 4 }]}>
                          模型将下载到: {getRemoteModelsPath()}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
    color: '#2D3436',
  },
  sectionHint: {
    ...typography.caption,
    marginBottom: spacing.lg,
    color: '#636E72',
    fontSize: 13,
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
    padding: spacing.lg,
    borderRadius: 16,
    marginTop: spacing.sm,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  codeText: {
    ...typography.body,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#495057',
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
    backgroundColor: 'rgba(91, 140, 90, 0.15)',
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
  },
  subTabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: spacing.md,
    padding: spacing.xs,
  },
  subTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: 'rgba(91, 140, 90, 0.15)',
  },
  subTabText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 13,
  },
  targetSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  targetSelectorLabel: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    marginRight: spacing.md,
  },
  targetButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: '#F1F3F4',
    marginRight: spacing.sm,
  },
  targetButtonActive: {
    backgroundColor: '#6BA3BE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  targetButtonText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 12,
  },
  serviceCard: {
    padding: spacing.lg,
    borderRadius: 16,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  serviceTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 16,
  },
  refreshButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  serviceStatusContainer: {
    gap: spacing.sm,
  },
  serviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceStatusLabel: {
    ...typography.body,
    fontSize: 13,
    width: 50,
  },
  serviceStatusValue: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  serviceButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  serviceButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  serviceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  serviceHint: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  serviceHintText: {
    ...typography.body,
    fontSize: 13,
  },
  poolControlCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  poolControlButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  poolButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  poolButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  poolStatusInfo: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    marginTop: spacing.md,
  },
  poolStatusText: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 16,
  },
  poolStatusTarget: {
    fontSize: 12,
    color: '#636E72',
    marginTop: spacing.xs,
  },
  embeddedWebContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  logCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    marginBottom: spacing.md,
    minHeight: 300,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 14,
    color: '#FFFFFF',
  },
  logFetching: {
    fontSize: 11,
    color: '#F4A261',
  },
  logScroll: {
    flex: 1,
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    alignItems: 'flex-start',
  },
  logTime: {
    fontSize: 10,
    marginRight: spacing.sm,
    fontFamily: 'monospace',
    color: '#6B7280',
  },
  logLevel: {
    fontSize: 10,
    fontWeight: '700',
    marginRight: spacing.sm,
    fontFamily: 'monospace',
    width: 50,
  },
  logMessage: {
    fontSize: 12,
    flex: 1,
    fontFamily: 'monospace',
    color: '#E5E7EB',
    lineHeight: 18,
  },
  logLoadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  logLoadingText: {
    fontSize: 12,
    marginTop: spacing.sm,
    color: '#6B7280',
  },
  hintCard: {
    padding: spacing.xl,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  hintIcon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  hintTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  hintText: {
    ...typography.body,
    fontSize: 14,
    color: '#636E72',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modelCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  modelInfo: {
    marginBottom: spacing.sm,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modelReason: {
    fontSize: 11,
    fontWeight: '600',
  },
  modelStatusBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  modelName: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 15,
    color: '#2D3436',
    flex: 1,
  },
  modelSize: {
    fontSize: 12,
    color: '#636E72',
    marginTop: spacing.xs,
  },
  modelDesc: {
    ...typography.body,
    fontSize: 13,
    color: '#636E72',
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  modelMeta: {
    fontSize: 12,
    color: '#ADB5BD',
    marginTop: spacing.xs,
  },
  modelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  memoryInfoCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  memoryInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  downloadButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#5B8C5A',
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  downloading: {
    opacity: 0.8,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: spacing.sm,
    width: 100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  downloadedBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: '#5B8C5A',
  },
  downloadedText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  disabledButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  engineCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  engineInfo: {
    marginBottom: spacing.md,
  },
  engineName: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 16,
    color: '#2D3436',
  },
  engineVersion: {
    fontSize: 13,
    color: '#636E72',
    marginTop: spacing.xs,
  },
  engineVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  engineVersionLabel: {
    fontSize: 13,
    color: '#636E72',
    marginRight: spacing.sm,
  },
  engineVersionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  enginePlatform: {
    fontSize: 12,
    color: '#636E72',
    marginTop: spacing.xs,
  },
  engineWarning: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  engineWarningText: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
  },
  engineUrlContainer: {
    padding: spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginTop: spacing.md,
  },
  engineUrlLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  engineUrlText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  engineProgressContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  engineProgressText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
    color: '#2D3436',
  },
  engineDownloadButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#5B8C5A',
  },
  engineDownloadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  engineDescTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    fontSize: 14,
    color: '#2D3436',
    marginBottom: spacing.sm,
  },
  engineDesc: {
    ...typography.body,
    fontSize: 13,
    color: '#636E72',
    lineHeight: 20,
  },
  configCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  configLabel: {
    ...typography.body,
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  configInput: {
    ...typography.body,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
    width: 100,
    textAlign: 'right',
    fontSize: 13,
  },
  configInputWide: {
    ...typography.body,
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
    fontSize: 13,
    textAlign: 'left',
  },
  sshCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sshLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  sshLabel: {
    ...typography.body,
    fontSize: 13,
    color: '#495057',
    width: 80,
  },
  sshInput: {
    ...typography.body,
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
    fontSize: 13,
  },
  probeButton: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  probeButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  probeResultCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  probeResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  probeResultTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
  },
  probeResultTime: {
    fontSize: 11,
  },
  probeError: {
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  probeSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  probeSectionTitle: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  probeText: {
    ...typography.body,
    fontSize: 12,
    marginBottom: 2,
  },
  probeRecommendation: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(91, 140, 90, 0.1)',
    borderRadius: 8,
  },
  diskItem: {
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: 8,
  },
  diskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modelItem: {
    padding: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(107, 163, 190, 0.1)',
    borderRadius: 6,
  },
  modelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  probeModelName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginRight: spacing.sm,
  },
  probeModelSize: {
    fontSize: 11,
    fontWeight: '600',
  },
  probeModelTime: {
    fontSize: 10,
    marginTop: 2,
  },
  disabledCard: {
    opacity: 0.5,
  },
  remoteModelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: 13,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
