import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from '../src/dump.js';
import { DetentConfigError } from '../src/detentConfig.js';

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

  it('returns user patterns and rules from config', () => {
    const configPath = writeConfig({
      patterns: {
        'github-api': { domain: { const: 'api.github.com' } },
        'get-only': { method: { const: 'GET' } },
      },
      rules: [{ 'github-api': ['get-only'] }],
    });

    const result = dump(configPath);

    expect(result.patterns).toHaveProperty('github-api', { domain: { const: 'api.github.com' } });
    expect(result.patterns).toHaveProperty('get-only', { method: { const: 'GET' } });
    // Builtin patterns are also present
    expect(result.patterns).toHaveProperty('any', {});
    expect(result.rules).toEqual([{ 'github-api': ['get-only'] }]);
  });

  it('returns builtin patterns and empty rules for minimal config', () => {
    const configPath = writeConfig({});

    const result = dump(configPath);

    expect(result.patterns).toHaveProperty('any', {});
    expect(result.rules).toEqual([]);
  });

  it('returns builtin patterns and empty rules for missing config file', () => {
    const result = dump('/nonexistent/path.json');
    // Built-in patterns are still included even without a config file
    expect(result.patterns).toHaveProperty('any', {});
    expect(result.rules).toEqual([]);
  });

  it('throws DetentConfigError for invalid JSON', () => {
    const configPath = join(tempDir, 'bad.json');
    writeFileSync(configPath, 'not json');
    expect(() => dump(configPath)).toThrow(DetentConfigError);
  });

  it('excludes builtin patterns when DETENT_DO_NOT_USE_BUILTIN_PATTERNS is set', () => {
    const configPath = writeConfig({
      patterns: {
        'my-pattern': { method: { const: 'GET' } },
      },
      rules: [],
    });

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const previous = process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'];
    try {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'] = '1';
      const result = dump(configPath);
      // Only user-defined patterns should be present, no builtins
      expect(Object.keys(result.patterns)).toEqual(['my-pattern']);
    } finally {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      process.env['DETENT_DO_NOT_USE_BUILTIN_PATTERNS'] = previous;
    }
  });

  it('preserves rules as-is from the config', () => {
    const configPath = writeConfig({
      patterns: {
        scope1: { domain: { const: 'a.com' } },
        scope2: { domain: { const: 'b.com' } },
        perm1: { method: { const: 'GET' } },
        perm2: { method: { const: 'POST' } },
      },
      rules: [{ scope1: ['perm1'] }, { scope2: ['perm1', 'perm2'] }],
    });

    const result = dump(configPath);

    expect(result.rules).toEqual([{ scope1: ['perm1'] }, { scope2: ['perm1', 'perm2'] }]);
  });
});
