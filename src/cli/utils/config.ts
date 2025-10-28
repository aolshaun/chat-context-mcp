/**
 * Configuration Management
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CLIConfig } from '../types.js';

const CONFIG_DIR = path.join(os.homedir(), '.cursor-context');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: CLIConfig = {
  defaultFormat: 'table',
  defaultLimit: 20,
  defaultSort: 'newest',
  useColors: true
};

/**
 * Load configuration from file
 */
export function loadConfig(): CLIConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    
    // Merge with defaults to handle new config keys
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('Failed to load config, using defaults');
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: CLIConfig): void {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save config: ${error}`);
  }
}

/**
 * Get a specific config value
 */
export function getConfigValue(key: keyof CLIConfig): any {
  const config = loadConfig();
  return config[key];
}

/**
 * Set a specific config value
 */
export function setConfigValue(key: keyof CLIConfig, value: any): void {
  const config = loadConfig();
  
  // Validate the value based on key
  switch (key) {
    case 'defaultFormat':
      if (!['json', 'markdown', 'table', 'compact'].includes(value)) {
        throw new Error('defaultFormat must be: json, markdown, table, or compact');
      }
      break;
    case 'defaultLimit':
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error('defaultLimit must be a positive number');
      }
      value = num;
      break;
    case 'defaultSort':
      if (!['newest', 'oldest', 'most_messages'].includes(value)) {
        throw new Error('defaultSort must be: newest, oldest, or most_messages');
      }
      break;
    case 'useColors':
      value = value === 'true' || value === true;
      break;
  }
  
  (config as any)[key] = value;
  saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  saveConfig(DEFAULT_CONFIG);
}

/**
 * Get configuration file path
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

