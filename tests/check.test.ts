import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check } from '../src/check.js';
import { Config, ConfigError } from '../src/config.js';
import { RequestSchema, RequestSchemaError, SchemaRegistry } from '../src/schemas/requestSchema.js';
import { decomposeRequest } from '../src/decomposedRequest.js';
import { CustomMetadataError } from '../src/environment.js';
import type { DecomposedRequest } from '../src/decomposedRequest.js';

describe('decomposeRequest', () => {
  it('extracts all fields from a simple GET request', async () => {
    const request = new Request('https://api.example.com:8080/users?page=1', {
      method: 'GET',
      headers: { Authorization: 'Bearer token123' },
    });
    const data = await decomposeRequest(request);

    expect(data.protocol).toBe('https');
    expect(data.domain).toBe('api.example.com');
    expect(data.port).toBe(8080);
    expect(data.path).toBe('/users');
    expect(data.method).toBe('GET');
    expect(data.headers).toHaveProperty('authorization', 'Bearer token123');
    expect(data.queryParams).toEqual({ page: '1' });
    expect(data.body).toBeUndefined();
  });

  it('uses default port 443 for https', async () => {
    const request = new Request('https://example.com/path');
    const data = await decomposeRequest(request);
    expect(data.port).toBe(443);
  });

  it('uses default port 80 for http', async () => {
    const request = new Request('http://example.com/path');
    const data = await decomposeRequest(request);
    expect(data.port).toBe(80);
  });

  it('extracts body from POST request', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      body: '{"name":"alice"}',
    });
    const data = await decomposeRequest(request);
    expect(data.body).toBe('{"name":"alice"}');
    expect(data.method).toBe('POST');
  });

  it('parses parsedBody for JSON request bodies', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: '{"name":"alice","nested":{"x":1}}',
    });
    const data = await decomposeRequest(request);
    expect(data.parsedBody).toEqual({ name: 'alice', nested: { x: 1 } });
  });

  it('parses parsedBody for +json content types', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.api+json' },
      body: '[1,2,3]',
    });
    const data = await decomposeRequest(request);
    expect(data.parsedBody).toEqual([1, 2, 3]);
  });

  it('leaves parsedBody undefined for non-JSON content types', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"name":"alice"}',
    });
    const data = await decomposeRequest(request);
    expect(data.parsedBody).toBeUndefined();
    expect(data.body).toBe('{"name":"alice"}');
  });

  it('leaves parsedBody undefined for malformed JSON', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    const data = await decomposeRequest(request);
    expect(data.parsedBody).toBeUndefined();
  });

  it('uppercases the method even when the Request object does not normalize it', async () => {
    // The Fetch API only auto-uppercases the six standard methods
    // (DELETE, GET, HEAD, OPTIONS, POST, PUT). Others like PATCH
    // are left as-is. decomposeRequest must uppercase all methods.
    // We simulate this by overriding the method property to avoid
    // an undici warning when constructing a Request with lowercase 'patch'.
    const request = new Request('https://example.com/api', { method: 'PATCH' });
    Object.defineProperty(request, 'method', { value: 'patch' });
    // Confirm the Request object has the lowercase method
    expect(request.method).toBe('patch');
    const data = await decomposeRequest(request);
    expect(data.method).toBe('PATCH');
  });

  it('lowercases header keys', async () => {
    const request = new Request('https://example.com', {
      headers: { 'X-Custom-Header': 'value', Authorization: 'Bearer tok' },
    });
    const data = await decomposeRequest(request);
    expect(Object.keys(data.headers).every((k) => k === k.toLowerCase())).toBe(true);
    expect(data.headers).toHaveProperty('x-custom-header', 'value');
    expect(data.headers).toHaveProperty('authorization', 'Bearer tok');
  });

  it('lowercases protocol and domain', async () => {
    // URL constructor already normalizes these, but verify the contract
    const request = new Request('HTTPS://API.GITHUB.COM/path');
    const data = await decomposeRequest(request);
    expect(data.protocol).toBe('https');
    expect(data.domain).toBe('api.github.com');
  });
});

describe('RequestSchema', () => {
  it('matches a request with const method', () => {
    const schema = new RequestSchema('get-only', {
      properties: { method: { const: 'GET' } },
      required: ['method'],
    });
    const data: DecomposedRequest = {
      protocol: 'https',
      domain: 'example.com',
      port: 443,
      path: '/test',
      method: 'GET',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    expect(schema.match(data)).toBe(true);
  });

  it('rejects a request that does not match', () => {
    const schema = new RequestSchema('get-only', {
      properties: { method: { const: 'GET' } },
      required: ['method'],
    });
    const data: DecomposedRequest = {
      protocol: 'https',
      domain: 'example.com',
      port: 443,
      path: '/test',
      method: 'POST',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    expect(schema.match(data)).toBe(false);
  });

  it('matches with domain pattern', () => {
    const schema = new RequestSchema('github-api', {
      properties: { domain: { const: 'api.github.com' } },
      required: ['domain'],
    });
    const data: DecomposedRequest = {
      protocol: 'https',
      domain: 'api.github.com',
      port: 443,
      path: '/repos',
      method: 'GET',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    expect(schema.match(data)).toBe(true);
  });

  it('matches with path regex pattern', () => {
    const schema = new RequestSchema('issues-path', {
      properties: {
        path: { type: 'string', pattern: '^/repos/[^/]+/[^/]+/issues(/[0-9]+)?$' },
      },
      required: ['path'],
    });
    const matching: DecomposedRequest = {
      protocol: 'https',
      domain: 'api.github.com',
      port: 443,
      path: '/repos/octocat/Hello-World/issues/42',
      method: 'GET',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    const nonMatching: DecomposedRequest = {
      ...matching,
      path: '/repos/octocat/Hello-World/pulls',
    };
    expect(schema.match(matching)).toBe(true);
    expect(schema.match(nonMatching)).toBe(false);
  });

  it('empty schema matches everything', () => {
    const schema = new RequestSchema('any', {});
    const data: DecomposedRequest = {
      protocol: 'https',
      domain: 'anything.com',
      port: 443,
      path: '/whatever',
      method: 'DELETE',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    expect(schema.match(data)).toBe(true);
  });

  it('throws RequestSchemaError for unknown request property name', () => {
    expect(
      () =>
        new RequestSchema('bad', {
          properties: { methd: { const: 'GET' } },
          required: ['methd'],
        })
    ).toThrow(RequestSchemaError);
    expect(
      () =>
        new RequestSchema('bad', {
          properties: { methd: { const: 'GET' } },
          required: ['methd'],
        })
    ).toThrow(/unknown request property "methd"/);
  });

  it('throws RequestSchemaError for unknown property name inside anyOf', () => {
    expect(
      () =>
        new RequestSchema('bad', {
          anyOf: [
            { properties: { method: { const: 'GET' } }, required: ['method'] },
            { properties: { pth: { const: '/foo' } }, required: ['pth'] },
          ],
        })
    ).toThrow(/unknown request property "pth"/);
  });

  it('accepts all valid DecomposedRequest property names', () => {
    expect(
      () =>
        new RequestSchema('all-fields', {
          properties: {
            protocol: { const: 'https' },
            domain: { const: 'example.com' },
            port: { const: 443 },
            path: { const: '/test' },
            method: { const: 'GET' },
            headers: { type: 'object' },
            queryParams: { type: 'object' },
            body: { type: 'string' },
            parsedBody: {},
            customMetadata: { type: 'object' },
          },
          required: ['protocol', 'domain', 'port', 'path', 'method', 'headers', 'queryParams'],
        })
    ).not.toThrow();
  });

  it('supports anyOf at the schema level', () => {
    const schema = new RequestSchema('read-or-search', {
      anyOf: [
        { properties: { method: { const: 'GET' } }, required: ['method'] },
        {
          properties: {
            method: { const: 'POST' },
            path: { type: 'string', pattern: '^/search$' },
          },
          required: ['method', 'path'],
        },
      ],
    });
    const getData: DecomposedRequest = {
      protocol: 'https',
      domain: 'example.com',
      port: 443,
      path: '/anything',
      method: 'GET',
      headers: {},
      queryParams: {},
      body: undefined,
    };
    const postSearchData: DecomposedRequest = {
      ...getData,
      method: 'POST',
      path: '/search',
    };
    const postOtherData: DecomposedRequest = {
      ...getData,
      method: 'POST',
      path: '/pages',
    };
    expect(schema.match(getData)).toBe(true);
    expect(schema.match(postSearchData)).toBe(true);
    expect(schema.match(postOtherData)).toBe(false);
  });
});

describe('schema composition via $defs references', () => {
  const baseRequest: DecomposedRequest = {
    protocol: 'https',
    domain: 'slack.com',
    port: 443,
    path: '/api/chat.postMessage',
    method: 'POST',
    headers: {},
    queryParams: {},
    body: undefined,
  };

  const availableSchemas = {
    'slack-api': {
      properties: { domain: { const: 'slack.com' } },
      required: ['domain'],
    },
    'alice-only': {
      allOf: [{ $ref: '#/$defs/slack-api' }],
      properties: {
        customMetadata: {
          type: 'object',
          properties: { account: { const: 'alice' } },
          required: ['account'],
        },
      },
      required: ['customMetadata'],
    },
  };

  it('composes a referenced schema with additional constraints', () => {
    const schema = new RequestSchema(
      'slack-with-account',
      {
        allOf: [
          { $ref: '#/$defs/slack-api' },
          {
            properties: {
              customMetadata: {
                type: 'object',
                properties: { account: { type: 'string', minLength: 1 } },
                required: ['account'],
              },
            },
            required: ['customMetadata'],
          },
        ],
      },
      availableSchemas
    );

    expect(schema.match({ ...baseRequest, customMetadata: { account: 'alice' } })).toBe(true);
    expect(schema.match(baseRequest)).toBe(false);
    expect(
      schema.match({ ...baseRequest, domain: 'example.com', customMetadata: { account: 'alice' } })
    ).toBe(false);
  });

  it('resolves references transitively', () => {
    const schema = new RequestSchema(
      'composed',
      { allOf: [{ $ref: '#/$defs/alice-only' }] },
      availableSchemas
    );

    expect(schema.match({ ...baseRequest, customMetadata: { account: 'alice' } })).toBe(true);
    expect(schema.match({ ...baseRequest, customMetadata: { account: 'bob' } })).toBe(false);
    expect(schema.match({ ...baseRequest, domain: 'example.com' })).toBe(false);
  });

  it('supports pointers into a referenced schema', () => {
    const schema = new RequestSchema(
      'domain-only',
      { properties: { domain: { $ref: '#/$defs/slack-api/properties/domain' } } },
      availableSchemas
    );

    expect(schema.match(baseRequest)).toBe(true);
    expect(schema.match({ ...baseRequest, domain: 'example.com' })).toBe(false);
  });

  it('lets inline $defs shadow named schemas', () => {
    const schema = new RequestSchema(
      'shadowing',
      {
        allOf: [{ $ref: '#/$defs/slack-api' }],
        $defs: {
          'slack-api': { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        },
      },
      availableSchemas
    );

    expect(schema.match(baseRequest)).toBe(false);
    expect(schema.match({ ...baseRequest, domain: 'example.com' })).toBe(true);
  });

  it('throws RequestSchemaError for a reference to an unknown schema', () => {
    expect(
      () => new RequestSchema('bad', { allOf: [{ $ref: '#/$defs/nope' }] }, availableSchemas)
    ).toThrow(/references unknown schema "#\/\$defs\/nope"/);
  });

  it('resolves references between schemas in a registry', () => {
    const registry = new SchemaRegistry(availableSchemas);
    const schema = registry.get('alice-only')!;

    expect(schema.match({ ...baseRequest, customMetadata: { account: 'alice' } })).toBe(true);
    expect(
      schema.match({
        ...baseRequest,
        domain: 'example.com',
        customMetadata: { account: 'alice' },
      })
    ).toBe(false);
  });
});

describe('Config', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(config: object): string {
    const configPath = join(tempDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config));
    return configPath;
  }

  it('rejects all requests when no rules are defined', async () => {
    const configPath = writeConfig({ schemas: {}, rules: [] });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('allows a request that matches a rule scope and permission', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://api.github.com/repos');
    expect(await config.check(request)).toBe(true);
  });

  it('rejects a request that matches scope but not any permission', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://api.github.com/repos', { method: 'DELETE' });
    expect(await config.check(request)).toBe(false);
  });

  it('rejects a request that does not match any rule scope', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://slack.com/api/chat.postMessage');
    expect(await config.check(request)).toBe(false);
  });

  it('stops at first matching scope rule', async () => {
    const configPath = writeConfig({
      schemas: {
        'all-https': { properties: { protocol: { const: 'https' } }, required: ['protocol'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        'any-method': {},
      },
      rules: [{ 'all-https': ['get-only'] }, { 'all-https': ['any-method'] }],
    });
    const config = new Config(configPath, true);
    // POST should be rejected by first rule, second rule never evaluated
    const request = new Request('https://example.com', { method: 'POST' });
    expect(await config.check(request)).toBe(false);
  });

  it('throws ConfigError when permissions value is a string instead of an array', () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': 'get-only' }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('treats missing schemas as implicitly empty', async () => {
    const configPath = writeConfig({
      rules: [],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('treats missing rules as implicitly empty', async () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
    });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('treats completely empty object as valid config', async () => {
    const configPath = writeConfig({});
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('throws ConfigError for unknown top-level keys', () => {
    const configPath = writeConfig({
      schemas: {},
      rules: [],
      unknown: 'value',
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when rules is not an array', () => {
    const configPath = writeConfig({
      rules: 'not-an-array',
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when schemas is not an object', () => {
    const configPath = writeConfig({
      schemas: 'not-an-object',
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when include contains non-strings', () => {
    const configPath = writeConfig({
      include: [42],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when config is an array instead of an object', () => {
    const configPath = join(tempDir, 'config.json');
    writeFileSync(configPath, JSON.stringify([1, 2, 3]));
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('validates included config files as well', () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(includedPath, JSON.stringify({ rules: 'not-an-array' }));

    const configPath = writeConfig({
      include: ['included.json'],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when a schema is not an object', () => {
    const configPath = writeConfig({
      schemas: {
        'bad-schema': 'not-an-object',
      },
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('treats missing schemas and rules in included files as implicitly empty', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(includedPath, JSON.stringify({}));

    const configPath = writeConfig({
      include: ['included.json'],
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: ['permission'] }],
    });

    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(true);
  });

  it('treats missing config file as implicitly empty and rejects all requests', async () => {
    const config = new Config('/nonexistent/path.json', true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('throws ConfigError for invalid JSON', () => {
    const configPath = join(tempDir, 'bad.json');
    writeFileSync(configPath, 'not json');
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('skips a rule whose scope schema name is unknown instead of throwing', () => {
    const configPath = writeConfig({
      schemas: {},
      rules: [{ 'unknown-scope': ['also-unknown'] }],
    });
    const config = new Config(configPath, true);
    // The rule is dropped, so the request falls through to the default deny.
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/Unknown schema "unknown-scope" used as scope/);
  });

  it('skips an unknown permission schema name instead of throwing', () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
      },
      rules: [{ 'github-api': ['nonexistent-permission'] }],
    });
    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(
      /Unknown schema "nonexistent-permission" used as a permission/
    );
  });

  it('throws ConfigError for rule with multiple keys', () => {
    const configPath = writeConfig({
      schemas: {
        a: { properties: { method: { const: 'GET' } }, required: ['method'] },
        b: { properties: { method: { const: 'POST' } }, required: ['method'] },
      },
      rules: [{ a: ['b'], b: ['a'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('supports multiple permissions in a single rule', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        'post-only': { properties: { method: { const: 'POST' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['get-only', 'post-only'] }],
    });
    const config = new Config(configPath, true);

    const getRequest = new Request('https://api.github.com/repos');
    expect(await config.check(getRequest)).toBe(true);

    const postRequest = new Request('https://api.github.com/repos', { method: 'POST' });
    expect(await config.check(postRequest)).toBe(true);

    const deleteRequest = new Request('https://api.github.com/repos', { method: 'DELETE' });
    expect(await config.check(deleteRequest)).toBe(false);
  });

  it('merges schemas and rules from included config files', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        schemas: {
          'slack-api': { properties: { domain: { const: 'slack.com' } }, required: ['domain'] },
          'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
        rules: [{ 'slack-api': ['get-only'] }],
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });

    const config = new Config(configPath, true);

    // Included rule allows GET to slack
    const slackGet = new Request('https://slack.com/api/conversations.list');
    expect(await config.check(slackGet)).toBe(true);

    // Parent rule allows GET to github using schema from included config
    const githubGet = new Request('https://api.github.com/repos');
    expect(await config.check(githubGet)).toBe(true);

    // POST to slack is rejected by the included rule
    const slackPost = new Request('https://slack.com/api/chat.postMessage', { method: 'POST' });
    expect(await config.check(slackPost)).toBe(false);
  });

  it('parent schemas override included schemas with the same name', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        schemas: {
          scope: { properties: { domain: { const: 'included.com' } }, required: ['domain'] },
          permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      schemas: {
        scope: { properties: { domain: { const: 'parent.com' } }, required: ['domain'] },
      },
      rules: [{ scope: ['permission'] }],
    });

    const config = new Config(configPath, true);

    // Parent overrides the scope schema, so parent.com matches
    const parentRequest = new Request('https://parent.com/test');
    expect(await config.check(parentRequest)).toBe(true);

    // included.com no longer matches scope because parent overrode it
    const includedRequest = new Request('https://included.com/test');
    expect(await config.check(includedRequest)).toBe(false);
  });

  it('included rules come before parent rules in evaluation order', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        schemas: {
          'all-https': {
            properties: { protocol: { const: 'https' } },
            required: ['protocol'],
          },
          'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
        rules: [{ 'all-https': ['get-only'] }],
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      schemas: {
        'any-method': {},
      },
      // This rule would allow everything, but it's appended after included rules
      rules: [{ 'all-https': ['any-method'] }],
    });

    const config = new Config(configPath, true);

    // The included rule matches first and only allows GET
    const postRequest = new Request('https://example.com', { method: 'POST' });
    expect(await config.check(postRequest)).toBe(false);
  });

  it('resolves includes recursively', async () => {
    const deepIncludedPath = join(tempDir, 'deep.json');
    writeFileSync(
      deepIncludedPath,
      JSON.stringify({
        schemas: {
          'deep-schema': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
      })
    );

    const middlePath = join(tempDir, 'middle.json');
    writeFileSync(
      middlePath,
      JSON.stringify({
        include: ['deep.json'],
        schemas: {
          'middle-scope': {
            properties: { domain: { const: 'example.com' } },
            required: ['domain'],
          },
        },
        rules: [{ 'middle-scope': ['deep-schema'] }],
      })
    );

    const configPath = writeConfig({
      include: ['middle.json'],
    });

    const config = new Config(configPath, true);

    const getRequest = new Request('https://example.com/test');
    expect(await config.check(getRequest)).toBe(true);

    const postRequest = new Request('https://example.com/test', { method: 'POST' });
    expect(await config.check(postRequest)).toBe(false);
  });

  it('throws ConfigError on circular includes', () => {
    const aPath = join(tempDir, 'a.json');
    const bPath = join(tempDir, 'b.json');

    writeFileSync(aPath, JSON.stringify({ include: ['b.json'] }));
    writeFileSync(bPath, JSON.stringify({ include: ['a.json'] }));

    expect(() => new Config(aPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when a config includes itself', () => {
    const configPath = writeConfig({ include: ['config.json'] });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('resolves relative include paths from the directory of the including config', async () => {
    const subDir = join(tempDir, 'sub');
    mkdirSync(subDir, { recursive: true });

    const subIncludedPath = join(subDir, 'sub-included.json');
    writeFileSync(
      subIncludedPath,
      JSON.stringify({
        schemas: {
          'sub-permission': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
      })
    );

    const middlePath = join(subDir, 'middle.json');
    writeFileSync(
      middlePath,
      JSON.stringify({
        include: ['sub-included.json'],
        schemas: {
          'sub-scope': {
            properties: { domain: { const: 'example.com' } },
            required: ['domain'],
          },
        },
        rules: [{ 'sub-scope': ['sub-permission'] }],
      })
    );

    const configPath = writeConfig({
      include: ['sub/middle.json'],
    });

    const config = new Config(configPath, true);

    const getRequest = new Request('https://example.com/test');
    expect(await config.check(getRequest)).toBe(true);
  });

  it('merges schemas and rules from multiple includes in order', async () => {
    const firstPath = join(tempDir, 'first.json');
    writeFileSync(
      firstPath,
      JSON.stringify({
        schemas: {
          'first-scope': { properties: { domain: { const: 'first.com' } }, required: ['domain'] },
          'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
        rules: [{ 'first-scope': ['get-only'] }],
      })
    );

    const secondPath = join(tempDir, 'second.json');
    writeFileSync(
      secondPath,
      JSON.stringify({
        schemas: {
          'second-scope': {
            properties: { domain: { const: 'second.com' } },
            required: ['domain'],
          },
          'post-only': { properties: { method: { const: 'POST' } }, required: ['method'] },
        },
        rules: [{ 'second-scope': ['post-only'] }],
      })
    );

    const configPath = writeConfig({
      include: ['first.json', 'second.json'],
    });

    const config = new Config(configPath, true);

    const firstGet = new Request('https://first.com/test');
    expect(await config.check(firstGet)).toBe(true);

    const secondPost = new Request('https://second.com/test', { method: 'POST' });
    expect(await config.check(secondPost)).toBe(true);

    const firstPost = new Request('https://first.com/test', { method: 'POST' });
    expect(await config.check(firstPost)).toBe(false);
  });

  it('accepts legacy "patterns" key as backwards-compatible alias for "schemas"', async () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://api.github.com/repos');
    expect(await config.check(request)).toBe(true);
  });

  it('merges legacy "patterns" and "schemas" keys, with "schemas" taking precedence', async () => {
    const configPath = writeConfig({
      patterns: {
        scope: { properties: { domain: { const: 'old.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      schemas: {
        scope: { properties: { domain: { const: 'new.com' } }, required: ['domain'] },
      },
      rules: [{ scope: ['permission'] }],
    });
    const config = new Config(configPath, true);

    // "schemas" overrides "patterns" for "scope"
    const newRequest = new Request('https://new.com/test');
    expect(await config.check(newRequest)).toBe(true);

    const oldRequest = new Request('https://old.com/test');
    expect(await config.check(oldRequest)).toBe(false);

    // "permission" came from "patterns" and still works
    const postRequest = new Request('https://new.com/test', { method: 'POST' });
    expect(await config.check(postRequest)).toBe(false);
  });

  it('lets a user schema compose a built-in schema via $defs', async () => {
    const configPath = writeConfig({
      schemas: {
        'slack-for-alice': {
          allOf: [
            { $ref: '#/$defs/slack-api' },
            {
              properties: {
                customMetadata: {
                  type: 'object',
                  properties: { account: { const: 'alice' } },
                  required: ['account'],
                },
              },
              required: ['customMetadata'],
            },
          ],
        },
      },
      rules: [{ 'slack-for-alice': ['any'] }],
    });
    const config = new Config(configPath, false);

    const slackRequest = new Request('https://slack.com/api/chat.postMessage', { method: 'POST' });
    expect(await config.check(slackRequest, { account: 'alice' })).toBe(true);
    expect(await config.check(slackRequest, { account: 'bob' })).toBe(false);
    expect(await config.check(new Request('https://example.com'), { account: 'alice' })).toBe(
      false
    );
  });

  it('throws when a schema references an unknown schema', () => {
    const configPath = writeConfig({
      schemas: {
        broken: { allOf: [{ $ref: '#/$defs/does-not-exist' }] },
      },
      rules: [{ broken: ['broken'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(RequestSchemaError);
  });
});

describe('Config unknown-schema handling (soft skip)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(config: object): string {
    const configPath = join(tempDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config));
    return configPath;
  }

  it('does not throw when a rule scope name is a typo, and other rules still work', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [
        // A typo'd scope name that doesn't match any schema.
        { 'github-apy': ['get-only'] },
        { 'github-api': ['get-only'] },
      ],
    });

    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/Unknown schema "github-apy" used as scope/);

    // The second, valid rule still grants access.
    const request = new Request('https://api.github.com/repos');
    expect(await config.check(request)).toBe(true);
  });

  it('skips an unknown permission but keeps a valid one in the same rule', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': ['typo-permission', 'get-only'] }],
    });

    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/Unknown schema "typo-permission" used as a permission/);

    // The valid "get-only" permission still allows the GET request.
    expect(await config.check(new Request('https://api.github.com/repos'))).toBe(true);
    // A non-GET request is rejected because the only surviving permission is "get-only".
    expect(
      await config.check(new Request('https://api.github.com/repos', { method: 'DELETE' }))
    ).toBe(false);
  });

  it('rejects (rather than throwing) when every permission in a rule is unknown', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
      },
      rules: [{ 'github-api': ['typo-one', 'typo-two'] }],
    });

    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(2);

    // Scope matches but no permission survives, so the rule rejects.
    expect(await config.check(new Request('https://api.github.com/repos'))).toBe(false);
  });

  it('skips unknown schemas in the object-form "schemas" list but keeps valid ones', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': { schemas: ['typo-schema', 'get-only'], hooks: [] } }],
    });

    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/Unknown schema "typo-schema" used in schemas/);

    expect(await config.check(new Request('https://api.github.com/repos'))).toBe(true);
  });

  it('still runs hooks for an object-form rule even if some schemas are unknown', async () => {
    const hookPath = join(tempDir, 'always-allow.sh');
    writeFileSync(hookPath, '#!/bin/sh\nexit 0\n');
    chmodSync(hookPath, 0o755);

    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
      },
      rules: [{ 'github-api': { schemas: ['typo-schema'], hooks: [hookPath] } }],
    });

    const config = new Config(configPath, true);
    expect(config.warnings).toHaveLength(1);

    // The hook approves the request even though the (only) schema was unknown and skipped.
    expect(await config.check(new Request('https://api.github.com/repos'))).toBe(true);
  });

  it('constructing a config with unknown schema names never throws', () => {
    const configPath = writeConfig({
      schemas: {},
      rules: [
        { 'unknown-scope': ['unknown-permission'] },
        { 'also-unknown': { schemas: ['nope'], hooks: [] } },
      ],
    });

    expect(() => new Config(configPath, true)).not.toThrow();
  });
});

describe('check (top-level function)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses config from provided path', async () => {
    const configPath = join(tempDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        schemas: {
          everything: {},
          'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
        },
        rules: [{ everything: ['get-only'] }],
      })
    );
    const request = new Request('https://example.com');
    expect(await check(request, configPath)).toBe(true);

    const postRequest = new Request('https://example.com', { method: 'POST' });
    expect(await check(postRequest, configPath)).toBe(false);
  });

  it('uses builtin schemas by default', async () => {
    const configPath = join(tempDir, 'config.json');
    // Use a builtin schema name in a rule; it should resolve when useBuiltinSchemas is true (default).
    writeFileSync(
      configPath,
      JSON.stringify({
        schemas: {
          'github-rest-api': {
            properties: { domain: { const: 'api.github.com' } },
            required: ['domain'],
          },
        },
        rules: [{ 'github-rest-api': ['any'] }],
      })
    );
    const request = new Request('https://api.github.com/repos');
    // "any" is a builtin schema; it resolves because useBuiltinSchemas defaults to true.
    expect(await check(request, configPath)).toBe(true);
  });

  it('excludes builtin schemas when useBuiltinSchemas is false', async () => {
    const configPath = join(tempDir, 'config.json');
    // Reference the builtin "any" schema; it should not resolve when useBuiltinSchemas is false.
    writeFileSync(
      configPath,
      JSON.stringify({
        schemas: {
          scope: {
            properties: { domain: { const: 'example.com' } },
            required: ['domain'],
          },
        },
        rules: [{ scope: ['any'] }],
      })
    );
    // With builtins disabled, "any" is an unknown schema name. It is now
    // skipped (rather than throwing), leaving the rule with no matching
    // permission, so the request is rejected instead of erroring.
    await expect(check(new Request('https://example.com'), configPath, false)).resolves.toBe(false);
  });
});

describe('customMetadata', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeMetadataConfig(): string {
    const configPath = join(tempDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        schemas: {
          scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
          'alice-only': {
            properties: {
              customMetadata: {
                type: 'object',
                properties: { actor: { const: 'alice' } },
                required: ['actor'],
              },
            },
            required: ['customMetadata'],
          },
        },
        rules: [{ scope: ['alice-only'] }],
      })
    );
    return configPath;
  }

  it('is absent from the decomposed request when not provided', async () => {
    const data = await decomposeRequest(new Request('https://example.com'));
    expect(data.customMetadata).toBeUndefined();
    expect(Object.hasOwn(data, 'customMetadata')).toBe(false);
  });

  it('is included in the decomposed request when provided', async () => {
    const data = await decomposeRequest(new Request('https://example.com'), {
      actor: 'alice',
      nested: { attempt: 3 },
    });
    expect(data.customMetadata).toEqual({ actor: 'alice', nested: { attempt: 3 } });
  });

  it('can be matched by request schemas', () => {
    const schema = new RequestSchema('alice-only', {
      properties: {
        customMetadata: {
          type: 'object',
          properties: { actor: { const: 'alice' } },
          required: ['actor'],
        },
      },
      required: ['customMetadata'],
    });

    const base: DecomposedRequest = {
      protocol: 'https',
      domain: 'example.com',
      port: 443,
      path: '/',
      method: 'GET',
      headers: {},
      queryParams: {},
      body: undefined,
    };

    expect(schema.match({ ...base, customMetadata: { actor: 'alice' } })).toBe(true);
    expect(schema.match({ ...base, customMetadata: { actor: 'bob' } })).toBe(false);
    expect(schema.match(base)).toBe(false);
  });

  it('is honored by Config.check', async () => {
    const config = new Config(writeMetadataConfig(), true);
    const request = new Request('https://example.com');

    expect(await config.check(request, { actor: 'alice' })).toBe(true);
    expect(await config.check(request, { actor: 'bob' })).toBe(false);
    expect(await config.check(request)).toBe(false);
  });

  it('is honored by the top-level check', async () => {
    const configPath = writeMetadataConfig();
    const request = new Request('https://example.com');

    expect(await check(request, configPath, true, { actor: 'alice' })).toBe(true);
    expect(await check(request, configPath, true, { actor: 'bob' })).toBe(false);
    expect(await check(request, configPath)).toBe(false);
  });

  it('defaults to the DETENT_CUSTOM_METADATA environment variable', async () => {
    const configPath = writeMetadataConfig();
    const request = new Request('https://example.com');
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const previous = process.env['DETENT_CUSTOM_METADATA'];
    try {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_CUSTOM_METADATA'] = JSON.stringify({ actor: 'alice' });
      expect(await check(request, configPath)).toBe(true);

      // Explicitly passed metadata takes precedence over the environment.
      expect(await check(request, configPath, true, { actor: 'bob' })).toBe(false);

      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_CUSTOM_METADATA'] = '{not json}';
      await expect(check(request, configPath)).rejects.toThrow(CustomMetadataError);

      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_CUSTOM_METADATA'] = '["alice"]';
      await expect(check(request, configPath)).rejects.toThrow(/must be a JSON object/);
    } finally {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      if (previous === undefined) delete process.env['DETENT_CUSTOM_METADATA'];
      // eslint-disable-next-line @typescript-eslint/dot-notation
      else process.env['DETENT_CUSTOM_METADATA'] = previous;
    }
  });
});
