#!/usr/bin/env node
// Re-stamp blume.translations.json for English sources whose Japanese
// counterpart was updated by hand. `blume translate` would re-translate a
// stale entry with an agent instead; this records "the committed ja matches
// the current en" without touching the pages.
//
// Usage: node scripts/stamp-translation.mjs <en-source-path...>
// Paths may be absolute or relative to the repo root or docs/.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Must mirror blume's hashSource and ledger serialization exactly, or the
// stamp won't match what `blume translate --check` computes.
const hashSource = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

const docsRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const ledgerPath = resolve(docsRoot, 'blume.translations.json');
// The one non-default locale in blume.config.ts. Extend if a locale is added.
const locales = ['ja'];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/stamp-translation.mjs <en-source-path...>');
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf-8'));
for (const arg of args) {
  const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
  const sourceRel = relative(docsRoot, abs);
  if (sourceRel.startsWith('..')) {
    console.error(`Not inside docs/: ${arg}`);
    process.exit(1);
  }
  if (sourceRel.includes('/ja/')) {
    console.error(`Pass the English source, not the translation: ${arg}`);
    process.exit(1);
  }
  const hash = hashSource(readFileSync(abs, 'utf-8'));
  const entry = ledger.files[sourceRel] ?? {};
  for (const locale of locales) {
    entry[locale] = hash;
  }
  ledger.files[sourceRel] = entry;
  console.log(`stamped ${sourceRel} → ${locales.join(', ')}`);
}

const files = {};
for (const source of Object.keys(ledger.files).toSorted()) {
  const entry = ledger.files[source];
  files[source] = Object.fromEntries(
    Object.keys(entry)
      .toSorted()
      .map((l) => [l, entry[l]])
  );
}
writeFileSync(ledgerPath, `${JSON.stringify({ files, version: ledger.version }, null, 2)}\n`);
