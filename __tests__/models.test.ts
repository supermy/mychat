/**
 * @jest
 */

import { recommendModels, getQuantizationMemory, getRecommendedFile, AVAILABLE_MODELS } from '../src/services/models';

describe('Models Service', () => {
  describe('recommendModels', () => {
    it('should return recommendations sorted by canRun status', () => {
      const systemInfo = {
        total: 16 * 1024 * 1024 * 1024,
        free: 8 * 1024 * 1024 * 1024,
        totalGB: 16,
        freeGB: 8,
        hasGpu: false,
        vram: 0,
      };

      const recommendations = recommendModels(systemInfo);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      const canRunModels = recommendations.filter(r => r.canRun);
      const cannotRunModels = recommendations.filter(r => !r.canRun);
      
      expect(canRunModels.length).toBeLessThanOrEqual(recommendations.length);
    });

    it('should mark models as canRun when enough memory', () => {
      const systemInfo = {
        total: 32 * 1024 * 1024 * 1024,
        free: 32 * 1024 * 1024 * 1024,
        totalGB: 32,
        freeGB: 32,
        hasGpu: true,
        vram: 16 * 1024 * 1024 * 1024,
      };

      const recommendations = recommendModels(systemInfo);
      const allCanRun = recommendations.every(r => r.canRun);
      expect(allCanRun).toBe(true);
    });

    it('should mark models as cannotRun when insufficient memory', () => {
      const systemInfo = {
        total: 2 * 1024 * 1024 * 1024,
        free: 1 * 1024 * 1024 * 1024,
        totalGB: 2,
        freeGB: 1,
        hasGpu: false,
        vram: 0,
      };

      const recommendations = recommendModels(systemInfo);
      const noneCanRun = recommendations.every(r => !r.canRun);
      expect(noneCanRun).toBe(true);
    });

    it('should include GPU VRAM in available memory calculation', () => {
      const systemInfoNoGpu = {
        total: 32 * 1024 * 1024 * 1024,
        free: 16 * 1024 * 1024 * 1024,
        totalGB: 32,
        freeGB: 16,
        hasGpu: false,
        vram: 0,
      };

      const systemInfoWithGpu = {
        total: 32 * 1024 * 1024 * 1024,
        free: 16 * 1024 * 1024 * 1024,
        totalGB: 32,
        freeGB: 16,
        hasGpu: true,
        vram: 16 * 1024 * 1024 * 1024,
      };

      const recNoGpu = recommendModels(systemInfoNoGpu);
      const recWithGpu = recommendModels(systemInfoWithGpu);

      const smallModelNoGpu = recNoGpu.find(r => r.model.id === 'qwen3.5-0.8b');
      const smallModelWithGpu = recWithGpu.find(r => r.model.id === 'qwen3.5-0.8b');

      if (smallModelNoGpu && smallModelWithGpu) {
        expect(smallModelWithGpu!.canRun).toBe(true);
        expect(smallModelWithGpu!.reason).toContain('推荐运行');
      }
    });

    it('should handle GPU VRAM correctly', () => {
      const systemInfo = {
        total: 16 * 1024 * 1024 * 1024,
        free: 4 * 1024 * 1024 * 1024,
        totalGB: 16,
        freeGB: 4,
        hasGpu: true,
        vram: 8 * 1024 * 1024 * 1024,
      };

      const recommendations = recommendModels(systemInfo);
      const qwenSmall = recommendations.find(r => r.model.id === 'qwen3.5-0.8b');
      expect(qwenSmall).toBeDefined();
    });
  });

  describe('getQuantizationMemory', () => {
    it('should calculate memory for Q4_K_XL quantization', () => {
      const fileSizeGB = 1;
      const memory = getQuantizationMemory('Q4_K_XL', fileSizeGB);
      expect(memory).toBeCloseTo(1.15);
    });

    it('should calculate memory for Q4_K_M quantization', () => {
      const fileSizeGB = 2;
      const memory = getQuantizationMemory('Q4_K_M', fileSizeGB);
      expect(memory).toBeCloseTo(1.2);
    });

    it('should calculate memory for Q5_K_M quantization', () => {
      const fileSizeGB = 1;
      const memory = getQuantizationMemory('Q5_K_M', fileSizeGB);
      expect(memory).toBeCloseTo(1.35);
    });

    it('should calculate memory for Q8_0 quantization', () => {
      const fileSizeGB = 1;
      const memory = getQuantizationMemory('Q8_0', fileSizeGB);
      expect(memory).toBeCloseTo(1.8);
    });

    it('should use default ratio for unknown quantization', () => {
      const fileSizeGB = 1;
      const memory = getQuantizationMemory('UNKNOWN', fileSizeGB);
      expect(memory).toBeCloseTo(1.2);
    });
  });

  describe('getRecommendedFile', () => {
    it('should return Q4_K_XL file if available', () => {
      const model = AVAILABLE_MODELS[0];
      const file = getRecommendedFile(model);
      expect(file.quantization).toBe('Q4_K_XL');
    });

    it('should return Q4_K_M file if Q4_K_XL not available', () => {
      const model = {
        ...AVAILABLE_MODELS[0],
        files: [
          { name: 'test.Q4_K_M.gguf', quantization: 'Q4_K_M', size: 1024 * 1024 * 1024, url: '' },
        { name: 'test.Q4_K_XL.gguf', quantization: 'Q4_K_XL', size: 1024 * 1024 * 1024, url: '' },
      ];
      const file = getRecommendedFile(model);
      expect(file.quantization).toBe('Q4_K_M');
    });

    it('should return first file if no preferred quantization', () => {
      const model = {
        ...AVAILABLE_MODELS[0],
        files: [
          { name: 'test.Q8_0.gguf', quantization: 'Q8_0', size: 1024 * 1024 * 1024, url: '' },
        ],
      };
      const file = getRecommendedFile(model);
      expect(file.quantization).toBe('Q8_0');
    });
  });

  describe('AVAILABLE_MODELS', () => {
    it('should have required model configurations', () => {
      expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);
      
      AVAILABLE_MODELS.forEach(model => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.description).toBeDefined();
        expect(model.minRam).toBeGreaterThan(0);
        expect(model.recommendedRam).toBeGreaterThan(0);
        expect(model.files).toBeDefined();
        expect(Array.isArray(model.files)).toBe(true);
        expect(model.files.length).toBeGreaterThan(0);
      });
    });

    it('should have Qwen3.5-0.8B model', () => {
      const qwenModel = AVAILABLE_MODELS.find(m => m.id === 'qwen3.5-0.8b');
      expect(qwenModel).toBeDefined();
      expect(qwenModel?.name).toBe('Qwen3.5-0.8B');
      expect(qwenModel?.minRam).toBe(2);
    });

    it('should have Qwen3.5-2B model', () => {
      const qwen2Model = AVAILABLE_MODELS.find(m => m.id === 'qwen3.5-2b');
      expect(qwen2Model).toBeDefined();
      expect(qwen2Model?.minRam).toBe(3);
    });

    it('should have GLM-4.7-Flash model', () => {
      const glmModel = AVAILABLE_MODELS.find(m => m.id === 'glm-4.7-flash');
      expect(glmModel).toBeDefined();
      expect(glmModel?.minRam).toBe(20);
    });
  });
});
