import * as fs from 'fs';
import * as path from 'path';
import { TradingConfig } from './types';
import { DEFAULT_CONFIG_FILENAME, TIME_FORMAT_REGEX } from './constants';
import { isValidString, isValidPositiveNumber } from './utils';

export class ConfigManager {
  private config: TradingConfig | null = null;
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      path.join(__dirname, '..', 'config', DEFAULT_CONFIG_FILENAME);
  }

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

  public getConfig(): TradingConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }
  private validateConfig(config: any): void {
    if (!config.tradingHours) {
      throw new Error('Missing tradingHours');
    }

    if (
      !isValidString(config.tradingHours.start) ||
      !isValidString(config.tradingHours.end)
    ) {
      throw new Error('Missing start or end time');
    }

    if (!isValidString(config.tradingHours.timezone)) {
      throw new Error('Missing timezone');
    }

    if (
      !config.rateLimit ||
      typeof config.rateLimit.ordersPerSecond !== 'number'
    ) {
      throw new Error('Missing or invalid ordersPerSecond');
    }

    if (config.rateLimit.ordersPerSecond <= 0) {
      throw new Error('ordersPerSecond must be greater than 0');
    }

    if (
      !config.credentials ||
      !isValidString(config.credentials.username) ||
      !isValidString(config.credentials.password)
    ) {
      throw new Error('Missing or invalid credentials');
    }

    const timeRegex = TIME_FORMAT_REGEX;
    if (!timeRegex.test(config.tradingHours.start)) {
      throw new Error('Invalid start time format.');
    }

    if (!timeRegex.test(config.tradingHours.end)) {
      throw new Error('Invalid end time format.');
    }
  }

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
