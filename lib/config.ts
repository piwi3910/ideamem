import { promises as fs } from 'fs';
import path from 'path';

export interface AppConfig {
  qdrantUrl: string;
  ollamaUrl: string;
}

const configFilePath = path.join(process.cwd(), 'config.json');

const defaultConfig: AppConfig = {
  qdrantUrl: 'http://localhost:6333',
  ollamaUrl: 'http://localhost:11434',
};

// Type guard to check if the loaded config matches the interface
function isAppConfig(object: any): object is AppConfig {
  return (
    object &&
    typeof object.qdrantUrl === 'string' &&
    typeof object.ollamaUrl === 'string'
  );
}

export async function getConfig(): Promise<AppConfig> {
  try {
    await fs.access(configFilePath);
    const fileContent = await fs.readFile(configFilePath, 'utf-8');
    const config = JSON.parse(fileContent);

    if (isAppConfig(config)) {
      return config;
    } else {
      // If file is malformed, overwrite with default and return it
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    // If file doesn't exist, create it with default config
    await saveConfig(defaultConfig);
    return defaultConfig;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    const data = JSON.stringify(config, null, 2);
    await fs.writeFile(configFilePath, data, 'utf-8');
  } catch (error) {
    console.error('Failed to save config:', error);
    throw new Error('Could not save configuration file.');
  }
}
