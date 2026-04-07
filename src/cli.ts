#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { parseCurlArgs } from './curl.js';
import { check } from './check.js';
import { dump } from './dump.js';
import { resolveConfigPath } from './environment.js';

// Use createRequire instead of JSON import to avoid experimental warnings in some Node versions.
// The path is ../../ because this runs from dist/src/cli.js after compilation.
const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

const EXIT_CODE_ALLOWED = 0;
const EXIT_CODE_DENIED = 1;
const EXIT_CODE_ERROR = 2;

// eslint-disable-next-line @typescript-eslint/dot-notation
const configPathOverride = process.env['DETENT_CONFIG'];

const program = new Command();

const defaultConfigPath = resolveConfigPath();

program
  .name('detent')
  .description(
    `Check HTTP requests against permission rules. Returns 0 if allowed, 1 if denied, 2+ on error.`
  )
  .version(packageJson.version)
  .addHelpText(
    'after',
    `
Environment variables:
  DETENT_CONFIG                        Path to config file (default: ${defaultConfigPath})
  DETENT_DO_NOT_USE_BUILTIN_PATTERNS   When set to any non-empty value, disables built-in patterns`
  );

program
  .command('curl')
  .description('Check a curl-style HTTP request against permission rules')
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (_options: unknown, command: Command) => {
    try {
      const curlArgs = command.args as readonly string[];
      const request = parseCurlArgs(curlArgs);
      const allowed = await check(request, configPathOverride);
      process.exitCode = allowed ? EXIT_CODE_ALLOWED : EXIT_CODE_DENIED;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      }
      process.exitCode = EXIT_CODE_ERROR;
    }
  });

program
  .command('dump')
  .description('Print the effective config with all patterns (including built-in) as JSON')
  .action(() => {
    try {
      const effectiveConfig = dump(configPathOverride);
      console.log(JSON.stringify(effectiveConfig, null, 2));
      process.exitCode = EXIT_CODE_ALLOWED;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      }
      process.exitCode = EXIT_CODE_ERROR;
    }
  });

program.parse();
