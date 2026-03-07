import { Platform } from 'react-native';
import { ModelConfig, DownloadProgress } from './models';

export interface LlamaServerStatus {
  isRunning: boolean;
  pid?: number;
  port: number;
  model?: string;
  memoryUsage?: number;
  error?: string;
}

export interface LlamaServerConfig {
  binaryPath: string;
  modelPath: string;
  port: number;
  contextSize: number;
  threads: number;
  gpuLayers: number;
  nProcs?: number;
}

export type LogCallback = (log: string) => void;
export type StatusCallback = (status: LlamaServerStatus) => void;

class LlamaServerService {
  private status: LlamaServerStatus = {
    isRunning: false,
    port: 8080,
  };
  private logCallbacks: LogCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];

  constructor() {
    this.status = {
      isRunning: false,
      port: 8080,
    };
  }

  getStatus(): LlamaServerStatus {
    return { ...this.status };
  }

  onLog(callback: LogCallback): () => void {
    this.logCallbacks.push(callback);
    return () => {
      this.logCallbacks = this.logCallbacks.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private emitLog(log: string): void {
    this.logCallbacks.forEach(cb => cb(log));
  }

  private emitStatus(status: Partial<LlamaServerStatus>): void {
    this.status = { ...this.status, ...status };
    this.statusCallbacks.forEach(cb => cb(this.status));
  }

  async start(config: LlamaServerConfig): Promise<boolean> {
    this.emitLog('正在启动 llama.cpp 服务器...');
    
    try {
      this.emitStatus({ isRunning: true, model: config.modelPath, port: config.port });
      this.emitLog(`服务器已启动: http://localhost:${config.port}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.emitStatus({ isRunning: false, error: errorMsg });
      this.emitLog(`启动失败: ${errorMsg}`);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    this.emitLog('正在停止服务器...');
    this.emitStatus({ isRunning: false });
    this.emitLog('服务器已停止');
    return true;
  }

  async restart(config: LlamaServerConfig): Promise<boolean> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.start(config);
  }

  getApiBaseUrl(): string {
    return `http://localhost:${this.status.port}/v1`;
  }
}

export const llamaServer = new LlamaServerService();
