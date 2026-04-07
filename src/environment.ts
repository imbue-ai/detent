import { homedir } from 'node:os';
import { join } from 'node:path';

function defaultConfigPath(): string {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');
  return join(configHome, 'detent', 'config.json');
}

export function resolveConfigPath(overridePath?: string): string {
  return overridePath ?? defaultConfigPath();
}

export function useBuiltinPatterns(): boolean {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  return (process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'] ?? '') === '';
}
