import { readFileSync } from 'node:fs';
import { RequestPattern, RequestPatternError } from './requestPattern.js';
import { decomposeRequest } from './decomposedRequest.js';

export class DetentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetentConfigError';
  }
}

interface ResolvedRule {
  readonly scope: RequestPattern;
  readonly permissions: readonly RequestPattern[];
}

export class DetentConfig {
  private readonly rules: readonly ResolvedRule[];

  constructor(configPath: string, doNotUseBuiltinPatterns: boolean) {
    const rawConfig = readConfigFile(configPath);
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

interface RawConfig {
  readonly patterns?: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules?: readonly Readonly<Record<string, string | readonly string[]>>[];
}

function readConfigFile(configPath: string): RawConfig {
  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DetentConfigError(`Failed to read config file "${configPath}": ${message}`);
  }

  try {
    return JSON.parse(content) as RawConfig;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DetentConfigError(`Failed to parse config file "${configPath}": ${message}`);
  }
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

  if (rawConfig.patterns !== undefined) {
    for (const [name, schema] of Object.entries(rawConfig.patterns)) {
      patterns.set(name, new RequestPattern(name, schema));
    }
  }

  return patterns;
}

function resolveRules(
  rawConfig: RawConfig,
  patterns: ReadonlyMap<string, RequestPattern>
): readonly ResolvedRule[] {
  if (rawConfig.rules === undefined) {
    return [];
  }

  return rawConfig.rules.map((ruleObject, index) => {
    const entries = Object.entries(ruleObject);
    if (entries.length !== 1) {
      throw new DetentConfigError(
        `Rule at index ${String(index)} must have exactly one key, got ${String(entries.length)}`
      );
    }

    const [scopeName, permissionValue] = entries[0]!;
    const scope = resolvePattern(scopeName, patterns, `scope of rule at index ${String(index)}`);

    if (!Array.isArray(permissionValue)) {
      throw new DetentConfigError(
        `Permissions in rule at index ${String(index)} must be an array, got ${typeof permissionValue}`
      );
    }

    const permissions = (permissionValue as readonly string[]).map((permissionName) =>
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

// Builtin patterns — currently empty; will be populated in future increments.
const builtinPatterns: Readonly<Record<string, Record<string, unknown>>> = {};
