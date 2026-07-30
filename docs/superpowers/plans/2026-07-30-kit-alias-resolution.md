# SvelteKit alias resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve import specifiers through a project's declared `kit.alias` and `kit.files.lib` exactly
the way SvelteKit and Vite resolve them, so the rules built on `resolveRepoLocalPath` stop being blind to
any project that does not import through a literal `$lib/`.

**Architecture:** `svelte.config.{js,ts}` is already read during fact collection for `kit.paths.base`, so a
new parser derives an **ordered list** of compiled alias entries from the same source string — `$lib`
first, then `kit.alias` in declaration order — and stores it as `Project.kitAliases`. `resolveRepoLocalPath`
gains an optional third parameter taking that list and picks the **first** matching entry. The list is
threaded to the one other resolution site (`parseKitModuleFacts`, via `collectKitModuleFacts`) from both
the CLI and the Vite plugin.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, estree AST walking via the repo's
existing `component-parse`/`config-object` helpers, oxlint + oxfmt.

**Spec:** `docs/superpowers/specs/2026-07-30-kit-alias-resolution-design.md` — read it before Task 1. Every
non-obvious decision below has its rationale there, and several of them look wrong until you have.

## Global Constraints

- **Core purity:** `packages/core/src/` must contain no `node:` imports, no I/O, and no runtime-specific
  globals. All I/O goes through the injected `Runtime` interface. Every file this plan touches in
  `packages/core` is a pure module: it receives source strings, never paths to read.
- **The governing principle, verbatim from the spec:** "The resolver reproduces what the bundler does,
  mechanism included — not a cleaner scheme that usually agrees with it." When a test expectation looks
  wrong, it is reproducing `get_config_aliases` + Vite's `matches()`. Do not 'fix' it.
- **First match wins, never best match.** Position in the list is precedence. Do not sort the list, do not
  reorder it, do not prefer a longer `find`.
- **This change must add no I/O.** `packages/cli/test/io-budget.test.ts` holds the collection phase to a
  fixed number of `Runtime` calls. Those numbers must not move. Read the config sources that are already
  being read; never add a `readFile` or `exists` call.
- **`Object.hasOwn(obj, key)`** for presence checks on open-ended records — never `key in obj` or
  `obj[key] !== undefined` (prototype chain). Existing precedent: `packages/core/src/rules/perf/heavy-import.ts`.
- **A changeset is required** (`pnpm changeset`): this changes what default-on rules report.
- **en/ja docs ship together.** `docs/src/content/docs/` and `docs/src/content/docs/ja/` are updated in the
  same commit.
- **Never name other tools** (linters, plugins, competing products) in commits, PR bodies, or docs.
- **Verify commands:** `pnpm -r test`, `pnpm -r typecheck`, `pnpm lint` (`oxlint .` + `oxfmt --check .`),
  `pnpm format` to fix formatting. Run them from the repo root.
- **Conventional commits, scoped by package:** `feat(core):`, `fix(cli):`, `test(core):`, `docs:`.

## File Structure

| File                                                           | Responsibility                                                                   | Task |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---- |
| `packages/core/src/types.ts`                                   | `KitAlias` type + `Project.kitAliases` field                                     | 1    |
| `packages/core/src/kit-module-parse.ts`                        | The resolver: match an entry, substitute, normalise the path                     | 1    |
| `packages/core/src/svelte-config-parse.ts`                     | Parse `kit.alias`/`kit.files.lib` from a config source; compile the ordered list | 2    |
| `packages/core/src/index.ts`                                   | Public re-exports of the new type and functions                                  | 1, 2 |
| `packages/core/src/kit-module-collect.ts`                      | Pass the list through to the parser                                              | 3    |
| `packages/core/src/rules/architecture/private-scope-import.ts` | Pass `ctx.project.kitAliases` at rule time                                       | 3    |
| `packages/cli/src/providers/source/project.ts`                 | Derive both config facts from one pair of reads                                  | 4    |
| `packages/cli/src/collect-all.ts`                              | Hand `project.kitAliases` to the kit-module collector                            | 4    |
| `packages/vite/src/providers/rendered/project.ts`              | Same derivation, plugin channel                                                  | 4    |
| `packages/vite/src/providers/source/components.ts`             | Wrapper takes the list                                                           | 4    |
| `packages/vite/src/analyze.ts`                                 | Hand `project.kitAliases` to the wrapper                                         | 4    |
| `docs/src/content/docs/configuration.mdx` + `ja/`              | Document that aliases come from `svelte.config`                                  | 5    |

Tests live beside the code they cover: `packages/core/test/kit-module-parse.test.ts` (Task 1),
`packages/core/test/svelte-config-parse.test.ts` (Task 2), `packages/core/test/kit-module-collect.test.ts`
(Task 3), `packages/cli/test/kit-alias-e2e.test.ts` (new, Task 5).

---

### Task 1: The `KitAlias` type and the resolver

The resolver is the whole mechanism, and it is pure: it takes a list and a specifier. Building the list
from a config comes next (Task 2), so this task hand-writes lists in its tests.

**Files:**

- Modify: `packages/core/src/types.ts` (add `KitAlias` above `Project`; add the `kitAliases` field to
  `Project` beside `kitPathsBase`)
- Modify: `packages/core/src/kit-module-parse.ts:485-493` (`resolveRepoLocalPath`)
- Modify: `packages/core/src/index.ts:4-20` (export the type)
- Test: `packages/core/test/kit-module-parse.test.ts` (append a new `describe` block)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface KitAlias { find: string; replacement: string | null; match: 'prefix' | 'contents' | 'exact' }`
    in `packages/core/src/types.ts`.
  - `Project.kitAliases?: KitAlias[]`.
  - `resolveRepoLocalPath(spec: string, importerFile: string, aliases?: readonly KitAlias[]): string | undefined`
    — the third parameter defaults to `[{ find: '$lib', replacement: 'src/lib', match: 'prefix' }]`.

- [ ] **Step 1: Add the type and the `Project` field**

In `packages/core/src/types.ts`, immediately above `export interface Project {`:

```ts
/**
 * One compiled SvelteKit alias entry, in the order Kit builds them (`get_config_aliases` in
 * `@sveltejs/kit/src/exports/vite/utils.js`): `$lib` first, then `kit.alias` in declaration
 * order. Resolution takes the FIRST matching entry, exactly as Vite's alias plugin does, so
 * **position is precedence** — the list is never sorted and a longer `find` never wins on
 * length alone.
 */
export interface KitAlias {
  /** The alias key, with any trailing `/*` removed. */
  find: string;
  /**
   * The project-relative target: posixified, with any trailing `/*` and any trailing slashes
   * removed. `null` when the config's value is not a string literal — such an entry still
   * matches (holding its position and its mode) but resolves to undefined, so a specifier we
   * cannot resolve stays unresolved instead of falling through to a later entry.
   */
  replacement: string | null;
  /**
   * How `find` matches a specifier, mirroring Kit's three compiled entry shapes:
   * - `prefix` — `spec === find` or `spec.startsWith(find + '/')`; a plain key.
   * - `contents` — `spec.startsWith(find + '/')` only; from a `key/*` key, which Kit
   *   documents as matching "the contents of a directory, not the directory itself".
   * - `exact` — `spec === find` only; a plain key whose `key/*` form is ALSO declared, which
   *   is how Kit stops the plain key from swallowing the nested specifiers.
   */
  match: 'prefix' | 'contents' | 'exact';
}
```

Then inside `Project`, directly after the `kitPathsBase` field:

```ts
  /**
   * The project's compiled SvelteKit alias entries, in Kit's own order (`$lib` first), read from
   * `svelte.config.{js,ts}`. Absent means no config was read — resolution then falls back to
   * `$lib` → `src/lib`, which is what this analyzer assumed unconditionally before. A collected
   * list is never empty: `$lib` is always prepended.
   */
  kitAliases?: KitAlias[];
```

Add `KitAlias` to the `export type { … } from './types.js'` list in `packages/core/src/index.ts` (keep the
list's existing order; append after `Project`).

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts`. Add `resolveRepoLocalPath` to the existing import
from `'../src/kit-module-parse.js'`, and add `import type { KitAlias } from '../src/types.js';`.

```ts
const prefix = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'prefix' });
const contents = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'contents' });
const exact = (find: string, replacement: string | null): KitAlias => ({ find, replacement, match: 'exact' });
const LIB = prefix('$lib', 'src/lib');
const IMPORTER = 'src/routes/a/+page.server.ts';
const resolve = (spec: string, aliases?: KitAlias[]) => resolveRepoLocalPath(spec, IMPORTER, aliases);

describe('resolveRepoLocalPath — alias entries', () => {
  it('resolves a prefix entry for the bare key and for a nested specifier', () => {
    const aliases = [LIB, prefix('$a', 'src/a')];
    expect(resolve('$a', aliases)).toBe('src/a');
    expect(resolve('$a/x/y.svelte.ts', aliases)).toBe('src/a/x/y.svelte.ts');
  });

  it('a contents entry matches a nested specifier but not the bare key', () => {
    const aliases = [LIB, contents('$a', 'src/a')];
    expect(resolve('$a/x', aliases)).toBe('src/a/x');
    expect(resolve('$a', aliases)).toBeUndefined();
  });

  it('an exact entry matches the bare key but not a nested specifier', () => {
    const aliases = [LIB, exact('$a', 'src/a')];
    expect(resolve('$a', aliases)).toBe('src/a');
    expect(resolve('$a/x', aliases)).toBeUndefined();
  });

  it('takes the FIRST matching entry, not the one with the longest key', () => {
    // Kit pushes entries in declaration order and Vite's alias plugin uses entries.find(),
    // so `$a` answers `$a/b/c` and the `$a/b` entry is unreachable. A longest-key rule would
    // answer src/y/c — a different, possibly existing file.
    const aliases = [LIB, prefix('$a', 'src/x'), prefix('$a/b', 'src/y')];
    expect(resolve('$a/b/c', aliases)).toBe('src/x/b/c');
  });

  it('resolves the same pair differently when the declaration order is reversed', () => {
    const aliases = [LIB, prefix('$a/b', 'src/y'), prefix('$a', 'src/x')];
    expect(resolve('$a/b/c', aliases)).toBe('src/y/c');
  });

  it('an opaque entry blocks rather than falling through to a later entry', () => {
    // undefined is also what today's code answers for this specifier, so this pins the
    // "no worse than today" claim as well as the blocking behaviour.
    const aliases = [LIB, prefix('$a', null), prefix('$a/b', 'src/y')];
    expect(resolve('$a/b/c', aliases)).toBeUndefined();
  });

  it('does not match across a segment boundary', () => {
    expect(resolve('$libFoo/x', [LIB])).toBeUndefined();
  });

  it('returns undefined when the target escapes the project root', () => {
    expect(resolve('$out/x', [LIB, prefix('$out', '../sibling/src')])).toBeUndefined();
  });

  it('resolves a nested specifier under a value that names a file, without special-casing it', () => {
    // Kit never branches on whether the value is a file, so neither does this: the nonsense
    // path simply matches no real file downstream.
    expect(resolve('$f/x', [LIB, prefix('$f', 'src/f.js')])).toBe('src/f.js/x');
  });

  it('defaults to $lib -> src/lib when no list is passed', () => {
    expect(resolveRepoLocalPath('$lib/q.svelte.ts', IMPORTER)).toBe('src/lib/q.svelte.ts');
  });

  it('resolves a bare $lib under the default list', () => {
    // A deliberate widening: today this returns undefined. Kit's prefix mode resolves it.
    expect(resolveRepoLocalPath('$lib', IMPORTER)).toBe('src/lib');
  });

  it('resolves a relative specifier whatever the list says', () => {
    expect(resolve('../../lib/q.svelte.ts', [LIB, prefix('.', 'src/nonsense')])).toBe('src/lib/q.svelte.ts');
  });

  it('returns undefined for a bare package', () => {
    expect(resolve('drizzle-orm', [LIB, prefix('$a', 'src/a')])).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — `resolveRepoLocalPath` takes two parameters, so the alias-list cases resolve nothing
(`$a` → undefined) and the third argument is a TypeScript error.

- [ ] **Step 4: Implement the resolver**

In `packages/core/src/kit-module-parse.ts`, add to the type imports near the top:

```ts
import type { KitAlias } from './types.js';
```

Directly above `resolveRepoLocalPath` (currently line 485, after the `normalizePosix` helper):

```ts
/**
 * What `resolveRepoLocalPath` assumes when no config was read: SvelteKit's own `$lib`, at the
 * default `src/lib`. This single entry is the whole of this analyzer's pre-alias behaviour.
 */
const DEFAULT_KIT_ALIASES: readonly KitAlias[] = [{ find: '$lib', replacement: 'src/lib', match: 'prefix' }];

/**
 * Whether one compiled alias entry matches a specifier. The `prefix` arm is Vite's own
 * `matches()` — `importee === pattern || importee.startsWith(pattern + '/')` — and the `+ '/'`
 * is what keeps a `$lib` entry off `$libFoo`.
 */
function aliasMatches(entry: KitAlias, spec: string): boolean {
  if (entry.match === 'exact') return spec === entry.find;
  if (spec.startsWith(`${entry.find}/`)) return true;
  return entry.match === 'prefix' && spec === entry.find;
}
```

Then replace the body of `resolveRepoLocalPath` (lines 485-493) with:

```ts
export function resolveRepoLocalPath(
  spec: string,
  importerFile: string,
  aliases: readonly KitAlias[] = DEFAULT_KIT_ALIASES
): string | undefined {
  let path: string;
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const dir = importerFile.split('/').slice(0, -1).join('/');
    path = `${dir}/${spec}`;
  } else {
    // First match, not best match: `aliases` is ordered as Kit builds it and Vite's alias
    // plugin resolves with entries.find(), so position is precedence. An entry that matches
    // but carries no readable value stops here rather than letting a later entry answer.
    const entry = aliases.find((a) => aliasMatches(a, spec));
    if (entry?.replacement == null) return undefined;
    path = entry.replacement + spec.slice(entry.find.length);
  }
  return normalizePosix(path);
}
```

Update the doc comment above it: keep the "keep every alias mapping inside this one function" sentence,
and replace the "`$lib/` maps to `src/lib/`" clause with "the caller's `aliases` list decides which
non-relative specifiers resolve, defaulting to `$lib` → `src/lib`".

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: PASS, including the file's pre-existing tests — the default parameter must leave them untouched.

- [ ] **Step 6: Prove the segment-boundary test is load-bearing**

Temporarily change ``spec.startsWith(`${entry.find}/`)`` to `spec.startsWith(entry.find)` and re-run.
Expected: the `$libFoo` test FAILS. Restore the `/`.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm -r typecheck && pnpm lint
git add packages/core/src/types.ts packages/core/src/kit-module-parse.ts packages/core/src/index.ts packages/core/test/kit-module-parse.test.ts
git commit -m "feat(core): resolve import specifiers through an ordered alias list"
```

---

### Task 2: Parse `kit.alias` and `kit.files.lib`, and compile the list

**Files:**

- Modify: `packages/core/src/svelte-config-parse.ts` (add beside the existing `paths.base` parsing)
- Modify: `packages/core/src/index.ts:41-45` (add the two new exports to the existing
  `from './svelte-config-parse.js'` block)
- Test: `packages/core/test/svelte-config-parse.test.ts` (append two `describe` blocks)

**Interfaces:**

- Consumes: `KitAlias` from `packages/core/src/types.ts` (Task 1).
- Produces:
  - `export type RawKitAliases = { entries?: { key: string; value: string | null }[]; filesLib?: string }`
  - `export function findKitAliasesInSvelteConfig(source: string): RawKitAliases`
  - `export function resolveKitAliases(viteConfig: { source: string } | undefined, svelteConfig: { source: string } | undefined): KitAlias[] | undefined`

- [ ] **Step 1: Write the failing parser tests**

Append to `packages/core/test/svelte-config-parse.test.ts`. Extend the existing import from
`'../src/svelte-config-parse.js'` with `findKitAliasesInSvelteConfig` and `resolveKitAliases`.

```ts
describe('findKitAliasesInSvelteConfig', () => {
  const raw = (body: string) => findKitAliasesInSvelteConfig(`export default { kit: ${body} };`);

  it('reads alias entries in declaration order', () => {
    expect(raw(`{ alias: { '$b': 'src/b', '$a': 'src/a' } }`).entries).toEqual([
      { key: '$b', value: 'src/b' },
      { key: '$a', value: 'src/a' }
    ]);
  });

  it('records a non-literal value as null while its literal siblings keep theirs', () => {
    const src = [
      `import path from 'node:path';`,
      `export default { kit: { alias: { '$a': path.resolve('x'), '$b': 'src/b' } } };`
    ].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toEqual([
      { key: '$a', value: null },
      { key: '$b', value: 'src/b' }
    ]);
  });

  it('keeps a duplicate key at its first position with its last value', () => {
    // Object.entries semantics: { a: 1, b: 2, a: 3 } yields a at index 0 with value 3.
    expect(raw(`{ alias: { '$a': 'src/one', '$b': 'src/two', '$a': 'src/three' } }`).entries).toEqual([
      { key: '$a', value: 'src/three' },
      { key: '$b', value: 'src/two' }
    ]);
  });

  it('discards every entry when a spread makes the key set unknowable', () => {
    const src = [`const shared = {};`, `export default { kit: { alias: { ...shared, '$a': 'src/a' } } };`].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toBeUndefined();
  });

  it('discards every entry when a key is computed', () => {
    const src = [`const KEY = '$a';`, `export default { kit: { alias: { [KEY]: 'src/a' } } };`].join('\n');
    expect(findKitAliasesInSvelteConfig(src).entries).toBeUndefined();
  });

  it('discards every entry when alias is not an object literal', () => {
    expect(raw(`{ alias: makeAliases() }`).entries).toBeUndefined();
  });

  it('reports no alias property as no entries, not as unknowable', () => {
    expect(raw(`{ paths: { base: '/x' } }`).entries).toEqual([]);
  });

  it('reads a literal kit.files.lib', () => {
    expect(raw(`{ files: { lib: 'src/library' } }`).filesLib).toBe('src/library');
  });

  it('ignores a non-literal kit.files.lib', () => {
    expect(raw(`{ files: { lib: someDir } }`).filesLib).toBeUndefined();
  });

  it('returns empty entries for an unparseable config', () => {
    expect(findKitAliasesInSvelteConfig(`export default { kit: {`)).toEqual({ entries: [] });
  });
});

describe('resolveKitAliases', () => {
  const svelte = (body: string) => ({ source: `export default { kit: ${body} };` });
  const list = (body: string) => resolveKitAliases(undefined, svelte(body));

  it('puts $lib first, then the user entries in declaration order', () => {
    expect(list(`{ alias: { '$b': 'src/b', '$a': 'src/a' } }`)).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$b', replacement: 'src/b', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
  });

  it('lets kit.files.lib move $lib', () => {
    expect(list(`{ files: { lib: 'src/library' } }`)![0]).toEqual({
      find: '$lib',
      replacement: 'src/library',
      match: 'prefix'
    });
  });

  it('keeps files.lib ahead of a user $lib entry, which is therefore dead', () => {
    // Kit prepends its own $lib entry, and Vite takes the first match, so a user
    // kit.alias.$lib never fires.
    const l = list(`{ files: { lib: 'src/library' }, alias: { '$lib': 'src/mine' } }`)!;
    expect(l[0]).toEqual({ find: '$lib', replacement: 'src/library', match: 'prefix' });
    expect(l[1]).toEqual({ find: '$lib', replacement: 'src/mine', match: 'prefix' });
  });

  it('compiles a /* key to a contents entry with the star stripped from both sides', () => {
    expect(list(`{ alias: { '$a/*': 'src/a/*' } }`)![1]).toEqual({
      find: '$a',
      replacement: 'src/a',
      match: 'contents'
    });
  });

  it('narrows a plain key to exact when its /* form is also declared', () => {
    expect(list(`{ alias: { '$a': 'src/plain', '$a/*': 'src/star' } }`)!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/plain', match: 'exact' },
      { find: '$a', replacement: 'src/star', match: 'contents' }
    ]);
  });

  it('assigns exact from the declared key set even when the /* value is unreadable', () => {
    const src = [
      `import path from 'node:path';`,
      `export default { kit: { alias: { '$a': 'src/plain', '$a/*': path.resolve('x') } } };`
    ].join('\n');
    expect(resolveKitAliases(undefined, { source: src })!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/plain', match: 'exact' },
      { find: '$a', replacement: null, match: 'contents' }
    ]);
  });

  it('normalises a trailing slash, a backslash path, and a trailing star', () => {
    expect(list(`{ alias: { '$a': 'src/', '$b': 'src\\\\lib', '$c': 'src/c/*' } }`)!.slice(1)).toEqual([
      { find: '$a', replacement: 'src', match: 'prefix' },
      { find: '$b', replacement: 'src/lib', match: 'prefix' },
      { find: '$c', replacement: 'src/c', match: 'prefix' }
    ]);
  });

  it('normalises the $lib entry too, which Kit builds without posixify or resolve', () => {
    expect(list(`{ files: { lib: 'src/library/' } }`)![0]!.replacement).toBe('src/library');
  });

  it('keeps only $lib when the alias key set is unknowable', () => {
    const src = [`const shared = {};`, `export default { kit: { alias: { ...shared, '$a': 'src/a' } } };`].join('\n');
    expect(resolveKitAliases(undefined, { source: src })).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' }
    ]);
  });

  it('is undefined when there is no svelte config at all', () => {
    expect(resolveKitAliases(undefined, undefined)).toBeUndefined();
  });

  it('reads nothing when the Vite config carries a sveltekit() config, which makes svelte.config ignored', () => {
    const vite = {
      source: [
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `export default { plugins: [sveltekit({ alias: { '$a': 'src/a' } })] };`
      ].join('\n')
    };
    expect(resolveKitAliases(vite, svelte(`{ alias: { '$a': 'src/a' } }`))).toBeUndefined();
  });

  it('still reads svelte.config when sveltekit() takes no argument', () => {
    const vite = {
      source: [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [sveltekit()] };`].join(
        '\n'
      )
    };
    expect(resolveKitAliases(vite, svelte(`{ alias: { '$a': 'src/a' } }`))!.slice(1)).toEqual([
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- svelte-config-parse`
Expected: FAIL — `findKitAliasesInSvelteConfig` and `resolveKitAliases` do not exist.

- [ ] **Step 3: Implement the parser**

In `packages/core/src/svelte-config-parse.ts`, add `import type { KitAlias } from './types.js';` to the
imports, and add this after `basePathOf` (before `programOf`):

```ts
/** `kit.alias` and `kit.files.lib` as written, before Kit compiles them into ordered entries. */
export type RawKitAliases = {
  /**
   * `kit.alias` entries in declaration order, `value: null` where the config's value is not a
   * string literal. **Undefined means the key set is unknowable** — a spread or a computed key
   * puts an unknown key at a known position, and an unknown key could shadow anything after it,
   * with no `find` to record that with. The caller then discards every user entry.
   */
  entries?: { key: string; value: string | null }[];
  /** `kit.files.lib`, when it is a string literal. */
  filesLib?: string;
};

/** A property's key when it is a plain (non-computed) string or identifier key. */
function keyNameOf(p: Property): string | undefined {
  if (p.computed) return undefined;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'Literal' && typeof p.key.value === 'string') return p.key.value;
  return undefined;
}

/** A property's value when it is a string literal, else undefined. */
function stringValueOf(p: Property): string | undefined {
  const v = unwrapTs(p.value as Expression);
  return v.type === 'Literal' && typeof v.value === 'string' ? v.value : undefined;
}

/**
 * `kit.alias`'s entries in source order. Undefined when the key set cannot be known (see
 * `RawKitAliases.entries`); `[]` when `propOf` finds no `alias` property — which also covers the
 * case where a spread in the `kit` object could have supplied one, matching how every other
 * fact in this file treats that unknowability rather than inventing a stricter rule for alias
 * alone. Duplicate literal keys collapse the way `Object.entries` does — FIRST position, LAST
 * value — because that is the object Kit iterates.
 */
function aliasEntriesOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): RawKitAliases['entries'] {
  const alias = propOf(kitConfig, 'alias');
  if (!alias) return [];
  const obj = unwrapToObjectExpression(alias.value as Expression, bindings);
  if (!obj) return undefined;
  const out: { key: string; value: string | null }[] = [];
  const at = new Map<string, number>();
  for (const p of obj.properties) {
    if (p.type !== 'Property') return undefined; // a spread: unknown keys at a known position
    const key = keyNameOf(p);
    if (key === undefined) return undefined; // a computed key: could match, and shadow, anything
    const entry = { key, value: stringValueOf(p) ?? null };
    const seen = at.get(key);
    if (seen === undefined) {
      at.set(key, out.length);
      out.push(entry);
    } else out[seen] = entry;
  }
  return out;
}

/** `kit.files.lib` when it is a string literal. */
function filesLibOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): string | undefined {
  const files = propOf(kitConfig, 'files');
  const obj = files ? unwrapToObjectExpression(files.value as Expression, bindings) : undefined;
  const lib = obj ? propOf(obj, 'lib') : undefined;
  return lib ? stringValueOf(lib) : undefined;
}

/** `kit.alias` and `kit.files.lib` from a `svelte.config.{js,ts}` source. */
export function findKitAliasesInSvelteConfig(source: string): RawKitAliases {
  const program = programOf(source, 'svelte.config.js');
  const config = program ? resolveConfigObject(program) : undefined;
  if (!program || !config) return { entries: [] };
  const bindings = collectTopLevelBindings(program);
  const kit = propOf(config, 'kit');
  const kitObj = kit ? unwrapToObjectExpression(kit.value as Expression, bindings) : undefined;
  if (!kitObj) return { entries: [] };
  const filesLib = filesLibOf(kitObj, bindings);
  return { entries: aliasEntriesOf(kitObj, bindings), ...(filesLib !== undefined ? { filesLib } : {}) };
}

/**
 * The normalisation Kit applies to an alias value — `posixify`, then a trailing `/*` stripped —
 * plus the trailing-slash trim that Kit gets for free from `path.resolve` and this parser does
 * not (it works in project-relative strings and never resolves). Applied to the `$lib` entry
 * too, which Kit builds with neither step: `kit.files.lib` is a user-written string with the
 * same irregularities available to it.
 */
function normalizeAliasValue(value: string): string {
  const posix = value.replace(/\\/g, '/');
  const noStar = posix.endsWith('/*') ? posix.slice(0, -2) : posix;
  return noStar.replace(/\/+$/, '');
}

/**
 * Compile raw config values into Kit's ordered entry list: `$lib` first (from `kit.files.lib`,
 * else `src/lib`), then the user's entries in declaration order. Modes come from the DECLARED
 * key set — `key + '/*'` present makes the plain key exact — never from the subset whose values
 * happened to be readable.
 */
function compileKitAliases(raw: RawKitAliases): KitAlias[] {
  const out: KitAlias[] = [
    { find: '$lib', replacement: normalizeAliasValue(raw.filesLib ?? 'src/lib'), match: 'prefix' }
  ];
  const entries = raw.entries ?? [];
  const declared = new Set(entries.map((e) => e.key));
  for (const { key, value } of entries) {
    const star = key.endsWith('/*');
    out.push({
      find: star ? key.slice(0, -2) : key,
      replacement: value === null ? null : normalizeAliasValue(value),
      match: star ? 'contents' : declared.has(`${key}/*`) ? 'exact' : 'prefix'
    });
  }
  return out;
}

/**
 * The project's compiled alias list, following SvelteKit's config precedence: options passed to
 * the `sveltekit()` Vite plugin make `svelte.config` irrelevant (Kit logs "svelte.config.js is
 * ignored when options are passed via your Vite config"), so aliases are read from
 * `svelte.config` only when the Vite config carries no plugin config. Reading `kit.alias` out of
 * a plugin config is deliberately not done — that costs reach, not correctness, and such a
 * project keeps the resolver's default `$lib` behaviour. Undefined means "no config was read".
 */
export function resolveKitAliases(
  viteConfig: { source: string } | undefined,
  svelteConfig: { source: string } | undefined
): KitAlias[] | undefined {
  if (viteConfig && findKitPathsBaseInViteConfig(viteConfig.source).kind !== 'no-plugin-config') return undefined;
  if (!svelteConfig) return undefined;
  return compileKitAliases(findKitAliasesInSvelteConfig(svelteConfig.source));
}
```

`Property` must be added to the `import type { … } from 'estree'` list at the top of the file.

Add both public names to `packages/core/src/index.ts`'s existing `from './svelte-config-parse.js'` export
block, and `export type { RawKitAliases } from './svelte-config-parse.js';` beside it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- svelte-config-parse`
Expected: PASS, pre-existing `paths.base` tests included.

- [ ] **Step 5: Prove two fidelity tests are load-bearing**

Each of these mutations must break exactly one test; restore after each.

1. Change `match: star ? 'contents' : declared.has(...)` to `match: star ? 'contents' : 'prefix'`.
   Expected: the two `exact` tests FAIL.
2. Change `compileKitAliases`'s first element to be pushed **after** the loop instead of before it.
   Expected: the `$lib` ordering tests FAIL.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm -r typecheck && pnpm lint
git add packages/core/src/svelte-config-parse.ts packages/core/src/index.ts packages/core/test/svelte-config-parse.test.ts
git commit -m "feat(core): compile kit.alias and kit.files.lib into Kit's ordered entry list"
```

---

### Task 3: Thread the list to every resolution site inside core

Two sites resolve specifiers, and only one is a rule. Both must be reachable from a collected list.

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts` — `isLocalStateSpecifier` (line 527),
  `resolveRunesModuleSpecifier` (line 503), `parseKitModuleFacts` (line 538, and its two internal calls at
  lines 574 and 672)
- Modify: `packages/core/src/kit-module-collect.ts` — `collectKitModuleFacts`
- Modify: `packages/core/src/rules/architecture/private-scope-import.ts:107`
- Test: `packages/core/test/kit-module-parse.test.ts`, `packages/core/test/kit-module-collect.test.ts`

**Interfaces:**

- Consumes: `KitAlias` and the three-parameter `resolveRepoLocalPath` (Task 1).
- Produces:
  - `resolveRunesModuleSpecifier(spec: string, importerFile: string, aliases?: readonly KitAlias[]): string | undefined`
  - `parseKitModuleFacts(source: string, filename: string, aliases?: readonly KitAlias[]): Omit<KitModuleFacts, 'file' | 'kind'>`
  - `collectKitModuleFacts(rt: Runtime, cwd: string, aliases?: readonly KitAlias[]): Promise<KitModuleFacts[]>`
  - All three parameters are optional and default to today's behaviour — existing callers keep compiling.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts`:

```ts
describe('parseKitModuleFacts — alias-resolved specifiers', () => {
  const src = `import { s } from '$a/store.svelte';\ns.set(1);\n`;
  const aliases: KitAlias[] = [
    { find: '$lib', replacement: 'src/lib', match: 'prefix' },
    { find: '$a', replacement: 'src/a', match: 'prefix' }
  ];

  it('records no runes-module import for an unknown alias', () => {
    expect(parseKitModuleFacts(src, 'src/routes/+page.server.ts').runesModuleImports).toEqual([]);
  });

  it('records the import once the alias list explains the specifier', () => {
    expect(parseKitModuleFacts(src, 'src/routes/+page.server.ts', aliases).runesModuleImports).toEqual([
      { source: '$a/store.svelte', resolved: 'src/a/store.svelte.ts', names: ['s'], line: 1 }
    ]);
  });

  it('records the set-call write once the alias list explains the specifier', () => {
    const wrapped = `import { s } from '$a/store.svelte';\nexport function load() {\n  s.set(1);\n}\n`;
    expect(parseKitModuleFacts(wrapped, 'src/routes/+page.server.ts').importedStateWrites).toEqual([]);
    expect(parseKitModuleFacts(wrapped, 'src/routes/+page.server.ts', aliases).importedStateWrites).toEqual([
      { name: 's', line: 3, via: 'set-call' }
    ]);
  });
});
```

Append to `packages/core/test/kit-module-collect.test.ts` (match that file's existing runtime-stub style):

```ts
describe('collectKitModuleFacts — alias list', () => {
  it('passes the alias list through to the parser', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.server.ts': `import { s } from '$a/store.svelte';\n`
    });
    const withList = await collectKitModuleFacts(rt, '', [
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$a', replacement: 'src/a', match: 'prefix' }
    ]);
    const without = await collectKitModuleFacts(rt, '');
    expect(withList[0]!.runesModuleImports.map((i) => i.resolved)).toEqual(['src/a/store.svelte.ts']);
    expect(without[0]!.runesModuleImports).toEqual([]);
  });
});
```

If `packages/core/test/kit-module-collect.test.ts` has no memory-runtime helper, reuse the stub runtime
that file already constructs for its existing cases rather than importing across packages
(`packages/core` tests must not import from `packages/cli`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module`
Expected: FAIL — the third argument is a TypeScript error on both functions.

If the `importedStateWrites` fixture above does not produce the expected shape even with the alias list —
that fact records handler-scoped writes, and the exact conditions live in `parseKitModuleFacts` — adjust
the **fixture** to whatever shape the file's existing `importedStateWrites` tests use. Do not change
production behaviour to fit this test: its only job is to show the alias list reaching that code path.

- [ ] **Step 3: Add the parameter to the three functions**

`isLocalStateSpecifier`:

```ts
function isLocalStateSpecifier(spec: string, importerFile: string, aliases?: readonly KitAlias[]): boolean {
  const path = resolveRepoLocalPath(spec, importerFile, aliases);
  if (path === undefined) return false;
  return path !== 'src/lib/server' && !path.startsWith('src/lib/server/');
}
```

`resolveRunesModuleSpecifier`:

```ts
export function resolveRunesModuleSpecifier(
  spec: string,
  importerFile: string,
  aliases?: readonly KitAlias[]
): string | undefined {
  const path = resolveRepoLocalPath(spec, importerFile, aliases);
  // …rest unchanged
```

`parseKitModuleFacts`:

```ts
export function parseKitModuleFacts(
  source: string,
  filename: string,
  aliases?: readonly KitAlias[]
): Omit<KitModuleFacts, 'file' | 'kind'> {
```

and update its two internal call sites:

- line 574: `const resolved = resolveRunesModuleSpecifier(spec, filename, aliases);`
- line 672: `if (r && isLocalStateSpecifier(importedSpecifiers.get(r)!, filename, aliases))`

Note that passing `undefined` explicitly is safe and intended: `resolveRepoLocalPath`'s default parameter
supplies the `$lib` entry, so an uninstrumented caller behaves exactly as before.

- [ ] **Step 4: Add the parameter to the collector**

In `packages/core/src/kit-module-collect.ts`:

```ts
export async function collectKitModuleFacts(
  rt: Runtime,
  cwd: string,
  aliases?: readonly KitAlias[]
): Promise<KitModuleFacts[]> {
```

and the parse call inside becomes `parseKitModuleFacts(source, rel, aliases)`. Add
`import type { KitAlias } from './types.js';`.

Extend the function's doc comment with: "`aliases` is the project's compiled alias list
(`Project.kitAliases`); omitted, specifiers resolve through `$lib` → `src/lib` only."

- [ ] **Step 5: Pass the list at rule time**

In `packages/core/src/rules/architecture/private-scope-import.ts`, line 107:

```ts
const target = resolveRepoLocalPath(source, c.file, ctx.project.kitAliases);
```

`ctx.project` is a required field on `RuleContext`, so no optional chaining is needed; `kitAliases` being
absent falls back to the default list.

- [ ] **Step 6: Run the full core suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS. Every pre-existing test in `kit-module-parse.test.ts`, `security-kit-rules.test.ts` and the
`private-scope-import` suite must pass **unedited** — that is the proof the default reproduces today's
behaviour. If any of them needed a change, stop and report it: the default is wrong.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm -r typecheck && pnpm lint
git add packages/core/src packages/core/test
git commit -m "feat(core): thread the alias list to both specifier-resolution sites"
```

---

### Task 4: Collect the fact in both channels, with no new I/O

Both channels already read `svelte.config` and the Vite config for `kit.paths.base` and throw the sources
away. This task derives a second fact from the same reads.

**Files:**

- Modify: `packages/cli/src/providers/source/project.ts:187-212` (`detectKitPathsBase`, `collectProjectFacts`)
- Modify: `packages/cli/src/collect-all.ts:66`
- Modify: `packages/vite/src/providers/rendered/project.ts:53-69` (`collectRenderedProject`)
- Modify: `packages/vite/src/providers/source/components.ts:42-44`
- Modify: `packages/vite/src/analyze.ts:71`
- Test: `packages/cli/test/collect-all.test.ts`, `packages/cli/test/io-budget.test.ts` (assert unchanged)

**Interfaces:**

- Consumes: `resolveKitAliases` (Task 2), the three-parameter `collectKitModuleFacts` (Task 3),
  `Project.kitAliases` (Task 1).
- Produces: `Project.kitAliases` populated in both channels; nothing new for later tasks to call.

- [ ] **Step 1: Write the failing test**

Append to `packages/cli/test/collect-all.test.ts`:

```ts
describe('collectAll — kit aliases', () => {
  const TREE = {
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
    'svelte.config.js': `export default { kit: { alias: { '$data': 'src/data' } } };`,
    'src/routes/+page.svelte': `<h1>a</h1>`,
    'src/routes/+page.server.ts': `import { s } from '$data/store.svelte';\nexport function load() {\n  return {};\n}\n`
  };

  it('collects the alias list and resolves a kit-module import through it', async () => {
    const facts = await collectAll(createMemoryRuntime(TREE), '', defaultConfig);

    expect(facts.project.kitAliases).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$data', replacement: 'src/data', match: 'prefix' }
    ]);
    // The point of collecting it: the kit-module collector must have USED the list.
    expect(facts.kitModules[0]!.runesModuleImports.map((i) => i.resolved)).toEqual(['src/data/store.svelte.ts']);
  });

  it('leaves the fact absent when there is no svelte config', async () => {
    const { 'svelte.config.js': _omitted, ...rest } = TREE;
    const facts = await collectAll(createMemoryRuntime(rest), '', defaultConfig);

    expect(facts.project.kitAliases).toBeUndefined();
    expect(facts.kitModules[0]!.runesModuleImports).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter svelte-vitals test -- collect-all`
Expected: FAIL — `facts.project.kitAliases` is undefined in the first case.

- [ ] **Step 3: Derive both config facts from one pair of reads (CLI)**

In `packages/cli/src/providers/source/project.ts`, replace `detectKitPathsBase` with:

```ts
/**
 * Both facts that come out of the Kit config, from ONE pair of reads. Split into two
 * detectors, each reading the configs itself, this would double the collection phase's config
 * reads and move `packages/cli/test/io-budget.test.ts`'s numbers — which is a design decision,
 * not a number edit (AGENTS.md).
 */
async function detectKitConfigFacts(rt: Runtime, cwd: string): Promise<Pick<Project, 'kitPathsBase' | 'kitAliases'>> {
  const [viteConfig, svelteConfig] = await Promise.all([
    readFirstConfig(rt, cwd, VITE_CONFIG_FILES),
    readFirstConfig(rt, cwd, SVELTE_CONFIG_FILES)
  ]);
  const kitPathsBase = resolveKitPathsBase(viteConfig, svelteConfig);
  const kitAliases = resolveKitAliases(viteConfig, svelteConfig);
  return {
    ...(kitPathsBase ? { kitPathsBase } : {}),
    ...(kitAliases ? { kitAliases } : {})
  };
}
```

Add `resolveKitAliases` to the existing `@svelte-vitals/core` import in that file. Then in
`collectProjectFacts`, replace the `kitPathsBase` element of the `Promise.all` with `kitConfig`:

```ts
const [hasRobotsTxt, hasSitemap, htmlLang, viteMinifyDisabled, kitConfig] = await Promise.all([
  existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
  existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
  detectAppHtmlLang(rt, cwd),
  detectViteMinifyDisabled(rt, cwd),
  detectKitConfigFacts(rt, cwd)
]);
```

and replace the `...(kitPathsBase ? { kitPathsBase } : {})` line of the returned object with
`...kitConfig`.

- [ ] **Step 4: Hand the list to the kit-module collector (CLI)**

In `packages/cli/src/collect-all.ts`, line 66:

```ts
const kitModules = opts.route ? [] : await collectKitModuleFacts(rt, cwd, project.kitAliases);
```

`project` is already awaited on the line above, so no reordering is needed.

- [ ] **Step 5: Do the same in the Vite channel**

In `packages/vite/src/providers/rendered/project.ts`, `collectRenderedProject` already holds both config
objects. Add beside the existing `kitPathsBase` line:

```ts
const kitAliases = resolveKitAliases(viteConfig, svelteConfig);
```

and add `...(kitAliases ? { kitAliases } : {})` to the returned object. Import `resolveKitAliases` from
`@svelte-vitals/core`.

In `packages/vite/src/providers/source/components.ts`:

```ts
export function collectKitModuleFacts(root: string, aliases?: readonly KitAlias[]): Promise<KitModuleFacts[]> {
  return collectKit(nodeRuntime, root, aliases);
}
```

adding `type KitAlias` to the existing `@svelte-vitals/core` type import.

In `packages/vite/src/analyze.ts`, line 71:

```ts
const kitModules = await collectKitModuleFacts(cwd, project.kitAliases);
```

`project` is built on line 66, before this line — no reordering needed.

- [ ] **Step 6: Run the tests, including the I/O budget**

Run: `pnpm --filter svelte-vitals test && pnpm --filter @svelte-vitals/vite test`
Expected: PASS, and `io-budget.test.ts` passes **with its numbers untouched**. If it fails, a config read
was duplicated — fix the duplication, do not raise the budget.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm -r typecheck && pnpm lint
git add packages/cli packages/vite
git commit -m "feat(cli,vite): collect the project's alias list from the config already read"
```

---

### Task 5: End-to-end evidence, docs, changeset

Every test so far would pass over a resolver that silently never matched a real project. This task drives a
config through collection into a finding, and ships the user-facing parts.

**Files:**

- Create: `packages/cli/test/kit-alias-e2e.test.ts`
- Modify: `docs/src/content/docs/configuration.mdx`
- Modify: `docs/src/content/docs/ja/configuration.mdx`
- Create: `.changeset/<generated-name>.md`

**Interfaces:**

- Consumes: everything from Tasks 1-4.
- Produces: nothing further.

- [ ] **Step 1: Write the failing end-to-end test**

`packages/cli/test/kit-alias-e2e.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig, securitySharedStateImport } from '@svelte-vitals/core';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

/**
 * security/shared-state-import is the rule whose behaviour visibly changes: every entry in the
 * runesModuleImports fact it reads passes through specifier resolution, and its `applies` is
 * "the fact is non-empty", so before alias resolution an alias-only project made it inert.
 */
const TREE = (config: string) => ({
  'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
  'svelte.config.js': config,
  'src/routes/+page.svelte': `<h1>a</h1>`,
  'src/data/cart.svelte.ts': `export const items = $state([]);\n`,
  'src/routes/+page.server.ts': `import { items } from '$data/cart.svelte';\nexport function load() {\n  return { count: items.length };\n}\n`
});

const findings = async (config: string) => {
  const facts = await collectAll(createMemoryRuntime(TREE(config)), '', defaultConfig);
  const results = await securitySharedStateImport.check({
    heads: [],
    project: facts.project,
    components: facts.components,
    kitModules: facts.kitModules,
    config: defaultConfig
  });
  return results.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
};

describe('kit.alias resolution, end to end', () => {
  it('reports a shared-state import that arrives through a declared alias', async () => {
    const fs = await findings(`export default { kit: { alias: { '$data': 'src/data' } } };`);

    expect(fs).toHaveLength(1);
    expect(fs[0]!.route).toBe('src/routes/+page.server.ts');
    expect(fs[0]!.message).toContain('$data/cart.svelte');
  });

  it('reports nothing for the same tree when the alias is not declared', async () => {
    // The negative control: without it, a rule that fired for some unrelated reason would
    // make the assertion above pass without alias resolution existing at all.
    expect(await findings(`export default { kit: {} };`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify the first case fails before the feature and passes after**

Run: `pnpm --filter svelte-vitals test -- kit-alias-e2e`
Expected: PASS (Tasks 1-4 are in place). Then verify it is really load-bearing: `git stash` the Task 4
change to `collect-all.ts` line 66 (so the list is collected but not handed to the collector), re-run, and
confirm the first case FAILS. Restore with `git stash pop`.

- [ ] **Step 3: Document where aliases come from**

In `docs/src/content/docs/configuration.mdx`, add a short subsection near the existing SvelteKit-config
discussion:

```mdx
### Import aliases

Rules that follow imports (`architecture/private-scope-import`, `security/shared-state-import`,
`security/handler-state-write`) resolve specifiers through the aliases your project declares in
`svelte.config.js` — `kit.alias`, plus `kit.files.lib` when `$lib` has been moved. They are read
statically, in the same order SvelteKit builds them, and the first matching alias wins, exactly as it
does at build time.

Two cases are not resolved, and in both the specifier is treated as one we cannot see, so nothing is
reported for it:

- an alias whose value is computed (`path.resolve(...)`, a template literal) rather than a plain string;
- a project that passes its SvelteKit options to the `sveltekit()` plugin in `vite.config.ts` instead of
  `svelte.config.js`.
```

Add the Japanese equivalent at the matching position in `docs/src/content/docs/ja/configuration.mdx`.
Keep both in step — a doc change that lands in one language only breaks the repo's convention.

- [ ] **Step 4: Verify the docs build**

Run: `pnpm --filter docs build`
Expected: PASS. If the local `docs` install cannot run (a known workspace-install restriction), say so in
the task report rather than claiming a green build — CI's `docs` job is the gate.

- [ ] **Step 5: Add the changeset**

Run `pnpm changeset`, select `@svelte-vitals/core`, `svelte-vitals` and `@svelte-vitals/vite`, patch, and
write:

```md
Resolve import specifiers through the aliases a project declares in `svelte.config.js` (`kit.alias`, and
`kit.files.lib` when `$lib` has been moved), in SvelteKit's own order and with its first-match-wins
semantics.

Projects that import through their own aliases will see findings that were previously invisible —
`security/shared-state-import` in particular was inert for them, since every import it examines has to
resolve to a project-local path first. `$lib` now honours `kit.files.lib` instead of assuming `src/lib`.

An alias whose value is not a plain string, and a project whose SvelteKit options are passed to the
`sveltekit()` Vite plugin, are left unresolved rather than guessed at.
```

- [ ] **Step 6: Full verification and commit**

```bash
pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm build
git add packages/cli/test/kit-alias-e2e.test.ts docs .changeset
git commit -m "test(cli): drive a declared alias through collection into a finding"
```

---

## Self-Review

**Spec coverage.** Each spec section maps to a task: the governing principle and the resolver → Task 1;
three match modes, value normalisation, the opaque entry, the unreadable-key retreat, duplicate keys, and
the config-precedence guard → Task 2; the two resolution sites and the affected-rules table → Task 3; the
fact and "collection adds no I/O" → Task 4; the end-to-end test, the changeset wording and the docs note →
Task 5. The spec's eight test groups all appear: groups 1-2 in Task 2, group 3 in Task 1, group 4 split
across Tasks 1 (resolver-level fidelity) and 2 (compiler-level fidelity), group 5 in Task 2, group 6 in
Task 3 Step 6, group 7 in Task 4 Step 6, group 8 in Task 5.

**Type consistency.** `KitAlias` has the same three fields everywhere; `readonly KitAlias[]` is the
parameter type in all five signatures that take one, while `Project.kitAliases` and `resolveKitAliases`'
return type are mutable `KitAlias[]` (a mutable array is assignable to a readonly parameter, not the
reverse). `resolveKitAliases` returns `KitAlias[] | undefined`; `findKitAliasesInSvelteConfig` returns
`RawKitAliases` and never `undefined`.

**Deliberately not covered here**, and recorded so a reviewer does not read it as an omission: reading
`kit.alias` out of a `sveltekit()` plugin config (Task 2 returns `undefined` for that project instead —
today's behaviour, not a wrong answer); `kit.files.routes`; Vite's own `resolve.alias`; and evaluating a
computed alias value, which `packages/core` cannot do at all since it runs no user code and performs no I/O.
