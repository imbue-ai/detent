import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import { RequestPattern, RequestPatternError } from './requestPattern.js';
import { decomposeRequest } from './decomposedRequest.js';
import { builtinPatterns } from './builtinPatterns.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface RawConfig {
  readonly include?: readonly string[];
  readonly patterns: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly Readonly<Record<string, readonly string[]>>[];
}

const requestPatternPropertySchema = { type: 'object' } as const;

const requestPatternSchema = {
  type: 'object',
  properties: {
    protocol: requestPatternPropertySchema,
    domain: requestPatternPropertySchema,
    port: requestPatternPropertySchema,
    path: requestPatternPropertySchema,
    method: requestPatternPropertySchema,
    headers: requestPatternPropertySchema,
    queryParams: requestPatternPropertySchema,
    body: requestPatternPropertySchema,
  },
  additionalProperties: false,
} as const;

const rawConfigSchema = {
  type: 'object',
  properties: {
    include: {
      type: 'array',
      items: { type: 'string' },
    },
    patterns: {
      type: 'object',
      additionalProperties: requestPatternSchema,
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

const validateRawConfig: ValidateFunction = new Ajv({ allErrors: true }).compile(rawConfigSchema);

interface ResolvedRule {
  readonly scope: RequestPattern;
  readonly permissions: readonly RequestPattern[];
}

export class Config {
  private readonly rules: readonly ResolvedRule[];

  constructor(configPath: string, doNotUseBuiltinPatterns: boolean) {
    const rawConfig = readRawConfig(configPath);
    const patterns = buildPatternMap(rawConfig, doNotUseBuiltinPatterns);
    this.rules = resolveRules(rawConfig, patterns);
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
    return { patterns: {}, rules: [] };
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

  if (!validateRawConfig(parsed)) {
    const errors = (validateRawConfig.errors ?? [])
      .map((error) => `${error.instancePath || '/'}: ${error.message ?? 'unknown error'}`)
      .join('; ');
    throw new ConfigError(`Invalid config file "${configPath}": ${errors}`);
  }

  const validated = parsed as {
    include?: readonly string[];
    patterns?: Readonly<Record<string, Record<string, unknown>>>;
    rules?: readonly Readonly<Record<string, readonly string[]>>[];
  };

  return {
    include: validated.include,
    patterns: validated.patterns ?? {},
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

  let mergedPatterns: Record<string, Record<string, unknown>> = {};
  let mergedRules: Readonly<Record<string, readonly string[]>>[] = [];

  for (const includePath of currentConfig.include) {
    const resolvedIncludePath = resolve(configDirectory, includePath);
    const includedConfig = readRawConfigRecursive(resolvedIncludePath, newVisitedPaths);

    mergedPatterns = { ...mergedPatterns, ...includedConfig.patterns };
    mergedRules = [...mergedRules, ...includedConfig.rules];
  }

  // The current config's own patterns override included ones;
  // the current config's own rules are appended after included rules.
  mergedPatterns = { ...mergedPatterns, ...currentConfig.patterns };
  mergedRules = [...mergedRules, ...currentConfig.rules];

  return { patterns: mergedPatterns, rules: mergedRules };
}

function buildPatternMap(
  rawConfig: RawConfig,
  doNotUseBuiltinPatterns: boolean
): ReadonlyMap<string, RequestPattern> {
  const patterns = new Map<string, RequestPattern>();

  if (!doNotUseBuiltinPatterns) {
    for (const [name, schema] of Object.entries(builtinPatterns)) {
      patterns.set(name, new RequestPattern(name, schema));
    }
  }

  for (const [name, schema] of Object.entries(rawConfig.patterns)) {
    patterns.set(name, new RequestPattern(name, schema));
  }

  return patterns;
}

function resolveRules(
  rawConfig: RawConfig,
  patterns: ReadonlyMap<string, RequestPattern>
): readonly ResolvedRule[] {
  return rawConfig.rules.map((ruleObject, index) => {
    const entries = Object.entries(ruleObject);
    if (entries.length !== 1) {
      throw new ConfigError(
        `Rule at index ${String(index)} must have exactly one key, got ${String(entries.length)}`
      );
    }

    const [scopeName, permissionNames] = entries[0]!;
    const scope = resolvePattern(scopeName, patterns, `scope of rule at index ${String(index)}`);

    const permissions = permissionNames.map((permissionName) =>
      resolvePattern(
        permissionName,
        patterns,
        `permission "${permissionName}" in rule at index ${String(index)}`
      )
    );

    return { scope, permissions };
  });
}

function resolvePattern(
  name: string,
  patterns: ReadonlyMap<string, RequestPattern>,
  context: string
): RequestPattern {
  const pattern = patterns.get(name);
  if (pattern === undefined) {
    throw new RequestPatternError(`Unknown pattern "${name}" used in ${context}`);
  }
  return pattern;
}
