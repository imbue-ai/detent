#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { parseCurlArgs } from './curl.js';
import { check } from './check.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

const EXIT_CODE_ALLOWED = 0;
const EXIT_CODE_DENIED = 1;
const EXIT_CODE_ERROR = 2;

const program = new Command();

program
  .name('detent')
  .description(
    'Check HTTP requests against permission rules. Returns 0 if allowed, 1 if denied, 2+ on error.'
  )
  .version(packageJson.version);

program
  .command('curl')
  .description('Check a curl-style HTTP request against permission rules')
  .allowUnknownOption()
  .allowExcessArguments()
  .action((_options: unknown, command: Command) => {
    try {
      const curlArgs = command.args as readonly string[];
      const request = parseCurlArgs(curlArgs);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      const configPath = process.env['DETENT_CONFIG'];
      const allowed = check(request, configPath);
      process.exitCode = allowed ? EXIT_CODE_ALLOWED : EXIT_CODE_DENIED;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      }
      process.exitCode = EXIT_CODE_ERROR;
    }
  });

program.parse();
