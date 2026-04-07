import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check } from '../src/check.js';
import { DetentConfig, DetentConfigError } from '../src/detentConfig.js';
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

describe('DetentConfig', () => {
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
    const config = new DetentConfig(configPath, true);
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
    const config = new DetentConfig(configPath, true);
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
    const config = new DetentConfig(configPath, true);
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
    const config = new DetentConfig(configPath, true);
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
    const config = new DetentConfig(configPath, true);
    // POST should be rejected by first rule, second rule never evaluated
    const request = new Request('https://example.com', { method: 'POST' });
    expect(await config.check(request)).toBe(false);
  });

  it('throws DetentConfigError when permissions value is a string instead of an array', () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': 'get-only' }],
    });
    expect(() => new DetentConfig(configPath, true)).toThrow(DetentConfigError);
  });

  it('throws DetentConfigError for missing config file', () => {
    expect(() => new DetentConfig('/nonexistent/path.json', true)).toThrow(DetentConfigError);
  });

  it('throws DetentConfigError for invalid JSON', () => {
    const configPath = join(tempDir, 'bad.json');
    writeFileSync(configPath, 'not json');
    expect(() => new DetentConfig(configPath, true)).toThrow(DetentConfigError);
  });

  it('throws RequestPatternError for unknown pattern name in rule scope', () => {
    const configPath = writeConfig({
      patterns: {},
      rules: [{ 'unknown-scope': ['also-unknown'] }],
    });
    expect(() => new DetentConfig(configPath, true)).toThrow(RequestPatternError);
  });

  it('throws RequestPatternError for unknown pattern name in permissions', () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
      },
      rules: [{ 'github-api': ['nonexistent-permission'] }],
    });
    expect(() => new DetentConfig(configPath, true)).toThrow(RequestPatternError);
  });

  it('throws DetentConfigError for rule with multiple keys', () => {
    const configPath = writeConfig({
      patterns: {
        a: { method: { const: 'GET' } },
        b: { method: { const: 'POST' } },
      },
      rules: [{ a: ['b'], b: ['a'] }],
    });
    expect(() => new DetentConfig(configPath, true)).toThrow(DetentConfigError);
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
    const config = new DetentConfig(configPath, true);

    const getRequest = new Request('https://api.github.com/repos');
    expect(await config.check(getRequest)).toBe(true);

    const postRequest = new Request('https://api.github.com/repos', { method: 'POST' });
    expect(await config.check(postRequest)).toBe(true);

    const deleteRequest = new Request('https://api.github.com/repos', { method: 'DELETE' });
    expect(await config.check(deleteRequest)).toBe(false);
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
