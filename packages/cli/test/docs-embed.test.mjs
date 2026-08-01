import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core';
import { readTopics } from '../scripts/docs-embed.mjs';
import { EMBEDDED_DOCS } from '../src/docs/generated.js';

const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:docs && pnpm format`';

describe('docs: the embedded topics are up to date', () => {
  const topics = readTopics();

  it('the committed module carries the same topics as packages/cli/docs/*.md', () => {
    // Compared by content, not by rendered text: oxfmt reformats the generated module after
    // the generator writes it, so a byte comparison would fail on formatting alone.
    expect(EMBEDDED_DOCS, REGENERATE).toEqual(topics);
  });

  it('every topic has a non-empty description and body', () => {
    for (const t of topics) {
      expect(t.description.length, `${t.name} description`).toBeGreaterThan(0);
      expect(t.body.length, `${t.name} body`).toBeGreaterThan(0);
    }
  });
});

describe('docs: the embedded topics do not rot', () => {
  const topics = readTopics();
  const names = new Set(topics.map((t) => t.name));
  const ruleIds = new Set(allRules.map((r) => r.id));

  it('every `docs show <name>` cross-reference points at a topic that exists', () => {
    for (const t of topics) {
      for (const [, referenced] of t.body.matchAll(/docs show ([a-z-]+)/g)) {
        expect(names, `${t.name} references '${referenced}'`).toContain(referenced);
      }
    }
  });

  it('every rule id quoted in a topic is a real rule', () => {
    // A topic naming a renamed or deleted rule would send a reader after something that
    // no longer exists — the exact failure the bundled docs are supposed to prevent.
    for (const t of topics) {
      for (const [, id] of t.body.matchAll(/`((?:seo|performance|correctness|security|architecture)\/[a-z-]+)`/g)) {
        expect(ruleIds, `${t.name} quotes rule id '${id}'`).toContain(id);
      }
    }
  });
});
