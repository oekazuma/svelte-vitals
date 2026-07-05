import { describe, it, expect } from 'vitest';
import type { Runtime } from '../src/runtime.js';
import { collectComponentFacts, emptyComponentFacts } from '../src/component-collect.js';

/** Minimal in-memory Runtime for tests (design §8) — no real filesystem needed. */
function createMemoryRuntime(files: Record<string, string>, unreadable: Set<string> = new Set()): Runtime {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path) {
      if (unreadable.has(path)) throw new Error(`EACCES: ${path}`);
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async exists(path) {
      return map.has(path);
    },
    async glob() {
      return [...map.keys()].filter((key) => key.endsWith('.svelte'));
    },
    join(...parts) {
      return parts.filter((p) => p.length > 0).join('/');
    }
  };
}

describe('emptyComponentFacts', () => {
  it('returns the empty-facts shape for the given file', () => {
    expect(emptyComponentFacts('src/lib/Broken.svelte')).toEqual({
      file: 'src/lib/Broken.svelte',
      eachBlocks: [],
      effects: [],
      htmlTags: [],
      javascriptUrls: [],
      loc: 0,
      propCount: 0,
      imports: [],
      namespaceImports: [],
      constableStates: [],
      suppressions: []
    });
  });
});

describe('collectComponentFacts', () => {
  it('parses a well-formed file into real facts', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': '{#each xs as x}<i>{x}</i>{/each}'
    });
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toHaveLength(1);
    expect(facts[0]!.file).toBe('src/routes/+page.svelte');
    expect(facts[0]!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });

  it('falls back to emptyComponentFacts when readFile rejects', async () => {
    const rt = createMemoryRuntime(
      { 'src/lib/Unreadable.svelte': '<div></div>' },
      new Set(['src/lib/Unreadable.svelte'])
    );
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toEqual([emptyComponentFacts('src/lib/Unreadable.svelte')]);
  });

  it('sorts results by file path regardless of glob order', async () => {
    const rt: Runtime = {
      async readFile(path) {
        return `<!-- ${path} -->`;
      },
      async exists() {
        return true;
      },
      async glob() {
        return ['src/routes/z.svelte', 'src/lib/a.svelte', 'src/lib/m.svelte'];
      },
      join(...parts) {
        return parts.filter((p) => p.length > 0).join('/');
      }
    };
    const facts = await collectComponentFacts(rt, '');
    expect(facts.map((f) => f.file)).toEqual(['src/lib/a.svelte', 'src/lib/m.svelte', 'src/routes/z.svelte']);
  });
});
