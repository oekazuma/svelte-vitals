#!/usr/bin/env node
// Requires a build (`pnpm --filter svelte-vitals... build`, run by the `gen:cli-reference` npm
// script below) — see gunshi/registry.ts's own doc comment for why the arg schemas are read from
// dist rather than imported as TypeScript source.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_ARGS, INSTALL_ARGS, JA_ARG_DESCRIPTIONS } from '../dist/gunshi-registry.js';
import { renderTable, replaceBlock } from './cli-reference.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');

// The ja page's table is sourced from the ja arg-description resources (`gunshi/locales/ja.ts`,
// via the `JA_ARG_DESCRIPTIONS` re-export in `gunshi/registry.ts`) — a ja key missing for a given
// flag falls back to the English description (same as `--help` itself), never a blank cell.
const TARGETS = [
  { file: join(docsRoot, 'guides', '(setup)', 'cli.md'), block: renderTable(ROOT_ARGS) },
  {
    file: join(docsRoot, 'ja', 'guides', '(setup)', 'cli.md'),
    block: renderTable(ROOT_ARGS, JA_ARG_DESCRIPTIONS.root)
  },
  { file: join(docsRoot, 'guides', '(setup)', 'install.md'), block: renderTable(INSTALL_ARGS) },
  {
    file: join(docsRoot, 'ja', 'guides', '(setup)', 'install.md'),
    block: renderTable(INSTALL_ARGS, JA_ARG_DESCRIPTIONS.install)
  }
];

for (const { file, block } of TARGETS) {
  writeFileSync(file, replaceBlock(readFileSync(file, 'utf8'), block));
  console.log(`Updated ${relative(repoRoot, file)}`);
}
console.log('\nNow run `pnpm format`.');
