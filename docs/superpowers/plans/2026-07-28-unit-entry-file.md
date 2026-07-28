# `architecture/unit-entry-file` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `architecture/unit-entry-file`, an L3 rule that reports a declared unit directory with no file named after it, plus the source-file inventory fact it needs.

**Architecture:** A new collector globs every file under `src/` into `ctx.sourceFiles`, wired at the two places that assemble a full `RuleContext`. The rule derives the directory set from those paths' ancestor prefixes, decides which directories are units from three `string-map` / `string-list` options, and emits three finding shapes: a violation at a file inside the offending directory, a pass at the expected entry file, and a project-scoped finding for a declaration that matched nothing.

**Tech Stack:** TypeScript, `@svelte-vitals/core` (runtime-agnostic, dependency-free), vitest.

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals anywhere in `packages/core/src`. All filesystem access goes through the injected `Runtime` interface (`packages/core/src/runtime.ts`).
- **No new dependencies**: `packages/core` stays dependency-free.
- **Severity is `info`.** A new rule always lands at `info` in this project. Do not choose `warning`.
- **Defaults are empty** — `units: {}`, `pascalCaseUnits: {}`, `exclude: []` — and the rule must emit **nothing at all** when both `units` and `pascalCaseUnits` are empty.
- **Rule registration is four places** and TypeScript catches a miss in only three: the import, the `allRules` array, and the re-export block in `packages/core/src/rules/index.ts`, plus the duplicate re-export list in `packages/core/src/index.ts`.
- **Rule docs are mandatory in both languages**: `docs/src/content/docs/rules/architecture/unit-entry-file.md` and `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`. `packages/cli/test/docs-links.test.ts` fails the build if either is missing.
- **Regenerate the rule index pages** after registering the rule: `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`, then commit the four changed `.mdx` files. `packages/cli/test/rules-index.test.mjs` fails when they are stale — this exact step was missed on the previous rule and CI caught it.
- **en/ja docs stay in sync**: never ship an English-only documentation change.
- **Never name a third-party tool** in documentation, commit messages, or the PR body.
- **Conventional commits**, scoped by package: `feat(core):`, `test(core):`, `docs:`.
- Verify commands: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm --filter docs build`.

## Glob semantics that the option values depend on

Copied from the spec because every task that writes a glob needs it. `routeGlobToRegExp`
(`packages/core/src/config-apply.ts`) is **not** symmetric between its two star forms:

- **A `**` between two segments matches one segment or more — never zero.** `src/lib/api/**/*`
  compiles to `^src/lib/api/.*/[^/]*$`, so it requires at least two levels below `api/` and never
  matches `src/lib/api/voice`.
- **A trailing `/**` matches zero or more**, so it also matches the bare prefix.
  `src/**/functions/**` compiles to `^src/.*/functions(/.*)?$` and therefore matches the
  `functions/` container itself.

## File Structure

| File                                                                      | Responsibility                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/core/src/source-files.ts` (create)                              | `collectSourceFiles(rt, cwd)` — one glob, sorted paths.                |
| `packages/core/src/rule.ts` (modify)                                      | `RuleContext` gains `sourceFiles?: string[]`.                          |
| `packages/core/src/rules/architecture/unit-entry-file.ts` (create)        | The rule: directory derivation, unit resolution, three finding shapes. |
| `packages/core/src/rules/index.ts` (modify)                               | Registration: import, `allRules`, re-export block.                     |
| `packages/core/src/index.ts` (modify)                                     | Public re-exports: the collector and the rule name.                    |
| `packages/core/test/source-files.test.ts` (create)                        | The collector against a fake `Runtime`.                                |
| `packages/core/test/unit-entry-file.test.ts` (create)                     | Rule behaviour, every silent input, all three finding shapes.          |
| `packages/cli/src/index.ts` (modify)                                      | Collect and pass the fact in the CLI's full run.                       |
| `packages/vite/src/providers/source/components.ts` (modify)               | Node-runtime wrapper for the collector, beside its two siblings.       |
| `packages/vite/src/analyze.ts` (modify)                                   | Collect and pass the fact in the Vite build path.                      |
| `docs/src/content/docs/rules/architecture/unit-entry-file.md` (create)    | en rule page.                                                          |
| `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md` (create) | ja rule page.                                                          |
| `docs/src/content/docs/guides/(setup)/configuration.mdx` (modify)         | Add the rule to the configurable-rules list.                           |
| `docs/src/content/docs/ja/guides/(setup)/configuration.mdx` (modify)      | Same, ja.                                                              |
| `.changeset/unit-entry-file.md` (create)                                  | Minor for all four packages.                                           |

---

### Task 1: The `sourceFiles` fact

**Files:**

- Create: `packages/core/src/source-files.ts`
- Modify: `packages/core/src/rule.ts` (the `RuleContext` interface, around line 10)
- Modify: `packages/core/src/index.ts` (add one export line beside the other collectors, around line 35)
- Test: `packages/core/test/source-files.test.ts`

**Interfaces:**

- Consumes: `Runtime` from `packages/core/src/runtime.ts` — `{ readFile, exists, glob(pattern, cwd), join }`. Only `glob` is used here.
- Produces:
  - `collectSourceFiles(rt: Runtime, cwd: string): Promise<string[]>`
  - `RuleContext.sourceFiles?: string[]`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/source-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '../src/source-files.js';
import type { Runtime } from '../src/runtime.js';

/** A Runtime whose glob returns a fixed list, recording the patterns and any file reads. */
function fakeRuntime(files: string[]): { rt: Runtime; patterns: string[]; reads: string[] } {
  const patterns: string[] = [];
  const reads: string[] = [];
  const rt: Runtime = {
    readFile: (path) => {
      reads.push(path);
      return Promise.reject(new Error('not used'));
    },
    exists: () => Promise.resolve(false),
    glob: (pattern) => {
      patterns.push(pattern);
      return Promise.resolve(files);
    },
    join: (...parts) => parts.join('/')
  };
  return { rt, patterns, reads };
}

describe('collectSourceFiles', () => {
  it('globs every file under src/ exactly once', async () => {
    const { rt, patterns } = fakeRuntime(['src/app.html']);
    await collectSourceFiles(rt, '/project');
    expect(patterns).toEqual(['src/**/*']);
  });

  it('returns the paths sorted', async () => {
    const { rt } = fakeRuntime(['src/lib/b.ts', 'src/app.html', 'src/lib/a.ts']);
    expect(await collectSourceFiles(rt, '/project')).toEqual(['src/app.html', 'src/lib/a.ts', 'src/lib/b.ts']);
  });

  it('returns an empty list when nothing matches', async () => {
    const { rt } = fakeRuntime([]);
    expect(await collectSourceFiles(rt, '/project')).toEqual([]);
  });

  it('does not read any file', async () => {
    // Recorded rather than inferred from a rejection: a swallowed or unawaited read would
    // leave the outer promise resolving normally, so only a call count can prove this.
    const { rt, reads } = fakeRuntime(['src/lib/Card/Card.svelte']);
    await collectSourceFiles(rt, '/project');
    expect(reads).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/source-files.test.ts`
Expected: FAIL — `../src/source-files.js` does not exist.

- [ ] **Step 3: Write the collector**

Create `packages/core/src/source-files.ts`:

```ts
import type { Runtime } from './runtime.js';

/**
 * Every file under `src/`, as project-relative paths, sorted. Paths only — nothing is
 * read, so this is the cheaper of the two passes over `src/` (the component collector
 * already walks the same tree and reads every `.svelte`).
 *
 * Directory-shaped rules derive their directory set from these paths' ancestor prefixes
 * rather than globbing a second time; see `architecture/unit-entry-file`. The list is
 * sorted so anything that picks "the first file under a directory" is deterministic.
 */
export async function collectSourceFiles(rt: Runtime, cwd: string): Promise<string[]> {
  const files = await rt.glob('src/**/*', cwd);
  return files.slice().sort();
}
```

- [ ] **Step 4: Add the field to `RuleContext`**

In `packages/core/src/rule.ts`, inside `interface RuleContext`, add the field after `kitModules`:

```ts
  /** Every file under `src/` for directory-shaped Architecture rules (static/CLI + vite build mode only). */
  sourceFiles?: string[];
```

- [ ] **Step 5: Export the collector**

In `packages/core/src/index.ts`, beside the other collector exports (near line 35):

```ts
export { collectSourceFiles } from './source-files.js';
```

- [ ] **Step 6: Run the test to verify it passes, and typecheck**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/source-files.test.ts && ../../node_modules/.bin/tsc --noEmit`
Expected: 4 tests PASS, no typecheck output.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/source-files.ts packages/core/src/rule.ts packages/core/src/index.ts packages/core/test/source-files.test.ts
git commit -m "feat(core): collect the source-file inventory

One glob over src/, paths only, sorted. Directory-shaped Architecture rules
derive their directory set from these paths' ancestor prefixes instead of
globbing a second time, and the sort makes 'the first file under a directory'
deterministic."
```

---

### Task 2: The rule

**Files:**

- Create: `packages/core/src/rules/architecture/unit-entry-file.ts`
- Modify: `packages/core/src/rules/index.ts` (architecture imports near line 63, the `allRules` entry near line 131, the re-export block near line 200)
- Modify: `packages/core/src/index.ts` (the rules re-export list, beside `architecturePropCount` near line 125)
- Test: `packages/core/test/unit-entry-file.test.ts`

**Interfaces:**

- Consumes: `RuleContext.sourceFiles?: string[]` (Task 1); `compileOverrides` and `routeGlobToRegExp` from `../../config-apply.js`; `listOption`, `mapOption`, `resolveRuleOptions`, `type RuleOptionsSpec` from `../../rule-options.js`; `docsUrlFor`, `type Rule`, `type RuleContext` from `../../rule.js`; `type Result` from `../../types.js`.
- Produces: `export const architectureUnitEntryFile: Rule` with `id: 'architecture/unit-entry-file'`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/unit-entry-file.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureUnitEntryFile, applyOverrides } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own' && r.detection.value === 'static');

/** A RuleContext carrying a source-file inventory and the rule's options. */
const ctx = (sourceFiles: string[], options?: Record<string, unknown>): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig(options ? { rules: { 'architecture/unit-entry-file': { options } } } : {})
});

const PASCAL = { pascalCaseUnits: { 'src/**': '.svelte' } };

describe('architecture/unit-entry-file — inertness', () => {
  it('emits nothing when no declaration is given', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Badge.svelte']));
    expect(rs).toEqual([]);
  });

  it('emits nothing when sourceFiles is absent', async () => {
    const c: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({ rules: { 'architecture/unit-entry-file': { options: PASCAL } } })
    };
    expect(await architectureUnitEntryFile.check(c)).toEqual([]);
  });
});

describe('architecture/unit-entry-file — pascalCaseUnits', () => {
  it('reports a PascalCase directory with no same-named entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Badge.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.id).toBe('architecture/unit-entry-file');
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.location).toBe('src/lib/Card/Badge.svelte');
    expect(rs[0]!.line).toBeUndefined();
    expect(rs[0]!.message).toContain('src/lib/Card');
    expect(rs[0]!.message).toContain('src/lib/Card/Card.svelte');
    expect(rs[0]!.fix?.description).toContain('camelCase');
    expect(rs[0]!.fix?.snippet).toBeUndefined();
  });

  it('passes a conforming unit, keyed on the entry file with no location', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/Badge.svelte'], PASCAL)
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.route).toBe('src/lib/Card/Card.svelte');
    expect(passes(rs)[0]!.location).toBeUndefined();
  });

  it('skips a directory whose basename does not begin A-Z', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/fairSearch/x.svelte', 'src/routes/[hallId=integer]/+page.svelte'], PASCAL)
    );
    expect(rs).toEqual([]);
  });

  it('checks a directory whose only children are directories', async () => {
    // src/lib/Card holds only parts/, so a "parents of files" derivation would miss it.
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/parts/x.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/Card');
  });

  it('reports a case-mismatched entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/card.svelte'], PASCAL));
    expect(fails(rs)).toHaveLength(1);
  });

  it('prefers a direct child over a deeper file as the location', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/aaa/deep.svelte', 'src/lib/Card/zzz.svelte'], PASCAL)
    );
    // 'aaa/deep.svelte' sorts first overall, but 'zzz.svelte' is the direct child.
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/zzz.svelte');
  });

  it('falls back to the subtree when there is no direct child', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/parts/Badge.svelte'], PASCAL));
    expect(fails(rs)[0]!.location).toBe('src/lib/Card/parts/Badge.svelte');
  });
});

describe('architecture/unit-entry-file — units', () => {
  const FN = { units: { 'src/**/functions/*': '.ts' } };

  it('reports a declared unit with no entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/other.ts'], FN));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/x/functions/getFoo/getFoo.ts');
  });

  it('passes a declared unit that has its entry file', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/getFoo.ts'], FN));
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('uses the units Fix text, which never mentions camelCase', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/x/functions/getFoo/other.ts'], FN));
    expect(rs[0]!.fix?.description).not.toContain('camelCase');
    expect(rs[0]!.fix?.description).toContain('units');
  });

  it('does not match zero segments for a middle ** — the domain level is never a unit', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/api/voice/types.ts', 'src/lib/api/voice/fetchVoice/fetchVoice.ts'], {
        units: { 'src/lib/api/**/*': '.ts' }
      })
    );
    // src/lib/api/voice must NOT be treated as a unit; only the fetch unit is, and it conforms.
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
    expect(passes(rs)[0]!.route).toBe('src/lib/api/voice/fetchVoice/fetchVoice.ts');
  });

  it('takes the longest matching key', async () => {
    // Both keys match src/lib/x/stores/s. The longer one expects `.ts`, which exists; the
    // shorter one would expect `.svelte.ts` and report a violation.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/x/stores/s/s.ts'], {
        units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
      })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('takes the lexicographically first among equal-length keys', async () => {
    // Both keys are 9 characters and both match src/a/b/c. '*' (0x2A) sorts before 'a'
    // (0x61), so 'src/*/b/*' wins and `.ts` is expected — which exists.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/a/b/c/c.ts'], { units: { 'src/a/*/*': '.svelte', 'src/*/b/*': '.ts' } })
    );
    expect(fails(rs)).toHaveLength(0);
    expect(passes(rs)).toHaveLength(1);
  });

  it('does not call a key inert when it matched but lost the tie-break', async () => {
    // 'src/**/stores/*' matches and loses to the longer key; it has still done work.
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/x/stores/s/s.ts'], {
        units: { 'src/**/stores/*': '.svelte.ts', 'src/lib/x/stores/*': '.ts' }
      })
    );
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
  });

  it('prefers units over pascalCaseUnits for a directory matched by both', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Thing/Thing.ts'], { units: { 'src/lib/*': '.ts' }, ...PASCAL })
    );
    // units expects .ts and it exists, so the directory conforms despite pascalCaseUnits wanting .svelte.
    expect(fails(rs)).toHaveLength(0);
  });
});

describe('architecture/unit-entry-file — exclude', () => {
  it('exempts an excluded directory and its whole subtree', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte', 'src/lib/Card/tests/Fixtures/dummy.ts'], {
        ...PASCAL,
        exclude: ['**/tests']
      })
    );
    // Fixtures/ is PascalCase but sits under an excluded tests/, so it is not a unit.
    expect(fails(rs)).toHaveLength(0);
  });

  it('outranks both declarations', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Badge.svelte'], { ...PASCAL, units: { 'src/lib/*': '.svelte' }, exclude: ['src/lib/Card'] })
    );
    expect(rs).toEqual([]);
  });
});

describe('architecture/unit-entry-file — inert declarations', () => {
  it('reports a key that matched no directory, as a project-scoped finding', async () => {
    const rs = await architectureUnitEntryFile.check(
      ctx(['src/lib/Card/Card.svelte'], { ...PASCAL, units: { 'src/nowhere/*': '.ts' } })
    );
    const inert = rs.filter((r) => r.route === undefined);
    expect(inert).toHaveLength(1);
    expect(inert[0]!.location).toBeUndefined();
    expect(inert[0]!.message).toContain('src/nowhere/*');
    expect(inert[0]!.detection.presence).toBe('none');
  });

  it('does not report a key that matched at least one directory', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(['src/lib/Card/Card.svelte'], PASCAL));
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
  });

  it('does not check inertness for a key declared only in an overrides entry', async () => {
    const c: RuleContext = {
      sourceFiles: ['src/lib/Card/Card.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig({
        overrides: [
          {
            files: 'src/lib/**',
            rules: { 'architecture/unit-entry-file': { options: { units: { 'src/nowhere/*': '.ts' } } } }
          }
        ]
      })
    };
    expect((await architectureUnitEntryFile.check(c)).filter((r) => r.route === undefined)).toEqual([]);
  });
});

describe('architecture/unit-entry-file — per-path options', () => {
  it('applies a files:-scoped override, and its severity too', async () => {
    const cfg = {
      overrides: [
        {
          files: 'src/lib/**',
          rules: {
            'architecture/unit-entry-file': {
              severity: 'warning' as const,
              options: { pascalCaseUnits: { 'src/**': '.svelte' } }
            }
          }
        }
      ]
    };
    const c: RuleContext = {
      sourceFiles: ['src/lib/Card/Badge.svelte'],
      heads: [],
      project: defaultProject,
      config: defineConfig(cfg)
    };
    const rs = await architectureUnitEntryFile.check(c);
    expect(fails(rs)).toHaveLength(1);
    const applied = applyOverrides(rs, defineConfig(cfg));
    expect(applied.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/unit-entry-file.test.ts`
Expected: FAIL — `architectureUnitEntryFile` is not exported.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/architecture/unit-entry-file.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides, routeGlobToRegExp } from '../../config-apply.js';
import { listOption, mapOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';

const docsUrl = docsUrlFor('architecture/unit-entry-file');
const recommendation =
  'Give every declared unit directory a file named after it, or stop declaring that directory a unit.';

// Inert by default: with nothing declared there is no convention to check, and
// svelte-vitals never guesses which directories a project treats as units.
const OPTIONS: RuleOptionsSpec = {
  units: { kind: 'string-map', default: {} },
  pascalCaseUnits: { kind: 'string-map', default: {} },
  exclude: { kind: 'string-list', default: [] }
};

/** Every ancestor directory of `file`, shallowest first (`a/b/c.ts` → ['a', 'a/b']). */
function ancestorDirs(file: string): string[] {
  const segments = file.split('/');
  const out: string[] = [];
  for (let i = 1; i < segments.length; i++) out.push(segments.slice(0, i).join('/'));
  return out;
}

/** The basename of a directory path. */
function baseName(dir: string): string {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? dir : dir.slice(cut + 1);
}

/** A PascalCase name is one whose first character is A-Z. That is the whole definition. */
function isPascalCase(name: string): boolean {
  const c = name.charCodeAt(0);
  return c >= 65 && c <= 90;
}

/** A compiled declaration key. `barePrefix` is set only for a `units` key ending in `/**`. */
interface CompiledKey {
  key: string;
  re: RegExp;
  barePrefix?: string;
}

/**
 * Every declaration key matching `dir`, and the one that governs it. The longest match wins
 * as the most specific declaration; among equal lengths the lexicographically first wins,
 * because additive merging across config layers makes key insertion order unintuitive.
 *
 * `matched` carries ALL of them, not just the winner: a key that matched a directory but lost
 * the tie-break has still done work, and reporting it as an inert declaration would be a lie.
 *
 * A key's own `barePrefix` never matches. `routeGlobToRegExp` compiles a trailing `/**` to also
 * match the bare prefix, so `{ 'src/lib/functions/**': '.ts' }` would otherwise call
 * `src/lib/functions` a unit and demand a nonsensical `functions/functions.ts`. A key ending in
 * `/**` means "everything under X" in BOTH declarations, so it must not include X itself — the
 * casing gate hides this for `pascalCaseUnits` only when the root's basename happens to be
 * lowercase, which is not something to rely on: `{ 'src/Components/**': … }` would otherwise
 * demand `Components/Components.svelte` from a container.
 */
function matchKeys(dir: string, compiled: CompiledKey[]): { matched: string[]; best?: string } {
  const matched: string[] = [];
  let best: string | undefined;
  for (const { key, re, barePrefix } of compiled) {
    if (dir === barePrefix) continue;
    if (!re.test(dir)) continue;
    matched.push(key);
    if (best === undefined || key.length > best.length || (key.length === best.length && key < best)) best = key;
  }
  return best === undefined ? { matched } : { matched, best };
}

/**
 * architecture/unit-entry-file — a directory declared to be a unit must contain a file named
 * after it (design 2026-07-28). L3: the declarations come from the project's own `units`,
 * `pascalCaseUnits` and `exclude` options and are never inferred, so the rule is inert until then.
 *
 * The directory set is every ancestor path prefix of every file, so a directory holding only
 * subdirectories is checked too. Violations report at a file inside the directory rather than at
 * the directory, because `filterToChangedFiles` keeps only locations git lists as changed.
 */
export const architectureUnitEntryFile: Rule = {
  id: 'architecture/unit-entry-file',
  title: 'Unit entry file',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    "A directory named after a unit but missing that unit's entry file is either an incomplete unit or a grouping wearing the wrong name; either way the tree no longer says what it means, and tooling that resolves by convention starts guessing.",
  fix: {
    description:
      'Make the directory and its entry file agree — add the entry file, or stop declaring this directory a unit.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const files = ctx.sourceFiles;
    if (files === undefined) return [];

    // Hoisted: compiling every override's globs once, not once per directory.
    const compiledOverrides = compileOverrides(ctx.config);

    // Every ancestor prefix of every file — so a directory whose only children are
    // directories is in the set. Sorted for deterministic output.
    const dirs = new Set<string>();
    for (const f of files) for (const d of ancestorDirs(f)) dirs.add(d);
    const fileSet = new Set(files);

    // Compiled patterns are memoised on the resolved declaration, since a project has a
    // handful of distinct declarations and thousands of directories.
    const cache = new Map<string, CompiledKey[]>();
    const compile = (globs: string[], bareGuard = false): CompiledKey[] => {
      const cacheKey = JSON.stringify([globs, bareGuard]);
      let entry = cache.get(cacheKey);
      if (entry === undefined) {
        entry = globs.map((key) => ({
          key,
          re: routeGlobToRegExp(key),
          ...(bareGuard && key.endsWith('/**') ? { barePrefix: key.slice(0, -3) } : {})
        }));
        cache.set(cacheKey, entry);
      }
      return entry;
    };

    const out: Result[] = [];
    // Keys of the globally declared options that matched at least one directory.
    const globalOptions = resolveRuleOptions('architecture/unit-entry-file', OPTIONS, ctx.config);
    const globalKeys = new Set([
      ...Object.keys(mapOption(globalOptions, 'units')),
      ...Object.keys(mapOption(globalOptions, 'pascalCaseUnits'))
    ]);
    const usedKeys = new Set<string>();

    for (const dir of [...dirs].sort()) {
      const o = resolveRuleOptions(
        'architecture/unit-entry-file',
        OPTIONS,
        ctx.config,
        { route: dir, file: dir },
        compiledOverrides
      );
      const units = mapOption(o, 'units');
      const pascalUnits = mapOption(o, 'pascalCaseUnits');
      if (Object.keys(units).length === 0 && Object.keys(pascalUnits).length === 0) continue; // inert

      // Matched unconditionally — before `exclude` prunes the directory and before the casing
      // gate below decides whether `pascalCaseUnits` gets to set `ext`. A key that only ever
      // matches an excluded directory, or only matches directories a `units` key already won
      // for, has still done work; bookkeeping it after either gate would falsely call it inert.
      // `true` on the units side guards a key ending in `/**` from matching its own container.
      const byPath = matchKeys(dir, compile(Object.keys(units), true));
      const byCasing = matchKeys(dir, compile(Object.keys(pascalUnits), true));
      for (const k of [...byPath.matched, ...byCasing.matched]) if (globalKeys.has(k)) usedKeys.add(k);

      // `exclude` outranks both declarations, and prunes the whole subtree: a directory is
      // exempt when it or any ancestor matches.
      const excluded = compile(listOption(o, 'exclude'));
      if (excluded.some(({ re }) => re.test(dir) || ancestorDirs(dir).some((a) => re.test(a)))) continue;

      // A `units` key wins over the casing convention purely by being tried first.
      let ext = byPath.best === undefined ? undefined : units[byPath.best];
      const viaUnits = ext !== undefined;
      if (ext === undefined && isPascalCase(baseName(dir))) {
        ext = byCasing.best === undefined ? undefined : pascalUnits[byCasing.best];
      }
      if (ext === undefined) continue;

      const expected = `${dir}/${baseName(dir)}${ext}`;
      if (fileSet.has(expected)) {
        out.push({
          id: 'architecture/unit-entry-file',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          route: expected,
          message: 'Unit entry file',
          recommendation,
          docsUrl
        });
        continue;
      }

      // Prefer a direct child so the finding sits next to the directory it is about; fall
      // back to the subtree for a directory holding only subdirectories.
      const prefix = `${dir}/`;
      const under = files.filter((f) => f.startsWith(prefix));
      const at = under.find((f) => !f.slice(prefix.length).includes('/')) ?? under[0];
      if (at === undefined) continue; // unreachable: the directory came from a file's prefix
      out.push({
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: at,
        location: at,
        message: `${dir} declares a unit but has no ${expected}`,
        recommendation,
        docsUrl,
        // Which declaration matched decides the wording: a `units` match like functions/getFoo/
        // is already camelCase, so telling its author to rename it would be nonsense.
        fix: {
          description: viaUnits
            ? `Add ${baseName(dir)}${ext} to this directory, or remove it from the units declaration.`
            : `Add the same-named entry file, or rename the directory to camelCase if it is a grouping.`
        }
      });
    }

    // A declaration that matched nothing checks nothing — the failure this rule exists to
    // surface. Two deliberate narrowings: only globally declared keys are checked, since
    // whether an `overrides`-only key matched anything depends on intersecting its scope with
    // the directory set; and `exclude` globs are not checked at all, because an exclusion that
    // matches nothing fails LOUDLY — you get findings you did not want and notice — while a
    // unit declaration that matches nothing fails silently, which is the whole point here.
    for (const key of [...globalKeys].sort()) {
      if (usedKeys.has(key)) continue;
      out.push({
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: `The declaration '${key}' matched no directory, so it checks nothing.`,
        recommendation: 'Correct the glob, or remove the declaration.',
        docsUrl
      });
    }
    return out;
  }
};
```

- [ ] **Step 4: Register the rule in all four places**

In `packages/core/src/rules/index.ts`, beside the other architecture imports:

```ts
import { architectureUnitEntryFile } from './architecture/unit-entry-file.js';
```

Add `architectureUnitEntryFile` to the `allRules` array next to `architecturePropCount`, and to the
re-export block at the bottom of the same file.

In `packages/core/src/index.ts`, add `architectureUnitEntryFile` to the
`export { … } from './rules/index.js'` list next to `architecturePropCount`.

- [ ] **Step 5: Verify all four registrations landed**

Run: `grep -c architectureUnitEntryFile packages/core/src/rules/index.ts packages/core/src/index.ts`
Expected: `3` for `rules/index.ts` and `1` for `index.ts`. Any other numbers mean a site was missed —
TypeScript will not tell you, because the fourth is a plain re-export list.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/unit-entry-file.test.ts`
Expected: all PASS.

- [ ] **Step 7: Run the whole core suite and typecheck**

Run: `cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit`
Expected: all green. A rule added to `allRules` joins registry-wide tests, so a failure here is about
the new rule's metadata. `packages/cli`'s `docs-links` and `rules-index` tests WILL fail until Task 4 —
that is expected and not yours to fix.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/unit-entry-file.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/unit-entry-file.test.ts
git commit -m "feat(core): add architecture/unit-entry-file

A directory declared to be a unit must contain a file named after it. L3 under
the Architecture charter: units come from the project's own declarations and are
never inferred, so the rule is inert until one is given.

Two declarations because the two kinds of unit are identified differently and
neither subsumes the other — a camelCase directory may be a unit or a grouping,
so those are declared by path, while a PascalCase directory is unambiguous but
nests to arbitrary depth, so casing finds it where no path glob can. exclude
prunes what is never a unit, subtree included.

Violations report at a file inside the directory, not the directory, because
filterToChangedFiles keeps only locations git lists as changed. Passes key on
the expected entry file, so a component unit's pass lands on a path that is
already a score key rather than diluting the average with a new one. And a
declaration matching no directory is reported outright, since a silently inert
glob is the failure this rule exists to surface."
```

---

### Task 3: Wire the fact into the CLI and the Vite build

**Files:**

- Modify: `packages/cli/src/index.ts` (the collector imports near line 20, the collection block near line 216, the `runRules` call near line 222)
- Modify: `packages/vite/src/providers/source/components.ts` (add a third wrapper beside the two existing ones)
- Modify: `packages/vite/src/analyze.ts` (the import near line 22, the collection near line 70, the `runRules` call near line 74)
- Test: `packages/vite/test/analyze-source-files.test.ts`

**Interfaces:**

- Consumes: `collectSourceFiles(rt, cwd)` and `RuleContext.sourceFiles` (Task 1); `architectureUnitEntryFile` (Task 2).
- Produces: `sourceFiles` present in both full-analysis paths; `collectSourceFiles(root)` exported from the Vite provider module.

- [ ] **Step 1: Wire the CLI**

In `packages/cli/src/index.ts`, add `collectSourceFiles` to the existing `@svelte-vitals/core` import
list (the one that already brings in `collectKitModuleFacts`), then beside the two existing
collections near line 216:

```ts
const sourceFiles = opts.route ? undefined : await collectSourceFiles(rt, cwd);
```

and add `sourceFiles` to the `runRules` context object:

```ts
      await runRules(rules, { heads, images, headings, components, project, config, kitModules, sourceFiles }),
```

`undefined` rather than `[]` for a route-filtered run: an empty inventory would let the rule conclude
that declared directories do not exist and report inert declarations, while `undefined` means "this
mode does not collect it" and the rule stays silent.

- [ ] **Step 2: Wire the Vite provider wrapper**

In `packages/vite/src/providers/source/components.ts`, add `collectSourceFiles as collectFiles` to the
existing `@svelte-vitals/core` import, then add the wrapper beside its two siblings:

```ts
/** Every file under `src/` for directory-shaped Architecture rules (build mode only). */
export function collectSourceFiles(root: string): Promise<string[]> {
  return collectFiles(nodeRuntime, root);
}
```

- [ ] **Step 3: Wire the Vite build path**

In `packages/vite/src/analyze.ts`, add `collectSourceFiles` to the import from
`./providers/source/components.js`, collect it beside the others near line 70:

```ts
const sourceFiles = await collectSourceFiles(cwd);
```

and add `sourceFiles` to the `runRules` context object.

- [ ] **Step 4: Write the test**

Create `packages/vite/test/analyze-source-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectSourceFiles } from '../src/providers/source/components.js';

describe('collectSourceFiles (vite provider)', () => {
  it('returns paths under src/ for the repository it is pointed at', async () => {
    // Point it at this package: packages/vite/src exists and holds .ts files.
    const files = await collectSourceFiles(new URL('..', import.meta.url).pathname);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.startsWith('src/'))).toBe(true);
    expect(files).toEqual(files.slice().sort());
  });

  it('returns an empty list for a directory with no src/', async () => {
    expect(await collectSourceFiles(new URL('.', import.meta.url).pathname)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/vite && ../../node_modules/.bin/vitest run test/analyze-source-files.test.ts`
Expected: 2 tests PASS.

Then confirm nothing else broke in the two wired packages:

Run: `cd packages/vite && ../../node_modules/.bin/tsc --noEmit && cd ../cli && ../../node_modules/.bin/tsc --noEmit`
Expected: no output from either.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts packages/vite/src/providers/source/components.ts packages/vite/src/analyze.ts packages/vite/test/analyze-source-files.test.ts
git commit -m "feat(cli,vite): collect the source-file inventory in both full analyses

Wired at the two places that assemble a complete RuleContext. The dev server's
live per-request layer omits it, exactly as it omits components, so a
directory-shaped rule stays silent there.

A route-filtered CLI run passes undefined rather than an empty list: an empty
inventory would let the rule conclude that declared directories do not exist,
while undefined means the mode does not collect it."
```

---

### Task 4: Documentation, changeset, and the regenerated rule index

**Files:**

- Create: `docs/src/content/docs/rules/architecture/unit-entry-file.md`
- Create: `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`
- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx` (the configurable-rules list under "Rule options")
- Modify: `docs/src/content/docs/ja/guides/(setup)/configuration.mdx` (same list)
- Create: `.changeset/unit-entry-file.md`
- Modify: the four generated index pages, by running the generator

**Interfaces:**

- Consumes: the rule id and option names from Task 2.
- Produces: nothing.

- [ ] **Step 1: Write the en rule page**

Create `docs/src/content/docs/rules/architecture/unit-entry-file.md`:

````markdown
---
title: architecture/unit-entry-file · Unit entry file
description: A directory declared to be a unit should contain a file named after it.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory you have declared to be a "unit" that contains no file named after it — `Card/`
without `Card.svelte`, `getFoo/` without `getFoo.ts`.

This rule is **off until you configure it**. It has no default idea of what a unit is, because that
is your project's convention, not ours.

## Why it matters

A directory named after a unit but missing that unit's entry file is either an incomplete unit or a
grouping wearing the wrong name. Either way the tree stops saying what it means, and anyone — or
anything — resolving by convention starts guessing.

A filename-pattern check cannot catch this. Given a path it can ask whether that filename matches its
parent directory, but a file that does not exist has no path to check.

## How to fix

Add the entry file, or stop declaring the directory a unit — rename it to camelCase if it is really a
grouping, or narrow the declaration that swept it in.

## Configuration

| Option            | Type                              | Default |
| ----------------- | --------------------------------- | ------- |
| `units`           | map of directory glob → extension | `{}`    |
| `pascalCaseUnits` | map of root glob → extension      | `{}`    |
| `exclude`         | list of directory globs           | `[]`    |

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: {
        units: {
          'src/lib/api/**/*': '.ts',
          'src/**/functions/*': '.ts',
          'src/**/functions/*/*': '.ts',
          'src/**/stores/*': '.svelte.ts'
        },
        pascalCaseUnits: { 'src/**': '.svelte' },
        exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e']
      }
    }
  }
};
```

**`units`** identifies a unit by where it sits. **`pascalCaseUnits`** identifies one by its name: every
directory under a matching root whose name begins with an uppercase letter. Both are needed, because a
camelCase directory may legitimately be a unit _or_ a grouping — only its position can tell them apart
— while a PascalCase unit nests to arbitrary depth, where no path glob can find it.

A directory matched by `units` takes that declaration; `pascalCaseUnits` applies only to the rest. When
several `units` globs match, the longest wins, and the alphabetically first among equal-length ties.

### `exclude`

**`exclude` removes a directory and everything beneath it.** So it is only for directories that are
neither units themselves nor hold units:

| Directory                            | In `exclude`?                                 |
| ------------------------------------ | --------------------------------------------- |
| test, style-guide, e2e, type folders | Yes                                           |
| a folder whose children _are_ units  | **No** — excluding it removes those units too |

If a broad `units` glob sweeps in a folder that holds units, narrow the glob instead of excluding it.

### Glob depth

`*` matches within one path segment and `**` across segments, but the two star forms are not
symmetric: **a `**` between two segments matches one segment or more, never zero.** So
`src/lib/api/**/*` requires at least two levels below `api/` — which is what keeps an intermediate
grouping level from being treated as a unit. A **trailing** `/**` is safe to write: it means
"everything under this directory", and the rule will not treat the directory itself as a unit.

## Limitations

Only files under `src/` are considered, so a directory outside it is never checked and does not need
excluding.

A declaration that matches no directory at all is reported, so a glob typo cannot leave the rule
silently checking nothing. A declaration written **only** inside an `overrides` entry is not checked
that way — whether it matched anything depends on which paths the override applies to.
````

- [ ] **Step 2: Write the ja rule page**

Create `docs/src/content/docs/ja/rules/architecture/unit-entry-file.md`:

````markdown
---
title: architecture/unit-entry-file · ユニットのエントリファイル
description: ユニットとして宣言したディレクトリには、同名のファイルを置くべきです。
---

**重大度:** info · **カテゴリ:** architecture

## チェック内容

「ユニット」として宣言したディレクトリに、同名のファイルが無い箇所を検出します。`Card/` に
`Card.svelte` が無い、`getFoo/` に `getFoo.ts` が無い、といったケースです。

このルールは**設定するまで無効**です。何をユニットとみなすかについて既定の考えを持ちません。それは
プロジェクトの規約であって、svelte-vitals が決めることではないからです。

## なぜ重要か

ユニットの名前を持つのに本体ファイルが無いディレクトリは、未完成のユニットか、名前を間違えた
グルーピングのどちらかです。いずれにせよツリーが意味を語らなくなり、規約に沿って解決しようとする
人間もツールも推測を始めることになります。

ファイル名のパターン照合ではこれを検出できません。パスを与えられれば「そのファイル名は親ディレクトリと
一致するか」を問えますが、**存在しないファイルには照合すべきパスがありません。**

## 修正方法

エントリファイルを追加するか、そのディレクトリをユニットの宣言から外します。実際にはグルーピングで
あれば camelCase にリネームし、宣言が広すぎて巻き込んでいるなら宣言を狭めます。

## 設定

| オプション        | 型                                  | デフォルト |
| ----------------- | ----------------------------------- | ---------- |
| `units`           | ディレクトリ glob → 拡張子 のマップ | `{}`       |
| `pascalCaseUnits` | 起点 glob → 拡張子 のマップ         | `{}`       |
| `exclude`         | ディレクトリ glob のリスト          | `[]`       |

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: {
        units: {
          'src/lib/api/**/*': '.ts',
          'src/**/functions/*': '.ts',
          'src/**/functions/*/*': '.ts',
          'src/**/stores/*': '.svelte.ts'
        },
        pascalCaseUnits: { 'src/**': '.svelte' },
        exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e']
      }
    }
  }
};
```

**`units`** はユニットを**置き場所**で識別します。**`pascalCaseUnits`** は**名前**で識別し、マッチする
起点の配下にある、名前が大文字で始まるディレクトリすべてが対象になります。両方が必要な理由は、
camelCase のディレクトリはユニットでもグルーピングでもあり得るため位置でしか区別できず、一方で
PascalCase のユニットは任意の深さに入れ子になるためパスの glob では見つけられないからです。

`units` にマッチしたディレクトリはその宣言に従い、`pascalCaseUnits` は残りにだけ適用されます。複数の
`units` glob がマッチした場合は最も長いキーが優先され、同じ長さなら辞書順で先のものが優先されます。

### `exclude`

**`exclude` はそのディレクトリと配下すべてを対象外にします。** そのため、書けるのは「それ自体も
ユニットでなく、配下にもユニットを持たない」ディレクトリだけです。

| ディレクトリ                              | `exclude` 可否                              |
| ----------------------------------------- | ------------------------------------------- |
| テスト・スタイルガイド・E2E・型のフォルダ | 可                                          |
| **配下がユニットである**フォルダ          | **不可** — 中のユニットまで対象外になります |

広い `units` glob がユニットを持つフォルダを巻き込んでいる場合は、除外するのではなく **glob を
狭めてください。**

### glob の深さ

`*` は 1 つのパスセグメント内、`**` はセグメントをまたいでマッチしますが、2 つの形は対称では
ありません。**2 つのセグメントに挟まれた `**` は 1 セグメント以上にマッチし、0 にはマッチしません。**
そのため `src/lib/api/**/*` は `api/` の 2 段下以降を要求し、中間のグルーピング階層がユニットとして
扱われることを防ぎます。**末尾**の `/**` は安全に書けます。「このディレクトリ配下すべて」という意味に
なり、ディレクトリ自身はユニットとして扱われません。

## 制限

対象は `src/` 配下のファイルだけです。その外のディレクトリは検査されないので、除外する必要も
ありません。

1 つのディレクトリにもマッチしなかった宣言は報告されるので、glob の書き間違いでルールが黙って何も
検査しない状態にはなりません。ただし `overrides` エントリの**中だけ**で宣言したキーはこの検査の対象外
です。何にマッチしたかが、そのオーバーライドの適用範囲に依存するためです。
````

- [ ] **Step 3: Add the rule to both configuration guides**

In `docs/src/content/docs/guides/(setup)/configuration.mdx`, append to the bullet list under
"Rule options" (the list that currently ends with the `architecture/private-scope-import` entry):

```markdown
- [`architecture/unit-entry-file`](/rules/architecture/unit-entry-file) — `units`, `pascalCaseUnits`
  and `exclude` globs declaring which directories are units. The rule is inert until you set them.
```

In `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`, append the matching bullet:

```markdown
- [`architecture/unit-entry-file`](/ja/rules/architecture/unit-entry-file) — どのディレクトリが
  ユニットかを宣言する `units` / `pascalCaseUnits` / `exclude` の glob。設定するまでこのルールは何も
  出力しません。
```

- [ ] **Step 4: Write the changeset**

Create `.changeset/unit-entry-file.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

New rule `architecture/unit-entry-file`: a directory you have declared to be a unit must contain a
file named after it — `Card/` without `Card.svelte`, `getFoo/` without `getFoo.ts`. It is **inert
until configured**, so nothing changes for projects that do not set it.

Declare units by position with `units` (directory glob → the entry file's extension), by name with
`pascalCaseUnits` (root glob → extension, applying to every directory under it whose name begins with
an uppercase letter), and declare what is never a unit with `exclude`. Both identification styles
exist because a camelCase directory may be a unit or a grouping — only position tells them apart —
while a PascalCase unit nests to arbitrary depth, where no path glob reaches it.

A filename-pattern check cannot express this: a file that does not exist has no path to validate. For
the same reason, a declaration that matches no directory at all is reported, so a glob typo cannot
leave the rule silently checking nothing.
```

- [ ] **Step 5: Regenerate the rule index pages**

Run: `pnpm --filter svelte-vitals run gen:rules-index && pnpm format`
Expected: exactly four `.mdx` files change — `docs/src/content/docs/rules/index.mdx`,
`docs/src/content/docs/rules/architecture/index.mdx`, and their `ja/` counterparts. Confirm with
`git status --short` that nothing else was rewritten.

- [ ] **Step 6: Verify the docs tests pass**

Run: `cd packages/cli && ../../node_modules/.bin/vitest run test/docs-links.test.ts test/rules-index.test.mjs`
Expected: PASS. These two are the checks that both language pages landed and that the index is current.

- [ ] **Step 7: Build the docs, lint, and format**

Run: `pnpm --filter docs build && ./node_modules/.bin/oxlint . && ./node_modules/.bin/oxfmt --check .`
Expected: docs build succeeds, lint clean, formatting clean.

- [ ] **Step 8: Commit**

```bash
git add docs/src/content/docs/rules/architecture/unit-entry-file.md docs/src/content/docs/ja/rules/architecture/unit-entry-file.md "docs/src/content/docs/guides/(setup)/configuration.mdx" "docs/src/content/docs/ja/guides/(setup)/configuration.mdx" .changeset/unit-entry-file.md docs/src/content/docs/rules/index.mdx docs/src/content/docs/rules/architecture/index.mdx docs/src/content/docs/ja/rules/index.mdx docs/src/content/docs/ja/rules/architecture/index.mdx
git commit -m "docs: document architecture/unit-entry-file (en + ja)

Both pages state that the rule is inert until configured, that exclude removes a
directory's whole subtree and so may only name directories that hold no units,
and that a middle ** matches one segment or more rather than zero — the detail
the example configuration's correctness depends on.

Rule index pages regenerated, which the previous rule's CI failure was about."
```

---

### Task 5: Validate the example configuration against a real tree

The spec requires this, and it is not optional: every error the documented example has contained was
found by running it over a real tree, never by reading it. Two of those errors produced **zero
findings**, which is why the finding count alone does not settle anything.

**Files:**

- Create: `packages/core/test/unit-entry-file-example.test.ts`
- Modify: `docs/superpowers/plans/2026-07-28-unit-entry-file.md` (tick this task's boxes)

**Interfaces:**

- Consumes: `architectureUnitEntryFile` (Task 2), `collectSourceFiles` (Task 1).
- Produces: nothing.

- [x] **Step 1: Write the test that pins the example's coverage**

The three checks the spec asks for become one test over a synthetic tree that mirrors a real project's
shape. A synthetic tree is used rather than a checked-out application because the plan must be
reproducible; the shape below is taken from a real one.

Create `packages/core/test/unit-entry-file-example.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureUnitEntryFile } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

/** The configuration documented on the rule page, verbatim. */
const EXAMPLE = {
  units: {
    'src/lib/api/**/*': '.ts',
    'src/**/functions/*': '.ts',
    'src/**/functions/*/*': '.ts',
    'src/**/stores/*': '.svelte.ts'
  },
  pascalCaseUnits: { 'src/**': '.svelte' },
  exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e']
};

/** A compliant tree: one of every unit kind the example declares, all well-formed. */
const COMPLIANT = [
  // component unit, with a nested part and the reserved folders around it
  'src/lib/features/fair/FairSummary/FairSummary.svelte',
  'src/lib/features/fair/FairSummary/types.ts',
  'src/lib/features/fair/FairSummary/tests/FairSummary.test.ts',
  'src/lib/features/fair/FairSummary/styleGuide/FairSummary.styleGuide.svelte',
  'src/lib/features/fair/FairSummary/parts/FairBadge/FairBadge.svelte',
  // function unit and a helper nested inside it
  'src/lib/features/fair/FairSummary/functions/formatDate/formatDate.ts',
  'src/lib/features/fair/FairSummary/functions/formatDate/pad/pad.ts',
  // store unit
  'src/lib/features/fair/FairSummary/stores/createFair/createFair.svelte.ts',
  // api: a domain holding a shared type, a fetch unit, and a helper nested in it
  'src/lib/api/voice/types.ts',
  'src/lib/api/voice/fetchVoice/fetchVoice.ts',
  'src/lib/api/voice/fetchVoice/toQuery/toQuery.ts',
  // a camelCase grouping, which is not a unit and must not be reported
  'src/lib/features/fair/fairSearch/SearchBox/SearchBox.svelte',
  // a route tree, including a matcher segment and an e2e folder
  'src/routes/search/hallList/+page.svelte',
  'src/routes/search/hallList/components/Search/Search.svelte',
  'src/routes/search/hallList/e2e/index.spec.ts',
  'src/routes/[hallId=integer]/+page.svelte'
];

const ctx = (sourceFiles: string[]): RuleContext => ({
  sourceFiles,
  heads: [],
  project: defaultProject,
  config: defineConfig({ rules: { 'architecture/unit-entry-file': { options: EXAMPLE } } })
});

const fails = (rs: Result[]) => rs.filter((r) => r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.value === 'static');

describe('the documented example configuration', () => {
  it('check 1: reports nothing on a compliant tree', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    expect(fails(rs).map((r) => r.message)).toEqual([]);
  });

  it('check 2: examines a non-zero number of directories — zero findings must not mean zero work', async () => {
    // The pass count IS the examined count: every unit the example declares emits one.
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    expect(passes(rs).length).toBeGreaterThan(0);
  });

  it('check 3: examines every unit kind the example declares, not just some', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    const examined = passes(rs).map((r) => r.route);
    // One assertion per declaration key, so a key that silently matches nothing fails here.
    expect(examined).toContain('src/lib/features/fair/FairSummary/FairSummary.svelte'); // pascalCaseUnits
    expect(examined).toContain('src/lib/features/fair/FairSummary/parts/FairBadge/FairBadge.svelte'); // nested PascalCase
    expect(examined).toContain('src/lib/features/fair/FairSummary/functions/formatDate/formatDate.ts'); // functions/*
    expect(examined).toContain('src/lib/features/fair/FairSummary/functions/formatDate/pad/pad.ts'); // functions/*/*
    expect(examined).toContain('src/lib/features/fair/FairSummary/stores/createFair/createFair.svelte.ts'); // stores/*
    expect(examined).toContain('src/lib/api/voice/fetchVoice/fetchVoice.ts'); // api fetch unit
    expect(examined).toContain('src/lib/api/voice/fetchVoice/toQuery/toQuery.ts'); // api nested helper
    expect(examined).toContain('src/routes/search/hallList/components/Search/Search.svelte'); // route component
  });

  it('check 3b: does not examine what the example must leave alone', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    const touched = [...fails(rs), ...passes(rs)].map((r) => r.route ?? '').join('\n');
    // The api domain level, reserved folders, camelCase groupings and matcher segments.
    expect(touched).not.toContain('src/lib/api/voice/types.ts');
    expect(touched).not.toContain('tests/');
    expect(touched).not.toContain('styleGuide/');
    expect(touched).not.toContain('e2e/');
    expect(touched).not.toContain('fairSearch/fairSearch');
    expect(touched).not.toContain('[hallId=integer]');
  });

  it('reports on a non-compliant tree, so the checks above are not vacuous', async () => {
    const broken = [
      ...COMPLIANT,
      'src/lib/features/fair/Orphan/Something.svelte', // PascalCase, no Orphan.svelte
      'src/lib/features/fair/FairSummary/functions/getThing/other.ts' // declared unit, no getThing.ts
    ];
    const rs = await architectureUnitEntryFile.check(ctx(broken));
    const messages = fails(rs).map((r) => r.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('src/lib/features/fair/Orphan/Orphan.svelte'))).toBe(true);
    expect(messages.some((m) => m.includes('getThing/getThing.ts'))).toBe(true);
  });

  it('every declaration in the example matches something, so none is inert', async () => {
    const rs = await architectureUnitEntryFile.check(ctx(COMPLIANT));
    expect(rs.filter((r) => r.route === undefined)).toEqual([]);
  });
});
```

- [x] **Step 2: Run it**

Run: `cd packages/core && ../../node_modules/.bin/vitest run test/unit-entry-file-example.test.ts`
Expected: all PASS.

If `check 3` fails on a specific key, that key's glob is wrong in **both** the test and the rule page —
fix the page's example and this test together, and re-read the "Glob depth" guidance on the page before
choosing a replacement.

- [x] **Step 3: Commit**

```bash
git add packages/core/test/unit-entry-file-example.test.ts
git commit -m "test(core): pin the documented example's coverage, not just its silence

Every error this rule's example configuration has contained was found by running
it over a real tree, and two of them produced zero findings — so the finding
count alone settles nothing. These tests assert the three things the spec asks
for: no findings on a compliant tree, a non-zero examined count, and one
assertion per declaration key so a key that silently matches nothing fails here
rather than looking clean."
```

---

### Task 6: Full verification

**Files:** none.

**Interfaces:**

- Consumes: everything above.
- Produces: a branch ready for a pull request.

- [ ] **Step 1: Run every verify command**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter docs build
```

Expected: all green, and `pnpm test` shows a higher total than before the branch.

`pnpm check:publish` runs `attw`, which fails in some sandboxes with `Command failed: npm pack` for a
local npm-cache permission reason unrelated to any branch. If that is the failure, note it and move on;
CI runs it cleanly.

- [ ] **Step 2: Confirm the rule is inert by default**

```bash
node --input-type=module -e "
import { allRules, defineConfig } from './packages/core/dist/index.js';
const r = allRules.find((x) => x.id === 'architecture/unit-entry-file');
console.log('registered:', !!r, '| severity:', r?.severity, '| options:', Object.keys(r?.options ?? {}));
const project = { hasRobotsTxt: false, hasSitemap: false, htmlLang: { presence: 'none', value: 'absent' } };
const files = ['src/lib/Card/Badge.svelte'];
console.log('findings with no config:', (await r.check({ sourceFiles: files, heads: [], project, config: defineConfig({}) })).length);
const declared = defineConfig({ rules: { 'architecture/unit-entry-file': { options: { pascalCaseUnits: { 'src/**': '.svelte' } } } } });
const rs = await r.check({ sourceFiles: files, heads: [], project, config: declared });
console.log('findings once declared:', rs.length, '|', rs[0]?.message);
"
```

Expected: `registered: true | severity: info | options: [ 'units', 'pascalCaseUnits', 'exclude' ]`,
then `findings with no config: 0`, then one finding naming `src/lib/Card/Card.svelte`. A non-zero
count with no config means the rule is not inert and must not ship.

- [ ] **Step 3: Confirm the fact reaches a real run**

```bash
node --input-type=module -e "
import { collectSourceFiles } from './packages/core/dist/index.js';
const rt = { readFile: () => Promise.reject(new Error('unused')), exists: () => Promise.resolve(false), glob: async () => ['src/b.ts', 'src/a.ts'], join: (...p) => p.join('/') };
console.log('sorted:', await collectSourceFiles(rt, '.'));
"
```

Expected: `sorted: [ 'src/a.ts', 'src/b.ts' ]`.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/unit-entry-file
```

The PR body (English) must state: the rule is inert until configured; why there are two
identification declarations rather than one; that `exclude` prunes the subtree and therefore may only
name directories holding no units; that a middle `**` matches one segment or more, which is what the
example's correctness rests on; and that a declaration matching no directory is itself reported. Link
the spec (`docs/superpowers/specs/2026-07-28-unit-entry-file-design.md`) and the charter
(`docs/superpowers/specs/2026-07-28-architecture-charter-design.md`).
