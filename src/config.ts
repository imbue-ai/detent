import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Validator } from '@cfworker/json-schema';
import {
  RequestSchema,
  RequestSchemaError,
  SchemaRegistry,
  getAllBuiltinSchemas,
} from './schemas/requestSchema.js';
import { decomposeRequest } from './decomposedRequest.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface RawConfig {
  readonly include?: readonly string[];
  readonly schemas: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly Readonly<Record<string, readonly string[]>>[];
}

const rawConfigSchema = {
  type: 'object',
  properties: {
    include: {
      type: 'array',
      items: { type: 'string' },
    },
    schemas: {
      type: 'object',
      additionalProperties: { type: 'object' },
    },
    // Backwards compatibility: "patterns" is accepted as an alias for "schemas".
    patterns: {
      type: 'object',
      additionalProperties: { type: 'object' },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
  additionalProperties: false,
} as const;

const rawConfigValidator = new Validator(rawConfigSchema, '2020-12', false);

interface ResolvedRule {
  readonly scope: RequestSchema;
  readonly permissions: readonly RequestSchema[];
}

export function createSchemaRegistry(
  rawConfig: RawConfig,
  doNotUseBuiltinSchemas: boolean
): SchemaRegistry {
  const schemas: Record<string, Record<string, unknown>> = {};

  if (!doNotUseBuiltinSchemas) {
    Object.assign(schemas, getAllBuiltinSchemas());
  }

  // User schemas override builtins with the same name.
  Object.assign(schemas, rawConfig.schemas);

  return new SchemaRegistry(schemas);
}

export class Config {
  private readonly rules: readonly ResolvedRule[];

  constructor(configPath: string, doNotUseBuiltinSchemas: boolean) {
    const rawConfig = readRawConfig(configPath);
    const registry = createSchemaRegistry(rawConfig, doNotUseBuiltinSchemas);
    this.rules = resolveRules(rawConfig, registry);
  }

  async check(request: Request): Promise<boolean> {
    const decomposedRequest = await decomposeRequest(request);

    for (const rule of this.rules) {
      if (rule.scope.match(decomposedRequest)) {
        for (const permission of rule.permissions) {
          if (permission.match(decomposedRequest)) {
            return true;
          }
        }
        return false;
      }
    }

    // No rule matched — reject by default
    return false;
  }
}

export function readRawConfig(configPath: string): RawConfig {
  return readRawConfigRecursive(configPath, []);
}

function readSingleRawConfig(configPath: string): RawConfig {
  if (!existsSync(configPath)) {
    return { schemas: {}, rules: [] };
  }

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to read config file "${configPath}": ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Failed to parse config file "${configPath}": ${message}`);
  }

  const validationResult = rawConfigValidator.validate(parsed);
  if (!validationResult.valid) {
    const errors = validationResult.errors
      .map((error) => {
        const path = error.instanceLocation || '#';
        return `${path}: ${error.error}`;
      })
      .join('; ');
    throw new ConfigError(`Invalid config file "${configPath}": ${errors}`);
  }

  const validated = parsed as {
    include?: readonly string[];
    schemas?: Readonly<Record<string, Record<string, unknown>>>;
    patterns?: Readonly<Record<string, Record<string, unknown>>>;
    rules?: readonly Readonly<Record<string, readonly string[]>>[];
  };

  // Merge "patterns" (deprecated) and "schemas"; "schemas" takes precedence.
  const mergedSchemas: Record<string, Record<string, unknown>> = {
    ...(validated.patterns ?? {}),
    ...(validated.schemas ?? {}),
  };

  return {
    include: validated.include,
    schemas: mergedSchemas,
    rules: validated.rules ?? [],
  };
}

function readRawConfigRecursive(configPath: string, visitedPaths: readonly string[]): RawConfig {
  const absolutePath = resolve(configPath);

  if (visitedPaths.includes(absolutePath)) {
    const cycle = [...visitedPaths, absolutePath].join(' -> ');
    throw new ConfigError(`Circular include detected: ${cycle}`);
  }

  const currentConfig = readSingleRawConfig(absolutePath);

  if (currentConfig.include === undefined || currentConfig.include.length === 0) {
    return currentConfig;
  }

  const configDirectory = dirname(absolutePath);
  const newVisitedPaths = [...visitedPaths, absolutePath];

  let mergedSchemas: Record<string, Record<string, unknown>> = {};
  let mergedRules: Readonly<Record<string, readonly string[]>>[] = [];

  for (const includePath of currentConfig.include) {
    const resolvedIncludePath = resolve(configDirectory, includePath);
    const includedConfig = readRawConfigRecursive(resolvedIncludePath, newVisitedPaths);

    mergedSchemas = { ...mergedSchemas, ...includedConfig.schemas };
    mergedRules = [...mergedRules, ...includedConfig.rules];
  }

  // The current config's own schemas override included ones;
  // the current config's own rules are appended after included rules.
  mergedSchemas = { ...mergedSchemas, ...currentConfig.schemas };
  mergedRules = [...mergedRules, ...currentConfig.rules];

  return { schemas: mergedSchemas, rules: mergedRules };
}

export function validateRules(rawConfig: RawConfig, registry: SchemaRegistry): void {
  resolveRules(rawConfig, registry);
}

function resolveRules(rawConfig: RawConfig, registry: SchemaRegistry): readonly ResolvedRule[] {
  return rawConfig.rules.map((ruleObject, index) => {
    const entries = Object.entries(ruleObject);
    if (entries.length !== 1) {
      throw new ConfigError(
        `Rule at index ${String(index)} must have exactly one key, got ${String(entries.length)}`
      );
    }

    const [scopeName, permissionNames] = entries[0]!;
    const scope = resolveSchema(scopeName, registry, `scope of rule at index ${String(index)}`);

    const permissions = permissionNames.map((permissionName) =>
      resolveSchema(
        permissionName,
        registry,
        `permission "${permissionName}" in rule at index ${String(index)}`
      )
    );

    return { scope, permissions };
  });
}

function resolveSchema(name: string, registry: SchemaRegistry, context: string): RequestSchema {
  const schema = registry.get(name);
  if (schema === undefined) {
    throw new RequestSchemaError(`Unknown schema "${name}" used in ${context}`);
  }
  return schema;
}
