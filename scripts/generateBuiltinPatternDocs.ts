/**
 * Generates docs/builtin-patterns.md from the JSON files in src/patterns/builtin/.
 *
 * Run with: npx tsx scripts/generateBuiltinPatternDocs.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const builtinDirectory = join(projectRoot, 'src', 'patterns', 'builtin');
const outputPath = join(projectRoot, 'docs', 'builtin-patterns.md');

interface PatternSchema {
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

function isScopePattern(schema: PatternSchema): boolean {
  const required = schema.required ?? [];
  const properties = schema.properties ?? {};
  return required.includes('domain') && !('method' in properties);
}

// AWS service-specific patterns (aws-s3, aws-ec2, …) only match on domain,
// so they look like scopes structurally, but they double as permissions
// inside an "aws" scope rule (e.g. {"aws": ["aws-s3"]}).  Only the
// top-level "aws" pattern is unambiguously a scope.
const awsScopePatterns: ReadonlySet<string> = new Set(['aws']);

function shouldMarkAsScope(patternName: string, schema: PatternSchema, fileName: string): boolean {
  if (fileName === 'aws.json') {
    return awsScopePatterns.has(patternName);
  }
  return isScopePattern(schema);
}

function generateMarkdown(): string {
  const files = readdirSync(builtinDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort();

  const sections: string[] = [];

  for (const file of files) {
    const filePath = join(builtinDirectory, file);
    const content = readFileSync(filePath, 'utf-8');
    const patterns = JSON.parse(content) as Record<string, PatternSchema>;
    const sectionName = basename(file, '.json');

    const lines: string[] = [];
    lines.push(`### ${sectionName}`);
    lines.push('');

    for (const patternName of Object.keys(patterns)) {
      const schema = patterns[patternName]!;
      const suffix = shouldMarkAsScope(patternName, schema, file) ? ' *(scope)*' : '';
      lines.push(`- \`${patternName}\`${suffix}`);
    }

    sections.push(lines.join('\n'));
  }

  const header = [
    '# Built-in patterns',
    '',
    'Detent ships with the following built-in request patterns.',
    'Patterns marked *(scope)* identify requests to a particular',
    'service and are meant to be used as rule keys. The remaining',
    'patterns define permissions and are meant to be used as rule values.',
    '',
    'The AWS patterns are a special case: the service-specific',
    'patterns like `aws-s3` or `aws-ec2` only match on domain, so',
    'they can serve as scopes (e.g. `{"aws-s3": ["aws-s3-read"]}`)',
    'or as permissions inside a broader `aws` scope',
    '(e.g. `{"aws": ["aws-s3"]}` to allow all S3 access).',
    '',
    'See the main [README](../README.md) for how patterns and rules work together.',
    '',
  ];

  return header.join('\n') + sections.join('\n\n') + '\n';
}

const markdown = generateMarkdown();
writeFileSync(outputPath, markdown);
console.log(`Written to ${outputPath}`);
