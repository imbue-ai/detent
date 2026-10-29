import { Validator } from '@cfworker/json-schema';
import { decomposedRequestPropertyNames } from '../decomposedRequest.js';
import type { DecomposedRequest } from '../decomposedRequest.js';
import {
  builtinSchemaJsonSourceByService,
  builtinSchemaServiceByName,
} from './generatedBuiltinSchemas.js';

export class RequestSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestSchemaError';
  }
}

const validRequestPropertyNames = decomposedRequestPropertyNames;

function findInvalidPropertyName(schema: Record<string, unknown>): string | undefined {
  const properties = schema.properties;
  if (typeof properties === 'object' && properties !== null) {
    for (const key of Object.keys(properties)) {
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

const definitionReferencePrefix = '#/$defs/';

function decodeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Names of the schemas referenced by `{"$ref": "#/$defs/<name>"}` pointers anywhere
 * inside the given value. Pointers that reach into a definition (e.g.
 * "#/$defs/<name>/properties/domain") yield the name of the enclosing definition.
 */
function findDefinitionReferences(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) findDefinitionReferences(item, found);
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    if (
      key === '$ref' &&
      typeof child === 'string' &&
      child.startsWith(definitionReferencePrefix)
    ) {
      const pointerRemainder = child.slice(definitionReferencePrefix.length);
      const firstSegment = pointerRemainder.split('/', 1)[0]!;
      found.add(decodeJsonPointerSegment(firstSegment));
      continue;
    }
    findDefinitionReferences(child, found);
  }
}

/**
 * Read-only access to named raw schemas. Implementations may load schemas lazily.
 */
export interface RawSchemaLookup {
  has(name: string): boolean;
  get(name: string): Record<string, unknown> | undefined;
}

export type RawSchemaSource = Readonly<Record<string, Record<string, unknown>>> | RawSchemaLookup;

function isRawSchemaLookup(source: RawSchemaSource): source is RawSchemaLookup {
  return typeof source.has === 'function' && typeof source.get === 'function';
}

function toRawSchemaLookup(source: RawSchemaSource): RawSchemaLookup {
  if (isRawSchemaLookup(source)) {
    return source;
  }
  return {
    has: (name) => Object.hasOwn(source, name),
    get: (name) => source[name],
  };
}

/**
 * The transitive closure of the named schemas referenced by `schema`, ready to be
 * embedded as the `$defs` of the compiled schema. Schemas defined inline in the
 * schema's own `$defs` shadow equally-named ones from `availableSchemas`.
 */
function resolveReferencedDefinitions(
  name: string,
  schema: Record<string, unknown>,
  availableSchemas: RawSchemaLookup
): Record<string, Record<string, unknown>> {
  const inlineDefinitions = schema.$defs;
  const inlineDefinitionNames =
    typeof inlineDefinitions === 'object' && inlineDefinitions !== null
      ? new Set(Object.keys(inlineDefinitions))
      : new Set<string>();

  const resolvedDefinitions: Record<string, Record<string, unknown>> = {};
  const pending: unknown[] = [schema];

  while (pending.length > 0) {
    const referencedNames = new Set<string>();
    findDefinitionReferences(pending.pop(), referencedNames);

    for (const referencedName of referencedNames) {
      if (inlineDefinitionNames.has(referencedName)) continue;
      if (Object.hasOwn(resolvedDefinitions, referencedName)) continue;

      const referencedSchema = availableSchemas.get(referencedName);
      if (referencedSchema === undefined) {
        throw new RequestSchemaError(
          `Schema "${name}" references unknown schema "${definitionReferencePrefix}${referencedName}"`
        );
      }
      resolvedDefinitions[referencedName] = referencedSchema;
      pending.push(referencedSchema);
    }
  }

  return resolvedDefinitions;
}

/**
 * A request schema wraps a JSON schema that can be matched against a DecomposedRequest object.
 * The schema is a standard JSON Schema object schema (without the outer `type: "object"`
 * wrapper, which is added automatically).
 *
 * `availableSchemas` holds the other named schemas that this one may compose with via
 * `{"$ref": "#/$defs/<name>"}`; only the referenced ones end up in the compiled schema.
 */
export class RequestSchema {
  readonly name: string;
  readonly schema: Readonly<Record<string, unknown>>;
  private readonly validator: Validator;

  constructor(
    name: string,
    schema: Record<string, unknown>,
    availableSchemas: RawSchemaSource = {}
  ) {
    this.name = name;
    this.schema = schema;

    const invalidPropertyName = findInvalidPropertyName(schema);
    if (invalidPropertyName !== undefined) {
      throw new RequestSchemaError(
        `Schema "${name}" references unknown request property "${invalidPropertyName}". ` +
          `Valid properties: ${[...validRequestPropertyNames].join(', ')}`
      );
    }

    const referencedDefinitions = resolveReferencedDefinitions(
      name,
      schema,
      toRawSchemaLookup(availableSchemas)
    );
    const inlineDefinitions = schema.$defs as Record<string, unknown> | undefined;
    const definitions = { ...referencedDefinitions, ...inlineDefinitions };

    const fullSchema = {
      type: 'object' as const,
      ...schema,
      ...(Object.keys(definitions).length === 0 ? {} : { $defs: definitions }),
    };

    this.validator = new Validator(fullSchema, '2020-12', true);
  }

  match(decomposedRequest: DecomposedRequest): boolean {
    return this.validator.validate(decomposedRequest).valid;
  }
}

/**
 * Built-in schemas, parsed from their embedded JSON one service at a time on first use,
 * so that checking a request only pays for the services its rules reference.
 */
export class BuiltinSchemaLookup implements RawSchemaLookup {
  private readonly parsedServices = new Map<string, Record<string, Record<string, unknown>>>();

  has(name: string): boolean {
    return Object.hasOwn(builtinSchemaServiceByName, name);
  }

  get(name: string): Record<string, unknown> | undefined {
    const serviceName = builtinSchemaServiceByName[name];
    if (serviceName === undefined) {
      return undefined;
    }
    return this.schemasOfService(serviceName)[name];
  }

  names(): readonly string[] {
    return Object.keys(builtinSchemaServiceByName);
  }

  all(): Readonly<Record<string, Record<string, unknown>>> {
    const merged: Record<string, Record<string, unknown>> = {};
    for (const serviceName of Object.keys(builtinSchemaJsonSourceByService)) {
      Object.assign(merged, this.schemasOfService(serviceName));
    }
    return merged;
  }

  private schemasOfService(serviceName: string): Record<string, Record<string, unknown>> {
    const cached = this.parsedServices.get(serviceName);
    if (cached !== undefined) {
      return cached;
    }
    const jsonSource = builtinSchemaJsonSourceByService[serviceName];
    if (jsonSource === undefined) {
      throw new RequestSchemaError(`Unknown built-in schema service "${serviceName}"`);
    }
    const parsed = JSON.parse(jsonSource) as Record<string, Record<string, unknown>>;
    this.parsedServices.set(serviceName, parsed);
    return parsed;
  }
}

export const builtinSchemas = new BuiltinSchemaLookup();

/**
 * Holds raw schemas and compiles them into RequestSchema instances on demand.
 * Schemas passed explicitly take precedence over equally-named built-in ones.
 */
export class SchemaRegistry {
  private readonly rawSchemas: Readonly<Record<string, Record<string, unknown>>>;
  private readonly builtinLookup: BuiltinSchemaLookup | undefined;
  private readonly compiledSchemas = new Map<string, RequestSchema>();
  private readonly rawLookup: RawSchemaLookup = {
    has: (name) => this.has(name),
    get: (name) => this.getRaw(name),
  };

  constructor(
    rawSchemas: Readonly<Record<string, Record<string, unknown>>>,
    builtinLookup?: BuiltinSchemaLookup
  ) {
    this.rawSchemas = { ...rawSchemas };
    this.builtinLookup = builtinLookup;
  }

  get(name: string): RequestSchema | undefined {
    const cached = this.compiledSchemas.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const rawSchema = this.getRaw(name);
    if (rawSchema === undefined) {
      return undefined;
    }

    const requestSchema = new RequestSchema(name, rawSchema, this.rawLookup);
    this.compiledSchemas.set(name, requestSchema);
    return requestSchema;
  }

  has(name: string): boolean {
    return Object.hasOwn(this.rawSchemas, name) || (this.builtinLookup?.has(name) ?? false);
  }

  compileAll(): void {
    for (const name of Object.keys(this.allSchemas())) {
      if (!this.compiledSchemas.has(name)) {
        this.get(name);
      }
    }
  }

  allSchemas(): Readonly<Record<string, Record<string, unknown>>> {
    return { ...this.builtinLookup?.all(), ...this.rawSchemas };
  }

  private getRaw(name: string): Record<string, unknown> | undefined {
    return this.rawSchemas[name] ?? this.builtinLookup?.get(name);
  }
}

export function getAllBuiltinSchemas(): Readonly<Record<string, Record<string, unknown>>> {
  return builtinSchemas.all();
}
