import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from '../src/dump.js';
import { ConfigError } from '../src/config.js';

describe('dump', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-dump-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
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

  it('returns user schemas and rules from config', () => {
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

    const result = dump(configPath);

    expect(result.schemas).toHaveProperty('github-api', {
      properties: { domain: { const: 'api.github.com' } },
      required: ['domain'],
    });
    expect(result.schemas).toHaveProperty('get-only', {
      properties: { method: { const: 'GET' } },
      required: ['method'],
    });
    // Builtin schemas are also present
    expect(result.schemas).toHaveProperty('any', {});
    expect(result.rules).toEqual([{ 'github-api': ['get-only'] }]);
  });

  it('returns builtin schemas and empty rules for minimal config', () => {
    const configPath = writeConfig({});

    const result = dump(configPath);

    expect(result.schemas).toHaveProperty('any', {});
    expect(result.rules).toEqual([]);
  });

  it('returns empty schemas and rules for missing config file', () => {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const previous = process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'];
    try {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = '1';
      const result = dump('/nonexistent/path.json');
      expect(result.schemas).toEqual({});
      expect(result.rules).toEqual([]);
    } finally {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = previous;
    }
  });

  it('throws ConfigError for invalid JSON', () => {
    const configPath = join(tempDir, 'bad.json');
    writeFileSync(configPath, 'not json');
    expect(() => dump(configPath)).toThrow(ConfigError);
  });

  it('names unknown top-level properties in error message', () => {
    const configPath = writeConfig({
      rulez: [{ 'github-api': ['github-read-issues'] }],
    });

    expect(() => dump(configPath)).toThrow(/rulez/);
  });

  it('excludes builtin schemas when DETENT_DO_NOT_USE_BUILTIN_SCHEMAS is set', () => {
    const configPath = writeConfig({
      schemas: {
        'my-schema': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [],
    });

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const previous = process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'];
    try {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = '1';
      const result = dump(configPath);
      // Only user-defined schemas should be present, no builtins
      expect(Object.keys(result.schemas)).toEqual(['my-schema']);
    } finally {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = previous;
    }
  });

  it('preserves rules as-is from the config', () => {
    const configPath = writeConfig({
      schemas: {
        scope1: { properties: { domain: { const: 'a.com' } }, required: ['domain'] },
        scope2: { properties: { domain: { const: 'b.com' } }, required: ['domain'] },
        perm1: { properties: { method: { const: 'GET' } }, required: ['method'] },
        perm2: { properties: { method: { const: 'POST' } }, required: ['method'] },
      },
      rules: [{ scope1: ['perm1'] }, { scope2: ['perm1', 'perm2'] }],
    });

    const result = dump(configPath);

    expect(result.rules).toEqual([{ scope1: ['perm1'] }, { scope2: ['perm1', 'perm2'] }]);
  });

  it('includes schemas and rules from included config files', () => {
    const includedPath = join(tempDir, 'included.json');
    writeFileSync(
      includedPath,
      JSON.stringify({
        schemas: {
          'included-scope': {
            properties: { domain: { const: 'included.com' } },
            required: ['domain'],
          },
          'included-perm': {
            properties: { method: { const: 'GET' } },
            required: ['method'],
          },
        },
        rules: [{ 'included-scope': ['included-perm'] }],
      })
    );

    const configPath = writeConfig({
      include: ['included.json'],
      schemas: {
        'own-scope': { properties: { domain: { const: 'own.com' } }, required: ['domain'] },
      },
      rules: [{ 'own-scope': ['included-perm'] }],
    });

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const previous = process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'];
    try {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = '1';
      const result = dump(configPath);

      expect(result.schemas).toHaveProperty('included-scope');
      expect(result.schemas).toHaveProperty('included-perm');
      expect(result.schemas).toHaveProperty('own-scope');
      // Included rules come first, then own rules
      expect(result.rules).toEqual([
        { 'included-scope': ['included-perm'] },
        { 'own-scope': ['included-perm'] },
      ]);
    } finally {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_SCHEMAS'] = previous;
    }
  });
});
