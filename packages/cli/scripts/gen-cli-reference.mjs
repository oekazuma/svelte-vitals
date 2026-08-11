#!/usr/bin/env node
// Requires a build (`pnpm --filter svelte-vitals... build`, run by the `gen:cli-reference` npm
// script below) — see gunshi/registry.ts's own doc comment for why the arg schemas are read from
// dist rather than imported as TypeScript source.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_ARGS, INSTALL_ARGS } from '../dist/gunshi-registry.js';
import { renderTable, replaceBlock } from './cli-reference.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');

// The ja page embeds this SAME English-generated block (flag names/descriptions are English in
// the declarations today); surrounding ja prose stays hand-written. Regenerates from ja resources
// once i18n adoption (gunshi migration design doc, item 2) lands.
const TARGETS = [
  { file: join(docsRoot, 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  { file: join(docsRoot, 'ja', 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  { file: join(docsRoot, 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) },
  { file: join(docsRoot, 'ja', 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) }
];

for (const { file, block } of TARGETS) {
  writeFileSync(file, replaceBlock(readFileSync(file, 'utf8'), block));
  console.log(`Updated ${relative(repoRoot, file)}`);
}
console.log('\nNow run `pnpm format`.');
