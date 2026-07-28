import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Validator } from '@cfworker/json-schema';
import { RequestSchema, SchemaRegistry, getAllBuiltinSchemas } from './schemas/requestSchema.js';
import { decomposeRequest, type CustomMetadata } from './decomposedRequest.js';
import { runHooksAll, type HookSpec } from './hooks.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface RawRuleObjectBody {
  readonly schemas?: readonly string[];
  readonly hooks?: readonly string[];
}

export type RawRuleBody = readonly string[] | RawRuleObjectBody;

export type RawRule = Readonly<Record<string, RawRuleBody>>;

export interface RawConfig {
  readonly include?: readonly string[];
  readonly schemas: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly RawRule[];
}

interface RawConfigWithOrigins {
  readonly rawConfig: RawConfig;
  // Parallel array to rawConfig.rules: the directory of the config file that
  // contributed each rule. Used to resolve relative hook paths.
  readonly ruleOriginDirectories: readonly string[];
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
          oneOf: [
            // Legacy plain list of schema names.
            { type: 'array', items: { type: 'string' } },
            // Object form with schemas and/or hooks.
            {
              type: 'object',
              properties: {
                schemas: { type: 'array', items: { type: 'string' } },
                hooks: { type: 'array', items: { type: 'string' } },
              },
              additionalProperties: false,
              minProperties: 1,
            },
          ],
        },
      },
    },
  },
  additionalProperties: false,
} as const;

// Cast to bypass strictness around readonly tuples introduced by `oneOf`.
const rawConfigValidator = new Validator(
  rawConfigSchema as unknown as Record<string, unknown>,
  '2020-12',
  false
);

interface ResolvedRule {
  readonly scope: RequestSchema;
  readonly body: ResolvedRuleBody;
}

type ResolvedRuleBody =
  | { readonly kind: 'list'; readonly schemas: readonly RequestSchema[] }
  | {
      readonly kind: 'object';
      readonly schemaAny: readonly RequestSchema[];
      readonly hooks: readonly HookSpec[];
    };

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
  /**
   * Human-readable warnings produced while resolving rules, e.g. references to
   * unknown schema names that were skipped instead of failing the whole config.
   */
  readonly warnings: readonly string[];

  constructor(configPath: string, doNotUseBuiltinSchemas: boolean) {
    const { rawConfig, ruleOriginDirectories } = readRawConfigWithOrigins(configPath);
    const registry = createSchemaRegistry(rawConfig, doNotUseBuiltinSchemas);
    const { rules, warnings } = resolveRules(rawConfig, ruleOriginDirectories, registry);
    this.rules = rules;
    this.warnings = warnings;
  }

  async check(request: Request, customMetadata?: CustomMetadata): Promise<boolean> {
    const decomposedRequest = await decomposeRequest(request, customMetadata);

    for (let index = 0; index < this.rules.length; index++) {
      const rule = this.rules[index]!;
      if (!rule.scope.match(decomposedRequest)) continue;

      if (rule.body.kind === 'list') {
        for (const schema of rule.body.schemas) {
          if (schema.match(decomposedRequest)) {
            return true;
          }
        }
        return false;
      }

      // Object form: hooks AND schemas (each vacuously true if empty/absent).
      // Hooks run first so that hooks like "audit-log" happen even if the schemas don't match.
      if (rule.body.hooks.length > 0) {
        const outcome = await runHooksAll(rule.body.hooks, decomposedRequest, index);
        if (outcome.kind === 'rejected') return false;
      }

      if (rule.body.schemaAny.length > 0) {
        const anyMatch = rule.body.schemaAny.some((schema) => schema.match(decomposedRequest));
        if (!anyMatch) return false;
      }

      return true;
    }

    // No rule matched — reject by default
    return false;
  }
}

export function readRawConfig(configPath: string): RawConfig {
  return readRawConfigWithOrigins(configPath).rawConfig;
}

function readRawConfigWithOrigins(configPath: string): RawConfigWithOrigins {
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
    rules?: readonly RawRule[];
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

function readRawConfigRecursive(
  configPath: string,
  visitedPaths: readonly string[]
): RawConfigWithOrigins {
  const absolutePath = resolve(configPath);

  if (visitedPaths.includes(absolutePath)) {
    const cycle = [...visitedPaths, absolutePath].join(' -> ');
    throw new ConfigError(`Circular include detected: ${cycle}`);
  }

  const currentConfig = readSingleRawConfig(absolutePath);
  const currentDirectory = dirname(absolutePath);

  let mergedSchemas: Record<string, Record<string, unknown>> = {};
  let mergedRules: RawRule[] = [];
  let mergedRuleOriginDirectories: string[] = [];

  if (currentConfig.include !== undefined && currentConfig.include.length > 0) {
    const newVisitedPaths = [...visitedPaths, absolutePath];

    for (const includePath of currentConfig.include) {
      const resolvedIncludePath = resolve(currentDirectory, includePath);
      const included = readRawConfigRecursive(resolvedIncludePath, newVisitedPaths);
      mergedSchemas = { ...mergedSchemas, ...included.rawConfig.schemas };
      mergedRules = [...mergedRules, ...included.rawConfig.rules];
      mergedRuleOriginDirectories = [
        ...mergedRuleOriginDirectories,
        ...included.ruleOriginDirectories,
      ];
    }
  }

  // The current config's own schemas override included ones; the current
  // config's own rules are appended after included rules.
  mergedSchemas = { ...mergedSchemas, ...currentConfig.schemas };
  mergedRules = [...mergedRules, ...currentConfig.rules];
  mergedRuleOriginDirectories = [
    ...mergedRuleOriginDirectories,
    ...new Array<string>(currentConfig.rules.length).fill(currentDirectory),
  ];

  return {
    rawConfig: { schemas: mergedSchemas, rules: mergedRules },
    ruleOriginDirectories: mergedRuleOriginDirectories,
  };
}

export function validateRules(rawConfig: RawConfig, registry: SchemaRegistry): readonly string[] {
  // Origin directories are not relevant for validation (they only affect
  // hook-path resolution at exec time). Pass empty placeholders.
  const placeholders = rawConfig.rules.map(() => '');
  return resolveRules(rawConfig, placeholders, registry).warnings;
}

function resolveRules(
  rawConfig: RawConfig,
  ruleOriginDirectories: readonly string[],
  registry: SchemaRegistry
): { readonly rules: readonly ResolvedRule[]; readonly warnings: readonly string[] } {
  const warnings: string[] = [];
  const rules: ResolvedRule[] = [];

  rawConfig.rules.forEach((ruleObject, index) => {
    const entries = Object.entries(ruleObject);
    if (entries.length !== 1) {
      throw new ConfigError(
        `Rule at index ${String(index)} must have exactly one key, got ${String(entries.length)}`
      );
    }

    const [scopeName, body] = entries[0]!;
    const scope = resolveSchema(scopeName, registry);
    if (scope === null) {
      warnings.push(
        `Unknown schema "${scopeName}" used as scope of rule at index ${String(index)}; skipping this rule.`
      );
      return;
    }
    const originDirectory = ruleOriginDirectories[index] ?? '';

    if (isListRuleBody(body)) {
      const schemas: RequestSchema[] = [];
      for (const schemaName of body) {
        const schema = resolveSchema(schemaName, registry);
        if (schema === null) {
          warnings.push(
            `Unknown schema "${schemaName}" used as a permission in rule at index ${String(index)}; skipping this permission.`
          );
        } else {
          schemas.push(schema);
        }
      }
      rules.push({ scope, body: { kind: 'list', schemas } });
      return;
    }

    const objectBody = body;
    const schemaAnyNames = objectBody.schemas ?? [];
    const hookStrings = objectBody.hooks ?? [];

    const schemaAny: RequestSchema[] = [];
    for (const schemaName of schemaAnyNames) {
      const schema = resolveSchema(schemaName, registry);
      if (schema === null) {
        warnings.push(
          `Unknown schema "${schemaName}" used in schemas of rule at index ${String(index)}; skipping this schema.`
        );
      } else {
        schemaAny.push(schema);
      }
    }
    const hooks: readonly HookSpec[] = hookStrings.map((hookString) => ({
      hookString,
      configDirectory: originDirectory,
    }));

    rules.push({ scope, body: { kind: 'object', schemaAny, hooks } });
  });

  return { rules, warnings };
}

function isListRuleBody(body: RawRuleBody): body is readonly string[] {
  return Array.isArray(body);
}

function resolveSchema(name: string, registry: SchemaRegistry): RequestSchema | null {
  // Don't throw on an unknown name: a typo'd or hallucinated schema name in a
  // single rule must not take down the entire gateway. Callers skip the
  // offending rule/permission and record a warning so the misconfiguration is
  // still discoverable.
  return registry.get(name) ?? null;
}
