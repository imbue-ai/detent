import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CustomMetadata } from './decomposedRequest.js';

export class CustomMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomMetadataError';
  }
}

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

function parseCustomMetadata(text: string, variableName: string): CustomMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CustomMetadataError(
      `Failed to parse custom metadata from ${variableName}: ${message}`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CustomMetadataError(`Custom metadata from ${variableName} must be a JSON object`);
  }

  return parsed as CustomMetadata;
}

export function customMetadataFromEnvironment(): CustomMetadata | undefined {
  const variableName = 'DETENT_CUSTOM_METADATA';
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const value = process.env['DETENT_CUSTOM_METADATA'] ?? '';
  if (value.trim() === '') {
    return undefined;
  }
  return parseCustomMetadata(value, variableName);
}
