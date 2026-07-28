# `architecture/private-scope-import` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `architecture/private-scope-import`, an L3 rule that flags an import of a unit inside a declared private scope from outside that scope.

**Architecture:** A hand-written `Rule` (not the `componentRule` factory, which judges one file at a time and cannot express a verdict about a relation between two files). It iterates `ctx.components`, resolves each import specifier to a repo-relative path, finds the deepest ancestor directory matching a configured `scopes` glob, and reports when the importing file sits outside that directory's parent. Two module-private helpers in `packages/core` become exports so the rule reuses them instead of growing a second copy.

**Tech Stack:** TypeScript, `@svelte-vitals/core` (runtime-agnostic, dependency-free), vitest.

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals anywhere in `packages/core/src`. All I/O goes through the `Runtime` interface. This rule needs none.
- **No new dependencies**: `packages/core` stays dependency-free.
- **Rule registration is four places**: the import, the `allRules` array, and the re-export block in `packages/core/src/rules/index.ts`, plus the duplicate re-export list in `packages/core/src/index.ts`. TypeScript does not catch a miss in the fourth.
- **Rule docs are mandatory**: `docs/src/content/docs/rules/architecture/private-scope-import.md` (en) and `docs/src/content/docs/ja/rules/architecture/private-scope-import.md` (ja). `packages/cli/test/docs-links.test.ts` fails the build if either is missing.
- **en/ja docs stay in sync**: never ship an English-only change where the Japanese equivalent exists.
- **Conventional commits, scoped by package**: `feat(core):`, `test(core):`, `docs:`.
- **Severity is `info`** — the landing severity every new rule takes (charter release contract). Do not choose `warning`.
- **Default `scopes` is `[]`** — the rule emits nothing at all until the project declares its scopes.
- **Never name third-party tools** in commits, PR bodies, or docs.
- Verify commands: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`.

## File Structure

| File                                                                           | Responsibility                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `packages/core/src/kit-module-parse.ts` (modify)                               | Export the existing `resolveRepoLocalPath`. No behaviour change.                               |
| `packages/core/src/config-apply.ts` (modify)                                   | Export the existing `routeGlobToRegExp`. No behaviour change.                                  |
| `packages/core/src/index.ts` (modify)                                          | Public re-exports: the two helpers, plus the new rule name.                                    |
| `packages/core/src/rules/architecture/private-scope-import.ts` (create)        | The rule: scope resolution, verdict, findings.                                                 |
| `packages/core/src/rules/index.ts` (modify)                                    | Registration: import, `allRules`, re-export block.                                             |
| `packages/core/test/private-scope-import.test.ts` (create)                     | Rule behaviour, including every silent input.                                                  |
| `docs/src/content/docs/rules/architecture/private-scope-import.md` (create)    | en rule page.                                                                                  |
| `docs/src/content/docs/ja/rules/architecture/private-scope-import.md` (create) | ja rule page.                                                                                  |
| `docs/src/content/docs/guides/(setup)/configuration.mdx` (modify)              | Add the rule to the configurable-rules list.                                                   |
| `docs/src/content/docs/ja/guides/(setup)/configuration.mdx` (modify)           | Same, ja.                                                                                      |
| `.changeset/private-scope-import.md` (create)                                  | Minor for `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp`. |

---

### Task 1: Export the two helpers

Both already exist and are correct; they are module-private. Exporting them is the whole task, so the rule in Task 2 does not reimplement path resolution or glob compilation.

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts` (the `resolveRepoLocalPath` declaration, around line 476)
- Modify: `packages/core/src/config-apply.ts` (the `routeGlobToRegExp` declaration, around line 37)
- Modify: `packages/core/src/index.ts` (two re-export lines)
- Test: `packages/core/test/private-scope-import.test.ts` (new file, first two tests)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `resolveRepoLocalPath(spec: string, importerFile: string): string | undefined` — `$lib/foo` → `src/lib/foo`; `./x` / `../x` resolved against the importer's directory; `undefined` for bare packages, unknown aliases, and `..` escaping the root.
  - `routeGlobToRegExp(pattern: string): RegExp` — anchored; `*` within a segment, `**` across segments, a trailing `/**` also matching the bare prefix, everything else literal.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/private-scope-import.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveRepoLocalPath, routeGlobToRegExp } from '../src/index.js';

describe('resolveRepoLocalPath (exported for private-scope-import)', () => {
  it('maps $lib/ to src/lib/', () => {
    expect(resolveRepoLocalPath('$lib/Button.svelte', 'src/routes/+page.svelte')).toBe('src/lib/Button.svelte');
  });
  it('resolves a relative specifier against the importer directory', () => {
    expect(resolveRepoLocalPath('./parts/Badge.svelte', 'src/lib/Card/Card.svelte')).toBe(
      'src/lib/Card/parts/Badge.svelte'
    );
  });
  it('returns undefined for a bare package and for an unknown alias', () => {
    expect(resolveRepoLocalPath('lodash', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$app/state', 'src/lib/C.svelte')).toBeUndefined();
    expect(resolveRepoLocalPath('$myalias/lib/x', 'src/lib/C.svelte')).toBeUndefined();
  });
  it('returns undefined when .. escapes the repo root', () => {
    expect(resolveRepoLocalPath('../../../../x', 'src/lib/C.svelte')).toBeUndefined();
  });
});

describe('routeGlobToRegExp (exported for private-scope-import)', () => {
  it('matches ** across segments but not zero segments in a middle position', () => {
    const re = routeGlobToRegExp('src/routes/**/components');
    expect(re.test('src/routes/a/components')).toBe(true);
    expect(re.test('src/routes/a/b/components')).toBe(true);
    expect(re.test('src/routes/components')).toBe(false);
  });
  it('treats SvelteKit bracket and paren segments as literal', () => {
    expect(routeGlobToRegExp('src/routes/**/components').test('src/routes/[id=integer]/components')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- test/private-scope-import.test.ts`
Expected: FAIL — the module has no exported `resolveRepoLocalPath` / `routeGlobToRegExp`.

- [ ] **Step 3: Export both helpers**

In `packages/core/src/kit-module-parse.ts`, change the declaration (keep the doc comment above it, and add the sentence explaining the export):

```ts
/**
 * Resolve an import specifier to a repo-relative path against the importing file, or
 * undefined when it cannot be a repo-local module: `$lib/` maps to `src/lib/`, `./`/`../`
 * resolve against the importing file's directory; bare packages and other aliases are
 * skipped (they can't be resolved to a repo-local path at all). Also undefined when a
 * relative specifier's `..` segments escape the repo root — see `normalizePosix`.
 *
 * Exported because `architecture/private-scope-import` needs resolution that is not
 * restricted to runes modules, unlike `resolveRunesModuleSpecifier`. Keep every alias
 * mapping inside this one function: adding `svelte.config.js` alias support later must
 * stay a single-site change.
 */
export function resolveRepoLocalPath(spec: string, importerFile: string): string | undefined {
```

In `packages/core/src/config-apply.ts`, change the declaration (keep the doc comment and the `�` note above it, and add):

```ts
/**
 * …existing comment…
 *
 * Exported so a rule that matches paths against user globs (`architecture/private-scope-import`)
 * compiles them with the same semantics as `route`/`files` overrides, rather than a second
 * implementation that could drift.
 */
export function routeGlobToRegExp(pattern: string): RegExp {
```

In `packages/core/src/index.ts`, add `routeGlobToRegExp` to the existing `config-apply.js` export block:

```ts
export {
  selectRules,
  applyRuleSeverities,
  applyOverrides,
  compileOverrides,
  overrideMatches,
  routeGlobToRegExp,
  settingSeverity,
  settingOptions
} from './config-apply.js';
```

and add `resolveRepoLocalPath` to the existing `kit-module-parse.js` export:

```ts
export { parseKitModuleFacts, resolveRunesModuleSpecifier, resolveRepoLocalPath } from './kit-module-parse.js';
```

Note: the existing `kit-module-parse.js` export line may list a different set of names — add `resolveRepoLocalPath` to whatever is already there rather than replacing the line.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core test -- test/private-scope-import.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/kit-module-parse.ts packages/core/src/config-apply.ts packages/core/src/index.ts packages/core/test/private-scope-import.test.ts
git commit -m "refactor(core): export resolveRepoLocalPath and routeGlobToRegExp

Both are correct and already used internally; a rule that matches user globs
against repo-relative paths needs them. Exporting keeps the alias mapping and
the glob semantics in one place each instead of growing a second copy."
```

---

### Task 2: The rule — boundary resolution and verdict

**Files:**

- Create: `packages/core/src/rules/architecture/private-scope-import.ts`
- Test: `packages/core/test/private-scope-import.test.ts` (append)

**Interfaces:**

- Consumes: `resolveRepoLocalPath`, `routeGlobToRegExp` (Task 1); `listOption`, `resolveRuleOptions`, `type RuleOptionsSpec` from `../../rule-options.js`; `compileOverrides` from `../../config-apply.js`; `docsUrlFor`, `type Rule`, `type RuleContext` from `../../rule.js`; `type Result` from `../../types.js`.
- Produces: `export const architecturePrivateScopeImport: Rule` with `id: 'architecture/private-scope-import'`.

Rule semantics, restated so the implementer needs nothing else:

1. `scopes` is a `string-list` option, default `[]`. Empty → return `[]` immediately.
2. For each component, for each entry of `c.importSpans ?? c.imports.map((source) => ({ source, line: 0 }))`:
   - `resolveRepoLocalPath(source, c.file)`; `undefined` → skip.
   - Take the resolved path's directory chain (every ancestor directory, not the file itself) and find the **deepest** one matching any compiled `scopes` glob. None → skip.
   - The boundary is that directory's parent (`''` when the marker is a top-level segment).
   - `c.file` is inside the boundary when it starts with `` `${boundary}/` `` — or always, when the boundary is `''`. Not inside → a violation.
3. A component with no import that resolved into a marked scope emits nothing.
4. All in-scope imports legal → one PASS result. Any violation → one penalized result per violating import.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/private-scope-import.test.ts`:

```ts
import { architecturePrivateScopeImport } from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/index.js';

const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

const comp = (over: Partial<ComponentFacts>): ComponentFacts => ({
  file: 'src/lib/C.svelte',
  eachBlocks: [],
  effects: [],
  htmlTags: [],
  javascriptUrls: [],
  loc: 10,
  propCount: 0,
  imports: [],
  importSpans: [],
  namespaceImports: [],
  constableStates: [],
  mutatedProps: [],
  stalePropDerivations: [],
  rawableStates: [],
  nonreactiveBuiltinStates: [],
  checkableBindValues: [],
  basePathLinks: [],
  orphanEffects: [],
  orphanLifecycleCalls: [],
  browserGlobalRefs: [],
  moduleStateDecls: [],
  suppressions: [],
  ...over
});

/** Context with `scopes` declared globally. */
const scoped = (components: ComponentFacts[], scopes: string[]): RuleContext => ({
  components,
  heads: [],
  project: defaultProject,
  config: defineConfig({ rules: { 'architecture/private-scope-import': { options: { scopes } } } })
});

const SCOPES = ['**/parts', 'src/routes/**/components'];

describe('architecture/private-scope-import', () => {
  it('emits nothing when scopes is not declared', async () => {
    const c = comp({
      file: 'src/routes/other/+page.svelte',
      importSpans: [{ source: '../../lib/Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = { components: [c], heads: [], project: defaultProject, config: defineConfig({}) };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });

  it('flags an import of a parts/ unit from outside the owning unit', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/Badge.svelte', line: 7 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.id).toBe('architecture/private-scope-import');
    expect(rs[0]!.category).toBe('architecture');
    expect(rs[0]!.severity).toBe('info');
    expect(rs[0]!.location).toBe('src/lib/Other/Other.svelte');
    expect(rs[0]!.line).toBe(7);
    expect(rs[0]!.message).toContain('src/lib/Card/parts/Badge.svelte');
    expect(rs[0]!.message).toContain('src/lib/Card');
    expect(rs[0]!.fix?.description.length).toBeGreaterThan(0);
    expect(rs[0]!.fix?.snippet).toBeUndefined();
  });

  it('passes an import of a parts/ unit from inside the owning unit', async () => {
    const c = comp({ file: 'src/lib/Card/Card.svelte', importSpans: [{ source: './parts/Badge.svelte', line: 2 }] });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });

  it('passes a sibling import within the same parts/ directory', async () => {
    const c = comp({
      file: 'src/lib/Card/parts/Badge/Badge.svelte',
      importSpans: [{ source: '../Label/Label.svelte', line: 2 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });

  it('scopes a route components/ directory to that route subtree', async () => {
    const inside = comp({
      file: 'src/routes/search/hallList/+page.svelte',
      importSpans: [{ source: './components/Search/Search.svelte', line: 4 }]
    });
    const outside = comp({
      file: 'src/routes/other/+page.svelte',
      importSpans: [{ source: '../search/hallList/components/Search/Search.svelte', line: 4 }]
    });
    expect(fails(await architecturePrivateScopeImport.check(scoped([inside], SCOPES)))).toHaveLength(0);
    expect(fails(await architecturePrivateScopeImport.check(scoped([outside], SCOPES)))).toHaveLength(1);
  });

  it('leaves src/lib/components unconstrained', async () => {
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [{ source: '$lib/components/Button/Button.svelte', line: 1 }]
    });
    expect(await architecturePrivateScopeImport.check(scoped([c], SCOPES))).toEqual([]);
  });

  it('takes the deepest marker when scopes nest', async () => {
    // Boundary is src/lib/A/parts/B, so an importer in src/lib/A is outside it.
    const c = comp({
      file: 'src/lib/A/A.svelte',
      importSpans: [{ source: './parts/B/parts/C/C.svelte', line: 5 }]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.message).toContain('src/lib/A/parts/B');
  });

  it('reports one finding per violating import', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [
        { source: '../Card/parts/Badge.svelte', line: 3 },
        { source: '../Card/parts/Label.svelte', line: 4 }
      ]
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(2);
    expect(fails(rs).map((r) => r.line)).toEqual([3, 4]);
  });

  it('stays silent on specifiers it cannot resolve', async () => {
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [
        { source: 'lodash', line: 1 },
        { source: '$app/state', line: 2 },
        { source: '$myalias/lib/Card/parts/Badge.svelte', line: 3 },
        { source: '../../../../elsewhere/parts/X.svelte', line: 4 }
      ]
    });
    expect(await architecturePrivateScopeImport.check(scoped([c], SCOPES))).toEqual([]);
  });

  it('falls back to line 0 when importSpans is absent', async () => {
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      imports: ['../Card/parts/Badge.svelte'],
      importSpans: undefined as unknown as ComponentFacts['importSpans']
    });
    const rs = await architecturePrivateScopeImport.check(scoped([c], SCOPES));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.line).toBeUndefined();
  });

  it('emits nothing when ctx.components is unset', async () => {
    const ctx: RuleContext = {
      heads: [],
      project: defaultProject,
      config: defineConfig({ rules: { 'architecture/private-scope-import': { options: { scopes: SCOPES } } } })
    };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- test/private-scope-import.test.ts`
Expected: FAIL — `architecturePrivateScopeImport` is not exported.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/architecture/private-scope-import.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { compileOverrides, routeGlobToRegExp } from '../../config-apply.js';
import { resolveRepoLocalPath } from '../../kit-module-parse.js';
import { listOption, resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';

const docsUrl = docsUrlFor('architecture/private-scope-import');
const recommendation =
  'Move the unit to the directory shared by all of its importers, or import it only from inside its own scope.';

// Inert by default: with no declared scope there is no convention to check, and
// svelte-vitals never guesses which directories a project treats as private.
const OPTIONS: RuleOptionsSpec = { scopes: { kind: 'string-list', default: [] } };

/** Every ancestor directory of `file`, deepest first (`a/b/c.svelte` → ['a/b', 'a']). */
function ancestorDirs(file: string): string[] {
  const segments = file.split('/');
  const out: string[] = [];
  for (let i = segments.length - 1; i > 0; i--) out.push(segments.slice(0, i).join('/'));
  return out;
}

/**
 * The boundary of the private scope containing `target` — the marker directory's parent
 * (`''` when the marker is a top-level segment, i.e. the repo root) — or undefined when none
 * of `patterns` matches an ancestor. The DEEPEST match wins so nested scopes stay private to
 * their immediate owner rather than only to the outermost one.
 */
function privateScopeOf(target: string, patterns: RegExp[]): string | undefined {
  for (const dir of ancestorDirs(target)) {
    if (!patterns.some((p) => p.test(dir))) continue;
    const cut = dir.lastIndexOf('/');
    return cut === -1 ? '' : dir.slice(0, cut);
  }
  return undefined;
}

/** Whether `file` lives inside `boundary` (an empty boundary is the repo root — always inside). */
function isInside(file: string, boundary: string): boolean {
  return boundary === '' || file.startsWith(`${boundary}/`);
}

/**
 * architecture/private-scope-import — a unit inside a declared private scope must not be
 * imported from outside that scope (design 2026-07-28). L3: the scopes are declared by the
 * project via the `scopes` option and never inferred, so the rule is inert until then.
 *
 * Findings are reported at the import site, not at the imported unit: `--diff` filters
 * results to the files that changed, and the author of the violation edited the importer.
 */
export const architecturePrivateScopeImport: Rule = {
  id: 'architecture/private-scope-import',
  title: 'Private-scope import',
  category: 'architecture',
  severity: 'info',
  scope: 'component',
  rationale:
    'A unit placed inside a private directory is written for one owner; importing it from elsewhere couples two parts of the tree that were meant to move independently, and the unit belongs higher up instead.',
  fix: {
    description:
      'Move this unit out of its private scope, to the directory shared by all of its importers, and update this import.'
  },
  options: OPTIONS,
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    // Hoisted: compiling every override's globs once, not once per component.
    const compiled = compileOverrides(ctx.config);
    // An `overrides` entry can declare different scopes for different paths, so options
    // resolve per component — but the compiled patterns are memoised on the resolved list,
    // since a project has a handful of distinct lists and thousands of files.
    const patternCache = new Map<string, RegExp[]>();
    const compileScopes = (scopes: string[]): RegExp[] => {
      const key = JSON.stringify(scopes);
      let patterns = patternCache.get(key);
      if (patterns === undefined) {
        patterns = scopes.map(routeGlobToRegExp);
        patternCache.set(key, patterns);
      }
      return patterns;
    };
    for (const c of ctx.components ?? []) {
      const o = resolveRuleOptions(
        'architecture/private-scope-import',
        OPTIONS,
        ctx.config,
        { route: c.file, file: c.file },
        compiled
      );
      const scopes = listOption(o, 'scopes');
      if (scopes.length === 0) continue; // nothing declared for this file → inert
      const patterns = compileScopes(scopes);
      const spans = c.importSpans ?? c.imports.map((source) => ({ source, line: 0 }));
      let sawScopedImport = false;
      const violations: { line: number; message: string }[] = [];
      for (const { source, line } of spans) {
        const target = resolveRepoLocalPath(source, c.file);
        if (target === undefined) continue; // bare package, unknown alias, or escapes the root
        const boundary = privateScopeOf(target, patterns);
        if (boundary === undefined) continue; // not in a private scope
        sawScopedImport = true;
        if (isInside(c.file, boundary)) continue;
        // `boundary` is never '' here: an empty boundary is the repo root, and `isInside`
        // already accepted every importer above.
        violations.push({ line, message: `${target} is private to ${boundary}` });
      }
      if (!sawScopedImport) continue; // no signal in this file → neither penalize nor seed
      if (violations.length === 0) {
        out.push({
          id: 'architecture/private-scope-import',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'own', value: 'static' },
          route: c.file,
          message: 'Private-scope import',
          recommendation,
          docsUrl
        });
        continue;
      }
      for (const v of violations) {
        out.push({
          id: 'architecture/private-scope-import',
          category: 'architecture',
          severity: 'info',
          detection: { presence: 'none', value: 'absent' },
          route: c.file,
          location: c.file,
          ...(v.line > 0 ? { line: v.line } : {}),
          message: v.message,
          recommendation,
          docsUrl,
          fix: { ...(architecturePrivateScopeImport.fix as NonNullable<Rule['fix']>) }
        });
      }
    }
    return out;
  }
};
```

- [ ] **Step 4: Register the rule in all four places**

In `packages/core/src/rules/index.ts`, add the import next to the other architecture imports:

```ts
import { architecturePrivateScopeImport } from './architecture/private-scope-import.js';
```

add it to the `allRules` array next to `architecturePropCount`, and add it to the re-export block at the bottom of the same file.

In `packages/core/src/index.ts`, add `architecturePrivateScopeImport` to the `export { … } from './rules/index.js'` list next to `architecturePropCount`.

- [ ] **Step 5: Verify all four registrations landed**

Run: `grep -c architecturePrivateScopeImport packages/core/src/rules/index.ts packages/core/src/index.ts`
Expected: `3` for `rules/index.ts` and `1` for `index.ts`. Any other numbers mean a site was missed — TypeScript will not tell you, because the fourth is a plain re-export list.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- test/private-scope-import.test.ts`
Expected: PASS (17 tests total in the file).

- [ ] **Step 7: Run the whole core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: all green. A rule added to `allRules` participates in registry-wide tests, so a failure here is about the new rule's metadata, not about the tests you wrote.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/architecture/private-scope-import.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/private-scope-import.test.ts
git commit -m "feat(core): add architecture/private-scope-import

A unit inside a declared private scope must not be imported from outside that
scope. L3 under the Architecture charter: the scopes come from the project's
own \`scopes\` option and are never inferred, so the rule is inert until
declared.

\`scopes\` globs match the marker directory and the boundary is its parent, so
the same directory name means different things in different places — a route's
components/ is private to that route while src/lib/components is not. The
deepest matching marker wins, keeping nested scopes private to their immediate
owner.

Reported at the import site rather than the imported unit: --diff filters to
changed files, and the author of the violation edited the importer."
```

---

### Task 3: Per-path options parity

The per-rule-options work requires that a `files:`-scoped override's options reach the run, not only its severity. This rule resolves options per component keyed on `c.file`, which is the same target `applyOverrides` matches a penalized result's `location` against. Pin that.

**Files:**

- Test: `packages/core/test/private-scope-import.test.ts` (append)

**Interfaces:**

- Consumes: `architecturePrivateScopeImport` (Task 2), `applyOverrides` from `../src/index.js`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/private-scope-import.test.ts` (and add `applyOverrides` to the existing `../src/index.js` import):

```ts
describe('architecture/private-scope-import per-path options', () => {
  it('applies scopes declared in a files:-scoped override, and its severity too', async () => {
    const cfg = {
      overrides: [
        {
          files: 'src/lib/**',
          rules: {
            'architecture/private-scope-import': {
              severity: 'warning' as const,
              options: { scopes: ['**/parts'] }
            }
          }
        }
      ]
    };
    const c = comp({
      file: 'src/lib/Other/Other.svelte',
      importSpans: [{ source: '../Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = {
      components: [c],
      heads: [],
      project: defaultProject,
      config: defineConfig(cfg)
    };
    const rs = await architecturePrivateScopeImport.check(ctx);
    // Options resolved during the run: the scope is only in effect because of the override.
    expect(fails(rs)).toHaveLength(1);
    // Severity resolved in the post-pass, matched by the same files glob on the same location.
    const applied = applyOverrides(rs, defineConfig(cfg));
    expect(applied.find((r) => r.detection.value === 'absent')?.severity).toBe('warning');
  });

  it('leaves a file outside the override untouched', async () => {
    const cfg = {
      overrides: [
        { files: 'src/lib/**', rules: { 'architecture/private-scope-import': { options: { scopes: ['**/parts'] } } } }
      ]
    };
    const c = comp({
      file: 'src/routes/+page.svelte',
      importSpans: [{ source: '../lib/Card/parts/Badge.svelte', line: 3 }]
    });
    const ctx: RuleContext = { components: [c], heads: [], project: defaultProject, config: defineConfig(cfg) };
    expect(await architecturePrivateScopeImport.check(ctx)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @svelte-vitals/core test -- test/private-scope-import.test.ts`
Expected: PASS. Task 2's implementation already resolves options per component, so these pin existing behaviour rather than driving new code. If the first one fails, the options target in `check` is wrong — it must be `{ route: c.file, file: c.file }`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/private-scope-import.test.ts
git commit -m "test(core): pin per-path options parity for private-scope-import

A files:-scoped override must deliver both its severity and its options to the
same file. Severity resolves after the run and options during it, so the two
paths have to agree on the target; this fails if they ever stop agreeing."
```

---

### Task 4: Config-file validation reaches the new option

The CLI's config loader validates every rule setting against the rule's declared options. Confirm the new option is covered by that machinery — an unknown key must be fatal, and a wrongly-typed `scopes` must be fatal.

**Files:**

- Create: `packages/cli/test/fixtures/config-file-private-scope-unknown-option/svelte-vitals.config.mjs`
- Create: `packages/cli/test/fixtures/config-file-private-scope-bad-type/svelte-vitals.config.mjs`
- Modify: `packages/cli/test/config-file.test.ts`

**Interfaces:**

- Consumes: `loadConfigFile` from `../src/config-file.js`; the rule's `scopes` option (Task 2).
- Produces: nothing.

- [ ] **Step 1: Create the fixtures**

`packages/cli/test/fixtures/config-file-private-scope-unknown-option/svelte-vitals.config.mjs`:

```js
/** 'scope' is not an option of architecture/private-scope-import; 'scopes' is. */
export default {
  rules: {
    'architecture/private-scope-import': { options: { scope: ['**/parts'] } }
  }
};
```

`packages/cli/test/fixtures/config-file-private-scope-bad-type/svelte-vitals.config.mjs`:

```js
/** scopes is a list of globs, not a single string. */
export default {
  rules: {
    'architecture/private-scope-import': { options: { scopes: '**/parts' } }
  }
};
```

- [ ] **Step 2: Write the failing tests**

Append inside the existing `describe('loadConfigFile', …)` in `packages/cli/test/config-file.test.ts`:

```ts
it('rejects an unknown option on architecture/private-scope-import', async () => {
  await expect(loadConfigFile(fixture('config-file-private-scope-unknown-option'))).rejects.toThrow(
    /unknown option 'scope'/
  );
});

it('rejects a non-list scopes value', async () => {
  await expect(loadConfigFile(fixture('config-file-private-scope-bad-type'))).rejects.toThrow(
    /must be an array of non-empty strings/
  );
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter svelte-vitals test -- test/config-file.test.ts`
Expected: PASS. The validation is generic over a rule's declared options, so these confirm the new rule is wired into it rather than adding validation code. A failure means the rule is missing from `allRules` — go back to Task 2 Step 5.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/test/fixtures/config-file-private-scope-unknown-option packages/cli/test/fixtures/config-file-private-scope-bad-type packages/cli/test/config-file.test.ts
git commit -m "test(cli): cover config validation for the private-scope-import option"
```

---

### Task 5: Documentation and changeset

**Files:**

- Create: `docs/src/content/docs/rules/architecture/private-scope-import.md`
- Create: `docs/src/content/docs/ja/rules/architecture/private-scope-import.md`
- Modify: `docs/src/content/docs/guides/(setup)/configuration.mdx` (the configurable-rules bullet list under "Rule options")
- Modify: `docs/src/content/docs/ja/guides/(setup)/configuration.mdx` (same list)
- Create: `.changeset/private-scope-import.md`

**Interfaces:**

- Consumes: the rule id and option name from Task 2.
- Produces: nothing.

- [ ] **Step 1: Write the en rule page**

Create `docs/src/content/docs/rules/architecture/private-scope-import.md`:

````markdown
---
title: architecture/private-scope-import · Private-scope import
description: A unit inside a private directory should not be imported from outside it.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags an import of a file inside a directory you have declared private, made from outside that directory's owner.

This rule is **off until you configure it**. It has no default convention, because where a project keeps its private code is the project's own decision.

## Why it matters

Code placed in a private directory is written for one owner. Importing it from elsewhere couples two parts of the tree that were meant to move independently: renaming or deleting the owner now breaks a stranger. The unit belongs higher up — in the directory its importers share.

## How to fix

Move the unit out of its private directory, up to the directory shared by all of its importers, and update the import paths. Or keep it private and import it only from inside its own scope.

## Configuration

| Option   | Type          | Default |
| -------- | ------------- | ------- |
| `scopes` | list of globs | `[]`    |

Each glob matches a **private directory**, and its **parent** becomes the boundary: files inside the parent may import from it, files outside may not.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': {
      options: { scopes: ['**/parts', 'src/routes/**/components'] }
    }
  }
};
```

With that configuration:

- `Card/parts/Badge.svelte` is importable from anywhere under `Card/`, and nowhere else.
- `src/routes/blog/components/Toc.svelte` is importable from anywhere under `src/routes/blog/`, and nowhere else.
- `src/lib/components/Button.svelte` is unconstrained — no glob matches it, so the same directory name means something different here.

When private directories nest, the innermost one wins: with `**/parts`, a unit in `A/parts/B/parts/C` is private to `A/parts/B`, not to `A`.

In globs, `*` matches within a path segment and `**` across segments. A `**` between two segments matches one segment or more, not zero — so `src/routes/**/components` does not match `src/routes/components`. List both patterns if you have a private directory at that level.

## Limitations

Imports written through a custom alias configured in `svelte.config.js` are not checked yet; `$lib/` and relative specifiers are.

Only imports written in `.svelte` components are checked. Imports written in a `.svelte.ts` / `.svelte.js` module, or in a Kit module such as `+page.ts` or `+server.ts`, are not checked yet.

Both are gaps being closed, not deliberate exemptions.
````

- [ ] **Step 2: Write the ja rule page**

Create `docs/src/content/docs/ja/rules/architecture/private-scope-import.md`:

````markdown
---
title: architecture/private-scope-import · プライベートスコープの import
description: プライベートなディレクトリ内のユニットを、その外から import すべきではありません。
---

**重大度:** info · **カテゴリ:** architecture

## チェック内容

プライベートだと宣言したディレクトリの中にあるファイルを、その所有者の外から import している箇所を検出します。

このルールは**設定するまで無効**です。既定の規約を持ちません。プライベートなコードをどこに置くかは、プロジェクト自身が決めることだからです。

## なぜ重要か

プライベートなディレクトリに置いたコードは、1つの所有者のために書かれています。それを外から import すると、独立して動かせるはずだった2つの箇所が結合します。所有者の名前を変えたり削除したりすると、無関係な場所が壊れるようになります。そのユニットは、import している箇所すべてが共有するディレクトリ、つまり一段上に属します。

## 修正方法

そのユニットをプライベートなディレクトリから出し、import している箇所すべての共通のディレクトリへ移して、import のパスを更新します。あるいはプライベートなまま残し、自身のスコープの内側からのみ import します。

## 設定

| オプション | 型            | デフォルト |
| ---------- | ------------- | ---------- |
| `scopes`   | glob のリスト | `[]`       |

各 glob は**プライベートなディレクトリ**にマッチし、その**親**が境界になります。親の内側にあるファイルはそこから import できますが、外側のファイルはできません。

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': {
      options: { scopes: ['**/parts', 'src/routes/**/components'] }
    }
  }
};
```

この設定では次のようになります。

- `Card/parts/Badge.svelte` は `Card/` 配下からのみ import できます。
- `src/routes/blog/components/Toc.svelte` は `src/routes/blog/` 配下からのみ import できます。
- `src/lib/components/Button.svelte` は制約を受けません。どの glob にもマッチしないため、同じディレクトリ名でも意味が変わります。

プライベートなディレクトリが入れ子になっている場合は、内側が優先されます。`**/parts` を指定したとき、`A/parts/B/parts/C` にあるユニットは `A` ではなく `A/parts/B` に対してプライベートです。

glob では `*` がパスセグメント内、`**` がセグメントをまたいでマッチします。2つのセグメントに挟まれた `**` は1セグメント以上にマッチし、0セグメントにはマッチしません。そのため `src/routes/**/components` は `src/routes/components` にマッチしません。その位置にプライベートなディレクトリがある場合は、両方のパターンを列挙してください。

## 制限

`svelte.config.js` で設定した独自エイリアス経由の import は、まだ検査していません（`$lib/` と相対指定子は検査します）。

検査するのは `.svelte` コンポーネントに書かれた import だけです。`.svelte.ts` / `.svelte.js` モジュールや、`+page.ts` / `+server.ts` のような Kit モジュールに書かれた import は、まだ検査対象外です。

どちらも意図的な除外ではなく、解消予定のギャップです。
````

- [ ] **Step 3: Add the rule to both configuration guides**

In `docs/src/content/docs/guides/(setup)/configuration.mdx`, add a bullet to the list of rules that take options (the list currently ending with the `performance/preconnect` entry):

```markdown
- [`architecture/private-scope-import`](/rules/architecture/private-scope-import) — a `scopes` list of
  globs naming private directories. The rule is inert until you set it.
```

In `docs/src/content/docs/ja/guides/(setup)/configuration.mdx`, add the matching bullet to the same list:

```markdown
- [`architecture/private-scope-import`](/ja/rules/architecture/private-scope-import) — プライベートな
  ディレクトリを指定する `scopes` の glob リスト。設定するまでこのルールは何も出力しません。
```

- [ ] **Step 4: Write the changeset**

Create `.changeset/private-scope-import.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

New rule `architecture/private-scope-import`: a unit inside a directory you have declared private
must not be imported from outside that directory's owner. It is **inert until configured** — set
`scopes` to a list of globs naming your private directories, and nothing changes for projects that
do not.

Each glob matches a private directory and its parent becomes the boundary, so the same directory
name can mean different things in different places: with `scopes: ['src/routes/**/components']`, a
route's `components/` is private to that route while `src/lib/components` stays shared. When private
directories nest, the innermost one wins.

Imports through a custom `svelte.config.js` alias, and imports made from `.svelte.ts` / `+page.ts`
modules, are not checked yet.
```

- [ ] **Step 5: Verify the docs-link test passes**

Run: `pnpm --filter svelte-vitals test -- test/docs-links.test.ts`
Expected: PASS. This test fails if either language's rule page is missing, so it is the check that both landed.

- [ ] **Step 6: Format, lint, and build the docs**

Run: `pnpm format && pnpm lint && pnpm --filter docs build`
Expected: formatting rewrites nothing unexpected, lint is clean, docs build succeeds.

- [ ] **Step 7: Commit**

```bash
git add docs/src/content/docs/rules/architecture/private-scope-import.md docs/src/content/docs/ja/rules/architecture/private-scope-import.md "docs/src/content/docs/guides/(setup)/configuration.mdx" "docs/src/content/docs/ja/guides/(setup)/configuration.mdx" .changeset/private-scope-import.md
git commit -m "docs: document architecture/private-scope-import (en + ja)

Both rule pages state the current gaps — alias-resolved imports and imports from
.svelte.ts / +page.ts modules — in the present tense, since both are being
closed rather than deliberately exempted."
```

---

### Task 6: Full verification

**Files:** none.

**Interfaces:**

- Consumes: everything above.
- Produces: a branch ready for a PR.

- [ ] **Step 1: Run every verify command**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm check:publish
pnpm --filter docs build
```

Expected: all green. `pnpm test` must show a higher total than before the branch (the new rule's tests plus the CLI fixtures).

- [ ] **Step 2: Confirm the rule is inert by default**

Run:

```bash
node --input-type=module -e "
import { allRules, defineConfig } from './packages/core/dist/index.js';
const r = allRules.find((x) => x.id === 'architecture/private-scope-import');
console.log('registered:', !!r, '| severity:', r?.severity, '| options:', Object.keys(r?.options ?? {}));
const ctx = { components: [{ file: 'src/lib/A/A.svelte', imports: ['../B/parts/C.svelte'], importSpans: [{ source: '../B/parts/C.svelte', line: 1 }], eachBlocks: [], effects: [], htmlTags: [], javascriptUrls: [], loc: 1, propCount: 0, namespaceImports: [], constableStates: [], mutatedProps: [], stalePropDerivations: [], rawableStates: [], nonreactiveBuiltinStates: [], checkableBindValues: [], basePathLinks: [], orphanEffects: [], orphanLifecycleCalls: [], browserGlobalRefs: [], moduleStateDecls: [], suppressions: [] }], heads: [], project: { hasRobotsTxt: false, hasSitemap: false, htmlLang: { presence: 'none', value: 'absent' } }, config: defineConfig({}) };
console.log('findings with no config:', (await r.check(ctx)).length);
"
```

Expected: `registered: true | severity: info | options: [ 'scopes' ]` and `findings with no config: 0`. A non-zero count means the rule is not inert and must not ship.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/private-scope-import
```

PR body (English) must state: the rule is inert until configured; the boundary rule (glob matches the private directory, parent is the boundary) and why matching bare names was rejected; that findings are reported at the import site and why; and the two gaps left for follow-up. Link the spec (`docs/superpowers/specs/2026-07-28-private-scope-import-design.md`) and the charter.
