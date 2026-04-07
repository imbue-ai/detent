import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export class BuiltinPatternLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuiltinPatternLoadError';
  }
}

function loadBuiltinPatterns(): Readonly<Record<string, Record<string, unknown>>> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const builtinPatternsDirectory = join(currentDirectory, 'builtinPatterns');

  let entries: string[];
  try {
    entries = readdirSync(builtinPatternsDirectory, { recursive: true, encoding: 'utf-8' });
  } catch {
    return {};
  }

  const jsonFiles = entries.filter((entry) => entry.endsWith('.json'));

  const merged: Record<string, Record<string, unknown>> = {};

  for (const jsonFile of jsonFiles) {
    const filePath = join(builtinPatternsDirectory, jsonFile);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BuiltinPatternLoadError(
        `Failed to read builtin pattern file "${filePath}": ${message}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BuiltinPatternLoadError(
          `Failed to parse builtin pattern file "${filePath}": ${error.message}`
        );
      }
      throw error;
    }

    const patternsObject = parsed as Record<string, Record<string, unknown>>;

    for (const [name, schema] of Object.entries(patternsObject)) {
      merged[name] = schema;
    }
  }

  return merged;
}

export const builtinPatterns: Readonly<Record<string, Record<string, unknown>>> =
  loadBuiltinPatterns();
