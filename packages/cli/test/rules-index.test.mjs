import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from '@svelte-vitals/core';
import { allRules } from '@svelte-vitals/core/internal';
import { LOCALES, extractBlock, localeDir, normalizeBlock, parseRuleIds, renderAll } from '../scripts/rules-index.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const docsRoot = join(repoRoot, 'docs', 'src', 'content', 'docs');
const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`';

describe('docs: rule index pages are up to date', () => {
  // Filter to categories that have at least one rule documented (exclude empty categories in development)
  const documentedCategories = CATEGORIES.filter((cat) => allRules.some((rule) => rule.category === cat));
  const blocks = renderAll(docsRoot, documentedCategories, allRules);

  for (const [file, block] of blocks) {
    it(`matches the generator: ${relative(docsRoot, file)}`, () => {
      const committed = extractBlock(readFileSync(file, 'utf8'));
      expect(normalizeBlock(committed), REGENERATE).toBe(normalizeBlock(block));
    });
  }

  for (const locale of LOCALES) {
    it(`lists every rule exactly once across all category pages combined (${locale})`, () => {
      const dir = localeDir(docsRoot, locale);
      const listed = documentedCategories.flatMap((category) =>
        parseRuleIds(extractBlock(readFileSync(join(dir, category, 'index.mdx'), 'utf8')))
      );
      expect(listed.slice().sort(), REGENERATE).toEqual(allRules.map((rule) => rule.id).sort());
    });
  }
});
