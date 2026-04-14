/**
 * Generates docs/builtin-schemas.md from the JSON files in src/schemas/builtin/.
 *
 * Run with: npx tsx scripts/generateBuiltinSchemaDocs.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const builtinDirectory = join(projectRoot, 'src', 'schemas', 'builtin');
const outputPath = join(projectRoot, 'docs', 'builtin-schemas.md');

interface SchemaDefinition {
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

function isScopeSchema(schema: SchemaDefinition): boolean {
  const required = schema.required ?? [];
  const properties = schema.properties ?? {};
  return required.includes('domain') && !('method' in properties);
}

// AWS service-specific schemas (aws-s3, aws-ec2, …) only match on domain,
// so they look like scopes structurally, but they double as permissions
// inside an "aws" scope rule (e.g. {"aws": ["aws-s3"]}).  Only the
// top-level "aws" schema is unambiguously a scope.
const awsScopeSchemas: ReadonlySet<string> = new Set(['aws']);

function shouldMarkAsScope(schemaName: string, schema: SchemaDefinition, fileName: string): boolean {
  if (fileName === 'aws.json') {
    return awsScopeSchemas.has(schemaName);
  }
  return isScopeSchema(schema);
}

function generateMarkdown(): string {
  const files = readdirSync(builtinDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort();

  const sections: string[] = [];

  for (const file of files) {
    const filePath = join(builtinDirectory, file);
    const content = readFileSync(filePath, 'utf-8');
    const schemas = JSON.parse(content) as Record<string, SchemaDefinition>;
    const sectionName = basename(file, '.json');

    const lines: string[] = [];
    lines.push(`### ${sectionName}`);
    lines.push('');

    for (const schemaName of Object.keys(schemas)) {
      const schema = schemas[schemaName]!;
      const suffix = shouldMarkAsScope(schemaName, schema, file) ? ' *(scope)*' : '';
      lines.push(`- \`${schemaName}\`${suffix}`);
    }

    sections.push(lines.join('\n'));
  }

  const header = [
    '# Built-in schemas',
    '',
    'Detent ships with the following preconfigured request schemas.',
    'Schemas marked *(scope)* identify requests to a particular',
    'service and are meant to be used as rule keys. The remaining',
    'schemas define permissions and are meant to be used as rule values.',
    '',
    'The AWS ones are a special case: the service-specific',
    'ones like `aws-s3` or `aws-ec2` only match on domain, so',
    'they can serve as scopes (e.g. `{"aws-s3": ["aws-s3-read"]}`)',
    'or as permissions inside a broader `aws` scope',
    '(e.g. `{"aws": ["aws-s3"]}` to allow all S3 access).',
    '',
    'See the main [README](../README.md) for how schemas and rules work together.',
    '',
  ];

  return header.join('\n') + sections.join('\n\n') + '\n';
}

const markdown = generateMarkdown();
writeFileSync(outputPath, markdown);
console.log(`Written to ${outputPath}`);
