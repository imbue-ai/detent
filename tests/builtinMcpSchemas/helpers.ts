import { expect } from 'vitest';
import { SchemaRegistry, getAllBuiltinSchemas } from '../../src/schemas/requestSchema.js';
import type { DecomposedRequest } from '../../src/decomposedRequest.js';

export const builtinRegistry = new SchemaRegistry(getAllBuiltinSchemas());

export function makeRequest(overrides: Partial<DecomposedRequest> = {}): DecomposedRequest {
  return {
    protocol: 'https',
    domain: 'example.com',
    port: 443,
    path: '/',
    method: 'GET',
    headers: {},
    queryParams: {},
    body: undefined,
    ...overrides,
  };
}

export function expectSchemaExists(name: string): void {
  expect(builtinRegistry.get(name), `Expected builtin schema "${name}" to exist`).toBeDefined();
}

export function mcpToolCall(name: string, toolArguments: Record<string, unknown> = {}): unknown {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: toolArguments },
  };
}

export function mcpRpc(method: string): unknown {
  return { jsonrpc: '2.0', id: 1, method };
}

/**
 * A POST to an MCP endpoint carrying the given JSON-RPC message as its parsed body.
 */
export function mcpRequest(domain: string, path: string, parsedBody: unknown): DecomposedRequest {
  return makeRequest({ domain, method: 'POST', path, parsedBody });
}

export function matches(schemaName: string, request: DecomposedRequest): boolean {
  expectSchemaExists(schemaName);
  return builtinRegistry.get(schemaName)!.match(request);
}
