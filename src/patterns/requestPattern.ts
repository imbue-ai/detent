import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import { decomposedRequestPropertyNames } from '../decomposedRequest.js';
import type { DecomposedRequest } from '../decomposedRequest.js';

export class RequestPatternError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestPatternError';
  }
}

export class BuiltinPatternLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuiltinPatternLoadError';
  }
}

const validRequestPropertyNames = decomposedRequestPropertyNames;

function findInvalidPropertyName(schema: Record<string, unknown>): string | undefined {
  const properties = schema.properties;
  if (typeof properties === 'object' && properties !== null) {
    for (const key of Object.keys(properties as Record<string, unknown>)) {
      if (!validRequestPropertyNames.has(key)) {
        return key;
      }
    }
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    const value = schema[keyword];
    if (Array.isArray(value)) {
      for (const subSchema of value) {
        if (typeof subSchema === 'object' && subSchema !== null) {
          const found = findInvalidPropertyName(subSchema as Record<string, unknown>);
          if (found !== undefined) return found;
        }
      }
    }
  }

  for (const keyword of ['if', 'then', 'else', 'not'] as const) {
    const value = schema[keyword];
    if (typeof value === 'object' && value !== null) {
      const found = findInvalidPropertyName(value as Record<string, unknown>);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}


const ajv = new Ajv({ allErrors: true });

/**
 * A request pattern wraps a JSON schema that can be matched against a DecomposedRequest object.
 * The schema is a standard JSON Schema object schema (without the outer `type: "object"`
 * wrapper, which is added automatically).
 */
export class RequestPattern {
  readonly name: string;
  readonly schema: Readonly<Record<string, unknown>>;
  private readonly validate: ValidateFunction;

  constructor(name: string, schema: Record<string, unknown>) {
    this.name = name;
    this.schema = schema;

    const invalidPropertyName = findInvalidPropertyName(schema);
    if (invalidPropertyName !== undefined) {
      throw new RequestPatternError(
        `Pattern "${name}" references unknown request property "${invalidPropertyName}". ` +
          `Valid properties: ${[...validRequestPropertyNames].join(', ')}`
      );
    }

    const fullSchema = {
      type: 'object' as const,
      ...schema,
    };

    try {
      this.validate = ajv.compile(fullSchema);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RequestPatternError(`Invalid schema for pattern "${name}": ${message}`);
    }
  }

  match(decomposedRequest: DecomposedRequest): boolean {
    return this.validate(decomposedRequest);
  }
}

/**
 * Holds raw schemas and compiles them into RequestPattern instances on demand.
 */
export class PatternRegistry {
  private readonly rawSchemas: ReadonlyMap<string, Record<string, unknown>>;
  private readonly compiledPatterns = new Map<string, RequestPattern>();

  constructor(rawSchemas: Readonly<Record<string, Record<string, unknown>>>) {
    this.rawSchemas = new Map(Object.entries(rawSchemas));
  }

  get(name: string): RequestPattern | undefined {
    const cached = this.compiledPatterns.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const schema = this.rawSchemas.get(name);
    if (schema === undefined) {
      return undefined;
    }

    const pattern = new RequestPattern(name, schema);
    this.compiledPatterns.set(name, pattern);
    return pattern;
  }

  has(name: string): boolean {
    return this.rawSchemas.has(name);
  }

  compileAll(): void {
    for (const name of this.rawSchemas.keys()) {
      if (!this.compiledPatterns.has(name)) {
        this.get(name);
      }
    }
  }

  allSchemas(): Readonly<Record<string, Record<string, unknown>>> {
    return Object.fromEntries(this.rawSchemas);
  }
}

function readBuiltinSchemas(): Readonly<Record<string, Record<string, unknown>>> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const builtinDirectory = join(currentDirectory, 'builtin');

  let entries: string[];
  try {
    entries = readdirSync(builtinDirectory, { recursive: true, encoding: 'utf-8' });
  } catch {
    return {};
  }

  const jsonFiles = entries.filter((entry) => entry.endsWith('.json'));
  const schemas: Record<string, Record<string, unknown>> = {};

  for (const jsonFile of jsonFiles) {
    const filePath = join(builtinDirectory, jsonFile);
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
      schemas[name] = schema;
    }
  }

  return schemas;
}

let cachedBuiltinSchemas: Readonly<Record<string, Record<string, unknown>>> | undefined;

export function getAllBuiltinSchemas(): Readonly<Record<string, Record<string, unknown>>> {
  cachedBuiltinSchemas ??= readBuiltinSchemas();
  return cachedBuiltinSchemas;
}
