import { SystemInfo } from '../services/models';

interface ModelPoolConfig {
  port?: number;
  host?: string;
  maxModels?: number;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
}

declare global {
  interface Window {
    electronAPI?: {
      // System
      getSystemMemory: () => Promise<SystemInfo>;
      getSystemInfo: () => Promise<{ platform: string; arch: string; cpuCores: number; cpuModel: string; gpuInfo: { hasGpu: boolean; vendor: string; model: string; vram: number } }>;
      checkEngineCompatibility: (engine: string) => Promise<{ installed: boolean; compatible: boolean; engineArch: string; systemArch: string; message: string }>;
      
      // Models
      getModelsDir: () => Promise<string>;
      getDefaultModel: () => Promise<{ exists: boolean; name?: string; path?: string; size?: number }>;
      listModels: () => Promise<Array<{ name: string; path: string; size: number; isDefault?: boolean }>>;
      downloadModel: (options: { url: string; filename: string; expectedSize?: number }) => Promise<{ path: string; size: number }>;
      checkModelDownload: (options: { filename: string; expectedSize?: number }) => Promise<{ exists: boolean; size: number; expectedSize: number; complete: boolean; progress: string }>;
      deleteModel: (filename: string) => Promise<boolean>;
      
      // Engines
      getEngineStatus: (engine: string) => Promise<{ installed: boolean; path: string; version: string }>;
      checkEngineUpdate: (engine: string) => Promise<{ currentVersion: string | null; latestVersion: string | null; hasUpdate: boolean; releaseInfo?: any; error?: string }>;
      downloadEngineUpdate: (options: { engine: string; version?: string }) => Promise<{ path: string; version: string; alreadyInstalled?: boolean }>;
      downloadEngine: (engine: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      startEngine: (engine: string, config: any) => Promise<{ success: boolean; port: number; engine?: string; external?: boolean }>;
      stopEngine: () => Promise<void>;
      getCurrentEngine: () => Promise<{ running: boolean; port: number; engine?: string }>;
      testEngine: (engine: string, config: any) => Promise<{ success: boolean; message: string }>;
      
      // ZeroClaw
      startZeroclaw: (config: any) => Promise<{ port: number }>;
      stopZeroclaw: () => Promise<void>;
      getZeroclawStatus: () => Promise<{ running: boolean; port: number; config: any }>;
      saveZeroclawConfig: (config: any) => Promise<void>;
      getZeroclawConfig: () => Promise<any>;
      zeroclawDoctor: () => Promise<{ success: boolean; output: string }>;
      zeroclawStatus: () => Promise<{ success: boolean; output: string }>;
      
      // Codex
      startCodex: (config: any) => Promise<{ port: number }>;
      stopCodex: () => Promise<void>;
      getCodexStatus: () => Promise<{ running: boolean; port: number }>;
      saveCodexConfig: (config: any) => Promise<void>;
      getCodexConfig: () => Promise<any>;
      codexDoctor: () => Promise<{ success: boolean; output: string }>;
      codexStatus: () => Promise<{ success: boolean; output: string }>;
      
      // Model Pool
      startModelPool: (config: ModelPoolConfig) => Promise<{ success: boolean; port: number; engine?: string; message?: string }>;
      generateModelConfig: () => Promise<{ success: boolean; output?: string; message?: string }>;
      getModelConfigPath: () => Promise<string>;
      getGgufModelsDir: () => Promise<string>;
      installModelPoolService: (config: ModelPoolConfig) => Promise<{ success: boolean; message?: string }>;
      uninstallModelPoolService: () => Promise<{ success: boolean; message?: string }>;
      
      // File Operations
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      
      // Config
      getConfig: (modelName?: string) => Promise<any>;
      saveConfig: (config: any, modelName?: string) => Promise<void>;
      checkFirstRun: () => Promise<boolean>;
      
      // Events
      onDownloadProgress: (callback: (data: { progress: string; downloaded: number; totalSize: number; resuming?: boolean }) => void) => () => void;
      onDownloadRedirect: (callback: (data: { url: string }) => void) => () => void;
      onEngineLog: (callback: (data: { message: string; type: string; timestamp: number }) => void) => () => void;
      onEngineDownloadProgress: (callback: (data: { engine: string; version: string; downloaded: number; total: number; progress: string }) => void) => () => void;
      removeDownloadListeners: () => void;
      
      // App Config persistence
      saveAppConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
      loadAppConfig: () => Promise<any>;
      
      // SSH Probe
      probeSSHHost: (config: { host: string; port: number; username: string; password?: string; keyPath?: string; useKey: boolean; modelsPath?: string }) => Promise<{
        connected: boolean;
        error?: string;
        system?: { hostname: string; os: string; kernel: string; arch: string };
        cpu?: { model: string; cores: number; threads: number };
        memory?: { total: number; available: number; used: number };
        gpu?: { available: boolean; vendor?: string; devices: Array<{ name: string; memory?: number; driver?: string }> };
        disk?: { total: number; available: number; used: number; path: string };
        disks?: Array<{ filesystem: string; total: number; available: number; used: number; path: string; usePercent: string }>;
        models?: Array<{ name: string; size: string; modifiedTime: string; path: string }>;
        timestamp: string;
      }>;
      
      // SSH Command Execution
      executeSSHCommand: (config: { host: string; port: number; username: string; password?: string; keyPath?: string; useKey: boolean }, command: string) => Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
        error?: string;
        exitCode?: number;
      }>;
      onSSHCommandOutput: (callback: (data: { type: 'stdout' | 'stderr'; data: string }) => void) => () => void;
    };
  }
}
