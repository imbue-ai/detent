import { Config } from './config.js';
import {
  resolveConfigPath,
  useBuiltinSchemas as useBuiltinSchemasFromEnvironment,
} from './environment.js';

export async function check(
  request: Request,
  configPath?: string,
  useBuiltinSchemas = useBuiltinSchemasFromEnvironment()
): Promise<boolean> {
  const resolvedPath = resolveConfigPath(configPath);
  const config = new Config(resolvedPath, !useBuiltinSchemas);
  return config.check(request);
}
