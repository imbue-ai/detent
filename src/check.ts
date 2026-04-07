import { Config } from './config.js';
import { resolveConfigPath, useBuiltinPatterns } from './environment.js';

export async function check(request: Request, configPath?: string): Promise<boolean> {
  const resolvedPath = resolveConfigPath(configPath);
  const config = new Config(resolvedPath, !useBuiltinPatterns());
  return config.check(request);
}
