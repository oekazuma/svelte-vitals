# correctness/base-path-navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a correctness rule that flags hardcoded root-relative navigation (`<a href="/about">`, `goto('/about')`, `redirect(303, '/login')`) in projects that configure `kit.paths.base` — such links resolve against the domain root, land outside the app, and 404 in production.

**Architecture:** A new project-level fact (`Project.kitPathsBase`) gates the rule: it is parsed statically from the `sveltekit()` Vite-plugin config, else `svelte.config.{js,ts}`, following SvelteKit's own precedence. Detection is literal-only across three surfaces on two existing fact channels (component + Kit-module), which makes `base`-prefixed and `resolve()`-wrapped paths fall out as non-literals with no extra logic. The rule is a custom dual-channel `Rule` following `correctness/orphan-lifecycle`.

**Tech Stack:** TypeScript, `svelte/compiler`'s `parse()`, acorn (via the existing `parseModuleProgram`), Vitest.

Design doc: [docs/superpowers/specs/2026-07-25-base-path-navigation-design.md](../specs/2026-07-25-base-path-navigation-design.md)
Issue: https://github.com/oekazuma/svelte-vitals/issues/300

## Global Constraints

- **Core purity**: no `node:` imports, no I/O, no runtime-specific globals in `packages/core/src/`. All config file reading happens in the CLI/Vite providers; core only receives source strings.
- **Rule id**: `correctness/base-path-navigation`. **Severity**: `warning`. **Category**: `correctness`. **Scope**: `component`.
- **Never throw**: every new parser function returns `undefined` (or an empty list) for malformed, dynamic, or unparsable input — same contract as `findMinifyDisabled`.
- **Four registration places** for the new rule (`packages/core/src/rules/index.ts` import + `allRules` array + re-export block, and `packages/core/src/index.ts`'s own re-export list). TypeScript does NOT catch a missed spot in the last one — grep for `correctnessOrphanLifecycle` to see all of them.
- **Doc pages required** at `docs/src/content/docs/rules/correctness/base-path-navigation.md` (en) and `docs/src/content/docs/ja/rules/correctness/base-path-navigation.md` (ja) — `packages/cli/test/docs-links.test.ts` fails without both.
- **Changeset required** — `minor` for `@svelte-vitals/core`, `svelte-vitals`, `@svelte-vitals/vite`, `@svelte-vitals/mcp`.
- **No import cycles**: the module layering is `svelte-ast.ts` (leaf) → `component-parse.ts` → `kit-module-parse.ts` → `vite-config-parse.ts`. New leaf modules must not import upward.
- All shell commands assume the repository root as the working directory.

---

### Task 1: Extract the shared config-object helpers

**Files:**

- Create: `packages/core/src/config-object.ts`
- Modify: `packages/core/src/vite-config-parse.ts`

**Interfaces:**

- Produces: `propOf(obj: ObjectExpression, name: string): Property | undefined`, `findExportedExpression(program: Program): Expression | undefined`, `unwrapToObjectExpression(expr: TsExpression | undefined, bindings: Map<string, TsExpression>): ObjectExpression | undefined`, `resolveConfigObject(program: Program): ObjectExpression | undefined` — all consumed by Task 2's new parser.

Pure, behaviour-preserving move. `vite-config-parse.ts` currently defines four generic config-object helpers that the new `svelte.config` parser needs verbatim; a third copy would be duplication, so they move to a shared module. The existing `findMinifyDisabled` tests are the safety net — they must pass unchanged, with no edits.

- [ ] **Step 1: Create `packages/core/src/config-object.ts`**

Move the four helpers out of `packages/core/src/vite-config-parse.ts` verbatim (they are currently lines 16–119 of that file: `propOf`, `unwrapToObjectExpression`, `findExportedExpression`, `resolveConfigObject`, with their doc comments) into a new file, adding `export` to each and keeping every doc comment word-for-word:

```ts
/**
 * Generic resolution of a JS config file's exported object literal, shared by the
 * Vite-config and svelte.config parsers. Pure module (design §8): callers pass an
 * already-parsed ESTree program.
 */
import type { Expression, ObjectExpression, Program, Property } from 'estree';
import { unwrapTs, type TsExpression } from './component-parse.js';
import { collectTopLevelBindings } from './kit-module-parse.js';

// ...the four helpers, each now `export function`, doc comments unchanged...
```

- [ ] **Step 2: Point `vite-config-parse.ts` at the new module**

Delete the four moved functions from `packages/core/src/vite-config-parse.ts` and import them instead. The file's remaining imports narrow to what `findMinifyDisabled` still uses:

```ts
import type { Expression, Program } from 'estree';
import { parseModuleProgram, unwrapTs } from './component-parse.js';
import { propOf, resolveConfigObject } from './config-object.js';
import { lineOf } from './svelte-ast.js';
```

Leave `findMinifyDisabled` itself byte-identical. Update the file's top-of-file doc comment's phrase "Uses the shared wrap parser" only if it names a moved function — otherwise leave it alone.

- [ ] **Step 3: Run the tests that protect the move**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/vite-config-parse.test.ts test/perf012-minify.test.ts`
Expected: PASS, with the same test count as before the change. These files must NOT be edited — if either needs an edit, the move was not behaviour-preserving.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS (no output).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config-object.ts packages/core/src/vite-config-parse.ts
git commit -m "refactor(core): extract shared config-object helpers"
```

---

### Task 2: The `kit.paths.base` parser

**Files:**

- Create: `packages/core/src/svelte-config-parse.ts`
- Create: `packages/core/test/svelte-config-parse.test.ts`

**Interfaces:**

- Consumes: `propOf`, `resolveConfigObject`, `unwrapToObjectExpression` from Task 1's `./config-object.js`; `parseModuleProgram`, `unwrapTs`, `type TsExpression` from `./component-parse.js`; `collectTopLevelBindings` from `./kit-module-parse.js`.
- Produces:
  - `findKitPathsBaseInSvelteConfig(source: string): { value?: string } | undefined`
  - `findKitPathsBaseInViteConfig(source: string): ViteKitConfigResult` where `type ViteKitConfigResult = { kind: 'no-plugin-config' } | { kind: 'unresolvable' } | { kind: 'resolved'; base?: { value?: string } }`
  - `resolveKitPathsBase(viteConfig: { file: string; source: string } | undefined, svelteConfig: { file: string; source: string } | undefined): { value?: string; file: string } | undefined`

Task 3 wires `resolveKitPathsBase` into both providers; nothing else consumes the other two.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/svelte-config-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase
} from '../src/svelte-config-parse.js';

describe('findKitPathsBaseInSvelteConfig', () => {
  it('reads a literal base from an exported object', () => {
    const src = `export default { kit: { paths: { base: '/docs' } } };`;
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({ value: '/docs' });
  });

  it('reads a literal base through a same-file alias', () => {
    const src = [`const config = { kit: { paths: { base: '/docs' } } };`, `export default config;`].join('\n');
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({ value: '/docs' });
  });

  it('reports a dynamic base as present-but-unknown', () => {
    const src = [
      `import { dev } from '$app/environment';`,
      `export default { kit: { paths: { base: dev ? '' : '/repo' } } };`
    ].join('\n');
    expect(findKitPathsBaseInSvelteConfig(src)).toEqual({});
  });

  it('ignores an empty-string base', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: { paths: { base: '' } } };`)).toBeUndefined();
  });

  it('ignores a config with no paths.base', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: { adapter: adapter() } };`)).toBeUndefined();
  });

  it('returns undefined for a malformed source instead of throwing', () => {
    expect(findKitPathsBaseInSvelteConfig(`export default { kit: {`)).toBeUndefined();
  });
});

describe('findKitPathsBaseInViteConfig', () => {
  const vite = (plugins: string, imports = `import { sveltekit } from '@sveltejs/kit/vite';`) =>
    [imports, `export default { plugins: [${plugins}] };`].join('\n');

  it('reads a literal base from the sveltekit() plugin config', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ paths: { base: '/docs' } })`))).toEqual({
      kind: 'resolved',
      base: { value: '/docs' }
    });
  });

  it('reports a dynamic base in the plugin config as present-but-unknown', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ paths: { base: process.env.BASE ?? '' } })`))).toEqual({
      kind: 'resolved',
      base: {}
    });
  });

  it('resolves a plugin config with no paths.base to resolved-without-base', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit({ adapter: adapter() })`))).toEqual({ kind: 'resolved' });
  });

  it('treats an argument-less sveltekit() as no plugin config', () => {
    expect(findKitPathsBaseInViteConfig(vite(`sveltekit()`))).toEqual({ kind: 'no-plugin-config' });
  });

  it('treats an unresolvable plugin argument as unresolvable', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import kitConfig from './kit.config.js';`,
      `export default { plugins: [sveltekit(kitConfig)] };`
    ].join('\n');
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'unresolvable' });
  });

  it('resolves the plugin config through defineConfig and a same-file alias', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import { defineConfig } from 'vite';`,
      `const kit = { paths: { base: '/docs' } };`,
      `export default defineConfig({ plugins: [sveltekit(kit)] });`
    ].join('\n');
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
  });

  it('honours an aliased sveltekit import', () => {
    const src = vite(`kit({ paths: { base: '/docs' } })`, `import { sveltekit as kit } from '@sveltejs/kit/vite';`);
    expect(findKitPathsBaseInViteConfig(src)).toEqual({ kind: 'resolved', base: { value: '/docs' } });
  });

  it('reports no plugin config when the plugins array has no sveltekit call', () => {
    expect(findKitPathsBaseInViteConfig(vite(`svelte()`, `import { svelte } from 'x';`))).toEqual({
      kind: 'no-plugin-config'
    });
  });

  it('reports no plugin config for a config with no plugins array', () => {
    expect(findKitPathsBaseInViteConfig(`export default { build: { minify: false } };`)).toEqual({
      kind: 'no-plugin-config'
    });
  });

  it('returns no-plugin-config for a malformed source instead of throwing', () => {
    expect(findKitPathsBaseInViteConfig(`export default { plugins: [`)).toEqual({ kind: 'no-plugin-config' });
  });
});

describe('resolveKitPathsBase', () => {
  const svelteConfig = { file: 'svelte.config.js', source: `export default { kit: { paths: { base: '/s' } } };` };
  const viteWith = (plugins: string) => ({
    file: 'vite.config.ts',
    source: [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [${plugins}] };`].join('\n')
  });

  it('prefers the plugin config over svelte.config', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit({ paths: { base: '/v' } })`), svelteConfig)).toEqual({
      value: '/v',
      file: 'vite.config.ts'
    });
  });

  it('does not fall back to svelte.config when the plugin config resolves without a base', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit({ adapter: adapter() })`), svelteConfig)).toBeUndefined();
  });

  it('does not fall back to svelte.config when the plugin argument is unresolvable', () => {
    const src = [
      `import { sveltekit } from '@sveltejs/kit/vite';`,
      `import kitConfig from './kit.config.js';`,
      `export default { plugins: [sveltekit(kitConfig)] };`
    ].join('\n');
    expect(resolveKitPathsBase({ file: 'vite.config.ts', source: src }, svelteConfig)).toBeUndefined();
  });

  it('falls back to svelte.config for an argument-less sveltekit()', () => {
    expect(resolveKitPathsBase(viteWith(`sveltekit()`), svelteConfig)).toEqual({
      value: '/s',
      file: 'svelte.config.js'
    });
  });

  it('reads svelte.config when there is no vite config', () => {
    expect(resolveKitPathsBase(undefined, svelteConfig)).toEqual({ value: '/s', file: 'svelte.config.js' });
  });

  it('carries a dynamic base through with only the file', () => {
    const dynamic = {
      file: 'svelte.config.js',
      source: `export default { kit: { paths: { base: process.env.BASE ?? '' } } };`
    };
    expect(resolveKitPathsBase(undefined, dynamic)).toEqual({ file: 'svelte.config.js' });
  });

  it('returns undefined when neither config exists', () => {
    expect(resolveKitPathsBase(undefined, undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/svelte-config-parse.test.ts`
Expected: FAIL — cannot resolve `../src/svelte-config-parse.js` (the module does not exist yet).

- [ ] **Step 3: Create the parser module**

Create `packages/core/src/svelte-config-parse.ts`:

```ts
/**
 * Static extraction of `kit.paths.base` (correctness/base-path-navigation). Pure module
 * (design §8): callers read the files and pass the source strings. Two config homes are
 * supported, in SvelteKit's own precedence — `sveltekit(<config>)` in a Vite config wins and
 * makes `svelte.config` irrelevant (SvelteKit logs "svelte.config.js is ignored when options
 * are passed via your Vite config"), otherwise `svelte.config.{js,ts}` is read. Never throws.
 */
import type { Expression, ObjectExpression, Program } from 'estree';
import { parseModuleProgram, unwrapTs, type TsExpression } from './component-parse.js';
import { collectTopLevelBindings } from './kit-module-parse.js';
import { propOf, resolveConfigObject, unwrapToObjectExpression } from './config-object.js';

/** What a Vite config says about SvelteKit's own configuration. */
export type ViteKitConfigResult =
  /** No `sveltekit()` call, or one with no argument — `svelte.config` still applies. */
  | { kind: 'no-plugin-config' }
  /** `sveltekit(<something we can't resolve>)` — the effective config is unknowable AND
   *  `svelte.config` is provably ignored, so the caller must stay quiet. */
  | { kind: 'unresolvable' }
  /** `sveltekit({…})` resolved. `base` is unset when the config declares no non-empty base. */
  | { kind: 'resolved'; base?: { value?: string } };

/**
 * `paths.base` off a resolved Kit-config object: `{ value }` for a non-empty string literal,
 * `{}` for any other expression (base exists, value unknowable — the `dev ? '' : '/repo'`
 * deploy form), and undefined when absent or an explicit empty string.
 */
function basePathOf(kitConfig: ObjectExpression, bindings: Map<string, TsExpression>): { value?: string } | undefined {
  const paths = propOf(kitConfig, 'paths');
  const pathsObj = paths ? unwrapToObjectExpression(paths.value as Expression, bindings) : undefined;
  if (!pathsObj) return undefined;
  const base = propOf(pathsObj, 'base');
  if (!base) return undefined;
  const value = unwrapTs(base.value as Expression);
  if (value.type === 'Literal') {
    return typeof value.value === 'string' && value.value !== '' ? { value: value.value } : undefined;
  }
  return {};
}

/** Parse a config source to a program, or undefined when it cannot be parsed. */
function programOf(source: string, filename: string): Program | undefined {
  try {
    return parseModuleProgram(source, filename).program ?? undefined;
  } catch {
    return undefined;
  }
}

/** `kit.paths.base` from a `svelte.config.{js,ts}` source. */
export function findKitPathsBaseInSvelteConfig(source: string): { value?: string } | undefined {
  const program = programOf(source, 'svelte.config.js');
  if (!program) return undefined;
  const config = resolveConfigObject(program);
  if (!config) return undefined;
  const bindings = collectTopLevelBindings(program);
  const kit = propOf(config, 'kit');
  const kitObj = kit ? unwrapToObjectExpression(kit.value as Expression, bindings) : undefined;
  return kitObj ? basePathOf(kitObj, bindings) : undefined;
}

/**
 * Local names bound to `sveltekit` imported from '@sveltejs/kit/vite'. When no such import is
 * found (an unusual or unparsed import form), the bare name `sveltekit` is assumed — the call
 * shape is distinctive enough that a false match is not a realistic concern.
 */
function sveltekitLocalNames(program: Program): Set<string> {
  const out = new Set<string>();
  for (const stmt of program.body) {
    if (stmt.type !== 'ImportDeclaration' || stmt.source.value !== '@sveltejs/kit/vite') continue;
    for (const s of stmt.specifiers) {
      if (s.type === 'ImportSpecifier' && s.imported.type === 'Identifier' && s.imported.name === 'sveltekit') {
        out.add(s.local.name);
      }
    }
  }
  if (out.size === 0) out.add('sveltekit');
  return out;
}

/** SvelteKit config passed to the `sveltekit()` plugin in a Vite config source (since Kit 2.62). */
export function findKitPathsBaseInViteConfig(source: string): ViteKitConfigResult {
  const none: ViteKitConfigResult = { kind: 'no-plugin-config' };
  const program = programOf(source, 'vite.config.ts');
  if (!program) return none;
  const config = resolveConfigObject(program);
  if (!config) return none;
  const bindings = collectTopLevelBindings(program);
  const plugins = propOf(config, 'plugins');
  const pluginsValue = plugins ? unwrapTs(plugins.value as Expression) : undefined;
  if (pluginsValue?.type !== 'ArrayExpression') return none;

  const locals = sveltekitLocalNames(program);
  for (const el of pluginsValue.elements) {
    if (!el || el.type === 'SpreadElement') continue;
    const call = unwrapTs(el as Expression);
    if (call.type !== 'CallExpression') continue;
    if (call.callee.type !== 'Identifier' || !locals.has(call.callee.name)) continue;
    const arg = call.arguments[0] as Expression | undefined;
    if (arg === undefined) return none; // sveltekit() — svelte.config still applies
    const kitConfig = unwrapToObjectExpression(arg, bindings);
    if (!kitConfig) return { kind: 'unresolvable' };
    const base = basePathOf(kitConfig, bindings);
    return base ? { kind: 'resolved', base } : { kind: 'resolved' };
  }
  return none;
}

/**
 * The project's effective `kit.paths.base`, following SvelteKit's precedence: the `sveltekit()`
 * plugin config when it carries one, otherwise `svelte.config`. `file` is the config the base
 * came from (as passed in by the caller). Undefined means "no base path" — the gate stays shut.
 */
export function resolveKitPathsBase(
  viteConfig: { file: string; source: string } | undefined,
  svelteConfig: { file: string; source: string } | undefined
): { value?: string; file: string } | undefined {
  if (viteConfig) {
    const result = findKitPathsBaseInViteConfig(viteConfig.source);
    if (result.kind === 'unresolvable') return undefined;
    if (result.kind === 'resolved') {
      return result.base ? { ...result.base, file: viteConfig.file } : undefined;
    }
  }
  if (!svelteConfig) return undefined;
  const base = findKitPathsBaseInSvelteConfig(svelteConfig.source);
  return base ? { ...base, file: svelteConfig.file } : undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/svelte-config-parse.test.ts`
Expected: PASS (23 cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/svelte-config-parse.ts packages/core/test/svelte-config-parse.test.ts
git commit -m "feat(core): parse kit.paths.base from svelte.config and the sveltekit() plugin config (issue #300)"
```

---

### Task 3: The `kitPathsBase` project fact, end to end

**Files:**

- Modify: `packages/core/src/types.ts` (the `Project` interface)
- Modify: `packages/core/src/project-paths.ts`
- Modify: `packages/core/src/index.ts` (public exports)
- Modify: `packages/cli/src/providers/source/project.ts`
- Modify: `packages/vite/src/providers/rendered/project.ts`
- Create: `packages/cli/test/kit-paths-base-provider.test.ts`

**Interfaces:**

- Consumes: `resolveKitPathsBase(viteConfig, svelteConfig)` from Task 2.
- Produces: `Project.kitPathsBase?: { value?: string; file: string }` — Task 7's rule gates on its presence. Also `VITE_CONFIG_FILES` and `SVELTE_CONFIG_FILES` (readonly string arrays) exported from `packages/core/src/project-paths.ts`.

- [ ] **Step 1: Add the config-file lists to `project-paths.ts`**

Append to `packages/core/src/project-paths.ts`:

```ts
/** Vite's own config resolution order — only the first existing file is the one Vite loads. */
export const VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts'
] as const;

/** SvelteKit's config resolution order (`@sveltejs/kit` checks js before ts). */
export const SVELTE_CONFIG_FILES = ['svelte.config.js', 'svelte.config.ts'] as const;
```

- [ ] **Step 2: Add the `Project` fact**

In `packages/core/src/types.ts`, add this field to the `Project` interface immediately after `viteMinifyDisabled`:

```ts
  /**
   * Set when the project configures a non-empty `kit.paths.base` — read from the `sveltekit()`
   * Vite plugin config, else `svelte.config.{js,ts}` (correctness/base-path-navigation).
   * `value` is the literal base when statically resolvable, unset when the config computes it
   * (e.g. `dev ? '' : '/repo'`). `file` is the config path relative to the analyzed root (posix).
   * Absent means the app is served at the root — the rule stays silent.
   */
  kitPathsBase?: { value?: string; file: string };
```

Leave `defaultProject` untouched — the field is optional and absent by default, exactly like `viteMinifyDisabled`.

- [ ] **Step 3: Export the new core surface**

In `packages/core/src/index.ts`, next to the existing `findMinifyDisabled` export, add the parser and path exports so the CLI and Vite providers can import them. Find the line exporting `findMinifyDisabled` and add alongside it:

```ts
export {
  findKitPathsBaseInSvelteConfig,
  findKitPathsBaseInViteConfig,
  resolveKitPathsBase
} from './svelte-config-parse.js';
export type { ViteKitConfigResult } from './svelte-config-parse.js';
```

`project-paths.js` is already re-exported by `index.ts` (that is how `ROBOTS_SOURCE_PATHS` reaches the CLI) — verify with `grep -n "project-paths" packages/core/src/index.ts` and, if the export list there names individual constants rather than using `export *`, add `VITE_CONFIG_FILES` and `SVELTE_CONFIG_FILES` to it.

- [ ] **Step 4: Write the failing provider test**

Create `packages/cli/test/kit-paths-base-provider.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { nodeRuntime } from '../src/runtime/node.js';

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'svelte-vitals-base-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content, 'utf8');
  return dir;
}

const svelteConfig = (base: string) => `export default { kit: { paths: { base: ${base} } } };`;
const viteConfig = (plugins: string) =>
  [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [${plugins}] };`].join('\n');

describe('collectProjectFacts: kitPathsBase', () => {
  it('reads a literal base from svelte.config.js', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`'/docs'`) });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toEqual({
      value: '/docs',
      file: 'svelte.config.js'
    });
  });

  it('omits the fact when no config declares a base', async () => {
    const dir = await project({ 'svelte.config.js': `export default { kit: {} };` });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toBeUndefined();
  });

  it('omits the fact for an explicit empty base', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`''`) });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toBeUndefined();
  });

  it('keeps the fact without a value for a dynamic base', async () => {
    const dir = await project({ 'svelte.config.js': svelteConfig(`process.env.BASE ?? ''`) });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toEqual({ file: 'svelte.config.js' });
  });

  it('prefers the sveltekit() plugin config over svelte.config', async () => {
    const dir = await project({
      'svelte.config.js': svelteConfig(`'/from-svelte-config'`),
      'vite.config.ts': viteConfig(`sveltekit({ paths: { base: '/from-vite' } })`)
    });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toEqual({
      value: '/from-vite',
      file: 'vite.config.ts'
    });
  });

  it('falls back to svelte.config for an argument-less sveltekit()', async () => {
    const dir = await project({
      'svelte.config.js': svelteConfig(`'/docs'`),
      'vite.config.ts': viteConfig(`sveltekit()`)
    });
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toEqual({
      value: '/docs',
      file: 'svelte.config.js'
    });
  });

  it('omits the fact when there is no config at all', async () => {
    const dir = await project({});
    expect((await collectProjectFacts(nodeRuntime, dir)).kitPathsBase).toBeUndefined();
  });
});
```

Before running it, confirm the runtime import path is right: `grep -rn "nodeRuntime" packages/cli/test/project.test.ts | head -3`. If that test imports the runtime from a different module or under a different name (e.g. `createNodeRuntime()`), match whatever `packages/cli/test/project.test.ts` already does — it exercises `collectProjectFacts` the same way.

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/kit-paths-base-provider.test.ts`
Expected: FAIL — every `kitPathsBase` assertion gets `undefined` because the CLI provider does not populate the fact yet.

- [ ] **Step 6: Populate the fact in the CLI provider**

In `packages/cli/src/providers/source/project.ts`:

1. Extend the import from `@svelte-vitals/core` with `resolveKitPathsBase`, `VITE_CONFIG_FILES`, and `SVELTE_CONFIG_FILES`.
2. Delete the local `const VITE_CONFIG_FILES = [...] as const;` block (it now lives in core) — `detectViteMinifyDisabled` keeps working against the imported one unchanged.
3. Add the reader and detector above `collectProjectFacts`:

```ts
/**
 * The first config file that exists, with its source. Only the FIRST existing candidate is
 * considered — that is the one the tool would load — so an unreadable first candidate yields
 * undefined rather than silently falling through to a file that is never loaded.
 */
async function readFirstConfig(
  rt: Runtime,
  cwd: string,
  files: readonly string[]
): Promise<{ file: string; source: string } | undefined> {
  for (const file of files) {
    const path = rt.join(cwd, file);
    if (!(await rt.exists(path))) continue;
    try {
      return { file, source: await rt.readFile(path) };
    } catch {
      return undefined; // unreadable config — don't guess
    }
  }
  return undefined;
}

async function detectKitPathsBase(rt: Runtime, cwd: string): Promise<Project['kitPathsBase']> {
  const [viteConfig, svelteConfig] = await Promise.all([
    readFirstConfig(rt, cwd, VITE_CONFIG_FILES),
    readFirstConfig(rt, cwd, SVELTE_CONFIG_FILES)
  ]);
  return resolveKitPathsBase(viteConfig, svelteConfig);
}
```

4. Wire it into `collectProjectFacts` — add it to the `Promise.all` destructuring and to the returned object:

```ts
export async function collectProjectFacts(rt: Runtime, cwd: string): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, htmlLang, viteMinifyDisabled, kitPathsBase] = await Promise.all([
    existsAny(rt, cwd, ROBOTS_SOURCE_PATHS),
    existsAny(rt, cwd, SITEMAP_SOURCE_PATHS),
    detectAppHtmlLang(rt, cwd),
    detectViteMinifyDisabled(rt, cwd),
    detectKitPathsBase(rt, cwd)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(rt, cwd);
  return {
    hasRobotsTxt,
    hasSitemap,
    htmlLang,
    ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
    ...(viteMinifyDisabled ? { viteMinifyDisabled } : {}),
    ...(kitPathsBase ? { kitPathsBase } : {})
  };
}
```

- [ ] **Step 7: Populate the fact in the Vite provider**

In `packages/vite/src/providers/rendered/project.ts`, extend the core import and add the same read using this package's `node:fs` helpers, so build-mode analysis gates identically:

```ts
import {
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  SVELTE_CONFIG_FILES,
  VITE_CONFIG_FILES,
  resolveKitPathsBase,
  type Detection,
  type Project
} from '@svelte-vitals/core';
```

```ts
/** First existing config candidate with its source — same "only the first is loaded" rule as the CLI provider. */
async function readFirstConfig(
  cwd: string,
  files: readonly string[]
): Promise<{ file: string; source: string } | undefined> {
  for (const file of files) {
    const path = join(cwd, file);
    if (!(await exists(path))) continue;
    try {
      return { file, source: await readFile(path, 'utf8') };
    } catch {
      return undefined; // unreadable config — don't guess
    }
  }
  return undefined;
}
```

and in `collectRenderedProject`:

```ts
export async function collectRenderedProject(cwd: string, htmlLang: Detection): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, viteConfig, svelteConfig] = await Promise.all([
    existsAny(cwd, ROBOTS_SOURCE_PATHS),
    existsAny(cwd, SITEMAP_SOURCE_PATHS),
    readFirstConfig(cwd, VITE_CONFIG_FILES),
    readFirstConfig(cwd, SVELTE_CONFIG_FILES)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(cwd);
  const kitPathsBase = resolveKitPathsBase(viteConfig, svelteConfig);
  return {
    hasRobotsTxt,
    hasSitemap,
    htmlLang,
    ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
    ...(kitPathsBase ? { kitPathsBase } : {})
  };
}
```

- [ ] **Step 8: Run the provider test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals exec vitest run test/kit-paths-base-provider.test.ts`
Expected: PASS (7 cases). The core build is needed first because the CLI imports `@svelte-vitals/core` from its built `dist`.

- [ ] **Step 9: Run the surrounding suites and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter svelte-vitals exec vitest run test/project.test.ts && pnpm typecheck`
Expected: PASS. `pnpm typecheck` is the monorepo-wide run — it covers `packages/vite`, whose provider changed.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/project-paths.ts packages/core/src/index.ts packages/cli/src/providers/source/project.ts packages/vite/src/providers/rendered/project.ts packages/cli/test/kit-paths-base-provider.test.ts
git commit -m "feat(core,cli,vite): add the kitPathsBase project fact (issue #300)"
```

---

### Task 4: The `basePathLinks` fact and `<a href>` detection

**Files:**

- Create: `packages/core/src/base-path.ts`
- Create: `packages/core/test/base-path-links-parse.test.ts`
- Modify: `packages/core/src/component.ts`, `packages/core/src/kit-module.ts`
- Modify: `packages/core/src/component-parse.ts`, `packages/core/src/kit-module-parse.ts`
- Modify: `packages/core/src/component-collect.ts`, `packages/core/src/kit-module-collect.ts`
- Modify (mechanical, one line each — the full list, do not discover it by trial and error):
  `packages/core/test/architecture-rules.test.ts:27`, `packages/core/test/bundle-rules.test.ts:30`,
  `packages/core/test/component-rule.test.ts:27`, `packages/core/test/correctness-rules.test.ts:38` and `:54`,
  `packages/core/test/security-kit-rules.test.ts:29` and `:96`, `packages/core/test/security-rules.test.ts:27`,
  `packages/core/test/component-collect.test.ts:47`, `packages/cli/test/malformed-svelte.test.ts:53` and `:118`,
  `packages/cli/test/suppression-e2e.test.ts:31`

**Interfaces:**

- Produces: `isRootRelativePath(value: string): boolean` from `./base-path.js`; `BasePathLinkFact` (`{ kind: 'href' | 'goto' | 'redirect'; path: string; line: number }`) exported from `./component.js`; `ComponentFacts.basePathLinks: BasePathLinkFact[]` and `KitModuleFacts.basePathLinks: BasePathLinkFact[]`. Tasks 5–7 all use these exact names.

The field is non-optional on both channels deliberately: that makes TypeScript point at every construction site, which is how a missed producer gets caught. The site list above is complete — the `packages/cli` entries are outside `packages/core`'s own `tsc` scope and only surface under the monorepo-wide `pnpm typecheck`, so update them in this task rather than discovering them at the end.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/base-path-links-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/component-parse.js';

const links = (src: string) => parseComponentFacts(src, 'A.svelte').basePathLinks;

describe('basePathLinks — <a href>', () => {
  it('records a root-relative href', () => {
    expect(links(`<a href="/about">About</a>`)).toEqual([{ kind: 'href', path: '/about', line: 1 }]);
  });

  it('records a bare root href', () => {
    expect(links(`<a href="/">Home</a>`)).toEqual([{ kind: 'href', path: '/', line: 1 }]);
  });

  it('records each link with its own line', () => {
    const src = [`<a href="/about">A</a>`, `<a href="/blog">B</a>`].join('\n');
    expect(links(src)).toEqual([
      { kind: 'href', path: '/about', line: 1 },
      { kind: 'href', path: '/blog', line: 2 }
    ]);
  });

  it('records a link nested inside blocks', () => {
    const src = [`{#if show}`, `  <a href="/about">A</a>`, `{/if}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'href', path: '/about', line: 2 }]);
  });
});

describe('basePathLinks — <a href> exclusions', () => {
  it('does not record a protocol-relative URL', () => {
    expect(links(`<a href="//cdn.example.com/x">x</a>`)).toEqual([]);
  });

  it('does not record absolute, hash, query, or document-relative links', () => {
    expect(links(`<a href="https://example.com">x</a>`)).toEqual([]);
    expect(links(`<a href="mailto:a@b.dev">x</a>`)).toEqual([]);
    expect(links(`<a href="#top">x</a>`)).toEqual([]);
    expect(links(`<a href="?q=1">x</a>`)).toEqual([]);
    expect(links(`<a href="./rel">x</a>`)).toEqual([]);
    expect(links(`<a href="rel">x</a>`)).toEqual([]);
  });

  it('does not record a dynamic href (base-prefixed or resolve-wrapped)', () => {
    expect(links(`<a href="{base}/about">x</a>`)).toEqual([]);
    expect(links(`<a href={resolve('/about')}>x</a>`)).toEqual([]);
    expect(links(`<a href={url}>x</a>`)).toEqual([]);
  });

  it('does not record an href on a non-anchor element or a dynamic tag', () => {
    expect(links(`<link href="/style.css" />`)).toEqual([]);
    expect(links(`<area href="/about" />`)).toEqual([]);
    expect(links(`<svelte:element this="a" href="/about">x</svelte:element>`)).toEqual([]);
  });

  it('does not record an anchor with no href', () => {
    expect(links(`<a>x</a>`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-links-parse.test.ts`
Expected: FAIL — `parseComponentFacts(...).basePathLinks` is `undefined`.

- [ ] **Step 3: Create the leaf predicate module**

Create `packages/core/src/base-path.ts`. It imports nothing, so both parsers can use it with no risk of an import cycle:

```ts
/**
 * The path shape broken by `kit.paths.base` (correctness/base-path-navigation). Pure data
 * predicate — no imports, so both the component and Kit-module parsers can use it freely.
 */

/**
 * Whether a literal path is root-relative — it resolves against the domain root, so under a
 * base path it lands outside the app. `//host/x` is a protocol-relative EXTERNAL URL and is
 * excluded; `#hash`, `?query`, `./rel`, `rel`, and absolute URLs never start with `/`.
 */
export function isRootRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}
```

- [ ] **Step 4: Add the fact type and both channel fields**

In `packages/core/src/component.ts`, add this interface immediately above the `ComponentFacts` interface (after `SuppressionDirective`):

```ts
/** A root-relative navigation literal — broken when the app is served under `kit.paths.base`
 *  (correctness/base-path-navigation). Shared by the component and Kit-module channels. */
export interface BasePathLinkFact {
  /** Which navigation surface it was written on — selects the message wording. */
  kind: 'href' | 'goto' | 'redirect';
  /** The literal path as written, e.g. '/about'. */
  path: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}
```

and this field to `ComponentFacts`, immediately after `nonreactiveBuiltinStates`:

```ts
  /** Root-relative `<a href>` and `goto()` literals in this component (correctness/base-path-navigation). */
  basePathLinks: BasePathLinkFact[];
```

In `packages/core/src/kit-module.ts`, extend the existing type import and add the field after `browserGlobalRefs`:

```ts
import type { BasePathLinkFact, SuppressionDirective } from './component.js';
```

```ts
  /** Root-relative `redirect()` literals in this Kit module (correctness/base-path-navigation). */
  basePathLinks: BasePathLinkFact[];
```

- [ ] **Step 5: Add the empty defaults**

Four production sites, one line each:

- `packages/core/src/component-collect.ts`, in `emptyComponentFacts`, after `nonreactiveBuiltinStates: [],` → `basePathLinks: [],`
- `packages/core/src/kit-module-collect.ts`, in `emptyKitModuleFacts`, after `browserGlobalRefs: [],` → `basePathLinks: [],`
- `packages/core/src/kit-module-parse.ts`, in `parseKitModuleFacts`'s early `if (!program)` return, after `browserGlobalRefs,` → `basePathLinks: [],`
- `packages/core/src/kit-module-parse.ts`, in the final return of `parseKitModuleFacts`, after `browserGlobalRefs: byLine(browserGlobalRefs),` → `basePathLinks: [],`

(The Kit-module channel gets its real values in Task 6; empty arrays keep the repo compiling and every earlier test honest.)

- [ ] **Step 6: Add the href collector to `component-parse.ts`**

Import the predicate at the top of `packages/core/src/component-parse.ts`:

```ts
import { isRootRelativePath } from './base-path.js';
```

and add `BasePathLinkFact` to the existing `import type { ... } from './component.js';` block.

Then add the collector directly after `collectSecurityFacts` (immediately after its closing brace, which currently sits just before `isPropsCall`):

```ts
/**
 * Root-relative `<a href="/…">` literals (correctness/base-path-navigation). Only
 * `RegularElement` anchors with a fully static href are considered, which is what makes the
 * correct forms self-excluding: `href="{base}/x"` and `href={resolve('/x')}` contain an
 * `ExpressionTag`, so `attrTextOf` returns undefined. `<svelte:element this="a">` is a
 * different node type and is out of static reach.
 */
function collectHrefLinks(node: Node, source: string, acc: BasePathLinkFact[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHrefLinks(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'a' && Array.isArray(node.attributes)) {
    const attr = findAttr(node.attributes, 'href');
    const value = attr ? attrTextOf(attr) : undefined;
    if (value !== undefined && isRootRelativePath(value)) {
      acc.push({ kind: 'href', path: value, line: lineOf(source, attr?.start ?? node.start) });
    }
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectHrefLinks(node[key], source, acc);
  }
}
```

- [ ] **Step 7: Wire it into both `parseComponentFacts` branches**

In `parseComponentFacts`, right after the existing `collectSecurityFacts(ast.fragment ?? ast, source, htmlTags, javascriptUrls);` call:

```ts
const basePathLinks: BasePathLinkFact[] = [];
collectHrefLinks(ast.fragment ?? ast, source, basePathLinks);
```

and add `basePathLinks,` to that function's final return object, after `nonreactiveBuiltinStates,`.

In `parseModuleFacts` (the `.svelte.ts`/`.svelte.js` branch), add `basePathLinks: [],` to its returned object after `nonreactiveBuiltinStates: [],` — runes modules have no template, and their `goto()` support arrives in Task 5.

- [ ] **Step 8: Update the twelve test-helper construction sites**

Each is a `ComponentFacts`/`KitModuleFacts` object literal that lists every field; add `basePathLinks: [],` directly after the `nonreactiveBuiltinStates: [],` line (component facts) or the `browserGlobalRefs: [],` line (Kit-module facts). The exact lines are listed in this task's **Files** block — work through them in that order. `packages/core/test/component-collect.test.ts:47` is an exact-shape assertion on `emptyComponentFacts`, so it needs the same one-line addition.

- [ ] **Step 9: Run the new test, then the full core suite and monorepo typecheck**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-links-parse.test.ts`
Expected: PASS (9 cases).

Run: `pnpm --filter @svelte-vitals/core test && pnpm typecheck`
Expected: PASS. The monorepo typecheck is what proves the two `packages/cli` helper files were updated.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/base-path.ts packages/core/src/component.ts packages/core/src/kit-module.ts packages/core/src/component-parse.ts packages/core/src/kit-module-parse.ts packages/core/src/component-collect.ts packages/core/src/kit-module-collect.ts packages/core/test packages/cli/test
git commit -m "feat(core): detect root-relative <a href> links (issue #300)"
```

---

### Task 5: `goto()` detection

**Files:**

- Modify: `packages/core/src/component-parse.ts`
- Modify: `packages/core/test/base-path-links-parse.test.ts`

**Interfaces:**

- Consumes: `isRootRelativePath`, `BasePathLinkFact`, `ComponentFacts.basePathLinks` from Task 4.
- Produces: `collectNamedImportAliases(program: Node, moduleSource: string, names: Set<string>): Set<string>` — exported from `./component-parse.js`, reused by Task 6's Kit-module collector.

`collectBrowserGuardImports` already does exactly this for one name from `$app/environment`. It is generalized rather than copied, and kept as a thin wrapper so its existing callers and tests are untouched.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/test/base-path-links-parse.test.ts`:

```ts
const script = (body: string, template = '<p>x</p>') => `<script>\n${body}\n</script>\n${template}`;

describe('basePathLinks — goto()', () => {
  const importGoto = `import { goto } from '$app/navigation';`;

  it('records a root-relative goto in a function', () => {
    const src = script([importGoto, `function submit() {`, `  goto('/dashboard');`, `}`].join('\n'));
    expect(links(src)).toEqual([{ kind: 'goto', path: '/dashboard', line: 4 }]);
  });

  it('records a goto in a template inline handler', () => {
    const src = script(importGoto, `<button onclick={() => goto('/dashboard')}>go</button>`);
    expect(links(src)).toEqual([{ kind: 'goto', path: '/dashboard', line: 4 }]);
  });

  it('records an aliased goto import', () => {
    const src = script(
      [`import { goto as navigate } from '$app/navigation';`, `function f() {`, `  navigate('/x');`, `}`].join('\n')
    );
    expect(links(src)).toEqual([{ kind: 'goto', path: '/x', line: 4 }]);
  });

  it('records a goto in a <script module>', () => {
    const src = [`<script module>`, importGoto, `function f() {`, `  goto('/x');`, `}`, `</script>`, `<p>x</p>`].join(
      '\n'
    );
    expect(links(src)).toEqual([{ kind: 'goto', path: '/x', line: 4 }]);
  });

  it('does not record a resolve-wrapped or base-prefixed goto', () => {
    const wrapped = script([importGoto, `function f() {`, `  goto(resolve('/x'));`, `}`].join('\n'));
    expect(links(wrapped)).toEqual([]);
    const prefixed = script([importGoto, `function f() {`, '  goto(`${base}/x`);', `}`].join('\n'));
    expect(links(prefixed)).toEqual([]);
  });

  it('does not record non-root-relative or non-literal goto arguments', () => {
    const external = script([importGoto, `function f() {`, `  goto('https://example.com');`, `}`].join('\n'));
    expect(links(external)).toEqual([]);
    const hash = script([importGoto, `function f() {`, `  goto('#top');`, `}`].join('\n'));
    expect(links(hash)).toEqual([]);
    const variable = script([importGoto, `function f(url) {`, `  goto(url);`, `}`].join('\n'));
    expect(links(variable)).toEqual([]);
  });

  it('does not record a goto imported from somewhere else', () => {
    const src = script([`import { goto } from './my-router.js';`, `function f() {`, `  goto('/x');`, `}`].join('\n'));
    expect(links(src)).toEqual([]);
  });

  it('does not record a namespace-imported goto (documented limitation)', () => {
    const src = script(
      [`import * as nav from '$app/navigation';`, `function f() {`, `  nav.goto('/x');`, `}`].join('\n')
    );
    expect(links(src)).toEqual([]);
  });
});
```

Also add a runes-module case to the same file:

```ts
describe('basePathLinks — runes modules', () => {
  it('records a goto in a .svelte.ts module', () => {
    const src = [`import { goto } from '$app/navigation';`, `export function f() {`, `  goto('/x');`, `}`].join('\n');
    expect(parseComponentFacts(src, 'nav.svelte.ts').basePathLinks).toEqual([{ kind: 'goto', path: '/x', line: 3 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-links-parse.test.ts`
Expected: FAIL on every new `goto` case (each returns `[]`); the Task 4 `href` cases still pass.

- [ ] **Step 3: Generalize the import-alias collector**

In `packages/core/src/component-parse.ts`, replace the body of `collectBrowserGuardImports` with a wrapper over a new generic function. Keep `collectBrowserGuardImports`'s doc comment and exported signature exactly as they are, and put the generic one directly above it:

```ts
/**
 * Local names bound to any of `names` VALUE-imported from `moduleSource` (alias-resolved;
 * type-only imports and specifiers skipped). Namespace imports (`import * as x from …`) are
 * deliberately not resolved — the callers that need them handle namespaces themselves.
 * Shared by the browser-guard, `goto`, and `redirect` collectors.
 */
export function collectNamedImportAliases(program: Node, moduleSource: string, names: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ImportDeclaration' || stmt.importKind === 'type' || stmt.source?.value !== moduleSource) {
      continue;
    }
    for (const s of stmt.specifiers ?? []) {
      if (s?.importKind === 'type' || s?.local?.type !== 'Identifier') continue;
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' && names.has(s.imported.name)) {
        out.add(s.local.name);
      }
    }
  }
  return out;
}

const BROWSER_GUARD_NAMES = new Set(['browser']);
```

and the wrapper (doc comment unchanged from what is already there):

```ts
export function collectBrowserGuardImports(program: Node): Set<string> {
  return collectNamedImportAliases(program, '$app/environment', BROWSER_GUARD_NAMES);
}
```

- [ ] **Step 4: Add the goto collector**

In `packages/core/src/component-parse.ts`, directly below `collectHrefLinks`:

```ts
const GOTO_NAMES = new Set(['goto']);

/**
 * Root-relative `goto('/…')` calls (correctness/base-path-navigation). Only a plain string
 * literal argument counts, which self-excludes the correct forms — `goto(resolve('/x'))` is a
 * CallExpression and ``goto(`${base}/x`)`` is a TemplateLiteral. `roots` are the nodes to walk
 * (the instance program plus the template fragment, so inline handlers are covered); `locals`
 * comes from the same program's imports.
 */
function collectGotoLinks(locals: Set<string>, roots: Node[], source: string, acc: BasePathLinkFact[]): void {
  if (locals.size === 0) return;
  for (const root of roots) {
    if (!root) continue;
    walkEstree(root, (n: Node) => {
      if (n.type !== 'CallExpression' || n.callee?.type !== 'Identifier' || !locals.has(n.callee.name)) return;
      const arg = n.arguments?.[0];
      if (arg?.type !== 'Literal' || typeof arg.value !== 'string' || !isRootRelativePath(arg.value)) return;
      acc.push({ kind: 'goto', path: arg.value, line: lineOf(source, n.start) });
    });
  }
}
```

- [ ] **Step 5: Wire goto into both `parseComponentFacts` branches**

In `parseComponentFacts`, the `basePathLinks` array already exists from Task 4. The instance and module programs are both available there (`ast.instance?.content` is assigned to `program` further down; `ast.module?.content` to `moduleProgram` above). Add this immediately after the `collectHrefLinks(...)` call, using the AST directly so it does not depend on where those locals are declared:

```ts
const gotoPrograms = [ast.module?.content, ast.instance?.content].filter(Boolean) as Node[];
const gotoLocals = new Set<string>();
for (const p of gotoPrograms)
  for (const n of collectNamedImportAliases(p, '$app/navigation', GOTO_NAMES)) {
    gotoLocals.add(n);
  }
collectGotoLinks(gotoLocals, [...gotoPrograms, ast.fragment], source, basePathLinks);
```

In `parseModuleFacts`, replace the `basePathLinks: []` placeholder from Task 4 with a real collection. `parseModuleFacts` already has `program` and `wrapped`, and reports lines shifted by its local `shift` helper:

```ts
const basePathLinks: BasePathLinkFact[] = [];
if (program) {
  const locals = collectNamedImportAliases(program, '$app/navigation', GOTO_NAMES);
  const raw: BasePathLinkFact[] = [];
  collectGotoLinks(locals, [program], wrapped, raw);
  for (const l of raw) basePathLinks.push({ ...l, line: shift(l.line) });
}
```

and return `basePathLinks` instead of the empty literal.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-links-parse.test.ts`
Expected: PASS (all href, goto, and runes-module cases).

- [ ] **Step 7: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. The `collectBrowserGuardImports` refactor is covered by the existing browser-global tests — any failure there means the wrapper changed behaviour.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/component-parse.ts packages/core/test/base-path-links-parse.test.ts
git commit -m "feat(core): detect root-relative goto() calls (issue #300)"
```

---

### Task 6: `redirect()` detection on the Kit-module channel

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts`
- Create: `packages/core/test/base-path-redirect-parse.test.ts`

**Interfaces:**

- Consumes: `collectNamedImportAliases` from Task 5 (exported by `./component-parse.js`, which `kit-module-parse.ts` already imports from), `isRootRelativePath` from Task 4, `KitModuleFacts.basePathLinks` from Task 4.
- Produces: populated `KitModuleFacts.basePathLinks` — Task 7's rule reads it.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/base-path-redirect-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseKitModuleFacts } from '../src/kit-module-parse.js';

const links = (src: string, file = 'src/routes/+page.server.ts') => parseKitModuleFacts(src, file).basePathLinks;
const importRedirect = `import { redirect } from '@sveltejs/kit';`;

describe('basePathLinks — redirect()', () => {
  it('records a root-relative redirect target', () => {
    const src = [importRedirect, `export function load() {`, `  redirect(303, '/login');`, `}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/login', line: 3 }]);
  });

  it('records a thrown redirect (the SvelteKit 1 form)', () => {
    const src = [importRedirect, `export function load() {`, `  throw redirect(303, '/login');`, `}`].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/login', line: 3 }]);
  });

  it('records an aliased redirect import', () => {
    const src = [
      `import { redirect as go } from '@sveltejs/kit';`,
      `export function load() {`,
      `  go(307, '/x');`,
      `}`
    ].join('\n');
    expect(links(src)).toEqual([{ kind: 'redirect', path: '/x', line: 3 }]);
  });

  it('records a redirect in a universal load', () => {
    const src = [importRedirect, `export function load() {`, `  redirect(303, '/x');`, `}`].join('\n');
    expect(links(src, 'src/routes/+page.ts')).toEqual([{ kind: 'redirect', path: '/x', line: 3 }]);
  });

  it('does not record a resolve-wrapped or base-prefixed target', () => {
    const wrapped = [importRedirect, `export function load() {`, `  redirect(303, resolve('/x'));`, `}`].join('\n');
    expect(links(wrapped)).toEqual([]);
    const prefixed = [importRedirect, `export function load() {`, '  redirect(303, `${base}/x`);', `}`].join('\n');
    expect(links(prefixed)).toEqual([]);
  });

  it('does not record external, hash, or non-literal targets', () => {
    const external = [importRedirect, `export function load() {`, `  redirect(303, 'https://x.dev');`, `}`].join('\n');
    expect(links(external)).toEqual([]);
    const protocolRelative = [importRedirect, `export function load() {`, `  redirect(303, '//x.dev');`, `}`].join(
      '\n'
    );
    expect(links(protocolRelative)).toEqual([]);
    const variable = [importRedirect, `export function load() {`, `  redirect(303, target);`, `}`].join('\n');
    expect(links(variable)).toEqual([]);
  });

  it('does not record a redirect imported from somewhere else', () => {
    const src = [
      `import { redirect } from './helpers.js';`,
      `export function load() {`,
      `  redirect(303, '/x');`,
      `}`
    ].join('\n');
    expect(links(src)).toEqual([]);
  });

  it('is empty for a module with no redirect', () => {
    expect(links(`export function load() { return {}; }`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-redirect-parse.test.ts`
Expected: FAIL — `basePathLinks` is the empty array Task 4 hard-coded, so every "records" case fails.

- [ ] **Step 3: Add the redirect collector**

In `packages/core/src/kit-module-parse.ts`, extend the existing import block from `./component-parse.js` with `collectNamedImportAliases`, and add these imports:

```ts
import { isRootRelativePath } from './base-path.js';
import type { BasePathLinkFact } from './component.js';
```

Then add the collector next to `collectAwaits` (same recursive shape, but it does descend into nested functions — a `redirect` inside a nested helper is just as broken):

```ts
const REDIRECT_NAMES = new Set(['redirect']);

/**
 * Root-relative `redirect(status, '/…')` targets (correctness/base-path-navigation). Argument 1
 * is the location (argument 0 is the status). Only a plain string literal counts, which
 * self-excludes `redirect(303, resolve('/x'))` and ``redirect(303, `${base}/x`)``. A `throw
 * redirect(...)` is the same CallExpression, so both call styles are covered.
 */
function collectRedirectCalls(node: Node, locals: Set<string>, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const child of node) collectRedirectCalls(child, locals, out);
    return out;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return out;
  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && locals.has(node.callee.name)) {
    out.push(node);
  }
  for (const key of Object.keys(node)) {
    if (WALK_IGNORED_KEYS.has(key)) continue;
    collectRedirectCalls(node[key], locals, out);
  }
  return out;
}
```

- [ ] **Step 4: Populate the fact**

In `parseKitModuleFacts`, immediately before the function's final `return {` statement (the `line` helper and `program` are both in scope there), build the list:

```ts
const basePathLinks: BasePathLinkFact[] = [];
const redirectLocals = collectNamedImportAliases(program, '@sveltejs/kit', REDIRECT_NAMES);
if (redirectLocals.size > 0) {
  for (const call of collectRedirectCalls(program, redirectLocals)) {
    const arg = call.arguments?.[1];
    if (arg?.type !== 'Literal' || typeof arg.value !== 'string' || !isRootRelativePath(arg.value)) continue;
    basePathLinks.push({ kind: 'redirect', path: arg.value, line: line(call.start) });
  }
}
```

Then replace the `basePathLinks: []` placeholder in the function's final return with `basePathLinks`. Leave the early `if (!program)` return's `basePathLinks: []` as-is — an unparsable module has no facts.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-redirect-parse.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 6: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/kit-module-parse.ts packages/core/test/base-path-redirect-parse.test.ts
git commit -m "feat(core): detect root-relative redirect() targets (issue #300)"
```

---

### Task 7: The rule and its registration

**Files:**

- Create: `packages/core/src/rules/correctness/base-path-navigation.ts`
- Create: `packages/core/test/base-path-navigation-rule.test.ts`
- Modify: `packages/core/src/rules/index.ts`, `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `ComponentFacts.basePathLinks` (Task 4), `KitModuleFacts.basePathLinks` (Task 6), `Project.kitPathsBase` (Task 3).
- Produces: `correctnessBasePathNavigation` (a `Rule`, id `correctness/base-path-navigation`), exported from `packages/core/src/rules/index.ts` and re-exported from `packages/core/src/index.ts`.

`correctness/orphan-lifecycle` is the shape to copy: a custom dual-channel `Rule` that emits per file, with no PASS seeding for files that carry no facts.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/base-path-navigation-rule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { correctnessBasePathNavigation } from '../src/rules/correctness/base-path-navigation.js';
import { emptyComponentFacts } from '../src/component-collect.js';
import { emptyKitModuleFacts } from '../src/kit-module-collect.js';
import { defaultProject, defineConfig } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';
import type { BasePathLinkFact, ComponentFacts } from '../src/component.js';
import type { KitModuleFacts } from '../src/kit-module.js';
import type { Project } from '../src/types.js';

const config = defineConfig({});
const withBase: Project = { ...defaultProject, kitPathsBase: { value: '/docs', file: 'svelte.config.js' } };

function ctx(project: Project, components: ComponentFacts[] = [], kitModules: KitModuleFacts[] = []): RuleContext {
  return { heads: [], project, config, components, kitModules } as RuleContext;
}

const comp = (file: string, basePathLinks: BasePathLinkFact[]): ComponentFacts => ({
  ...emptyComponentFacts(file),
  basePathLinks
});

const kit = (file: string, basePathLinks: BasePathLinkFact[]): KitModuleFacts => ({
  ...emptyKitModuleFacts(file, 'server'),
  basePathLinks
});

describe('correctness/base-path-navigation', () => {
  it('emits nothing when the project has no base path, even with facts present', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(defaultProject, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 3 }])])
    );
    expect(results).toEqual([]);
  });

  it('flags an href with the href-specific message at warning severity', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 3 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/routes/+page.svelte');
    expect(penalized[0]!.line).toBe(3);
    expect(penalized[0]!.severity).toBe('warning');
    expect(penalized[0]!.message).toBe(
      `<a href="/about"> is root-relative — under this project's kit.paths.base it points at the domain root, outside the app, and 404s in production. Use resolve('/about') from '$app/paths'.`
    );
    expect(penalized[0]!.fix?.description).toContain('$app/paths');
  });

  it('flags goto with the goto-specific message', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/lib/Nav.svelte', [{ kind: 'goto', path: '/dashboard', line: 7 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.message).toBe(
      `goto('/dashboard') is root-relative — it navigates outside this project's kit.paths.base and 404s in production. Use goto(resolve('/dashboard')) with resolve from '$app/paths'.`
    );
  });

  it('flags redirect on the Kit-module channel', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [], [kit('src/routes/+page.server.ts', [{ kind: 'redirect', path: '/login', line: 4 }])])
    );
    const penalized = results.filter((r) => r.detection.presence === 'none');
    expect(penalized).toHaveLength(1);
    expect(penalized[0]!.location).toBe('src/routes/+page.server.ts');
    expect(penalized[0]!.message).toBe(
      `redirect(…, '/login') is root-relative — the Location header points outside this project's kit.paths.base and 404s in production. Use resolve('/login') from '$app/paths'.`
    );
  });

  it('fires on a dynamic base (fact present, value unknown)', async () => {
    const dynamic: Project = { ...defaultProject, kitPathsBase: { file: 'svelte.config.js' } };
    const results = await correctnessBasePathNavigation.check(
      ctx(dynamic, [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/about', line: 1 }])])
    );
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(1);
  });

  it('reports both channels in one run', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(
        withBase,
        [comp('src/routes/+page.svelte', [{ kind: 'href', path: '/a', line: 1 }])],
        [kit('src/routes/+page.server.ts', [{ kind: 'redirect', path: '/b', line: 2 }])]
      )
    );
    expect(results.filter((r) => r.detection.presence === 'none')).toHaveLength(2);
  });

  it('emits nothing for files with no links', async () => {
    const results = await correctnessBasePathNavigation.check(
      ctx(withBase, [comp('src/routes/+page.svelte', [])], [kit('src/routes/+page.server.ts', [])])
    );
    expect(results).toEqual([]);
  });

  it('is registered', async () => {
    const { allRules, explainRule } = await import('../src/rules/index.js');
    expect(allRules.some((r) => r.id === 'correctness/base-path-navigation')).toBe(true);
    expect(explainRule('correctness/base-path-navigation')?.severity).toBe('warning');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-navigation-rule.test.ts`
Expected: FAIL — cannot resolve `../src/rules/correctness/base-path-navigation.js`.

- [ ] **Step 3: Create the rule**

Create `packages/core/src/rules/correctness/base-path-navigation.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { BasePathLinkFact, SuppressionDirective } from '../../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

const ID = 'correctness/base-path-navigation';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Base-path-aware navigation';
const RECOMMENDATION =
  "Wrap root-relative paths in resolve() from '$app/paths' so they resolve against kit.paths.base.";
const FIX = {
  description:
    "Import { resolve } from '$app/paths' and wrap the path: href={resolve('/about')}, goto(resolve('/about')), redirect(303, resolve('/login'))."
};

function messageFor(link: BasePathLinkFact): string {
  if (link.kind === 'href') {
    return `<a href="${link.path}"> is root-relative — under this project's kit.paths.base it points at the domain root, outside the app, and 404s in production. Use resolve('${link.path}') from '$app/paths'.`;
  }
  if (link.kind === 'goto') {
    return `goto('${link.path}') is root-relative — it navigates outside this project's kit.paths.base and 404s in production. Use goto(resolve('${link.path}')) with resolve from '$app/paths'.`;
  }
  return `redirect(…, '${link.path}') is root-relative — the Location header points outside this project's kit.paths.base and 404s in production. Use resolve('${link.path}') from '$app/paths'.`;
}

function isSuppressed(suppressions: SuppressionDirective[] | undefined, line: number): boolean {
  return (suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ID)));
}

/** Emit one file's PASS/PENALIZED results — same shapes as componentRule/kitModuleRule. */
function emitFile(
  out: Result[],
  file: string,
  links: BasePathLinkFact[],
  suppressions: SuppressionDirective[] | undefined
): void {
  const bad = links.filter((l) => !(l.line > 0 && isSuppressed(suppressions, l.line)));
  if (bad.length === 0) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'warning',
      detection: PASS,
      route: file,
      message: LABEL,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
    return;
  }
  for (const l of bad) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'warning',
      detection: PENALIZED,
      route: file,
      location: file,
      ...(l.line > 0 ? { line: l.line } : {}),
      message: messageFor(l),
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL,
      fix: { ...FIX }
    });
  }
}

/**
 * correctness/base-path-navigation — root-relative navigation literals in a project that sets
 * `kit.paths.base`. A custom check because it is gated on a PROJECT fact and its own facts live
 * on BOTH the component channel (`<a href>`, `goto()`) and the Kit-module channel (`redirect()`).
 * With no base path configured the rule emits nothing at all — the gate is the whole point.
 */
export const correctnessBasePathNavigation: Rule = {
  id: ID,
  title: 'Root-relative navigation under a base path',
  category: 'correctness',
  severity: 'warning',
  scope: 'component',
  rationale:
    'A root-relative literal resolves against the domain root, not kit.paths.base, so navigation lands outside an app served from a sub-path. The break only appears once the app is deployed under its base — locally base is usually empty, so every such link works.',
  fix: { ...FIX },
  async check(ctx: RuleContext): Promise<Result[]> {
    if (!ctx.project.kitPathsBase) return [];
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const links = c.basePathLinks ?? [];
      if (links.length === 0) continue;
      emitFile(out, c.file, links, c.suppressions);
    }
    for (const m of ctx.kitModules ?? []) {
      const links = m.basePathLinks ?? [];
      if (links.length === 0) continue;
      emitFile(out, m.file, links, m.suppressions);
    }
    return out;
  }
};
```

- [ ] **Step 4: Register in `packages/core/src/rules/index.ts`**

Three edits in that file, each placed directly after the corresponding `correctnessOrphanLifecycle` line:

```ts
import { correctnessBasePathNavigation } from './correctness/base-path-navigation.js';
```

```ts
  correctnessOrphanLifecycle,
  correctnessBasePathNavigation,
```

(once in the `allRules` array, once in the `export { ... }` block at the bottom).

- [ ] **Step 5: Register in `packages/core/src/index.ts`**

In the single `export { ... } from './rules/index.js';` list, add it directly after `correctnessOrphanLifecycle,`:

```ts
  correctnessOrphanLifecycle,
  correctnessBasePathNavigation,
```

Then verify all four registration places are present: `grep -rn "correctnessBasePathNavigation" packages/core/src/` must print exactly 5 lines — the four registrations (the import, the `allRules` entry, the `rules/index.ts` re-export, and the `index.ts` re-export) plus the `export const` in the rule file itself.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @svelte-vitals/core exec vitest run test/base-path-navigation-rule.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 7: Run the full core suite and typecheck**

Run: `pnpm --filter @svelte-vitals/core test && pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. `packages/cli/test/docs-links.test.ts` will fail until Task 8 adds the doc pages — that is expected and is not a regression from this task.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/rules/correctness/base-path-navigation.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/base-path-navigation-rule.test.ts
git commit -m "feat(core): add correctness/base-path-navigation rule (issue #300)"
```

---

### Task 8: Documentation, changeset, and full verification

**Files:**

- Create: `docs/src/content/docs/rules/correctness/base-path-navigation.md`
- Create: `docs/src/content/docs/ja/rules/correctness/base-path-navigation.md`
- Create: `.changeset/base-path-navigation-rule.md`

**Interfaces:**

- Consumes: rule id `correctness/base-path-navigation`, severity `warning`, category `correctness` from Task 7 — `packages/cli/test/docs-links.test.ts` asserts a page exists at `{category}/{rule-name}.md` under both `docs/src/content/docs/rules/` and `docs/src/content/docs/ja/rules/`.

- [ ] **Step 1: Create the English doc page**

Create `docs/src/content/docs/rules/correctness/base-path-navigation.md` with exactly this content:

````markdown
---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: 'A hardcoded root-relative link resolves against the domain root, not kit.paths.base — under a base path it lands outside the app and 404s in production.'
---

**Severity:** warning · **Category:** correctness

## What it checks

Only projects that configure `kit.paths.base` are checked. In those, the rule flags navigation written as a hardcoded root-relative literal on three surfaces:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

Under `base: '/docs'` these target `/about`, `/dashboard`, and `/login` on the domain root — outside the app — and 404 in production.

The base path is read the way SvelteKit reads it: from the `sveltekit({ paths: { base } })` argument in your Vite config when it has one (which makes `svelte.config` irrelevant, as SvelteKit itself warns), otherwise from `kit.paths.base` in `svelte.config.js`/`.ts`. A base that the config computes — the common `base: dev ? '' : '/repo'` deploy form — still opens the gate: the app is served under a base in at least one environment. An absent base, or an explicit `base: ''`, keeps the rule silent entirely.

Detection is literal-only, which means the correct forms are never flagged: `href="{base}/about"`, `href={resolve('/about')}`, `goto(resolve('/about'))`, and ``goto(`${base}/about`)`` are all dynamic expressions, not string literals.

## Why it matters

The break is invisible where you develop it. A base path is usually applied only in the deployed environment, so locally `base` is `''` and every hardcoded link works. Nothing else catches it either: the Svelte compiler sees an ordinary attribute, and `svelte-check` type-checks the string, not what it resolves to at runtime. The bug surfaces as "every link 404s" after deploy.

## How to fix

Wrap the path in `resolve()` from `$app/paths`:

```svelte
<script>
  import { resolve } from '$app/paths';
</script>

<a href={resolve('/about')}>About</a>
```

```js
import { resolve } from '$app/paths';
import { goto } from '$app/navigation';

goto(resolve('/dashboard'));
redirect(303, resolve('/login'));
```

`resolve()` (SvelteKit 2.26+) prefixes the base path for you, and also populates route parameters when you pass a route ID. It supersedes both `base` and `resolveRoute`, which are deprecated.

## Limitations

`<form action="/…">`, `fetch('/api/…')`, and static assets (`<img src="/logo.png">`, `<link href>`) are not covered — assets break the same way but are fixed with `asset()` rather than `resolve()`, so they are left to a future rule. Dynamic paths of any kind are out of static reach, as are `<svelte:element this="a">` and namespace-imported `goto`/`redirect` (`import * as nav from '$app/navigation'`). If your Vite config passes a `sveltekit()` argument that cannot be read statically — an imported config object, for example — the rule stays silent rather than guessing.

## Disabling

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
````

- [ ] **Step 2: Create the Japanese doc page**

Create `docs/src/content/docs/ja/rules/correctness/base-path-navigation.md` with exactly this content:

````markdown
---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: 'ハードコードされたルート相対リンクは kit.paths.base ではなくドメインのルートを指すため、base path 配下ではアプリの外に出てしまい、本番環境で404になります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

対象になるのは `kit.paths.base` を設定しているプロジェクトだけです。その場合に、ハードコードされたルート相対リテラルで書かれたナビゲーションを3つの箇所で検出します:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

`base: '/docs'` の下では、これらは `/about`・`/dashboard`・`/login` というドメインのルート、つまりアプリの外を指してしまい、本番環境で404になります。

base path の読み取り方は SvelteKit 自身と同じです。Vite の設定に `sveltekit({ paths: { base } })` の引数があればそちらを見ます(この場合 `svelte.config` は無視されます。SvelteKit 自身も警告を出します)。無ければ `svelte.config.js`/`.ts` の `kit.paths.base` を見ます。設定側で値を計算している場合 — よくある `base: dev ? '' : '/repo'` というデプロイ用の書き方 — も検出対象になります。少なくともどれかの環境では base 配下で配信されるからです。base が無い場合や、明示的に `base: ''` の場合は、このルールは一切発火しません。

検出は静的なリテラルだけを対象にします。そのため正しい書き方が誤検出されることはありません。`href="{base}/about"`、`href={resolve('/about')}`、`goto(resolve('/about'))`、``goto(`${base}/about`)`` はいずれも文字列リテラルではなく動的な式だからです。

## なぜ重要か

この不具合は、開発している環境では見えません。base path は通常デプロイ先の環境でだけ適用されるため、手元では `base` が `''` になり、ハードコードされたリンクはすべて正しく動いてしまいます。他のツールも教えてくれません。Svelte のコンパイラにはただの属性に見えますし、`svelte-check` が検査するのは文字列の型であって、それが実行時に何に解決されるかではありません。結果として「デプロイしたら全部のリンクが404になる」という形で表面化します。

## 修正方法

`$app/paths` の `resolve()` でパスを包みます:

```svelte
<script>
  import { resolve } from '$app/paths';
</script>

<a href={resolve('/about')}>About</a>
```

```js
import { resolve } from '$app/paths';
import { goto } from '$app/navigation';

goto(resolve('/dashboard'));
redirect(303, resolve('/login'));
```

`resolve()`(SvelteKit 2.26以降)が base path を前置してくれます。ルートIDを渡せばルートパラメータの埋め込みも行います。非推奨になった `base` と `resolveRoute` の置き換えです。

## 制限事項

`<form action="/…">`、`fetch('/api/…')`、静的アセット(`<img src="/logo.png">`、`<link href>`)は対象外です。アセットも同じように壊れますが、修正には `resolve()` ではなく `asset()` を使うため、別のルールに委ねています。動的なパスはすべて静的解析の範囲外で、`<svelte:element this="a">` や名前空間インポートの `goto`/`redirect`(`import * as nav from '$app/navigation'`)も同様です。Vite の設定の `sveltekit()` に静的に読めない引数(別ファイルからインポートした設定オブジェクトなど)が渡されている場合は、推測せずに沈黙します。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
````

- [ ] **Step 3: Run the docs-links test**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals exec vitest run test/docs-links.test.ts`
Expected: PASS. The core build is required first so the test sees the newly registered rule.

- [ ] **Step 4: Create the changeset**

Create `.changeset/base-path-navigation-rule.md`:

```markdown
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add `correctness/base-path-navigation`: in projects that configure `kit.paths.base`, flags hardcoded root-relative navigation — `<a href="/about">`, `goto('/about')`, `redirect(303, '/login')` — which resolves against the domain root, lands outside the app, and 404s in production while working fine locally. The base path is read from the `sveltekit()` Vite plugin config, else `svelte.config.{js,ts}`, following SvelteKit's own precedence; projects without a base path are never flagged. Detection is literal-only, so `resolve()`-wrapped and `base`-prefixed paths are never reported.
```

- [ ] **Step 5: Run the full verify suite**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:publish`
Expected: all five PASS. If `pnpm lint` reports formatting, run `pnpm format` and re-run `pnpm lint`. Any failure that the changed files do not explain should be investigated and reported, not patched around.

- [ ] **Step 6: Commit**

```bash
git add docs/src/content/docs/rules/correctness/base-path-navigation.md docs/src/content/docs/ja/rules/correctness/base-path-navigation.md .changeset/base-path-navigation-rule.md
git commit -m "docs: add base-path-navigation rule pages (en/ja) and changeset"
```

- [ ] **Step 7: Final review against the design doc**

Re-read `docs/superpowers/specs/2026-07-25-base-path-navigation-design.md` against the accumulated diff (`git diff <branch-base>..HEAD --stat`) and confirm each section — Rule, Gate, Resolution order, When the gate opens, Machinery, Detection, Registration/docs/changeset, Testing — has a corresponding change. Report anything unaccounted for.
