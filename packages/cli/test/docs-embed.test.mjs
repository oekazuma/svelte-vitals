import { describe, it, expect } from 'vitest';
import { allRules } from '@svelte-vitals/core';
import { parseTopic, readTopics } from '../scripts/docs-embed.mjs';
import { EMBEDDED_DOCS } from '../src/docs/generated.js';

const REGENERATE = 'run `pnpm --filter svelte-vitals run gen:docs && pnpm format`';

const topics = readTopics();

describe('docs: the embedded topics are up to date', () => {
  it('the committed module carries the same topics as packages/cli/docs/*.md', () => {
    // By content, not rendered text: oxfmt reformats the module after the generator writes it.
    expect(EMBEDDED_DOCS, REGENERATE).toEqual(topics);
  });

  it('every topic has a body', () => {
    // Not the description: `parseTopic` already throws on a blank one, so that could never fail.
    for (const t of topics) {
      expect(t.body.length, `${t.name} body`).toBeGreaterThan(0);
    }
  });
});

describe('docs: the frontmatter contract is enforced, not assumed', () => {
  const valid = '---\ntitle: T\ndescription: D\n---\n\nbody\n';

  it('accepts exactly title + description', () => {
    expect(parseTopic('x.md', valid)).toEqual({ name: 'x', title: 'T', description: 'D', body: 'body' });
  });

  it('rejects an unknown key instead of dropping it', () => {
    expect(() => parseTopic('x.md', '---\ntitle: T\ndescription: D\nsidebar: 3\n---\n\nbody\n')).toThrow(
      /unknown frontmatter key `sidebar`/
    );
  });

  it('rejects a duplicate key', () => {
    expect(() => parseTopic('x.md', '---\ntitle: T\ntitle: U\ndescription: D\n---\n\nbody\n')).toThrow(
      /duplicate frontmatter key `title`/
    );
  });

  it('rejects an empty value', () => {
    expect(() => parseTopic('x.md', '---\ntitle: T\ndescription:\n---\n\nbody\n')).toThrow(/`description` is empty/);
  });

  it('rejects a quoted value, which the sibling rules-index reader would have unquoted', () => {
    expect(() => parseTopic('x.md', "---\ntitle: T\ndescription: 'D'\n---\n\nbody\n")).toThrow(
      /`description` must not be quoted/
    );
  });

  it('rejects a missing key and a missing block', () => {
    expect(() => parseTopic('x.md', '---\ntitle: T\n---\n\nbody\n')).toThrow(/has no `description`/);
    expect(() => parseTopic('x.md', '# no frontmatter\n')).toThrow(/missing --- frontmatter block/);
  });
});

describe('docs: the embedded topics do not rot', () => {
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
    for (const t of topics) {
      for (const [, id] of t.body.matchAll(/`((?:seo|performance|correctness|security|architecture)\/[a-z-]+)`/g)) {
        expect(ruleIds, `${t.name} quotes rule id '${id}'`).toContain(id);
      }
    }
  });
});
