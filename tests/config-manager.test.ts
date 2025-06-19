import { ConfigManager } from '../src/config-manager';
import * as path from 'path';
import * as fs from 'fs';

describe('ConfigManager', () => {
  const testConfigPath = path.join(__dirname, 'test-config.json');

  beforeEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      const testConfig = {
        tradingHours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York',
        },
        rateLimit: {
          ordersPerSecond: 50,
        },
        credentials: {
          username: 'testuser',
          password: 'testpass',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigManager(testConfigPath);
      const config = configManager.loadConfig();

      expect(config.tradingHours.start).toBe('09:30');
      expect(config.tradingHours.end).toBe('16:00');
      expect(config.rateLimit.ordersPerSecond).toBe(50);
      expect(config.credentials.username).toBe('testuser');
    });

    it('should throw error for missing config file', () => {
      const configManager = new ConfigManager('nonexistent.json');

      expect(() => {
        configManager.loadConfig();
      }).toThrow('Configuration file not found');
    });

    it('should throw error for invalid time format', () => {
      const invalidConfig = {
        tradingHours: {
          start: '25:00',
          end: '16:00',
          timezone: 'America/New_York',
        },
        rateLimit: {
          ordersPerSecond: 50,
        },
        credentials: {
          username: 'testuser',
          password: 'testpass',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      const configManager = new ConfigManager(testConfigPath);

      expect(() => {
        configManager.loadConfig();
      }).toThrow('Invalid start time format');
    });

    it('should throw error for invalid rate limit', () => {
      const invalidConfig = {
        tradingHours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York',
        },
        rateLimit: {
          ordersPerSecond: -5,
        },
        credentials: {
          username: 'testuser',
          password: 'testpass',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      const configManager = new ConfigManager(testConfigPath);

      expect(() => {
        configManager.loadConfig();
      }).toThrow('ordersPerSecond must be greater than 0');
    });
  });

  describe('getConfig', () => {
    it('should throw error when config not loaded', () => {
      const configManager = new ConfigManager();

      expect(() => {
        configManager.getConfig();
      }).toThrow('Configuration not loaded');
    });
  });

  describe('getter methods', () => {
    it('should return correct config sections', () => {
      const testConfig = {
        tradingHours: {
          start: '09:30',
          end: '16:00',
          timezone: 'America/New_York',
        },
        rateLimit: {
          ordersPerSecond: 100,
        },
        credentials: {
          username: 'trader',
          password: 'secret',
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigManager(testConfigPath);
      configManager.loadConfig();

      expect(configManager.getTradingHours()).toEqual(testConfig.tradingHours);
      expect(configManager.getRateLimit()).toEqual(testConfig.rateLimit);
      expect(configManager.getCredentials()).toEqual(testConfig.credentials);
    });
  });
});
