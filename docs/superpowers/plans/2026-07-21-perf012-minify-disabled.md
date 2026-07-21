# PERF012 Minification Disabled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PERF012, a project-scope Performance rule that flags a literal `build.minify: false` left in `vite.config.*`, fed by a CLI static parser and by the Vite plugin's resolved config.

**Architecture:** A pure parser in core (`findMinifyDisabled`) detects the literal override in a Vite config source string. The CLI reads the config through `Runtime` and sets a new optional `Project.viteMinifyDisabled` fact; the Vite plugin instead reads the **resolved** `config.build.minify` in `configResolved` (exact even for function-form configs) and re-parses the config source only to locate the line. The rule itself is a plain project-scope `Rule` reading `ctx.project.viteMinifyDisabled`.

**Tech Stack:** TypeScript, svelte/compiler wrap-parse (via existing `parseModuleProgram`), vitest, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-07-21-perf012-minify-disabled-design.md` (approved).

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals anywhere in `packages/core/src` (design §8). Callers read files and pass source strings.
- Detect **only** literal `build.minify: false`. Never flag: function-form configs (CLI channel), non-literal values, `'esbuild'`/`'terser'`/`true`, `minify` outside `build`, projects without a Vite config, unparsable sources (return `undefined`, never throw).
- The rule emits a finding **only when the fact is set** — no pass result (spec: "if `ctx.project.viteMinifyDisabled` is set, return one finding").
- Finding message (exact): `JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger.`
- Rule metadata: id `PERF012`, title `Minification disabled`, category `performance`, severity `warning`, scope `project`.
- CLI probes Vite configs in Vite's own resolution order: `vite.config.js`, `vite.config.mjs`, `vite.config.ts`, `vite.config.cjs`, `vite.config.mts`, `vite.config.cts` — only the first existing file is analyzed.
- `findMinifyDisabled` takes the RAW source, wraps internally, and returns the line already −1-shifted to original-source coordinates (callers use it as-is). This is the opposite division of labor from `findSsrFalseOptOut` — do not copy that function's line contract.
- Registration in four places; verify with `grep -rn "perf012MinifyDisabled" packages/core/src` expecting exactly 5 hits.
- Before running cli/vite package tests, build core first: `pnpm --filter @svelte-vitals/core build`.
- Conventional commits scoped by package (`feat(core):`, `feat(cli):`, `feat(vite):`, `docs:`, `chore(action):`).

---

### Task 1: Core parser `findMinifyDisabled`

**Files:**

- Create: `packages/core/src/vite-config-parse.ts`
- Modify: `packages/core/src/kit-module-parse.ts` (export two existing private helpers)
- Modify: `packages/core/src/index.ts` (export `findMinifyDisabled`)
- Test: `packages/core/test/vite-config-parse.test.ts`

**Interfaces:**

- Consumes: `parseModuleProgram(source, filename)` from `./component-parse.js` (returns `{ program, wrapped }`), `lineOf(source, offset)` from `./svelte-ast.js`, and `unwrapTs` / `collectTopLevelBindings` from `./kit-module-parse.js` (exported in this task).
- Produces: `findMinifyDisabled(source: string): { line: number } | undefined` — exported from core's index for the CLI and Vite packages (Tasks 3–4).

- [ ] **Step 1: Export the two helpers from kit-module-parse**

In `packages/core/src/kit-module-parse.ts`, change these two declarations (keep bodies and doc comments untouched, just add `export`):

```ts
/** Unwrap TS wrapper expressions (`x satisfies T`, `x as T`) to the underlying expression. */
export function unwrapTs(expr: Node): Node {
```

```ts
export function collectTopLevelBindings(program: Node): Map<string, Node> {
```

(They are pure AST helpers also needed by the new Vite-config parser; they are NOT re-exported from core's public index.)

- [ ] **Step 2: Write the failing tests**

Create `packages/core/test/vite-config-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findMinifyDisabled } from '../src/vite-config-parse.js';

describe('findMinifyDisabled', () => {
  it('detects a literal build.minify: false in a defineConfig call', () => {
    const src = `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: false
  }
});
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 5 });
  });

  it('detects it in a plain default-exported object', () => {
    const src = `export default {
  build: { minify: false }
};
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 2 });
  });

  it('resolves a same-file alias export', () => {
    const src = `import { defineConfig } from 'vite';
const config = defineConfig({
  build: {
    minify: false
  }
});
export default config;
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 4 });
  });

  it('unwraps satisfies/as on the config and on nested values', () => {
    const src = `import type { UserConfig } from 'vite';
export default {
  build: {
    minify: false as const
  }
} satisfies UserConfig;
`;
    expect(findMinifyDisabled(src)).toEqual({ line: 4 });
  });

  it('accepts a string-literal build key', () => {
    const src = `export default { 'build': { minify: false } };\n`;
    expect(findMinifyDisabled(src)).toEqual({ line: 1 });
  });

  it('skips function-form configs', () => {
    const src = `import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  build: { minify: mode === 'production' ? 'esbuild' : false }
}));
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('skips non-literal minify values', () => {
    const src = `const DEBUG = true;
export default { build: { minify: DEBUG ? false : 'esbuild' } };
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
    expect(findMinifyDisabled(`export default { build: { minify: DEBUG } };\n`)).toBeUndefined();
  });

  it("does not flag 'esbuild' / 'terser' / true", () => {
    for (const v of [`'esbuild'`, `'terser'`, `true`]) {
      expect(findMinifyDisabled(`export default { build: { minify: ${v} } };\n`)).toBeUndefined();
    }
  });

  it('ignores minify keys outside the build object', () => {
    const src = `export default {
  plugins: [{ options: { minify: false } }],
  worker: { minify: false }
};
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('ignores computed keys', () => {
    const src = `const k = 'minify';
export default { build: { [k]: false } };
`;
    expect(findMinifyDisabled(src)).toBeUndefined();
  });

  it('returns undefined with no default export', () => {
    expect(findMinifyDisabled(`export const build = { minify: false };\n`)).toBeUndefined();
  });

  it('returns undefined (never throws) on malformed source', () => {
    expect(findMinifyDisabled(`export default {{{`)).toBeUndefined();
    expect(findMinifyDisabled(``)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- vite-config-parse`
Expected: FAIL — module `../src/vite-config-parse.js` not found.

- [ ] **Step 4: Implement the parser**

Create `packages/core/src/vite-config-parse.ts`:

```ts
/**
 * Static detection of a literal `build.minify: false` in a Vite config source
 * (PERF012). Pure module (design §8): callers read the file and pass the source
 * string. Uses the shared wrap parser; unlike `findSsrFalseOptOut` (which gets an
 * already-wrapped program and leaves the −1 shift to its caller), this function
 * takes the raw source and returns lines already shifted to the original
 * source's coordinates.
 */
import { parseModuleProgram } from './component-parse.js';
import { unwrapTs, collectTopLevelBindings } from './kit-module-parse.js';
import { lineOf } from './svelte-ast.js';

// Same pragmatic typing stance as component-parse.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;

/** Non-computed property of an object literal, by key name (`build` or `'build'`). */
function propOf(obj: Node, name: string): Node | undefined {
  for (const p of obj.properties ?? []) {
    if (p?.type !== 'Property' || p.computed) continue;
    if (p.key?.type === 'Identifier' && p.key.name === name) return p;
    if (p.key?.type === 'Literal' && p.key.value === name) return p;
  }
  return undefined;
}

/**
 * Resolve the default-exported config expression to an object literal:
 * `export default {…}`, `export default defineConfig({…})` (any call's first
 * argument — the callee name is not verified), or a same-file alias
 * (`const config = {…}; export default config`), with `satisfies`/`as`
 * unwrapped at every step. Function-form configs and anything else resolve to
 * undefined — the CLI channel is deliberately literal-only; the Vite plugin
 * channel sees the resolved value instead.
 */
function resolveConfigObject(program: Node): Node | undefined {
  let exported: Node | undefined;
  for (const stmt of program.body ?? []) {
    if (stmt?.type === 'ExportDefaultDeclaration') exported = stmt.declaration;
  }
  if (!exported) return undefined;
  let expr = unwrapTs(exported);
  if (expr?.type === 'Identifier') {
    const resolved = collectTopLevelBindings(program).get(expr.name);
    if (!resolved) return undefined;
    expr = unwrapTs(resolved);
  }
  if (expr?.type === 'CallExpression') {
    expr = expr.arguments?.[0] ? unwrapTs(expr.arguments[0]) : undefined;
  }
  return expr?.type === 'ObjectExpression' ? expr : undefined;
}

/**
 * The `build: { minify: false }` override, when present as a literal: returns the
 * `minify` property's 1-based line in the ORIGINAL source. Undefined for clean,
 * dynamic, or unparsable configs (never throws).
 */
export function findMinifyDisabled(source: string): { line: number } | undefined {
  const { program, wrapped } = parseModuleProgram(source, 'vite.config.ts');
  if (!program) return undefined;
  const config = resolveConfigObject(program);
  if (!config) return undefined;
  const build = propOf(config, 'build');
  const buildValue = build ? unwrapTs(build.value) : undefined;
  if (buildValue?.type !== 'ObjectExpression') return undefined;
  const minify = propOf(buildValue, 'minify');
  const minifyValue = minify ? unwrapTs(minify.value) : undefined;
  if (minifyValue?.type !== 'Literal' || minifyValue.value !== false) return undefined;
  return { line: Math.max(0, lineOf(wrapped, minify.start) - 1) };
}
```

- [ ] **Step 5: Export from core's index**

In `packages/core/src/index.ts`, next to the existing line
`export { parseKitModuleFacts, resolveRunesModuleSpecifier } from './kit-module-parse.js';`
add:

```ts
export { findMinifyDisabled } from './vite-config-parse.js';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- vite-config-parse`
Expected: PASS (13 tests).

Also run the untouched neighbors to catch regressions from the new `export` keywords:
`pnpm --filter @svelte-vitals/core test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/vite-config-parse.ts packages/core/src/kit-module-parse.ts packages/core/src/index.ts packages/core/test/vite-config-parse.test.ts
git commit -m "feat(core): add findMinifyDisabled Vite-config parser for PERF012"
```

---

### Task 2: `Project` fact + PERF012 rule + registration

**Files:**

- Modify: `packages/core/src/types.ts` (Project interface)
- Create: `packages/core/src/rules/perf/perf012-minify-disabled.ts`
- Modify: `packages/core/src/rules/index.ts` (import + `allRules` + re-export)
- Modify: `packages/core/src/index.ts` (named re-export — the untypechecked fourth place)
- Test: `packages/core/test/perf012-minify.test.ts`

**Interfaces:**

- Consumes: `Project` from Task 1's package state; `docsUrlFor`, `Rule`, `RuleContext` from `../../rule.js`.
- Produces: `Project.viteMinifyDisabled?: { file: string; line: number }` (Tasks 3–4 set it) and the exported rule object `perf012MinifyDisabled`.

- [ ] **Step 1: Add the fact field**

In `packages/core/src/types.ts`, inside `interface Project` after the `robotsReferencesSitemap` member, add:

```ts
  /** Set when the Vite config disables minification for production builds (PERF012). `file` is project-relative, `line` 1-based. */
  viteMinifyDisabled?: { file: string; line: number };
```

(`defaultProject` needs no change — the field is optional.)

- [ ] **Step 2: Write the failing rule tests**

Create `packages/core/test/perf012-minify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { perf012MinifyDisabled } from '../src/rules/perf/perf012-minify-disabled.js';
import { defaultProject, defaultConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

function ctx(viteMinifyDisabled?: { file: string; line: number }): RuleContext {
  return {
    heads: [],
    project: { ...defaultProject, ...(viteMinifyDisabled ? { viteMinifyDisabled } : {}) },
    config: defaultConfig
  } as RuleContext;
}

describe('PERF012 minify disabled', () => {
  it('emits nothing when the fact is unset', async () => {
    expect(await perf012MinifyDisabled.check(ctx())).toEqual([]);
  });

  it('emits one warning finding at the config file and line', async () => {
    const results = await perf012MinifyDisabled.check(ctx({ file: 'vite.config.ts', line: 5 }));
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.id).toBe('PERF012');
    expect(r.category).toBe('performance');
    expect(r.severity).toBe('warning');
    expect(r.detection).toEqual({ presence: 'none', value: 'absent' });
    expect(r.location).toBe('vite.config.ts');
    expect(r.line).toBe(5);
    expect(r.route).toBeUndefined();
    expect(r.message).toBe(
      'JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger.'
    );
    expect(r.fix?.description).toBeTruthy();
    expect(r.docsUrl).toContain('perf012');
  });

  it('is registered with project scope', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    const rule = allRules.find((r) => r.id === 'PERF012');
    expect(rule).toBeDefined();
    expect(rule?.scope).toBe('project');
    expect(explainRule('perf012')?.title).toBe('Minification disabled');
  });
});
```

Note: if `defaultConfig` lives in a different module than `types.ts`, import it from wherever `packages/core/test/project-rules.test.ts` imports its config — check that file first and mirror it.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- perf012-minify`
Expected: FAIL — rule module not found.

- [ ] **Step 4: Implement the rule**

Create `packages/core/src/rules/perf/perf012-minify-disabled.ts`:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;

const PERF012_FIX: Fix = {
  description:
    'Remove the minify: false override from vite.config (Vite minifies with esbuild by default), or scope it to non-production builds.',
  snippet: "export default defineConfig({\n  build: {\n    minify: 'esbuild'\n  }\n});",
  lang: 'ts'
};

const RECOMMENDATION =
  'Remove build.minify: false from vite.config, or scope it to non-production builds if it is intentional.';

/**
 * PERF012 — a `build.minify: false` left in vite.config ships unminified JS/CSS
 * to production. Project-scope: the fact is produced by the CLI's static parse
 * of vite.config.* (literal-only) or by the Vite plugin's resolved config
 * (exact). Emits a finding only when the fact is set — no pass result.
 */
export const perf012MinifyDisabled: Rule = {
  id: 'PERF012',
  title: 'Minification disabled',
  category: 'performance',
  severity: 'warning',
  scope: 'project',
  rationale:
    'Disabling minification ships unminified JS/CSS to production, inflating bundle size several-fold and slowing every page load; the override is usually a leftover from debugging.',
  fix: PERF012_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const hit = ctx.project.viteMinifyDisabled;
    if (!hit) return [];
    return [
      {
        id: 'PERF012',
        category: 'performance',
        severity: 'warning',
        detection: PENALIZED,
        location: hit.file,
        line: hit.line,
        message:
          'JS/CSS minification is disabled (build.minify: false) — production bundles ship unminified and several times larger.',
        recommendation: RECOMMENDATION,
        docsUrl: docsUrlFor('PERF012'),
        fix: { ...PERF012_FIX }
      }
    ];
  }
};
```

- [ ] **Step 5: Register in all four places**

1. `packages/core/src/rules/index.ts` — after the `perf010NamespaceImport` import line:
   ```ts
   import { perf012MinifyDisabled } from './perf/perf012-minify-disabled.js';
   ```
2. Same file — append `perf012MinifyDisabled` to the END of the `allRules` array (after `perf010NamespaceImport`).
3. Same file — append `perf012MinifyDisabled` to the END of the `export { … }` block (after `perf010NamespaceImport`).
4. `packages/core/src/index.ts` — find the rule re-export block (`export { … } from './rules/index.js'`) and append `perf012MinifyDisabled` after `perf010NamespaceImport` there too. **This fourth place is a plain re-export list TypeScript will not check — do not skip it.**

- [ ] **Step 6: Verify registration with grep**

Run: `grep -rn "perf012MinifyDisabled" packages/core/src | wc -l`
Expected: `5` (definition, rules/index import, allRules entry, rules/index re-export, core index re-export).

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: all pass, including the 3 new tests. If any existing test pins the total rule count or the full rule-id list (e.g. `explain-rule.test.ts`, reporter snapshots), update those pins — that is expected churn for a new rule, not a regression.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/rules/perf/perf012-minify-disabled.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/perf012-minify.test.ts
git commit -m "feat(core): add PERF012 minification-disabled project rule"
```

---

### Task 3: CLI producer

**Files:**

- Modify: `packages/cli/src/providers/source/project.ts` (extend `collectProjectFacts`)
- Test: `packages/cli/test/project-facts.test.ts` (extend)
- Create: `packages/cli/test/fixtures/minify-disabled-project/package.json`
- Create: `packages/cli/test/fixtures/minify-disabled-project/src/app.html`
- Create: `packages/cli/test/fixtures/minify-disabled-project/src/routes/+page.svelte`
- Create: `packages/cli/test/fixtures/minify-disabled-project/vite.config.ts`
- Test: `packages/cli/test/analyze-project.test.ts` (add one integration case)

**Interfaces:**

- Consumes: `findMinifyDisabled` from `@svelte-vitals/core` (Task 1), `Project.viteMinifyDisabled` (Task 2), the existing `Runtime` and memory-runtime test helper.
- Produces: `collectProjectFacts` now sets `viteMinifyDisabled` when the first-resolved Vite config carries the literal override.

- [ ] **Step 0: Build core so the CLI sees the new exports**

Run: `pnpm --filter @svelte-vitals/core build`

- [ ] **Step 1: Write the failing unit tests**

Append to the `describe('collectProjectFacts', …)` block in `packages/cli/test/project-facts.test.ts`:

```ts
it('detects build.minify: false in the Vite config', async () => {
  const rt = createMemoryRuntime({
    'vite.config.ts': `export default {\n  build: {\n    minify: false\n  }\n};\n`
  });
  const p = await collectProjectFacts(rt, '');
  expect(p.viteMinifyDisabled).toEqual({ file: 'vite.config.ts', line: 3 });
});

it('leaves the fact unset for a clean or absent Vite config', async () => {
  const clean = await collectProjectFacts(
    createMemoryRuntime({ 'vite.config.ts': `export default { build: { minify: 'terser' } };\n` }),
    ''
  );
  expect(clean.viteMinifyDisabled).toBeUndefined();
  const absent = await collectProjectFacts(createMemoryRuntime({}), '');
  expect(absent.viteMinifyDisabled).toBeUndefined();
});

it("analyzes only the first config in Vite's resolution order", async () => {
  // Vite loads vite.config.js before vite.config.ts — the stale .ts must be ignored.
  const rt = createMemoryRuntime({
    'vite.config.js': `export default { build: {} };\n`,
    'vite.config.ts': `export default { build: { minify: false } };\n`
  });
  const p = await collectProjectFacts(rt, '');
  expect(p.viteMinifyDisabled).toBeUndefined();
});
```

Note: check `packages/cli/test/helpers/memory-runtime.ts` first — if its `join('', 'vite.config.ts')` produces a leading-slash or different key shape, adapt the fixture keys the same way the existing robots/sitemap tests in this file do.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- project-facts`
Expected: FAIL — `viteMinifyDisabled` is `undefined` in the first test.

- [ ] **Step 3: Implement the producer**

In `packages/cli/src/providers/source/project.ts`:

1. Extend the core import at the top:
   ```ts
   import {
     ROBOTS_SOURCE_PATHS,
     SITEMAP_SOURCE_PATHS,
     findMinifyDisabled,
     type Project,
     type Detection,
     type Runtime
   } from '@svelte-vitals/core';
   ```
2. Add below `robotsRefsSitemap`:

   ```ts
   /** Vite's own config resolution order — only the first existing file is the one Vite loads. */
   const VITE_CONFIG_FILES = [
     'vite.config.js',
     'vite.config.mjs',
     'vite.config.ts',
     'vite.config.cjs',
     'vite.config.mts',
     'vite.config.cts'
   ] as const;

   async function detectViteMinifyDisabled(rt: Runtime, cwd: string): Promise<Project['viteMinifyDisabled']> {
     for (const file of VITE_CONFIG_FILES) {
       const p = rt.join(cwd, file);
       if (!(await rt.exists(p))) continue;
       try {
         const hit = findMinifyDisabled(await rt.readFile(p));
         return hit ? { file, line: hit.line } : undefined;
       } catch {
         return undefined; // unreadable config — don't guess
       }
     }
     return undefined;
   }
   ```

3. In `collectProjectFacts`, add the probe to the existing `Promise.all` and spread the result:

   ```ts
   export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
     const [hasRobotsTxt, hasSitemap, htmlLang, viteMinifyDisabled] = await Promise.all([
       existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
       existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
       detectAppHtmlLang(rt, cwd),
       detectViteMinifyDisabled(rt, cwd)
     ]);
     const robotsReferencesSitemap = await robotsRefsSitemap(rt, cwd);
     return {
       hasRobotsTxt,
       hasSitemap,
       htmlLang,
       ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
       ...(viteMinifyDisabled ? { viteMinifyDisabled } : {})
     };
   }
   ```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- project-facts`
Expected: PASS.

- [ ] **Step 5: Add the integration fixture**

Create `packages/cli/test/fixtures/minify-disabled-project/package.json`:

```json
{
  "name": "minify-disabled-project",
  "private": true,
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0"
  }
}
```

Create `packages/cli/test/fixtures/minify-disabled-project/src/app.html`:

```html
<html lang="en">
  <body>
    %sveltekit.body%
  </body>
</html>
```

Create `packages/cli/test/fixtures/minify-disabled-project/src/routes/+page.svelte`:

```svelte
<svelte:head>
  <title>Home</title>
</svelte:head>

<h1>Home</h1>
```

Create `packages/cli/test/fixtures/minify-disabled-project/vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: false
  }
});
```

- [ ] **Step 6: Add the integration test**

In `packages/cli/test/analyze-project.test.ts`, read the file first and mirror how its existing cases call `analyzeProject` against a fixture directory, then add:

```ts
it('flags PERF012 when vite.config disables minification', async () => {
  const { results } = await analyzeProject({ cwd: fixture('minify-disabled-project') });
  const hit = results.find((r) => r.id === 'PERF012');
  expect(hit).toBeDefined();
  expect(hit?.detection.presence).toBe('none');
  expect(hit?.location).toBe('vite.config.ts');
  expect(hit?.line).toBe(5);
  expect(hit?.route).toBeUndefined();
});

it('emits no PERF012 result for a project without the override', async () => {
  const { results } = await analyzeProject({ cwd: fixture('basic-project') });
  expect(results.some((r) => r.id === 'PERF012')).toBe(false);
});
```

Adapt the `analyzeProject({ cwd: … })` call shape and the `fixture()` helper to whatever the file actually uses (e.g. an options object with more required fields) — the assertions are the contract.

- [ ] **Step 7: Run the CLI suite**

Run: `pnpm --filter svelte-vitals test`
Expected: all pass. If a pinned report/summary expectation elsewhere in the CLI suite changes because `basic-project` now runs one more rule (it should NOT — the rule emits nothing when unset), investigate before adjusting: only the two new tests should be new behavior.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/providers/source/project.ts packages/cli/test/project-facts.test.ts packages/cli/test/analyze-project.test.ts packages/cli/test/fixtures/minify-disabled-project
git commit -m "feat(cli): produce the PERF012 vite.config minify fact in project analysis"
```

---

### Task 4: Vite plugin producer

**Files:**

- Create: `packages/vite/src/minify-flag.ts`
- Modify: `packages/vite/src/analyze.ts` (optional 4th parameter, merge into project facts)
- Modify: `packages/vite/src/plugin.ts` (capture in `configResolved`, pass through `closeBundle`)
- Test: `packages/vite/test/minify-flag.test.ts`
- Test: `packages/vite/test/analyze.test.ts` (one added case)

**Interfaces:**

- Consumes: `findMinifyDisabled` and `Project` type from `@svelte-vitals/core`; Vite's `ResolvedConfig` (`config.build.minify`, `config.configFile`, `config.root`).
- Produces: `resolveMinifyDisabled(minify: unknown, configFile: string | undefined, root: string): Promise<Project['viteMinifyDisabled']>`; `analyze(prerenderPagesDir, cwd, options, viteMinifyDisabled?)`.

- [ ] **Step 1: Write the failing unit tests**

Create `packages/vite/test/minify-flag.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveMinifyDisabled } from '../src/minify-flag.js';

describe('resolveMinifyDisabled', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sv-minify-'));
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it('returns undefined unless the resolved value is exactly false', async () => {
    expect(await resolveMinifyDisabled('esbuild', join(root, 'vite.config.ts'), root)).toBeUndefined();
    expect(await resolveMinifyDisabled('terser', undefined, root)).toBeUndefined();
    expect(await resolveMinifyDisabled(undefined, undefined, root)).toBeUndefined();
  });

  it('locates the line by re-parsing a literal config', async () => {
    const file = join(root, 'vite.config.ts');
    await writeFile(file, `export default {\n  build: {\n    minify: false\n  }\n};\n`);
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({ file: 'vite.config.ts', line: 3 });
  });

  it('falls back to line 1 for a dynamic config that still resolves to false', async () => {
    const file = join(root, 'vite.config.dynamic.ts');
    await writeFile(file, `export default () => ({ build: { minify: false } });\n`);
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({ file: 'vite.config.dynamic.ts', line: 1 });
  });

  it('falls back to vite.config.js line 1 when no config file path is known', async () => {
    expect(await resolveMinifyDisabled(false, undefined, root)).toEqual({ file: 'vite.config.js', line: 1 });
  });

  it('keeps line 1 when the config file is unreadable', async () => {
    expect(await resolveMinifyDisabled(false, join(root, 'missing.config.ts'), root)).toEqual({
      file: 'missing.config.ts',
      line: 1
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/vite test -- minify-flag`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `minify-flag.ts`**

Create `packages/vite/src/minify-flag.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
import { findMinifyDisabled, type Project } from '@svelte-vitals/core';

/**
 * PERF012 fact from the RESOLVED Vite config — exact, so it also catches
 * function-form/conditional configs the CLI's literal-only static pass skips.
 * The config source is re-parsed only to locate the line; a dynamic config
 * that still resolves to `minify: false` falls back to line 1.
 */
export async function resolveMinifyDisabled(
  minify: unknown,
  configFile: string | undefined,
  root: string
): Promise<Project['viteMinifyDisabled']> {
  if (minify !== false) return undefined;
  let file = 'vite.config.js';
  let line = 1;
  if (configFile) {
    const rel = relative(root, configFile);
    file = rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : configFile;
    try {
      line = findMinifyDisabled(await readFile(configFile, 'utf8'))?.line ?? 1;
    } catch {
      // unreadable config source — the resolved value already proved the finding
    }
  }
  return { file, line };
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/vite test -- minify-flag`
Expected: PASS (5 tests).

- [ ] **Step 5: Thread the fact through `analyze`**

In `packages/vite/src/analyze.ts`:

1. Add `type Project` to the existing `@svelte-vitals/core` import type list.
2. Extend the signature:
   ```ts
   export async function analyze(
     prerenderPagesDir: string,
     cwd: string,
     options: SvelteVitalsOptions,
     viteMinifyDisabled?: Project['viteMinifyDisabled']
   ): Promise<AnalyzeResult> {
   ```
3. Replace the project-collection line:
   ```ts
   const project = {
     ...(await collectRenderedProject(cwd, htmlLang)),
     ...(viteMinifyDisabled ? { viteMinifyDisabled } : {})
   };
   ```

Add a test case to `packages/vite/test/analyze.test.ts` inside the existing `describe` (reusing its `pages`/`cwd` setup):

```ts
it('threads a resolved minify-disabled fact into PERF012', async () => {
  const r = await analyze(pages, cwd, { report: false }, { file: 'vite.config.ts', line: 3 });
  const hit = r.results.find((x) => x.id === 'PERF012');
  expect(hit).toBeDefined();
  expect(hit?.location).toBe('vite.config.ts');
  expect(hit?.line).toBe(3);

  const clean = await analyze(pages, cwd, { report: false });
  expect(clean.results.some((x) => x.id === 'PERF012')).toBe(false);
});
```

- [ ] **Step 6: Capture the resolved config in the plugin**

In `packages/vite/src/plugin.ts`:

1. Import the helper: `import { resolveMinifyDisabled } from './minify-flag.js';`
2. In `svelteVitals`, add captured state next to `let root`:
   ```ts
   let minifyFlag: { minify: unknown; configFile: string | undefined } | undefined;
   ```
3. Extend `configResolved`:
   ```ts
   configResolved(config) {
     if (!options.cwd) root = config.root;
     minifyFlag = { minify: config.build.minify, configFile: config.configFile };
   },
   ```
4. In `closeBundle`, replace the `analyze` call:
   ```ts
   const viteMinifyDisabled = minifyFlag
     ? await resolveMinifyDisabled(minifyFlag.minify, minifyFlag.configFile, root)
     : undefined;
   result = await analyze(resolved, root, options, viteMinifyDisabled);
   ```
   (Keep the surrounding `try`/`catch` exactly as is — compute `viteMinifyDisabled` INSIDE the `try`, on the line before the `analyze` call.)

- [ ] **Step 7: Run the vite suite**

Run: `pnpm --filter @svelte-vitals/vite test`
Expected: all pass (existing tests unaffected — the new `analyze` parameter is optional).

- [ ] **Step 8: Commit**

```bash
git add packages/vite/src/minify-flag.ts packages/vite/src/analyze.ts packages/vite/src/plugin.ts packages/vite/test/minify-flag.test.ts packages/vite/test/analyze.test.ts
git commit -m "feat(vite): feed PERF012 from the resolved Vite config"
```

---

### Task 5: Docs (en/ja), changeset, action dist, full verify

**Files:**

- Create: `docs/src/content/docs/rules/perf012.md`
- Create: `docs/src/content/docs/ja/rules/perf012.md`
- Create: `.changeset/perf012-minify-disabled.md`
- Modify: `packages/action/dist/*` (rebuild artifact, committed by convention)

**Interfaces:**

- Consumes: rule behavior fixed in Tasks 1–4.
- Produces: docs pages required by `packages/cli/test/docs-links.test.ts`; release changeset.

- [ ] **Step 1: Write the English rule page**

Create `docs/src/content/docs/rules/perf012.md`:

````markdown
---
title: PERF012 · Minification disabled
description: A build.minify:false left in vite.config ships unminified JS/CSS to production.
---

**Severity:** warning · **Category:** performance

## What it checks

Flags a Vite config whose production build disables minification with `build.minify: false`. The CLI statically parses `vite.config.*` (the first file in Vite's own resolution order) and detects the literal form — `export default { … }`, `defineConfig({ … })`, or a same-file alias export, with `satisfies`/`as` unwrapped. The Vite plugin instead reads the **resolved** config during `vite build`, so it also catches function-form and conditional configs — and never flags an override that doesn't apply to the actual build.

Not flagged: `minify: 'esbuild' | 'terser' | true`, `minify` keys outside the `build` object, and projects without a Vite config.

## Why it matters

Vite minifies with esbuild by default; turning it off is almost always a leftover from debugging a production issue. Unminified bundles are several times larger, so every route pays for it in download and parse time — and nothing in the toolchain warns you: the build succeeds and dev behaves identically.

## How to fix

Remove the override (the default already minifies), or scope it so production keeps minification:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production' ? 'esbuild' : false
  }
}));
```

Note the CLI's static pass deliberately skips this conditional form — only the plugin channel (which sees the resolved value) verifies which branch your build actually takes.

## Limitations

The two channels differ in strength. The CLI flags only the literal `build.minify: false`; a dynamic expression that evaluates to `false` is invisible to it. The Vite plugin judges the resolved value, so its verdict is exact for the build it runs in; when the offending config is dynamic, the finding points at line 1 of the config file.

## Disabling

If unminified production output is intentional, turn the rule off in your config:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF012: 'off'
  }
};
```
````

- [ ] **Step 2: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/perf012.md` (same structure; parentheses in Japanese prose are full-width per the docs convention):

````markdown
---
title: PERF012 · Minification disabled
description: vite.config に残った build.minify:false は、ミニファイされていない JS/CSS を本番に出荷します。
---

**重大度:** warning · **カテゴリ:** performance

## チェック内容

本番ビルドのミニファイを `build.minify: false` で無効化している Vite 設定を検出します。CLI は `vite.config.*`（Vite 自身の解決順で最初に見つかったファイル）を静的解析し、リテラル形式（`export default { … }`、`defineConfig({ … })`、同一ファイル内のエイリアスエクスポート。`satisfies`／`as` は unwrap）を検出します。Vite プラグインは `vite build` 中に**解決済み**の設定値を読むため、関数形式や条件分岐の設定も検出でき、実際のビルドに適用されないオーバーライドを誤検知することもありません。

検出しないもの: `minify: 'esbuild' | 'terser' | true`、`build` オブジェクト外の `minify` キー、Vite 設定を持たないプロジェクト。

## 重要な理由

Vite はデフォルトで esbuild によるミニファイを行います。これを無効化する設定は、本番の問題をデバッグした際の消し忘れであることがほとんどです。ミニファイされていないバンドルは数倍のサイズになり、すべてのルートがダウンロードとパースの時間で代償を払います。しかもツールチェーンは何も警告しません。ビルドは成功し、開発時の挙動も変わらないためです。

## 修正方法

オーバーライドを削除する（デフォルトでミニファイされます）か、本番ではミニファイが維持されるようにスコープを限定します:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production' ? 'esbuild' : false
  }
}));
```

CLI の静的解析はこの条件分岐形式を意図的にスキップします。実際のビルドがどちらの分岐を通るかを検証できるのは、解決済みの値を見るプラグインチャネルだけです。

## 制限事項

2つのチャネルには検出力の差があります。CLI はリテラルの `build.minify: false` だけを検出し、`false` に評価される動的な式は見えません。Vite プラグインは解決済みの値で判定するため、実行されたビルドに対する判定は正確ですが、問題の設定が動的な場合、検出結果は設定ファイルの1行目を指します。

## 無効化

ミニファイしない本番出力が意図的な場合は、設定でルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF012: 'off'
  }
};
```
````

- [ ] **Step 3: Verify the docs-links gate**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS (both pages found for PERF012).

- [ ] **Step 4: Add the changeset**

Create `.changeset/perf012-minify-disabled.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add PERF012 (Minification disabled): flags a `build.minify: false` left in `vite.config.*`. The CLI detects the literal form statically; the Vite plugin reads the resolved config during `vite build`, catching conditional configs exactly.
```

- [ ] **Step 5: Rebuild the committed action dist**

Run: `pnpm --filter @svelte-vitals/action build`
Expected: `packages/action/dist/` changes (it vendors core/cli).

- [ ] **Step 6: Full verify**

Run, in order:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Expected: all pass. (`pnpm lint` may report the 2 pre-existing warnings in `packages/cli/test/meta-object.test.ts` — those are not ours.)

- [ ] **Step 7: Commit (two commits)**

```bash
git add docs/src/content/docs/rules/perf012.md docs/src/content/docs/ja/rules/perf012.md .changeset/perf012-minify-disabled.md
git commit -m "docs: add PERF012 rule pages (en/ja) and changeset"
git add packages/action/dist
git commit -m "chore(action): rebuild dist for PERF012"
```
