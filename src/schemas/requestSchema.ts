import { Validator } from '@cfworker/json-schema';
import { decomposedRequestPropertyNames } from '../decomposedRequest.js';
import type { DecomposedRequest } from '../decomposedRequest.js';
import { generatedBuiltinSchemas } from './generatedBuiltinSchemas.js';

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

/**
 * A request schema wraps a JSON schema that can be matched against a DecomposedRequest object.
 * The schema is a standard JSON Schema object schema (without the outer `type: "object"`
 * wrapper, which is added automatically).
 */
export class RequestSchema {
  readonly name: string;
  readonly schema: Readonly<Record<string, unknown>>;
  private readonly validator: Validator;

  constructor(name: string, schema: Record<string, unknown>) {
    this.name = name;
    this.schema = schema;

    const invalidPropertyName = findInvalidPropertyName(schema);
    if (invalidPropertyName !== undefined) {
      throw new RequestSchemaError(
        `Schema "${name}" references unknown request property "${invalidPropertyName}". ` +
          `Valid properties: ${[...validRequestPropertyNames].join(', ')}`
      );
    }

    const fullSchema = {
      type: 'object' as const,
      ...schema,
    };

    this.validator = new Validator(fullSchema, '2020-12', true);
  }

  match(decomposedRequest: DecomposedRequest): boolean {
    return this.validator.validate(decomposedRequest).valid;
  }
}

/**
 * Holds raw schemas and compiles them into RequestSchema instances on demand.
 */
export class SchemaRegistry {
  private readonly rawSchemas: ReadonlyMap<string, Record<string, unknown>>;
  private readonly compiledSchemas = new Map<string, RequestSchema>();

  constructor(rawSchemas: Readonly<Record<string, Record<string, unknown>>>) {
    this.rawSchemas = new Map(Object.entries(rawSchemas));
  }

  get(name: string): RequestSchema | undefined {
    const cached = this.compiledSchemas.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const schema = this.rawSchemas.get(name);
    if (schema === undefined) {
      return undefined;
    }

    const requestSchema = new RequestSchema(name, schema);
    this.compiledSchemas.set(name, requestSchema);
    return requestSchema;
  }

  has(name: string): boolean {
    return this.rawSchemas.has(name);
  }

  compileAll(): void {
    for (const name of this.rawSchemas.keys()) {
      if (!this.compiledSchemas.has(name)) {
        this.get(name);
      }
    }
  }

  allSchemas(): Readonly<Record<string, Record<string, unknown>>> {
    return Object.fromEntries(this.rawSchemas);
  }
}

export function getAllBuiltinSchemas(): Readonly<Record<string, Record<string, unknown>>> {
  return generatedBuiltinSchemas;
}
