import { Platform, NativeModules } from 'react-native';

export type PlatformType = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web';

export interface SystemInfo {
  platform: PlatformType;
  osVersion: string;
  deviceName: string;
  totalMemory: number;
  freeMemory: number;
}

export interface HardwareCapabilities {
  ram: number;
  vram: number;
  hasGPU: boolean;
  gpuName?: string;
  cores: number;
}

function getPlatform(): PlatformType {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'macos') return 'macos';
  if (Platform.OS === 'windows') return 'windows';
  return 'web';
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const platform = getPlatform();
  
  return {
    platform,
    osVersion: Platform.Version.toString(),
    deviceName: 'Desktop',
    totalMemory: 0,
    freeMemory: 0,
  };
}

export async function getHardwareCapabilities(): Promise<HardwareCapabilities> {
  return {
    ram: 0,
    vram: 0,
    hasGPU: false,
    cores: 1,
  };
}

export function isDesktopPlatform(): boolean {
  const platform = getPlatform();
  return platform === 'macos' || platform === 'windows' || platform === 'linux';
}

export function getLlamaCppBinaryName(platform: PlatformType): string {
  const binaries: Record<PlatformType, string> = {
    macos: 'llama-server',
    windows: 'llama-server.exe',
    linux: 'llama-server',
    ios: 'llama-server-ios',
    android: 'llama-server-android',
    web: 'llama-server',
  };
  return binaries[platform];
}

export function getLlamaCppDownloadUrl(
  platform: PlatformType,
  version: string = 'latest'
): string {
  const baseUrl = 'https://github.com/ggerganov/llama.cpp/releases';
  
  if (platform === 'macos') {
    return `${baseUrl}/download/${version}/llama-server-${version}-macos-arm64`;
  }
  if (platform === 'windows') {
    return `${baseUrl}/download/${version}/llama-server-${version}-windows-x64.zip`;
  }
  if (platform === 'linux') {
    return `${baseUrl}/download/${version}/llama-server-${version}-linux-x64`;
  }
  
  return '';
}

export interface LlamaCppConfig {
  binaryPath: string;
  modelPath: string;
  port: number;
  contextSize: number;
  threads: number;
  gpuLayers: number;
}

export function getDefaultLlamaCppConfig(platform: PlatformType): LlamaCppConfig {
  return {
    binaryPath: '',
    modelPath: '',
    port: 8080,
    contextSize: 2048,
    threads: 4,
    gpuLayers: 0,
  };
}
