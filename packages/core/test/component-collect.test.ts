import { describe, it, expect } from 'vitest';
import type { Runtime } from '../src/runtime.js';
import { collectComponentFacts, emptyComponentFacts } from '../src/component-collect.js';
import { withReadLimit } from '../src/runtime.js';
import { skippedFileWarnings } from '../src/component.js';

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
    async glob(pattern) {
      if (pattern === 'src/**/*.svelte{,.ts,.js}') {
        return [...map.keys()].filter((k) => /\.svelte(\.(ts|js))?$/.test(k));
      }
      return [...map.keys()].filter((k) => k.endsWith('.svelte'));
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
      importSpans: [],
      namespaceImports: [],
      constableStates: [],
      mutatedProps: [],
      stalePropDerivations: [],
      rawableStates: [],
      nonreactiveBuiltinStates: [],
      basePathLinks: [],
      orphanEffects: [],
      orphanLifecycleCalls: [],
      browserGlobalRefs: [],
      checkableBindValues: [],
      moduleStateDecls: [],
      suppressions: [],
      commentLinks: []
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

  it('marks a file it could not read as readFailed, not merely parseFailed', async () => {
    // An unreadable file is an environment problem; reporting it as a parse failure is how a
    // descriptor limit once read as hundreds of broken components.
    const rt = createMemoryRuntime(
      { 'src/lib/Unreadable.svelte': '<div></div>' },
      new Set(['src/lib/Unreadable.svelte'])
    );
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toEqual([
      { ...emptyComponentFacts('src/lib/Unreadable.svelte'), parseFailed: true, readFailed: true }
    ]);
  });

  it('marks parseFailed on a failed file and leaves it unset on a healthy one', async () => {
    const rt = createMemoryRuntime(
      {
        'src/lib/Unreadable.svelte': '<div></div>',
        'src/routes/+page.svelte': '<p>ok</p>'
      },
      new Set(['src/lib/Unreadable.svelte'])
    );
    const facts = await collectComponentFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/lib/Unreadable.svelte')!.parseFailed).toBe(true);
    expect(byFile.get('src/routes/+page.svelte')!.parseFailed).toBeUndefined();
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

  it('picks up .svelte.ts/.svelte.js runes modules with orphan-$effect facts', async () => {
    const rt = createMemoryRuntime({
      'src/lib/store.svelte.ts': '$effect(() => {});',
      'src/lib/legacy.svelte.js': '$effect(() => {});'
    });
    const facts = await collectComponentFacts(rt, '');
    expect(facts.map((f) => f.file)).toEqual(['src/lib/legacy.svelte.js', 'src/lib/store.svelte.ts']);
    expect(facts[0]!.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
    expect(facts[1]!.orphanEffects).toEqual([{ line: 1, kind: 'top-level' }]);
  });

  it('parses a module source containing a literal "</script>" string (neutralised wrap)', async () => {
    const rt = createMemoryRuntime({ 'src/lib/tricky.svelte.ts': 'const s = "</' + 'script>";\n$effect(() => {});' });
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toHaveLength(1);
    expect(facts[0]!.orphanEffects).toEqual([{ line: 2, kind: 'top-level' }]);
  });

  it('does not fall back to empty facts for a component with an argument-less $state() (issue #424)', async () => {
    const rt = createMemoryRuntime({
      'src/lib/Dialog.svelte': '<script>\n  let el = $state();\n</script>\n<dialog bind:this={el}></dialog>'
    });
    const facts = await collectComponentFacts(rt, '');
    expect(facts).toHaveLength(1);
    expect(facts[0]).not.toEqual(emptyComponentFacts('src/lib/Dialog.svelte'));
    expect(facts[0]!.loc).toBe(4);
  });
});

describe('withReadLimit', () => {
  it('never lets more than the limit run at once, and still resolves every read', async () => {
    let active = 0;
    let peak = 0;
    const read = withReadLimit(async (path: string) => {
      active++;
      peak = Math.max(peak, active);
      // A few microtask turns — core's tsconfig has no timers, and the semaphore only needs
      // the read to actually suspend for the overlap to be observable.
      for (let i = 0; i < 3; i++) await Promise.resolve();
      active--;
      return path;
    }, 4);
    const paths = Array.from({ length: 40 }, (_, i) => `f${i}`);
    expect(await Promise.all(paths.map(read))).toEqual(paths);
    expect(peak).toBe(4);
  });

  it('releases its slot when a read rejects, so the queue cannot deadlock', async () => {
    const read = withReadLimit(async (path: string) => {
      if (path === 'bad') throw new Error('EACCES');
      return path;
    }, 1);
    await expect(read('bad')).rejects.toThrow('EACCES');
    await expect(read('good')).resolves.toBe('good');
  });
});

describe('skippedFileWarnings', () => {
  it('separates unreadable files from unparseable ones', () => {
    const out = skippedFileWarnings([
      { file: 'a.svelte', parseFailed: true, readFailed: true },
      { file: 'b.svelte', parseFailed: true },
      { file: 'c.svelte' }
    ]);
    expect(out[0]).toContain('1 file(s) that could not be read: a.svelte');
    expect(out[1]).toContain('ulimit -n');
    expect(out[2]).toContain('1 file(s) that could not be parsed: b.svelte');
    expect(out.join(' ')).not.toContain('c.svelte');
  });

  it('says nothing when every file was read and parsed', () => {
    expect(skippedFileWarnings([{ file: 'a.svelte' }])).toEqual([]);
  });
});
