import { describe, it, expect } from 'vitest';
import {
  BuiltinSchemaLookup,
  SchemaRegistry,
  builtinSchemas,
  getAllBuiltinSchemas,
} from '../src/schemas/requestSchema.js';
import {
  builtinSchemaJsonSourceByService,
  builtinSchemaServiceByName,
} from '../src/schemas/generatedBuiltinSchemas.js';
import type { DecomposedRequest } from '../src/decomposedRequest.js';

const slackRequest: DecomposedRequest = {
  protocol: 'https',
  domain: 'slack.com',
  port: 443,
  path: '/api/chat.postMessage',
  method: 'POST',
  headers: {},
  queryParams: {},
  body: undefined,
};

describe('generated built-in schema index', () => {
  it('maps every schema name to a service whose JSON source defines it', () => {
    for (const [schemaName, serviceName] of Object.entries(builtinSchemaServiceByName)) {
      const jsonSource = builtinSchemaJsonSourceByService[serviceName];
      expect(jsonSource, `service "${serviceName}" for "${schemaName}"`).toBeDefined();
      const parsed = JSON.parse(jsonSource!) as Record<string, unknown>;
      expect(Object.hasOwn(parsed, schemaName), `${serviceName} defines ${schemaName}`).toBe(true);
    }
  });

  it('indexes every schema defined in every service source', () => {
    const indexedNames = new Set(Object.keys(builtinSchemaServiceByName));
    let definedCount = 0;
    for (const jsonSource of Object.values(builtinSchemaJsonSourceByService)) {
      for (const schemaName of Object.keys(JSON.parse(jsonSource) as Record<string, unknown>)) {
        expect(indexedNames.has(schemaName), schemaName).toBe(true);
        definedCount += 1;
      }
    }
    expect(definedCount).toBe(indexedNames.size);
  });
});

describe('BuiltinSchemaLookup', () => {
  it('answers has/get for built-in schemas and nothing else', () => {
    const lookup = new BuiltinSchemaLookup();
    expect(lookup.has('slack-api')).toBe(true);
    expect(lookup.get('slack-api')).toEqual(getAllBuiltinSchemas()['slack-api']);
    expect(lookup.has('no-such-schema')).toBe(false);
    expect(lookup.get('no-such-schema')).toBeUndefined();
  });

  it('lists the same names that the merged catalog contains', () => {
    const lookup = new BuiltinSchemaLookup();
    expect([...lookup.names()].sort()).toEqual(Object.keys(getAllBuiltinSchemas()).sort());
    expect(Object.keys(lookup.all()).sort()).toEqual(Object.keys(getAllBuiltinSchemas()).sort());
  });

  it('returns the same object for repeated lookups of one service', () => {
    const lookup = new BuiltinSchemaLookup();
    expect(lookup.get('slack-chat-write')).toBe(lookup.get('slack-chat-write'));
  });
});

describe('SchemaRegistry with built-in schemas', () => {
  it('resolves built-in schemas when given the built-in lookup', () => {
    const registry = new SchemaRegistry({}, builtinSchemas);
    expect(registry.has('slack-chat-write')).toBe(true);
    expect(registry.get('slack-chat-write')!.match(slackRequest)).toBe(true);
    expect(registry.get('no-such-schema')).toBeUndefined();
  });

  it('does not know built-in schemas without the lookup', () => {
    const registry = new SchemaRegistry({});
    expect(registry.has('slack-chat-write')).toBe(false);
    expect(registry.get('slack-chat-write')).toBeUndefined();
    expect(Object.keys(registry.allSchemas())).toEqual([]);
  });

  it('lets explicitly passed schemas override built-ins with the same name', () => {
    const registry = new SchemaRegistry(
      { 'slack-api': { properties: { domain: { const: 'example.com' } }, required: ['domain'] } },
      builtinSchemas
    );
    expect(registry.get('slack-api')!.match(slackRequest)).toBe(false);
    expect(registry.get('slack-api')!.match({ ...slackRequest, domain: 'example.com' })).toBe(true);
    expect(registry.allSchemas()['slack-api']).toEqual({
      properties: { domain: { const: 'example.com' } },
      required: ['domain'],
    });
  });

  it('lets explicitly passed schemas reference built-ins', () => {
    const registry = new SchemaRegistry(
      {
        'slack-post-only': {
          allOf: [{ $ref: '#/$defs/slack-api' }, { properties: { method: { const: 'POST' } } }],
        },
      },
      builtinSchemas
    );
    expect(registry.get('slack-post-only')!.match(slackRequest)).toBe(true);
    expect(registry.get('slack-post-only')!.match({ ...slackRequest, method: 'GET' })).toBe(false);
  });

  it('merges built-in and explicit schemas in allSchemas', () => {
    const registry = new SchemaRegistry({ custom: { properties: {} } }, builtinSchemas);
    const names = Object.keys(registry.allSchemas());
    expect(names).toContain('custom');
    expect(names).toContain('slack-api');
    expect(names.length).toBe(Object.keys(getAllBuiltinSchemas()).length + 1);
  });
});
