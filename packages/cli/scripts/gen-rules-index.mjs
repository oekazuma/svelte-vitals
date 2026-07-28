#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRules, CATEGORIES } from '@svelte-vitals/core';
import { renderAll, replaceBlock } from './rules-index.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');

for (const [file, block] of renderAll(docsRoot, CATEGORIES, allRules)) {
  writeFileSync(file, replaceBlock(readFileSync(file, 'utf8'), block));
  console.log(`Updated ${relative(repoRoot, file)}`);
}
console.log('\nNow run `pnpm format` — oxfmt aligns the generated tables.');
