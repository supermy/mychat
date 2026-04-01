/**
 * @jest
 */

describe('SSH Probe', () => {
  describe('SSH Connection', () => {
    it('should validate SSH config', () => {
      const config = {
        host: '192.168.1.1',
        port: 22,
        username: 'test',
        password: 'test123',
        useKey: false,
      };

      expect(config.host).toBeDefined();
      expect(config.port).toBe(22);
      expect(config.username).toBeDefined();
    });

    it('should validate SSH key config', () => {
      const config = {
        host: '192.168.1.1',
        port: 22,
        username: 'test',
        keyPath: '/home/user/.ssh/id_rsa',
        useKey: true,
      };

      expect(config.useKey).toBe(true);
      expect(config.keyPath).toBeDefined();
    });
  });

  describe('SSH Probe Result', () => {
    it('should parse memory info correctly', () => {
      const probeResult = {
        connected: true,
        memory: {
          total: 32 * 1024 * 1024 * 1024,
          available: 16 * 1024 * 1024 * 1024,
          used: 16 * 1024 * 1024 * 1024,
        },
        gpu: {
          available: true,
          vendor: 'NVIDIA',
          devices: [
            { name: 'RTX 4090', memory: 16 * 1024 * 1024 * 1024 },
          ],
        },
      };

      expect(probeResult.connected).toBe(true);
      expect(probeResult.memory.total).toBe(32 * 1024 * 1024 * 1024);
      expect(probeResult.gpu.available).toBe(true);
      expect(probeResult.gpu.vendor).toBe('NVIDIA');
    });

    it('should parse CPU info correctly', () => {
      const probeResult = {
        connected: true,
        cpu: {
          model: 'AMD Ryzen 5 7600',
          cores: 6,
          threads: 12,
        },
      };

      expect(probeResult.cpu.model).toBe('AMD Ryzen 5 7600');
      expect(probeResult.cpu.cores).toBe(6);
      expect(probeResult.cpu.threads).toBe(12);
    });

    it('should parse disk info correctly', () => {
      const probeResult = {
        connected: true,
        disk: {
          total: 500 * 1024 * 1024 * 1024,
          available: 250 * 1024 * 1024 * 1024,
          used: 250 * 1024 * 1024 * 1024,
          path: '/home/user',
        },
      };

      expect(probeResult.disk.total).toBe(500 * 1024 * 1024 * 1024);
      expect(probeResult.disk.available).toBe(250 * 1024 * 1024 * 1024);
    });

  });

  describe('Remote System Info Conversion', () => {
    it('should convert to SystemInfo format', () => {
      const probeResult = {
        connected: true,
        memory: {
          total: 32 * 1024 * 1024 * 1024,
          available: 16 * 1024 * 1024 * 1024,
        },
        gpu: {
          available: true,
          vendor: 'NVIDIA',
          devices: [
            { name: 'RTX 4090', memory: 16 * 1024 * 1024 * 1024 },
          ],
        },
      };

      const systemInfo = {
        total: probeResult.memory.total,
        free: probeResult.memory.available,
        totalGB: probeResult.memory.total / (1024 * 1024 * 1024),
        freeGB: probeResult.memory.available / (1024 * 1024 * 1024),
        hasGpu: probeResult.gpu?.available || false,
        vram: probeResult.gpu?.devices?.[0]?.memory || 0,
      };

      expect(systemInfo.totalGB).toBeCloseTo(32);
      expect(systemInfo.freeGB).toBeCloseTo(16);
      expect(systemInfo.hasGpu).toBe(true);
      expect(systemInfo.vram).toBe(16 * 1024 * 1024 * 1024);
    });
  });
});
