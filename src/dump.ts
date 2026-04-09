import { readRawConfig, createPatternRegistry, validateRules } from './config.js';
import { resolveConfigPath, useBuiltinPatterns } from './environment.js';

export interface DumpedConfig {
  readonly patterns: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly Readonly<Record<string, readonly string[]>>[];
}

export function dump(configPath?: string): DumpedConfig {
  const resolvedPath = resolveConfigPath(configPath);
  const rawConfig = readRawConfig(resolvedPath);
  const registry = createPatternRegistry(rawConfig, !useBuiltinPatterns());

  registry.compileAll();
  validateRules(rawConfig, registry);

  return {
    patterns: registry.allSchemas(),
    rules: rawConfig.rules,
  };
}
