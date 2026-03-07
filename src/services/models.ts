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
  recommended: boolean;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    description: '智谱AI GLM-4.7 Flash 模型，快速响应',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/GLM-4.7-Flash-GGUF/files',
    files: [
      { name: 'GLM-4.7-Flash-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 4.2 * 1024 * 1024 * 1024, url: '', recommended: true },
      { name: 'GLM-4.7-Flash-Q4_K_M.gguf', quantization: 'Q4_K_M', size: 3.8 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'GLM-4.7-Flash-Q5_K_M.gguf', quantization: 'Q5_K_M', size: 4.6 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'GLM-4.7-Flash-Q8_0.gguf', quantization: 'Q8_0', size: 7.2 * 1024 * 1024 * 1024, url: '', recommended: false },
    ],
    minRam: 6,
    recommendedRam: 8,
    parameters: '10B',
    contextLength: 131072
  },
  {
    id: 'qwen3.5-2b',
    name: 'Qwen3.5-2B',
    description: '通义千问3.5 2B参数，轻量高效',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF/files',
    files: [
      { name: 'Qwen3.5-2B-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 1.4 * 1024 * 1024 * 1024, url: '', recommended: true },
      { name: 'Qwen3.5-2B-Q4_K_M.gguf', quantization: 'Q4_K_M', size: 1.2 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'Qwen3.5-2B-Q5_K_M.gguf', quantization: 'Q5_K_M', size: 1.5 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'Qwen3.5-2B-Q8_0.gguf', quantization: 'Q8_0', size: 2.4 * 1024 * 1024 * 1024, url: '', recommended: false },
    ],
    minRam: 4,
    recommendedRam: 6,
    parameters: '2B',
    contextLength: 32768
  },
  {
    id: 'qwen3.5-35b-a3b',
    name: 'Qwen3.5-35B-A3B',
    description: '通义千问3.5 35B MoE模型，高性能推理',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-35B-A3B-GGUF/files',
    files: [
      { name: 'Qwen3.5-35B-A3B-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 18 * 1024 * 1024 * 1024, url: '', recommended: true },
      { name: 'Qwen3.5-35B-A3B-Q4_K_M.gguf', quantization: 'Q4_K_M', size: 16 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'Qwen3.5-35B-A3B-Q5_K_M.gguf', quantization: 'Q5_K_M', size: 20 * 1024 * 1024 * 1024, url: '', recommended: false },
    ],
    minRam: 24,
    recommendedRam: 32,
    parameters: '35B (A3B MoE)',
    contextLength: 32768
  },
  {
    id: 'agentcpm-explore',
    name: 'AgentCPM-Explore',
    description: 'AgentCPM 探索模型，适合智能体应用',
    source: 'ModelScope',
    baseUrl: 'https://www.modelscope.cn/models/DevQuasar/openbmb.AgentCPM-Explore-GGUF/files',
    files: [
      { name: 'AgentCPM-Explore-Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 8 * 1024 * 1024 * 1024, url: '', recommended: true },
      { name: 'AgentCPM-Explore-Q4_K_M.gguf', quantization: 'Q4_K_M', size: 7 * 1024 * 1024 * 1024, url: '', recommended: false },
      { name: 'AgentCPM-Explore-Q5_K_M.gguf', quantization: 'Q5_K_M', size: 9 * 1024 * 1024 * 1024, url: '', recommended: false },
    ],
    minRam: 12,
    recommendedRam: 16,
    parameters: '8B',
    contextLength: 32768
  }
];

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

export function recommendModels(systemInfo: SystemInfo): ModelRecommendation[] {
  const recommendations: ModelRecommendation[] = [];
  const availableRam = systemInfo.freeGB + (systemInfo.vram ? systemInfo.vram / (1024 * 1024 * 1024) : 0);
  
  for (const model of AVAILABLE_MODELS) {
    const recommendedFile = model.files.find(f => f.recommended) || model.files[0];
    const fileSizeGB = recommendedFile.size / (1024 * 1024 * 1024);
    const requiredRam = fileSizeGB * 1.3;
    
    const canRun = availableRam >= model.minRam;
    let reason = '';
    
    if (availableRam >= model.recommendedRam * 1.2) {
      reason = '✅ 推荐运行，内存充足';
    } else if (availableRam >= model.recommendedRam) {
      reason = '✅ 可以运行，内存刚好';
    } else if (canRun) {
      reason = '⚠️ 可以运行，但可能较慢';
    } else {
      reason = '❌ 内存不足，无法运行';
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
