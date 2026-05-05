import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, chmodSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Config, ConfigError } from '../src/config.js';
import { HookExecutionError } from '../src/hooks.js';
import { dump } from '../src/dump.js';

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `detent-hooks-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeConfig(config: object, fileName = 'config.json'): string {
  const configPath = join(tempDir, fileName);
  writeFileSync(configPath, JSON.stringify(config));
  return configPath;
}

/** Write an executable shell script under tempDir and return its absolute path. */
function writeHookScript(name: string, body: string): string {
  const scriptPath = join(tempDir, name);
  writeFileSync(scriptPath, `#!/bin/sh\n${body}\n`);
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

describe('rule object form: config validation', () => {
  it('accepts the object form with schemas only', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['permission'] } }],
    });
    expect(() => new Config(configPath, true)).not.toThrow();
  });

  it('accepts the object form with hooks only', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: ['/usr/bin/true'] } }],
    });
    expect(() => new Config(configPath, true)).not.toThrow();
  });

  it('accepts the object form with both schemas and hooks', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['permission'], hooks: ['/usr/bin/true'] } }],
    });
    expect(() => new Config(configPath, true)).not.toThrow();
  });

  it('accepts an explicit empty hooks as no constraint', async () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['permission'], hooks: [] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });

  it('accepts an explicit empty schemas as no constraint', async () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { schemas: [], hooks: ['/usr/bin/true'] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });

  it('rejects an empty object body (neither schemas nor hooks present)', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: {} }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('rejects unknown extra keys in the object body', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['permission'], unexpected: ['x'] } }],
    });
    expect(() => new Config(configPath, true)).toThrow(ConfigError);
  });

  it('rejects unknown schema names in schemas', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { schemas: ['nonexistent'] } }],
    });
    expect(() => new Config(configPath, true)).toThrow(/Unknown schema/);
  });

  it('does not validate hook executable existence at config load', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: ['/no/such/hook'] } }],
    });
    expect(() => new Config(configPath, true)).not.toThrow();
  });
});

describe('rule object form: schemas semantics', () => {
  it('approves when schemas matches', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': { properties: { domain: { const: 'api.github.com' } }, required: ['domain'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': { schemas: ['get-only'] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://api.github.com/repos'))).toBe(true);
  });

  it('rejects when schemas does not match', async () => {
    const configPath = writeConfig({
      schemas: {
        'github-api': { properties: { domain: { const: 'api.github.com' } }, required: ['domain'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ 'github-api': { schemas: ['get-only'] } }],
    });
    const config = new Config(configPath, true);
    expect(
      await config.check(new Request('https://api.github.com/repos', { method: 'DELETE' }))
    ).toBe(false);
  });
});

describe('rule object form: hooks semantics', () => {
  it('approves when a single hook exits 0', async () => {
    const okHook = writeHookScript('ok.sh', 'exit 0');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [okHook] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });

  it('rejects when a single hook exits 1', async () => {
    const denyHook = writeHookScript('deny.sh', 'exit 1');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [denyHook] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });

  it('throws HookExecutionError when a hook exits 2', async () => {
    const errorHook = writeHookScript('err.sh', 'exit 2');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [errorHook] } }],
    });
    const config = new Config(configPath, true);
    await expect(config.check(new Request('https://example.com'))).rejects.toThrow(
      HookExecutionError
    );
  });

  it('HookExecutionError carries the offending hook spec, exit code and rule index', async () => {
    const errorHook = writeHookScript('err.sh', 'exit 7');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [errorHook] } }],
    });
    const config = new Config(configPath, true);
    try {
      await config.check(new Request('https://example.com'));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HookExecutionError);
      const hookError = error as HookExecutionError;
      expect(hookError.exitCode).toBe(7);
      expect(hookError.hookSpec).toBe(errorHook);
      expect(hookError.ruleIndex).toBe(0);
    }
  });

  it('throws HookExecutionError when a hook executable cannot be spawned', async () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: ['/no/such/hook-executable'] } }],
    });
    const config = new Config(configPath, true);
    await expect(config.check(new Request('https://example.com'))).rejects.toThrow(
      HookExecutionError
    );
  });

  it('approves when all of multiple hooks exit 0', async () => {
    const a = writeHookScript('a.sh', 'exit 0');
    const b = writeHookScript('b.sh', 'exit 0');
    const c = writeHookScript('c.sh', 'exit 0');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [a, b, c] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });

  it('rejects when at least one of multiple hooks exits 1', async () => {
    const a = writeHookScript('a.sh', 'exit 0');
    const b = writeHookScript('b.sh', 'exit 1');
    const c = writeHookScript('c.sh', 'exit 0');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [a, b, c] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });

  it('stops at the first hook that returns 1 and reports rejection', async () => {
    const ok = writeHookScript('ok.sh', 'exit 0');
    const reject = writeHookScript('reject.sh', 'exit 1');
    // The third hook would error, but it must not run because the second
    // one already short-circuited with rejection.
    const wouldError = writeHookScript('would-error.sh', 'exit 9');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [ok, reject, wouldError] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });

  it('stops at the first hook that returns 2+ and surfaces it as an error', async () => {
    const ok = writeHookScript('ok.sh', 'exit 0');
    const errorer = writeHookScript('err.sh', 'exit 5');
    const wouldReject = writeHookScript('would-reject.sh', 'exit 1');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [ok, errorer, wouldReject] } }],
    });
    const config = new Config(configPath, true);
    try {
      await config.check(new Request('https://example.com'));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HookExecutionError);
      expect((error as HookExecutionError).exitCode).toBe(5);
    }
  });

  it('runs hooks in array order: an earlier rejection prevents a later error from being seen', async () => {
    // The rejecter is listed first, so it short-circuits before the
    // errorer would be reached. This documents the sequential-evaluation
    // contract.
    const reject = writeHookScript('reject.sh', 'exit 1');
    const errorer = writeHookScript('err.sh', 'exit 9');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [reject, errorer] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });

  it('does not start hooks listed after a rejecting hook', async () => {
    // If the second hook were started, it would create this marker file.
    // The test asserts the marker is absent because sequential evaluation
    // short-circuits on the first non-zero exit.
    const markerFile = join(tempDir, 'second-ran.marker');
    const reject = writeHookScript('reject.sh', 'exit 1');
    const second = writeHookScript('second.sh', `: > "${markerFile}"\nexit 0`);
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [reject, second] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
    expect(readdirSync(tempDir)).not.toContain('second-ran.marker');
  });
});

describe('rule object form: hooks input contract', () => {
  it('passes the decomposed request as JSON via the temp-file argument', async () => {
    // The hook writes its argument's contents next to itself for inspection.
    const captureFile = join(tempDir, 'captured.json');
    const captureHook = writeHookScript('capture.sh', `cat "$1" > "${captureFile}"\nexit 0`);
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [captureHook] } }],
    });
    const config = new Config(configPath, true);
    const request = new Request('https://example.com:8443/path?x=1', {
      method: 'POST',
      headers: { 'X-Test': 'value' },
      body: '{"a":1}',
    });
    await config.check(request);

    const captured = JSON.parse(readFileSync(captureFile, 'utf-8')) as Record<string, unknown>;
    expect(captured).toMatchObject({
      protocol: 'https',
      domain: 'example.com',
      port: 8443,
      path: '/path',
      method: 'POST',
      queryParams: { x: '1' },
      body: '{"a":1}',
    });
    expect(captured.headers).toMatchObject({ 'x-test': 'value' });
  });

  it('removes the temp request file after the hooks finish', async () => {
    const okHook = writeHookScript('ok.sh', 'exit 0');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: [okHook] } }],
    });
    const config = new Config(configPath, true);

    const before = readdirSync(tmpdir()).filter((name) => name.startsWith('detent-request-'));
    await config.check(new Request('https://example.com'));
    const after = readdirSync(tmpdir()).filter((name) => name.startsWith('detent-request-'));

    expect(after.length).toBeLessThanOrEqual(before.length);
  });
});

describe('rule object form: schemas + hooks (AND)', () => {
  it('rejects when schemas fails (and does not run hooks)', async () => {
    // The hook would have exited non-zero anyway, but more importantly we
    // assert that schema mismatch causes rejection without triggering a
    // hook-error.
    const errorHook = writeHookScript('err.sh', 'exit 9');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['get-only'], hooks: [errorHook] } }],
    });
    const config = new Config(configPath, true);
    // POST does not match schemas → rule rejects, hook is skipped, no throw.
    expect(await config.check(new Request('https://example.com', { method: 'POST' }))).toBe(false);
  });

  it('rejects when schemas matches but a hook returns 1', async () => {
    const denyHook = writeHookScript('deny.sh', 'exit 1');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['get-only'], hooks: [denyHook] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });

  it('approves when schemas matches and all hooks return 0', async () => {
    const okHook = writeHookScript('ok.sh', 'exit 0');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        'get-only': { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [{ scope: { schemas: ['get-only'], hooks: [okHook] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });
});

describe('rule object form: first-match-wins still applies', () => {
  it('does not evaluate later rules even when this rule rejects via hooks', async () => {
    const denyHook = writeHookScript('deny.sh', 'exit 1');
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        'allow-all': {},
      },
      rules: [
        { scope: { hooks: [denyHook] } },
        // This second rule would allow the request, but it should not be reached.
        { scope: ['allow-all'] },
      ],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(false);
  });
});

describe('rule object form: hook path resolution', () => {
  it('resolves hook paths relative to the config file that defined the rule', async () => {
    const subDirectory = join(tempDir, 'sub');
    mkdirSync(subDirectory, { recursive: true });

    // Hook lives next to the included config.
    const includedScriptPath = join(subDirectory, 'ok.sh');
    writeFileSync(includedScriptPath, '#!/bin/sh\nexit 0\n');
    chmodSync(includedScriptPath, 0o755);

    const includedConfigPath = join(subDirectory, 'included.json');
    writeFileSync(
      includedConfigPath,
      JSON.stringify({
        schemas: {
          scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        },
        // Relative path: must resolve from subDirectory, not the parent config.
        rules: [{ scope: { hooks: ['./ok.sh'] } }],
      })
    );

    const configPath = writeConfig({
      include: ['sub/included.json'],
    });

    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });

  it('resolves bare names via $PATH', async () => {
    // /usr/bin/true (or /bin/true) is found via PATH on POSIX systems.
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
      },
      rules: [{ scope: { hooks: ['true'] } }],
    });
    const config = new Config(configPath, true);
    expect(await config.check(new Request('https://example.com'))).toBe(true);
  });
});

describe('rule object form: dump round-trips verbatim', () => {
  it('preserves the object form in dump output', () => {
    const configPath = writeConfig({
      schemas: {
        scope: { properties: { domain: { const: 'example.com' } }, required: ['domain'] },
        permission: { properties: { method: { const: 'GET' } }, required: ['method'] },
      },
      rules: [
        { scope: ['permission'] },
        { scope: { schemas: ['permission'], hooks: ['/path/to/hook'] } },
      ],
    });
    const result = dump(configPath);
    expect(result.rules).toEqual([
      { scope: ['permission'] },
      { scope: { schemas: ['permission'], hooks: ['/path/to/hook'] } },
    ]);
  });
});
