import { readRawConfig } from './config.js';
import { builtinPatterns } from './patterns/requestPattern.js';
import { resolveConfigPath, useBuiltinPatterns } from './environment.js';

export interface DumpedConfig {
  readonly patterns: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly Readonly<Record<string, readonly string[]>>[];
}

export function dump(configPath?: string): DumpedConfig {
  const resolvedPath = resolveConfigPath(configPath);
  const rawConfig = readRawConfig(resolvedPath);

  const mergedPatterns: Record<string, Record<string, unknown>> = {};

  if (useBuiltinPatterns()) {
    for (const [name, pattern] of Object.entries(builtinPatterns)) {
      mergedPatterns[name] = pattern.schemaProperties;
    }
  }

  for (const [name, schema] of Object.entries(rawConfig.patterns)) {
    mergedPatterns[name] = schema;
  }

  return {
    patterns: mergedPatterns,
    rules: rawConfig.rules,
  };
}
