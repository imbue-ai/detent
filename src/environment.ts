import { homedir } from 'node:os';
import { join } from 'node:path';

function defaultConfigPath(): string {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');
  return join(configHome, 'detent', 'config.json');
}

export function resolveConfigPath(overridePath?: string): string {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  return overridePath ?? process.env['DETENT_CONFIG'] ?? defaultConfigPath();
}

export function useBuiltinSchemas(): boolean {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const newVar = process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] ?? '';
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const legacyVar = process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'] ?? '';
  return newVar === '' && legacyVar === '';
}
