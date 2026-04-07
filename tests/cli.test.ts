import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const cliPath = new URL('../dist/src/cli.js', import.meta.url).pathname;

describe('CLI', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `detent-cli-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
    configPath = join(tempDir, 'config.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('exits 0 for a valid curl subcommand', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        patterns: { everything: {}, 'allow-all': {} },
        rules: [{ everything: ['allow-all'] }],
      })
    );
    const { stdout: _stdout } = await execFileAsync(
      'node',
      [cliPath, 'curl', 'https://example.com'],
      {
        env: { ...process.env, DETENT_CONFIG: configPath },
      }
    );
    // exit code 0 means allowed (no throw)
  });

  it('exits 0 and outputs JSON for dump subcommand', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        patterns: { everything: {}, 'allow-all': {} },
        rules: [{ everything: ['allow-all'] }],
      })
    );
    const { stdout } = await execFileAsync('node', [cliPath, 'dump'], {
      env: { ...process.env, DETENT_CONFIG: configPath },
    });
    const parsed = JSON.parse(stdout) as { patterns: object; rules: object[] };
    expect(parsed.patterns).toHaveProperty('everything');
    expect(parsed.patterns).toHaveProperty('allow-all');
    expect(parsed.rules).toEqual([{ everything: ['allow-all'] }]);
  });

  it('exits 2 for curl with no URL', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        patterns: { everything: {}, 'allow-all': {} },
        rules: [{ everything: ['allow-all'] }],
      })
    );
    try {
      await execFileAsync('node', [cliPath, 'curl'], {
        env: { ...process.env, DETENT_CONFIG: configPath },
      });
      expect.fail('Should have exited with non-zero');
    } catch (error: unknown) {
      const execError = error as { code: number };
      expect(execError.code).toBe(2);
    }
  });
});
