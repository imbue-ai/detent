import { Ajv, type ValidateFunction } from 'ajv';
import type { DecomposedRequest } from './decomposedRequest.js';

export class RequestPatternError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestPatternError';
  }
}

/**
 * A request pattern wraps a JSON schema that can be matched against a DecomposedRequest object.
 * The schema properties correspond to the fields of DecomposedRequest.
 */
export class RequestPattern {
  readonly name: string;
  private readonly validate: ValidateFunction;

  constructor(name: string, schemaProperties: Record<string, unknown>) {
    this.name = name;

    const fullSchema = {
      type: 'object',
      properties: schemaProperties,
      required: Object.keys(schemaProperties),
    };

    const ajv = new Ajv({ allErrors: true });
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
