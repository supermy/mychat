export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  source: string;
  baseUrl: string;
  files: ModelFile[];
  minRam: number;
  recommendedRam: number;
  parameters: string;
  contextLength: number;
}

export interface ModelFile {
  name: string;
  quantization: string;
  size: number;
  url: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'qwen3.5-2b',
    name: 'Qwen3.5-2B',
    description: '通义千问3.5 2B参数，轻量高效',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF',
    files: [
      { name: 'Qwen3.5-2B-UD-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 1.34 * 1024 * 1024 * 1024, url: '' },
    ],
    minRam: 3,
    recommendedRam: 4,
    parameters: '2B',
    contextLength: 32768
  },
  {
    id: 'agentcpm-explore',
    name: 'AgentCPM-Explore',
    description: 'AgentCPM 探索模型，适合智能体应用',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/DevQuasar/openbmb.AgentCPM-Explore-GGUF',
    files: [
      { name: 'openbmb.AgentCPM-Explore.Q4_K_M.gguf', quantization: 'Q4_K_M', size: 2.72 * 1024 * 1024 * 1024, url: '' },
    ],
    minRam: 5,
    recommendedRam: 6,
    parameters: '8B',
    contextLength: 32768
  },
  {
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    description: '智谱AI GLM-4.7 Flash 模型，快速响应',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/GLM-4.7-Flash-GGUF',
    files: [
      { name: 'GLM-4.7-Flash-UD-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 17.52 * 1024 * 1024 * 1024, url: '' },
    ],
    minRam: 20,
    recommendedRam: 24,
    parameters: '10B',
    contextLength: 131072
  },
  {
    id: 'qwen3.5-35b-a3b',
    name: 'Qwen3.5-35B-A3B',
    description: '通义千问3.5 35B MoE模型，高性能推理',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-35B-A3B-GGUF',
    files: [
      { name: 'Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 22.24 * 1024 * 1024 * 1024, url: '' },
    ],
    minRam: 26,
    recommendedRam: 32,
    parameters: '35B (A3B MoE)',
    contextLength: 32768
  },
  {
    id: 'qwen3.5-0.8b',
    name: 'Qwen3.5-0.8B',
    description: '通义千问3.5 0.8B超轻量模型，开箱即用',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-0.8B-GGUF',
    files: [
      { name: 'Qwen3.5-0.8B-UD-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 0.5 * 1024 * 1024 * 1024, url: '' },
    ],
    minRam: 2,
    recommendedRam: 3,
    parameters: '0.8B',
    contextLength: 32768
  }
];

export function getDownloadUrl(model: ModelInfo, file: ModelFile): string {
  return `${model.baseUrl}/resolve/master/${file.name}`;
}

export function getRecommendedFile(model: ModelInfo): ModelFile {
  const q4kxl = model.files.find(f => f.quantization === 'Q4_K_XL');
  if (q4kxl) return q4kxl;
  
  const q4km = model.files.find(f => f.quantization === 'Q4_K_M');
  if (q4km) return q4km;
  
  return model.files[0];
}

export interface SystemInfo {
  total: number;
  free: number;
  totalGB: number;
  freeGB: number;
  hasGpu: boolean;
  vram: number;
}

export interface ModelRecommendation {
  model: ModelInfo;
  file: ModelFile;
  reason: string;
  canRun: boolean;
}

export function getQuantizationMemory(quantization: string, fileSizeGB: number): number {
  const ratioMap: { [key: string]: number } = {
    'Q4_K_XL': 1.15,
    'Q4_K_M': 1.20,
    'Q5_K_M': 1.35,
    'Q8_0': 1.80,
  };
  const ratio = ratioMap[quantization] || 1.2;
  return fileSizeGB * ratio;
}

export function recommendModels(systemInfo: SystemInfo): ModelRecommendation[] {
  const recommendations: ModelRecommendation[] = [];
  const availableRam = systemInfo.freeGB + (systemInfo.vram ? systemInfo.vram / (1024 * 1024 * 1024) : 0);
  
  for (const model of AVAILABLE_MODELS) {
    const recommendedFile = getRecommendedFile(model);
    const fileSizeGB = recommendedFile.size / (1024 * 1024 * 1024);
    const requiredRam = getQuantizationMemory(recommendedFile.quantization, fileSizeGB);
    
    const canRun = availableRam >= requiredRam;
    let reason = '';
    
    if (availableRam >= requiredRam * 1.5) {
      reason = `✅ 推荐运行 (需${requiredRam.toFixed(1)}GB内存)`;
    } else if (availableRam >= requiredRam) {
      reason = `✅ 可以运行 (需${requiredRam.toFixed(1)}GB内存)`;
    } else {
      reason = `❌ 内存不足 (需${requiredRam.toFixed(1)}GB内存，可用${availableRam.toFixed(1)}GB)`;
    }
    
    recommendations.push({
      model,
      file: recommendedFile,
      reason,
      canRun
    });
  }
  
  return recommendations.sort((a, b) => {
    if (a.canRun !== b.canRun) return a.canRun ? -1 : 1;
    return a.model.minRam - b.model.minRam;
  });
}

export function getBestQuantization(availableRam: number, modelParams: string): string {
  const params = parseFloat(modelParams.replace(/[^\d.]/g, ''));
  const isMoE = modelParams.includes('MoE') || modelParams.includes('A3B');
  
  const baseSize = isMoE ? params * 0.3 : params;
  
  if (availableRam >= baseSize * 2) {
    return 'Q8_0';
  } else if (availableRam >= baseSize * 1.5) {
    return 'Q5_K_M';
  } else if (availableRam >= baseSize * 1.2) {
    return 'Q4_K_XL';
  } else {
    return 'Q4_K_M';
  }
}
