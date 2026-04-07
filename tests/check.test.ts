import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check } from '../src/check.js';
import { Config, ConfigError } from '../src/config.js';
import { RequestPattern, RequestPatternError } from '../src/requestPattern.js';
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
    const request = new Request('https://example.com/api', { method: 'patch' });
    // Confirm the Request object didn't uppercase it
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

describe('RequestPattern', () => {
  it('matches a request with const method', () => {
    const pattern = new RequestPattern('get-only', {
      method: { const: 'GET' },
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
    expect(pattern.match(data)).toBe(true);
  });

  it('rejects a request that does not match', () => {
    const pattern = new RequestPattern('get-only', {
      method: { const: 'GET' },
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
    expect(pattern.match(data)).toBe(false);
  });

  it('matches with domain pattern', () => {
    const pattern = new RequestPattern('github-api', {
      domain: { const: 'api.github.com' },
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
    expect(pattern.match(data)).toBe(true);
  });

  it('matches with path regex pattern', () => {
    const pattern = new RequestPattern('issues-path', {
      path: { type: 'string', pattern: '^/repos/[^/]+/[^/]+/issues(/[0-9]+)?$' },
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
    expect(pattern.match(matching)).toBe(true);
    expect(pattern.match(nonMatching)).toBe(false);
  });

  it('empty schema matches everything', () => {
    const pattern = new RequestPattern('any', {});
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
    expect(pattern.match(data)).toBe(true);
  });

  it('throws RequestPatternError for invalid schema', () => {
    expect(() => new RequestPattern('bad', { method: { type: 'invalid-type' } })).toThrow(
      RequestPatternError
    );
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
    const configPath = writeConfig({ patterns: {}, rules: [] });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('allows a request that matches a rule scope and permission', async () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://api.github.com/repos');
    expect(await config.check(request)).toBe(true);
  });

  it('rejects a request that matches scope but not any permission', async () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://api.github.com/repos', { method: 'DELETE' });
    expect(await config.check(request)).toBe(false);
  });

  it('rejects a request that does not match any rule scope', async () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://slack.com/api/chat.postMessage');
    expect(await config.check(request)).toBe(false);
  });

  it('stops at first matching scope rule', async () => {
    const configPath = writeConfig({
      patterns: {
        'all-https': { protocol: { const: 'https' } },
        'get-only': { method: { const: 'GET' } },
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
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': 'get-only' }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('treats missing patterns as implicitly empty', async () => {
    const configPath = writeConfig({
      rules: [],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com');
    expect(await config.check(request)).toBe(false);
  });

  it('treats missing rules as implicitly empty', async () => {
    const configPath = writeConfig({
      patterns: { scope: { domain: { const: 'example.com' } } },
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
      patterns: {},
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

  it('throws ConfigError when patterns is not an object', () => {
    const configPath = writeConfig({
      patterns: 'not-an-object',
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

  it('throws ConfigError when a pattern contains an unknown property name', () => {
    const configPath = writeConfig({
      patterns: {
        'bad-pattern': { methd: { const: 'GET' } },
      },
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('throws ConfigError when a pattern property value is not an object', () => {
    const configPath = writeConfig({
      patterns: {
        'bad-pattern': { method: 'GET' },
      },
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('accepts patterns using all valid DecomposedRequest fields', () => {
    const configPath = writeConfig({
      patterns: {
        'all-fields': {
          protocol: { const: 'https' },
          domain: { const: 'example.com' },
          port: { const: 443 },
          path: { const: '/test' },
          method: { const: 'GET' },
          headers: { type: 'object' },
          queryParams: { type: 'object' },
          body: { type: 'string' },
        },
      },
    });
    expect(() => new Config(configPath, true)).not.toThrow();
  });

  it('validates patterns inside included config files', () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        patterns: {
          'bad-pattern': { unknownField: { const: 'value' } },
        },
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('treats missing patterns and rules in included files as implicitly empty', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(includedPath, JSON.stringify({}));

    const configPath = writeConfig({
      include: ['included.json'],
      patterns: {
        scope: { domain: { const: 'example.com' } },
        permission: { method: { const: 'GET' } },
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

  it('throws RequestPatternError for unknown pattern name in rule scope', () => {
    const configPath = writeConfig({
      patterns: {},
      rules: [{ 'unknown-scope': ['also-unknown'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(RequestPatternError);
  });

  it('throws RequestPatternError for unknown pattern name in permissions', () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
      },
      rules: [{ 'github-api': ['nonexistent-permission'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(RequestPatternError);
  });

  it('throws ConfigError for rule with multiple keys', () => {
    const configPath = writeConfig({
      patterns: {
        a: { method: { const: 'GET' } },
        b: { method: { const: 'POST' } },
      },
      rules: [{ a: ['b'], b: ['a'] }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('supports multiple permissions in a single rule', async () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
        'post-only': { method: { const: 'POST' } },
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

  it('merges patterns and rules from included config files', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        patterns: {
          'slack-api': { domain: { const: 'slack.com' } },
          'get-only': { method: { const: 'GET' } },
        },
        rules: [{ 'slack-api': ['get-only'] }],
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });

    const config = new Config(configPath, true);

    // Included rule allows GET to slack
    const slackGet = new Request('https://slack.com/api/conversations.list');
    expect(await config.check(slackGet)).toBe(true);

    // Parent rule allows GET to github using pattern from included config
    const githubGet = new Request('https://api.github.com/repos');
    expect(await config.check(githubGet)).toBe(true);

    // POST to slack is rejected by the included rule
    const slackPost = new Request('https://slack.com/api/chat.postMessage', { method: 'POST' });
    expect(await config.check(slackPost)).toBe(false);
  });

  it('parent patterns override included patterns with the same name', async () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        patterns: {
          scope: { domain: { const: 'included.com' } },
          permission: { method: { const: 'GET' } },
        },
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      patterns: {
        scope: { domain: { const: 'parent.com' } },
      },
      rules: [{ scope: ['permission'] }],
    });

    const config = new Config(configPath, true);

    // Parent overrides the scope pattern, so parent.com matches
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
        patterns: {
          'all-https': { protocol: { const: 'https' } },
          'get-only': { method: { const: 'GET' } },
        },
        rules: [{ 'all-https': ['get-only'] }],
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      patterns: {
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
        patterns: {
          'deep-pattern': { method: { const: 'GET' } },
        },
      })
    );

    const middlePath = join(tempDir, 'middle.json');
    writeFileSync(
      middlePath,
      JSON.stringify({
        include: ['deep.json'],
        patterns: {
          'middle-scope': { domain: { const: 'example.com' } },
        },
        rules: [{ 'middle-scope': ['deep-pattern'] }],
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
        patterns: {
          'sub-permission': { method: { const: 'GET' } },
        },
      })
    );

    const middlePath = join(subDir, 'middle.json');
    writeFileSync(
      middlePath,
      JSON.stringify({
        include: ['sub-included.json'],
        patterns: {
          'sub-scope': { domain: { const: 'example.com' } },
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

  it('merges patterns and rules from multiple includes in order', async () => {
    const firstPath = join(tempDir, 'first.json');
    writeFileSync(
      firstPath,
      JSON.stringify({
        patterns: {
          'first-scope': { domain: { const: 'first.com' } },
          'get-only': { method: { const: 'GET' } },
        },
        rules: [{ 'first-scope': ['get-only'] }],
      })
    );

    const secondPath = join(tempDir, 'second.json');
    writeFileSync(
      secondPath,
      JSON.stringify({
        patterns: {
          'second-scope': { domain: { const: 'second.com' } },
          'post-only': { method: { const: 'POST' } },
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
        patterns: {
          everything: {},
          'get-only': { method: { const: 'GET' } },
        },
        rules: [{ everything: ['get-only'] }],
      })
    );
    const request = new Request('https://example.com');
    expect(await check(request, configPath)).toBe(true);

    const postRequest = new Request('https://example.com', { method: 'POST' });
    expect(await check(postRequest, configPath)).toBe(false);
  });
});
