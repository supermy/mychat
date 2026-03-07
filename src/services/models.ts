import { Platform } from 'react-native';
import { getHardwareCapabilities, HardwareCapabilities } from './platform';

export { HardwareCapabilities } from './platform';

export interface ModelInfo {
  id: string;
  name: string;
  size: number;
  quantization: string;
  vramRequirement: number;
  ramRequirement: number;
  description: string;
  modelScopeUrl: string;
}

export interface DownloadProgress {
  modelId: string;
  progress: number;
  downloaded: number;
  total: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'error';
  error?: string;
}

export interface ModelConfig {
  id: string;
  modelPath: string;
  contextSize: number;
  threads: number;
  gpuLayers: number;
  temperature: number;
  maxTokens: number;
}

const MODELSCOPE_BASE_URL = 'https://www.modelscope.cn/api/v1/models';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    size: 5_500_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 4_500_000_000,
    ramRequirement: 6_000_000_000,
    description: '智谱AI GLM-4.7 Flash，快速且高效',
    modelScopeUrl: 'https://www.modelscope.cn/models/unsloth/GLM-4.7-Flash-GGUF/files',
  },
  {
    id: 'qwen3-35b-a3b',
    name: 'Qwen3.5-35B-A3B',
    size: 22_000_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 20_000_000_000,
    ramRequirement: 24_000_000_000,
    description: '阿里Qwen3 35B量化版本，适合高端配置',
    modelScopeUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-35B-A3B-GGUF/files',
  },
  {
    id: 'qwen3.5-2b',
    name: 'Qwen3.5-2B',
    size: 1_500_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 2_000_000_000,
    ramRequirement: 4_000_000_000,
    description: '阿里Qwen3.5 2B，小显存友好',
    modelScopeUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF',
  },
  {
    id: 'agent-cpm-explore',
    name: 'AgentCPM-Explore',
    size: 4_000_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 4_500_000_000,
    ramRequirement: 6_000_000_000,
    description: '面壁智能Agent CPM，探索版',
    modelScopeUrl: 'https://www.modelscope.cn/models/DevQuasar/openbmb.AgentCPM-Explore-GGUF/files',
  },
  {
    id: 'qwen3-0.6b',
    name: 'Qwen3-0.6B',
    size: 520_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 1_000_000_000,
    ramRequirement: 2_000_000_000,
    description: '极轻量版本，最低显存要求',
    modelScopeUrl: 'https://www.modelscope.cn/models/Qwen/Qwen3-0.6B-GGUF',
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3-4B',
    size: 2_500_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 3_500_000_000,
    ramRequirement: 5_000_000_000,
    description: '阿里Qwen3 4B，均衡选择',
    modelScopeUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3-4B-GGUF',
  },
  {
    id: 'qwen3-8b',
    name: 'Qwen3-8B',
    size: 5_200_000_000,
    quantization: 'Q4_K_M',
    vramRequirement: 6_500_000_000,
    ramRequirement: 8_000_000_000,
    description: '阿里Qwen3 8B，性能更强',
    modelScopeUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3-8B-GGUF',
  },
];

export function recommendModels(
  capabilities: HardwareCapabilities
): ModelInfo[] {
  const { ram, vram } = capabilities;
  
  const recommended: ModelInfo[] = [];
  
  for (const model of AVAILABLE_MODELS) {
    const canRunVRAM = vram >= model.vramRequirement;
    const canRunRAM = ram >= model.ramRequirement;
    
    if (canRunVRAM || (canRunRAM && vram === 0)) {
      recommended.push({
        ...model,
        size: model.size,
      });
    }
  }
  
  return recommended.sort((a, b) => a.vramRequirement - b.vramRequirement);
}

export function getRecommendedModel(capabilities: HardwareCapabilities): ModelInfo | null {
  const { vram, ram } = capabilities;
  
  if (vram >= 20_000_000_000 || ram >= 24_000_000_000) {
    return AVAILABLE_MODELS.find(m => m.id === 'qwen3-35b-a3b') || null;
  }
  
  if (vram >= 6_500_000_000 || ram >= 8_000_000_000) {
    return AVAILABLE_MODELS.find(m => m.id === 'qwen3-8b') || null;
  }
  
  if (vram >= 3_500_000_000 || ram >= 5_000_000_000) {
    return AVAILABLE_MODELS.find(m => m.id === 'qwen3-4b') || null;
  }
  
  if (vram >= 2_000_000_000 || ram >= 4_000_000_000) {
    return AVAILABLE_MODELS.find(m => m.id === 'qwen3.5-2b') || null;
  }
  
  return AVAILABLE_MODELS.find(m => m.id === 'qwen3-0.6b') || null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function formatVRAM(bytes: number): string {
  return formatBytes(bytes);
}

export async function getSystemCapabilities(): Promise<HardwareCapabilities> {
  if (Platform.OS === 'web') {
    return {
      ram: 8_000_000_000,
      vram: 0,
      hasGPU: false,
      cores: navigator.hardwareConcurrency || 4,
    };
  }
  
  return getHardwareCapabilities();
}

export const DEFAULT_MODEL_CONFIGS: Record<string, Partial<ModelConfig>> = {
  'qwen3-0.6b': {
    contextSize: 2048,
    threads: 4,
    gpuLayers: 20,
    temperature: 0.7,
    maxTokens: 1024,
  },
  'qwen3-4b': {
    contextSize: 4096,
    threads: 6,
    gpuLayers: 32,
    temperature: 0.7,
    maxTokens: 2048,
  },
  'qwen3-8b': {
    contextSize: 4096,
    threads: 8,
    gpuLayers: 32,
    temperature: 0.7,
    maxTokens: 2048,
  },
  'qwen3-35b-a3b': {
    contextSize: 8192,
    threads: 8,
    gpuLayers: 64,
    temperature: 0.7,
    maxTokens: 4096,
  },
  'glm-4.7-flash': {
    contextSize: 4096,
    threads: 6,
    gpuLayers: 32,
    temperature: 0.7,
    maxTokens: 2048,
  },
  'agent-cpm-explore': {
    contextSize: 4096,
    threads: 6,
    gpuLayers: 28,
    temperature: 0.7,
    maxTokens: 2048,
  },
};

export function getModelDefaultConfig(modelId: string): Partial<ModelConfig> {
  return DEFAULT_MODEL_CONFIGS[modelId] || DEFAULT_MODEL_CONFIGS['qwen3-0.6b'];
}
