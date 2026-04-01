/**
 * @jest
 */

import { saveAppConfig, loadAppConfig } from '../electron/storage';

describe('Storage', () => {
  describe('saveAppConfig', () => {
    it('should save config to storage', async () => {
      const config = {
        sshConfig: {
          host: '192.168.1.1',
          port: 22,
          username: 'test',
          password: 'test123',
        },
        modelPoolConfig: {
          port: 8080,
          host: '0.0.0.0',
          maxModels: 2,
        },
      };

      const result = await saveAppConfig(config);
      expect(result.success).toBe(true);
    });

    it('should handle save errors gracefully', async () => {
      const result = await saveAppConfig(null);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('loadAppConfig', () => {
    it('should load config from storage', async () => {
      const config = await loadAppConfig();
      expect(config).toBeDefined();
    });

    it('should return default config if no saved config', async () => {
      const config = await loadAppConfig();
      expect(config).toBeDefined();
      expect(config.sshConfig).toBeDefined();
      expect(config.modelPoolConfig).toBeDefined();
    });
  });
});
