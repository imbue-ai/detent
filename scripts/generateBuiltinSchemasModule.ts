/**
 * Generates src/schemas/generatedBuiltinSchemas.ts from the JSON files in
 * src/schemas/builtin/.
 *
 * The generated module statically embeds every built-in schema file as a JSON
 * string literal so that bundlers (bun compile, esbuild, webpack, ...) include the
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

const schemaNamesByService: Record<string, string> = {};
const jsonSourceByService: Record<string, string> = {};
const seenSchemaNames = new Map<string, string>();

for (const entry of entries) {
  const filePath = join(builtinDirectory, entry);
  const serviceName = entry.slice(0, -'.json'.length);
  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  for (const name of Object.keys(parsed)) {
    const previousFilePath = seenSchemaNames.get(name);
    if (previousFilePath !== undefined) {
      throw new Error(
        `Duplicate built-in schema name "${name}" in ${filePath} (already defined in ${previousFilePath}).`
      );
    }
    seenSchemaNames.set(name, filePath);
    schemaNamesByService[name] = serviceName;
  }
  jsonSourceByService[serviceName] = JSON.stringify(parsed);
}

// JSON.stringify of a string produces a valid JavaScript string literal, so the
// per-service sources are embedded as strings that are parsed lazily at runtime.
const header = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate with: npm run generate:builtin-schemas
//
// Sourced from src/schemas/builtin/*.json.
//
// Each service's schemas are embedded as a single JSON string and parsed only when
// one of its schemas is first looked up. Parsing JavaScript source is the dominant
// cost of CLI startup, and scanning a string literal is much cheaper than
// evaluating an equivalent object literal.

/** Maps every built-in schema name to the service (file name without extension) defining it. */
export const builtinSchemaServiceByName: Readonly<Record<string, string>> =
`;

const indexBody = JSON.stringify(schemaNamesByService, null, 2);
const sourcesBody = Object.entries(jsonSourceByService)
  .map(
    ([serviceName, jsonSource]) =>
      `  ${JSON.stringify(serviceName)}:\n    ${JSON.stringify(jsonSource)},`
  )
  .join('\n');

writeFileSync(
  outputPath,
  `${header}${indexBody};

/** Maps every service to the JSON source of its schema file. */
export const builtinSchemaJsonSourceByService: Readonly<Record<string, string>> = {
${sourcesBody}
};
`
);

console.log(
  `Wrote ${seenSchemaNames.size} built-in schemas from ${entries.length} file(s) to ${outputPath}`
);
