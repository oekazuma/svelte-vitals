#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectHtmlSpec, renderHtmlSpecModule, resolveHtmlSpec } from './html-spec.js';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const outPath = join(scriptsDir, '..', 'src', 'html-spec', 'generated.ts');

const { jsonPath, version, license } = resolveHtmlSpec();
const data = projectHtmlSpec(JSON.parse(readFileSync(jsonPath, 'utf8')));
writeFileSync(
  outPath,
  renderHtmlSpecModule(data, {
    version,
    license,
    generatorCommand: 'pnpm --filter @svelte-vitals/core run gen:html-spec'
  })
);
console.log(
  `Updated html-spec/generated.ts -> ${Object.keys(data.elements).length} elements from @markuplint/html-spec@${version}`
);
