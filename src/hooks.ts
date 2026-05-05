import { spawn } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve as resolvePath, sep, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { DecomposedRequest } from './decomposedRequest.js';

export class HookExecutionError extends Error {
  readonly exitCode: number;
  readonly hookSpec: string;
  readonly ruleIndex: number;

  constructor(message: string, exitCode: number, hookSpec: string, ruleIndex: number) {
    super(message);
    this.name = 'HookExecutionError';
    this.exitCode = exitCode;
    this.hookSpec = hookSpec;
    this.ruleIndex = ruleIndex;
  }
}

export interface HookSpec {
  readonly hookString: string;
  readonly configDirectory: string;
}

export type HookOutcome = { readonly kind: 'approved' } | { readonly kind: 'rejected' };

interface HookCompletion {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly spawnError: Error | null;
}

/**
 * Resolve a hook string to the executable that should be passed to `spawn`.
 *  - Absolute paths are used as-is.
 *  - Paths containing a separator are resolved relative to the config file
 *    that defined the hook.
 *  - Bare names are returned unchanged so that the OS performs PATH lookup.
 */
function resolveHookExecutable(hookString: string, configDirectory: string): string {
  if (isAbsolute(hookString)) {
    return hookString;
  }
  if (hookString.includes('/') || (sep !== '/' && hookString.includes(sep))) {
    return resolvePath(configDirectory, hookString);
  }
  return hookString;
}

function writeRequestTempFile(decomposedRequest: DecomposedRequest): string {
  const fileName = `detent-request-${randomBytes(8).toString('hex')}.json`;
  const filePath = join(tmpdir(), fileName);
  writeFileSync(filePath, JSON.stringify(decomposedRequest), { mode: 0o600 });
  return filePath;
}

function removeTempFile(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch {
    // Best-effort cleanup; ignore ENOENT and other errors.
  }
}

function runOneHook(executable: string, requestFilePath: string): Promise<HookCompletion> {
  return new Promise((resolveCompletion) => {
    const child = spawn(executable, [requestFilePath], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    let alreadyResolved = false;
    const finalize = (completion: HookCompletion) => {
      if (alreadyResolved) return;
      alreadyResolved = true;
      resolveCompletion(completion);
    };

    child.once('error', (error: Error) => {
      finalize({ exitCode: null, signal: null, spawnError: error });
    });
    child.once('exit', (code, signal) => {
      finalize({ exitCode: code, signal, spawnError: null });
    });
  });
}

export async function runHooksAll(
  hookSpecs: readonly HookSpec[],
  decomposedRequest: DecomposedRequest,
  ruleIndex: number
): Promise<HookOutcome> {
  if (hookSpecs.length === 0) {
    return { kind: 'approved' };
  }

  const requestFilePath = writeRequestTempFile(decomposedRequest);

  try {
    for (const hookSpec of hookSpecs) {
      const executable = resolveHookExecutable(hookSpec.hookString, hookSpec.configDirectory);
      const completion = await runOneHook(executable, requestFilePath);

      if (completion.spawnError !== null) {
        throw new HookExecutionError(
          `Hook "${hookSpec.hookString}" in rule at index ${String(ruleIndex)} ` +
            `failed to spawn (${completion.spawnError.message})`,
          2,
          hookSpec.hookString,
          ruleIndex
        );
      }

      if (completion.exitCode === null) {
        // Killed by an external signal (we never signal hooks ourselves in
        // sequential mode). Treat as an error.
        throw new HookExecutionError(
          `Hook "${hookSpec.hookString}" in rule at index ${String(ruleIndex)} ` +
            `was terminated by signal ${String(completion.signal)}`,
          2,
          hookSpec.hookString,
          ruleIndex
        );
      }

      if (completion.exitCode === 0) {
        continue;
      }

      if (completion.exitCode === 1) {
        return { kind: 'rejected' };
      }

      // exit code >= 2 => error; subsequent hooks are not evaluated.
      throw new HookExecutionError(
        `Hook "${hookSpec.hookString}" in rule at index ${String(ruleIndex)} ` +
          `exited with code ${String(completion.exitCode)}`,
        completion.exitCode,
        hookSpec.hookString,
        ruleIndex
      );
    }

    return { kind: 'approved' };
  } finally {
    removeTempFile(requestFilePath);
  }
}
