import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check } from '../src/check.js';
import { Config, ConfigError } from '../src/config.js';
import { RequestSchema, RequestSchemaError } from '../src/schemas/requestSchema.js';
import { decomposeRequest } from '../src/decomposedRequest.js';
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

  it('throws RequestSchemaError for unknown schema name in rule scope', () => {
    const configPath = writeConfig({
      schemas: {},
      rules: [{ 'unknown-scope': ['also-unknown'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(RequestSchemaError);
  });

  it('throws RequestSchemaError for unknown schema name in permissions', () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': {
          properties: { domain: { const: 'api.github.com' } },
          required: ['domain'],
        },
      },
      rules: [{ 'github-api': ['nonexistent-permission'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(RequestSchemaError);
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
    await expect(check(new Request('https://example.com'), configPath, false)).rejects.toThrow();
  });
});
