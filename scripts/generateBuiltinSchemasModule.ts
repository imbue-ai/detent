/**
 * Generates src/schemas/generatedBuiltinSchemas.ts from the JSON files in
 * src/schemas/builtin/.
 *
 * The generated module statically embeds every built-in schema as a literal
 * object so that bundlers (bun compile, esbuild, webpack, ...) include the
 * schemas in their output without having to follow runtime readFileSync calls.
 *
 * Run with: npx tsx scripts/generateBuiltinSchemasModule.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const builtinDirectory = join(projectRoot, 'src', 'schemas', 'builtin');
const outputPath = join(projectRoot, 'src', 'schemas', 'generatedBuiltinSchemas.ts');

const entries = readdirSync(builtinDirectory, { recursive: true, encoding: 'utf-8' })
  .filter((entry) => entry.endsWith('.json'))
  .sort();

const merged: Record<string, unknown> = {};
for (const entry of entries) {
  const filePath = join(builtinDirectory, entry);
  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  for (const [name, schema] of Object.entries(parsed)) {
    if (name in merged) {
      throw new Error(
        `Duplicate built-in schema name "${name}" while processing ${filePath}.`
      );
    }
    merged[name] = schema;
  }
}

const header = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate with: npm run generate:builtin-schemas
//
// Sourced from src/schemas/builtin/*.json.

export const generatedBuiltinSchemas: Readonly<Record<string, Record<string, unknown>>> =
`;

const body = JSON.stringify(merged, null, 2);
writeFileSync(outputPath, `${header}${body} as const;\n`);

console.log(
  `Wrote ${Object.keys(merged).length} built-in schemas from ${entries.length} file(s) to ${outputPath}`
);
