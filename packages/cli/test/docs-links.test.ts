import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allRules, CATEGORIES } from '@svelte-vitals/core';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const enRules = join(repoRoot, 'docs', 'src', 'content', 'docs', 'rules');
const jaRules = join(repoRoot, 'docs', 'src', 'content', 'docs', 'ja', 'rules');

// Every rule links its findings to our own docs, so every category has reference pages.
const DOCUMENTED_CATEGORIES = new Set(['seo', 'performance', 'correctness', 'security', 'architecture', 'a11y']);
const documented = allRules.filter((r) => DOCUMENTED_CATEGORIES.has(r.category));

/** Recursively list every file under `dir`, as paths relative to `dir` (POSIX-style, e.g. "seo/ssr-disabled.md"). */
function listFilesRecursive(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...listFilesRecursive(abs, rel));
    else out.push(rel);
  }
  return out;
}

describe('docs: every documented rule has a reference page (en + ja)', () => {
  it('has an en page per rule id', () => {
    for (const r of documented) {
      expect(existsSync(join(enRules, `${r.id}.md`)), `${r.id} en page`).toBe(true);
    }
  });
  it('has a ja page per rule id', () => {
    for (const r of documented) {
      expect(existsSync(join(jaRules, `${r.id}.md`)), `${r.id} ja page`).toBe(true);
    }
  });
  it('has no stray rule pages without a matching rule', () => {
    const ids = new Set(documented.map((r) => `${r.id}.md`));
    // Generated index pages and sidebar metadata live alongside the rule pages, at exactly
    // these paths — anything else must be a real `<rule id>.md` page.
    const allowed = new Set<string>(['index.mdx']);
    for (const category of CATEGORIES) {
      allowed.add(`${category}/index.mdx`);
      allowed.add(`${category}/meta.ts`);
    }
    for (const dir of [enRules, jaRules])
      for (const f of listFilesRecursive(dir)) {
        if (allowed.has(f)) continue;
        expect(ids.has(f), `stray ${f} in ${dir}`).toBe(true);
      }
  });
});
