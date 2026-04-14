import { readRawConfig, createSchemaRegistry, validateRules } from './config.js';
import { resolveConfigPath, useBuiltinSchemas } from './environment.js';

export interface DumpedConfig {
  readonly schemas: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly Readonly<Record<string, readonly string[]>>[];
}

export function dump(configPath?: string): DumpedConfig {
  const resolvedPath = resolveConfigPath(configPath);
  const rawConfig = readRawConfig(resolvedPath);
  const registry = createSchemaRegistry(rawConfig, !useBuiltinSchemas());

  registry.compileAll();
  validateRules(rawConfig, registry);

  return {
    schemas: registry.allSchemas(),
    rules: rawConfig.rules,
  };
}
