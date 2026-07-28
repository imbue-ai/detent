import { readRawConfig, createSchemaRegistry, validateRules } from './config.js';
import type { RawRule } from './config.js';
import { resolveConfigPath, useBuiltinSchemas } from './environment.js';

export interface DumpedConfig {
  readonly schemas: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly RawRule[];
}

export function dump(configPath?: string): DumpedConfig {
  const resolvedPath = resolveConfigPath(configPath);
  const rawConfig = readRawConfig(resolvedPath);
  const registry = createSchemaRegistry(rawConfig, !useBuiltinSchemas());

  registry.compileAll();
  const warnings = validateRules(rawConfig, registry);
  for (const warning of warnings) {
    console.warn(`detent: ${warning}`);
  }

  return {
    schemas: registry.allSchemas(),
    rules: rawConfig.rules,
  };
}
