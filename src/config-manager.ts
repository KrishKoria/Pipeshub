import * as fs from 'fs';
import * as path from 'path';
import { TradingConfig } from './types';

/**
 * ConfigManager handles loading and managing trading configuration
 **/

export class ConfigManager {
  private config: TradingConfig | null = null;
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath || path.join(__dirname, '..', 'config', 'trading-config.json');
  }

  /**
   * Load configuration from file
   **/

  public loadConfig(): TradingConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData) as TradingConfig;

      this.validateConfig(parsedConfig);
      this.config = parsedConfig;

      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  /**
   * Get current configuration
   **/

  public getConfig(): TradingConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Validate configuration
   **/

  private validateConfig(config: any): void {
    if (!config.tradingHours) {
      throw new Error('Missing tradingHours in configuration');
    }

    if (!config.tradingHours.start || !config.tradingHours.end) {
      throw new Error('Missing start or end time in tradingHours');
    }

    if (!config.tradingHours.timezone) {
      throw new Error('Missing timezone in tradingHours');
    }

    if (
      !config.rateLimit ||
      typeof config.rateLimit.ordersPerSecond !== 'number'
    ) {
      throw new Error('Missing or invalid ordersPerSecond in rateLimit');
    }

    if (config.rateLimit.ordersPerSecond <= 0) {
      throw new Error('ordersPerSecond must be greater than 0');
    }

    if (
      !config.credentials ||
      !config.credentials.username ||
      !config.credentials.password
    ) {
      throw new Error('Missing or invalid credentials');
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(config.tradingHours.start)) {
      throw new Error('Invalid start time format. Expected HH:MM');
    }

    if (!timeRegex.test(config.tradingHours.end)) {
      throw new Error('Invalid end time format. Expected HH:MM');
    }
  }

  /**
   * Get specific configuration
   **/

  public getTradingHours() {
    return this.getConfig().tradingHours;
  }

  public getRateLimit() {
    return this.getConfig().rateLimit;
  }

  public getCredentials() {
    return this.getConfig().credentials;
  }
}
