#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSchemaOrgTypes, renderSchemaVocabModule, resolveSchemaDts } from './schema-vocab.js';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const coreDir = join(scriptsDir, '..');
const outPath = join(coreDir, 'src', 'rules', 'seo', 'schema-vocabulary.generated.ts');

const { dtsPath, version } = resolveSchemaDts();
const names = extractSchemaOrgTypes(dtsPath);

let content;
try {
  content = renderSchemaVocabModule(names, {
    generatorCommand: 'pnpm --filter @svelte-vitals/core run gen:schema-vocab',
    schemaDtsVersion: version
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
writeFileSync(outPath, content);
console.log(`Updated schema-vocabulary.generated.ts -> ${names.length} types from schema-dts@${version}`);
