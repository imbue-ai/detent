import { DetentConfig } from './detentConfig.js';
import { resolveConfigPath, useBuiltinPatterns } from './environment.js';

export async function check(request: Request, configPath?: string): Promise<boolean> {
  const resolvedPath = resolveConfigPath(configPath);
  const config = new DetentConfig(resolvedPath, !useBuiltinPatterns());
  return config.check(request);
}
