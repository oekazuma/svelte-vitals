# SvelteKit 3 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** svelte-vitals analyzes a SvelteKit 3 app as well as a SvelteKit 2 app, and `@svelte-vitals/vite` installs and type-checks in one, without changing SvelteKit 2 findings.

**Architecture:** Three PRs. PR 1 makes the vite package's hook type version-agnostic and adds a SvelteKit 3 example app (`examples/sveltekit-3`) on a named pnpm catalog. PR 2 reads the facts that SvelteKit 3 moved into the `sveltekit({...})` plugin options and `$app/env`. PR 3 widens the server-only locations used by the shared-state rules, after a corpus measurement.

**Tech Stack:** TypeScript 6, SvelteKit 2.70 / 3.1, adapter-static 3 / 4, Vite 8, vitest 5, pnpm catalogs, Renovate.

**Spec:** `docs/superpowers/specs/2026-11-09-sveltekit-3-support-design.md`

## Global Constraints

- SvelteKit 2 support stays. No SvelteKit 2 path is removed.
- `packages/core` stays runtime-agnostic: no `node:` imports, no I/O.
- The default catalog stays on `@sveltejs/kit` ^2 and `@sveltejs/adapter-static` ^3. The named catalog `kit3` holds `@sveltejs/kit` ^3.1.1 and `@sveltejs/adapter-static` ^4.0.1 and is used only by `examples/sveltekit-3`.
- Every user-facing PR carries a changeset, `patch` only.
- A lost `tp` finding on the corpus is a failure even when the SvelteKit 3 behaviour is right.
- en and ja docs change together. Stamp each English page with `pnpm --filter docs run translate:stamp <en-file...>` only after its Japanese page is updated.
- Comments say only a non-obvious WHY. No change history in comments or docs.
- Lint and format from the mirror (`.claude/` worktrees make oxlint and oxfmt skip every file): `rsync` to `$S/mirror`, then `./node_modules/.bin/oxfmt` and `./node_modules/.bin/oxlint` there, never `pnpm exec`.
- Check each verification by its exit code, never through a pipe or grep filter.

## Review Focus

1. A SvelteKit 2 app that passes options to `sveltekit()` (Kit 2.62+, for example `conzani/cons-system` in the corpus) must still resolve `$lib`. Task 5 pins it.
2. `svelteVitalsHandle()` must still be assignable to SvelteKit 2's `Handle` as well as SvelteKit 3's. Task 1 pins 2 and Task 2 pins 3.
3. A plugin config with options but no `router` must not fall back to a stale `svelte.config.js` hash router. Task 5 pins it.
4. An opaque `$lib` (unreadable `files.lib`) keeps the shared-state rules silent after PR 3. Task 8 pins it.
5. An in-memory container (`new Map()`) exported from a newly exempt `server` location is still reported, as it is under `src/lib/server` today. Task 8 pins it.

---

## PR 1: hook type, example app, catalog

Branch: `claude/sveltekit-3-support` (already holds the design doc commit).

### Task 1: Version-agnostic `Handle` type in `@svelte-vitals/vite`

**Files:**

- Modify: `packages/vite/src/hooks/handle.ts:2` and the `svelteVitalsHandle` signature
- Modify: `packages/vite/package.json` (`peerDependencies`)
- Test: `packages/vite/test/dev-handle.test.ts`
- Create: `.changeset/<name>.md`

**Interfaces:**

- Produces: `svelteVitalsHandle(options?: SvelteVitalsHookOptions): SvelteVitalsHandle`, with the type below declared in `handle.ts` and not exported:

```ts
type MaybePromise<T> = T | Promise<T>;
/** The part of a SvelteKit 2 or 3 `RequestEvent` this handle reads. */
interface HandleEvent {
  route: { id: string | null };
  url: URL;
}
type SvelteVitalsHandle = <E extends HandleEvent>(input: {
  event: E;
  resolve: (
    event: E,
    opts?: { transformPageChunk?: (input: { html: string; done: boolean }) => MaybePromise<string | undefined> }
  ) => MaybePromise<Response>;
}) => MaybePromise<Response>;
```

The type parameter is what makes it assignable to both majors' `Handle`. A non-generic `event: HandleEvent` fails, because `resolve`'s parameter is checked contravariantly against Kit's `RequestEvent`.

- [ ] **Step 1: Add the SvelteKit 2 assignability guard**

In `dev-handle.test.ts`, next to the existing `import type { Handle, RequestEvent } from '@sveltejs/kit'`:

```ts
it('is assignable to the SvelteKit Handle type', () => {
  const handle: Handle = svelteVitalsHandle();
  expect(typeof handle).toBe('function');
});
```

- [ ] **Step 2: Replace the import and annotate the return type**

Remove `import type { Handle } from '@sveltejs/kit'`, add the types above, and change the return annotation to `SvelteVitalsHandle`. Set `"@sveltejs/kit": "^2.0.0 || ^3.0.0"` in `peerDependencies`.

- [ ] **Step 3: Verify**

Run `pnpm --filter @svelte-vitals/vite typecheck`, `pnpm --filter @svelte-vitals/vite test`, and `pnpm --filter @svelte-vitals/vite build`. Expected: all exit 0. Then `grep -c "@sveltejs/kit" packages/vite/dist/hooks/index.d.ts`. Expected: `0`, which grep reports with exit 1.

- [ ] **Step 4: Changeset and commit**

Changeset: `'@svelte-vitals/vite': patch`. Text: "`@svelte-vitals/vite` now accepts SvelteKit 3 as a peer, and `svelteVitalsHandle()` type-checks against both SvelteKit 2's and 3's `Handle`."

```bash
git add packages/vite .changeset
git commit -m "fix(vite): type svelteVitalsHandle without importing SvelteKit's Handle"
```

### Task 2: `kit3` catalog, Renovate hold, and the SvelteKit 3 example app

**Files:**

- Modify: `pnpm-workspace.yaml` (add `catalogs.kit3`)
- Modify: `renovate.json` (one `packageRules` entry)
- Modify: `pnpm-lock.yaml` (via `pnpm install`)
- Create: `examples/sveltekit-3/{package.json,vite.config.ts,vitest.config.ts,tsconfig.json,.gitignore}`
- Create: `examples/sveltekit-3/src/{app.html,hooks.server.ts}`, `src/lib/Head.svelte`, `src/routes/{+layout.ts,+page.svelte}`, `src/routes/untitled/+page.svelte`
- Create: `examples/sveltekit-3/test/e2e.test.ts`
- Modify: `AGENTS.md` (Package map, one entry)

**Interfaces:**

- Consumes: Task 1's `svelteVitalsHandle`.
- Produces: the app at `examples/sveltekit-3`. PRs 2 and 3 plant samples in it and add `it` cases to `test/e2e.test.ts`, which exposes `staticReport` and `buildReport` (both typed as kitchen-sink's `JsonReport`) from its `beforeAll`s.

- [ ] **Step 1: Catalog and Renovate rule**

```yaml
catalogs:
  kit3:
    '@sveltejs/adapter-static': ^4.0.1
    '@sveltejs/kit': ^3.1.1
```

Renovate gives default-catalog entries the depType `pnpm.catalog.default` and named catalogs `pnpm.catalog.<name>` (confirmed in `renovatebot/renovate` `lib/modules/manager/npm/dep-types.ts`). Add two rules after the `Svelte` group rule:

```json
{
  "description": "The default catalog stays on SvelteKit 2, which most analyzed apps still use; SvelteKit 3 lives in the kit3 catalog, used only by examples/sveltekit-3.",
  "matchDepTypes": ["pnpm.catalog.default"],
  "matchPackageNames": ["@sveltejs/kit"],
  "allowedVersions": "<3"
},
{
  "description": "adapter-static 4 requires SvelteKit 3, so it is held with it.",
  "matchDepTypes": ["pnpm.catalog.default"],
  "matchPackageNames": ["@sveltejs/adapter-static"],
  "allowedVersions": "<4"
}
```

Verify with `node -e "JSON.parse(require('node:fs').readFileSync('renovate.json','utf8'))"`. Expected: exit 0.

- [ ] **Step 2: Scaffold the app**

- `package.json`:
  - Fields: `"name": "sveltekit-3"`, `"private": true`, `"type": "module"`.
  - `imports`: `"#lib/*": "./src/lib/*"`.
  - Scripts, the same two as kitchen-sink (no `build` script, since `pnpm -r build` must not run it):
    - `"test": "svelte-kit sync && vitest run"`
    - `"typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"`
  - devDependencies:
    - `@sveltejs/kit` and `@sveltejs/adapter-static` as `catalog:kit3`;
    - `@sveltejs/vite-plugin-svelte`, `svelte`, `svelte-check`, `typescript`, `vite` and `vitest` as `catalog:`;
    - `@svelte-vitals/core`, `@svelte-vitals/vite` and `svelte-vitals` as `workspace:*`.
- `vite.config.ts`: `plugins: [sveltekit({ adapter: adapter() }), svelteVitals({ outFile: 'svelte-vitals-report.json' })]`. There is no `svelte.config.*` file.
- `vitest.config.ts`: a copy of kitchen-sink's, so vitest does not load the sveltekit plugin.
- `tsconfig.json`: `{ "extends": "$app/tsconfig", "include": ["src"] }`. `test/` stays out, as in kitchen-sink: `$app/tsconfig` pins `types`, so `node:` imports in the test would not resolve under `svelte-check`.
- `.gitignore`: the same four lines as kitchen-sink.
- `src/hooks.server.ts`:
  - `import { sequence } from '@sveltejs/kit/hooks'` and `import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks'`;
  - `export const handle = sequence(svelteVitalsHandle());`.
- `src/lib/Head.svelte`: a `<svelte:head>` with a title of 30–60 characters and a description of 70–160 characters, so the length rules pass.
- `src/routes/+page.svelte`: `import Head from '#lib/Head.svelte';`, renders `<Head />`, and has one `<h1>`.
- `src/routes/untitled/+page.svelte`: one `<h1>` and no `<title>`. Its `seo/title-presence` finding is critical, so every `vite build` of the app fails the gate.
- `src/routes/+layout.ts`: `export const prerender = true;`.
- `src/app.html`: kitchen-sink's.

Run `pnpm install` from the repo root. Expected: exit 0, and the lockfile gains the `kit3` catalog and a second `@sveltejs/kit` resolution. Then run `pnpm install --frozen-lockfile`. Expected: exit 0.

- [ ] **Step 3: Write the e2e test**

`test/e2e.test.ts` follows kitchen-sink's two files. A static `beforeAll` runs `packages/cli/dist/bin.js <appDir> --reporter json` and parses stdout, accepting exit status 0 or 1. A build `beforeAll` runs `node_modules/vite/bin/vite.js build`, keeps the stderr of a throw as `buildStderr` when it contains `svelte-vitals: build failed`, rethrows any other failure, and reads `svelte-vitals-report.json`. `titleIssues(report, route)` returns that route's `seo/title-presence` issues. Cases:

```ts
it('static: reaches the head behind the #lib import on /', () => {
  expect(staticReport.routes.map((r) => r.route)).toContain('/');
  expect(titleIssues(staticReport, '/')).toEqual([]);
  expect(staticReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
  expect(
    Object.values(staticReport.skipped ?? {})
      .flat()
      .map((s) => s.route)
  ).not.toContain('/');
});
it('build: analyzes the prerendered / from the SvelteKit 3 output', () => {
  expect(buildReport.routes.map((r) => r.route)).toContain('/');
  expect(titleIssues(buildReport, '/')).toEqual([]);
  expect(buildReport.rules['seo/title-presence']!.passed).toBeGreaterThan(0);
});
it('build: a critical finding fails vite build', () => {
  expect(titleIssues(buildReport, '/untitled')).toHaveLength(1);
  expect(buildStderr).toContain('svelte-vitals: build failed');
});
it('ships hook types that name no @sveltejs/kit type', () => {
  const dts = readFileSync(join(appDir, 'node_modules/@svelte-vitals/vite/dist/hooks/index.d.ts'), 'utf8');
  expect(dts).not.toContain('@sveltejs/kit');
});
```

- [ ] **Step 4: Run, and check that the first case guards `#lib`**

Run `pnpm build`, then `pnpm --filter sveltekit-3 typecheck` and `pnpm --filter sveltekit-3 test`. Expected: both exit 0.

Then change the page's import to `'#nolib/Head.svelte'` and run only the CLI, `node packages/cli/dist/bin.js examples/sveltekit-3 --reporter json`, because the broken import also breaks `vite build`. Expect the first case's assertions to fail on that report: either `seo/title-presence` no longer passes, or `/` appears in `skipped`. Revert the import. If they still hold, they do not detect a lost `#lib`: tighten them before moving on.

If `svelte-check` or `svelte-kit sync` cannot handle a project with no `svelte.config`, stop and report it. Do not work around it in the example.

- [ ] **Step 5: AGENTS.md entry and commit**

Add one Package map line: "`examples/sveltekit-3` — a small SvelteKit 3 app (config in `vite.config.ts`, `#lib`, the Vite plugin) on the `kit3` catalog. It guards SvelteKit 3 reading end to end. It is not a per-rule gallery."

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml renovate.json examples/sveltekit-3 AGENTS.md
git commit -m "test: add a SvelteKit 3 example app on a kit3 catalog"
```

### PR 1 wrap-up

- [ ] From the mirror, run oxfmt and oxlint and expect exit 0. Then run `pnpm typecheck`, `pnpm test` and `pnpm check:publish` and expect exit 0. CI's `corpus` job measures the PR, and no finding change is expected.
- [ ] Ask the user before pushing or opening the PR. After it merges, ask the user before closing Renovate's `chore(deps): update svelte (major)` PR.

---

## PR 2: plugin-config facts and `$app/env`

### Task 3: Shared plugin-config reader

**Files:**

- Modify: `packages/core/src/svelte-config-parse.ts` (`findKitPathsBaseInViteConfig` at ~401)
- Test: `packages/core/test/svelte-config-parse.test.ts` (the existing `findKitPathsBaseInViteConfig` and `resolveKitPathsBase` suites)

**Interfaces:**

- Produces (module-private):

```ts
type PluginConfig =
  | { kind: 'no-plugin-config' }
  | { kind: 'unresolvable' }
  | { kind: 'resolved'; config: ObjectExpression; program: Program; bindings: Map<string, TsExpression> };
function sveltekitPluginConfig(source: string): PluginConfig;
```

It holds the loop that `findKitPathsBaseInViteConfig` has today, which then becomes a thin mapping over it.

- [ ] **Step 1: Extract the helper.** This is a refactor with no behaviour change.
- [ ] **Step 2: Verify.** Run `pnpm --filter @svelte-vitals/core test -- svelte-config-parse`. Expected: exit 0 with an unchanged test count.
- [ ] **Step 3: Commit.** `refactor(core): share the sveltekit() plugin-config lookup`

### Task 4: `router.type` from the plugin config

**Files:**

- Modify: `packages/core/src/svelte-config-parse.ts`
- Modify: `packages/core/src/internal.ts:55` (export `resolveKitHashRouter` in place of `findKitHashRouterInSvelteConfig`)
- Modify: `packages/cli/src/providers/source/project.ts:343` and `packages/vite/src/providers/rendered/project.ts:90`
- Test: `packages/core/test/svelte-config-parse.test.ts`
- Docs: the "With `kit.router.type: 'hash'` in `svelte.config.js`" sentence in `rules/correctness/instance-browser-global.md`, `rules/correctness/server-browser-global.md`, `rules/security/shared-state-import.md` and `rules/security/handler-state-write.md`, en + ja

**Interfaces:**

- Consumes: Task 3's `sveltekitPluginConfig`.
- Produces: `resolveKitHashRouter(viteConfig: { source: string } | undefined, svelteConfig: { source: string } | undefined): boolean`.

- [ ] **Step 1: Write the failing tests** in a new `describe('resolveKitHashRouter')`:

```ts
const vite = (arg: string) => ({
  source: `import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit(${arg})] };`
});
const svelte = { source: "export default { kit: { router: { type: 'hash' } } };" };
expect(resolveKitHashRouter(vite("{ router: { type: 'hash' } }"), undefined)).toBe(true);
expect(resolveKitHashRouter(vite("{ router: { type: 'pathname' } }"), undefined)).toBe(false);
expect(resolveKitHashRouter(vite("{ paths: { base: '/x' } }"), svelte)).toBe(false); // plugin options decide
expect(resolveKitHashRouter(vite('opts'), svelte)).toBe(false); // unresolvable: silent
expect(resolveKitHashRouter(vite(''), svelte)).toBe(true); // sveltekit(): svelte.config applies
expect(resolveKitHashRouter(undefined, svelte)).toBe(true);
expect(resolveKitHashRouter(vite("{ ...base, router: { type: 'hash' } }"), undefined)).toBe(false); // spread: unknown
```

- [ ] **Step 2: Run.** `pnpm --filter @svelte-vitals/core test -- svelte-config-parse`. Expected: FAIL, because `resolveKitHashRouter` is not exported.
- [ ] **Step 3: Implement.** Apply the same strictness as `findKitHashRouterInSvelteConfig`: `knownObject` at each level, and a literal `'hash'` only. Keep `findKitHashRouterInSvelteConfig` module-private, and move the cases of the existing `describe('findKitHashRouterInSvelteConfig')` to `resolveKitHashRouter(undefined, { source })` with their assertions unchanged. Switch both call sites to `resolveKitHashRouter(viteConfig, svelteConfig) ? { kitHashRouter: true as const } : {}`.
- [ ] **Step 4: Run.** `pnpm --filter @svelte-vitals/core test`, then `pnpm typecheck`. Expected: exit 0.
- [ ] **Step 5: Docs.** In each listed page (en + ja), the sentence becomes "With `router.type: 'hash'` in `svelte.config.js`, or in the options passed to `sveltekit()` in the Vite config, no route renders on the server." Stamp the four English pages.
- [ ] **Step 6: Commit.** `feat(core): read router.type from the sveltekit() plugin options`

### Task 5: `alias` and `files.lib` from the plugin config

**Files:**

- Modify: `packages/core/src/svelte-config-parse.ts` (`resolveKitAliases` at ~272 and its doc comment)
- Test: `packages/core/test/svelte-config-parse.test.ts` (the `resolveKitAliases` suite)

**Interfaces:**

- Consumes: `sveltekitPluginConfig`, `aliasEntriesOf`, `filesLibOf`, and `compileKitAliases`, unchanged.
- Produces: the same `resolveKitAliases` signature. A resolved plugin config now returns `compileKitAliases({ entries: aliasEntriesOf(config, bindings), filesLib })`, read from the top level of the plugin options. An unresolvable one returns `undefined`. `no-plugin-config` keeps today's `svelte.config` path.

- [ ] **Step 1: Write the failing tests:**

```ts
expect(resolveKitAliases(vite("{ alias: { $utils: 'src/utils' } }"), undefined)).toEqual([
  { find: '$lib', replacement: 'src/lib', match: 'prefix' },
  { find: '$utils', replacement: 'src/utils', match: 'prefix' }
]);
expect(resolveKitAliases(vite("{ files: { lib: 'app/lib' } }"), undefined)).toEqual([
  { find: '$lib', replacement: 'app/lib', match: 'prefix' }
]);
// Kit 2.62+ app configured through the plugin, no alias: the same list the `?? DEFAULT_KIT_ALIASES`
// fallbacks give it today, so its findings do not move
expect(resolveKitAliases(vite("{ paths: { base: '/x' } }"), svelteWithAlias)).toEqual(DEFAULT_KIT_ALIASES);
expect(resolveKitAliases(vite('opts'), svelteWithAlias)).toBeUndefined();
```

Here `svelteWithAlias` is a `svelte.config` with a `kit.alias`, which must be ignored whenever the plugin has options.

The existing case "reads nothing when the Vite config carries a sveltekit() config" asserts `undefined` and no longer holds. Rewrite it to give the plugin `{ alias: { '$a': 'src/a' } }` and `svelte.config` `{ alias: { '$b': 'src/b' } }`, and to expect `$lib` and `$a` only.

- [ ] **Step 2: Run** the suite. Expected: the first two cases and the `$lib` case FAIL, because today the function returns `undefined`.
- [ ] **Step 3: Implement.** Rewrite the doc comment so that it states the current precedence and no longer says that reading plugin aliases "is deliberately not done".
- [ ] **Step 4: Run** `pnpm --filter @svelte-vitals/core test`. Expected: exit 0.
- [ ] **Step 5: Commit.** `feat(core): read alias and files.lib from the sveltekit() plugin options`

### Task 6: `dev` and `building` from `$app/env`

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts:181` (`dev`) and `:1598` (`building`), plus the doc comment at ~432
- Modify: `packages/core/src/kit-module.ts:59` (doc comment)
- Test: `packages/core/test/kit-module-parse.test.ts` (the suites at ~555 and ~636)
- Docs: the "`dev` from `$app/environment`" phrase in `rules/seo/ssr-disabled.md`, `rules/performance/load-waterfall.md`, `rules/correctness/instance-browser-global.md`, `rules/correctness/server-browser-global.md`, `rules/security/shared-state-import.md` and `rules/security/handler-state-write.md`, en + ja

**Interfaces:**

- Produces: no new names. Each collector unions `collectNamedImportAliases(program, '$app/environment', NAMES)` with the same call for `'$app/env'`, the way `module-ast.ts:402` does for `browser`.

- [ ] **Step 1: Write the failing tests.** These are the existing `dev` and `building` cases with `'$app/env'` as the specifier:

```ts
const devEnv = "import { dev as isDev } from '$app/env';\n";
expect(facts(`${devEnv}export const ssr = isDev;`, 'src/routes/+layout.ts').ssrDisabled).toEqual({ line: 2 });
expect(facts(`${devEnv}export const csr = isDev;`, 'src/routes/+layout.ts').csrDisabled).toEqual({ line: 2 });
```

Add the `building` case the same way, using the suite at ~636 with `$app/env`, and expect `loadNeverRendersOutsideBuild` to be `true`.

- [ ] **Step 2: Run** `pnpm --filter @svelte-vitals/core test -- kit-module-parse`. Expected: FAIL.
- [ ] **Step 3: Implement** both unions and update the two comments.
- [ ] **Step 4: Run** `pnpm --filter @svelte-vitals/core test`. Expected: exit 0.
- [ ] **Step 5: Docs.** Each phrase becomes "`dev` from `$app/environment` (or SvelteKit 3's `$app/env`)", en + ja. Then stamp the pages.
- [ ] **Step 6: Commit.** `feat(core): read dev and building from SvelteKit 3's $app/env`

### Task 7: Example samples, setup-guide note, changeset

**Files:**

- Modify: `examples/sveltekit-3/vite.config.ts`, plus new files under `src/`
- Modify: `examples/sveltekit-3/test/e2e.test.ts`
- Modify: `docs/src/content/docs/guides/(setup)/cli.md:452` and `docs/src/content/docs/ja/guides/(setup)/cli.md:415`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Plant the samples**

  - Alias sample:
    - Add `alias: { $seo: 'src/seo' }` to the `sveltekit({...})` options.
    - Create `src/seo/AliasHead.svelte`, with a `<svelte:head>` title that passes the length rules.
    - Add a route `src/routes/via-alias/+page.svelte` that imports it as `$seo/AliasHead.svelte`. The route must have no other head source.
  - `$app/env` sample: a route `src/routes/dev-ssr/+page.ts` with `import { dev } from '$app/env'; export const ssr = dev;`. Add a `+page.svelte` beside it.

- [ ] **Step 2: Add the e2e cases**

```ts
it('static: follows an alias declared in the sveltekit() options', () => {
  const route = staticReport.routes.find((r) => r.route === '/via-alias')!;
  expect(route.issues.filter((i) => i.id === 'seo/title-presence')).toEqual([]);
  expect(
    Object.values(staticReport.skipped ?? {})
      .flat()
      .map((s) => s.route)
  ).not.toContain('/via-alias');
});
it('static: reads ssr = dev with dev from $app/env', () => {
  const route = staticReport.routes.find((r) => r.route === '/dev-ssr')!;
  expect(route.issues.map((i) => i.id)).toContain('seo/ssr-disabled');
});
```

- [ ] **Step 3: Check each lever.** Run `pnpm build && pnpm --filter sveltekit-3 test`. Expected: exit 0.

  Then check that each case guards its change:
  - Make `resolveKitAliases` return `undefined` for a resolved plugin config, rebuild, rerun the test, and expect the alias case to fail. Restore the code.
  - Drop the `$app/env` union for `dev`, rebuild, rerun, and expect the `$app/env` case to fail. Restore the code.

  If a case does not fail, tighten its assertions.

- [ ] **Step 4: Setup-guide note.** After "Rules assume **Svelte 5+ (runes)** and **SvelteKit 2+**." in `cli.md`, add: "In a SvelteKit 3 app, svelte-vitals reads the options passed to `sveltekit()` in the Vite config and the renamed `$app/env` module, in the places where it reads `svelte.config.js` and `$app/environment` for SvelteKit 2." Update ja and stamp.

- [ ] **Step 5: Changeset.** `'@svelte-vitals/core': patch`, `'svelte-vitals': patch`, `'@svelte-vitals/vite': patch`. Text: "SvelteKit 3: `alias`, `files.lib` and `router.type` are read from the options passed to `sveltekit()` in the Vite config, and `dev` and `building` are recognized from `$app/env`."

- [ ] **Step 6: Commit.** `test: plant SvelteKit 3 plugin-config and $app/env samples`

### PR 2 wrap-up

- [ ] Run lint and format from the mirror, then `pnpm typecheck`, `pnpm test` and `pnpm lint:docs`. Expected: exit 0.
- [ ] Run `pnpm corpus update --cache ~/.cache/svelte-vitals-corpus` (it does not install anything in the apps) and expect no change to `scripts/corpus/measurement.json`. One change is possible by design: Task 4 stops reading a `svelte.config` hash router in an app that passes options to `sveltekit()`, as SvelteKit does. Any change is reported to the user before going further, not absorbed into verdicts.
- [ ] Ask the user before pushing or opening the PR.

---

## PR 3: server-only module locations

### Task 8: Treat SvelteKit 3's server-only locations as singleton homes

**Files:**

- Modify: `packages/core/src/kit-module-parse.ts` (`isLocalStateSpecifier` at ~1232 and the doc comment above it)
- Test: `packages/core/test/kit-module-parse.test.ts` (the imported-state-writes suite at ~110), and `packages/core/test/kit-module-collect.test.ts` for the full-pipeline cases
- Docs: the `src/lib/server` exemption paragraphs in `rules/security/handler-state-write.md` (~19–32) and `rules/security/shared-state-import.md`, en + ja

**Interfaces:**

- Produces (module-private): `isServerOnlyPath(path: string): boolean`, which is true when either of these holds:
  - a directory segment is `server`, and the path is not under `src/routes/` or `static/`;
  - the last segment, split on `.`, contains `server` (`server.ts`, `db.server.ts`, `db.server`).
- `isLocalStateSpecifier` returns `false` for such paths as well as for paths under `libServerRoot`, so a write to them takes the `pendingServerStoreWrites` path that `src/lib/server` takes today. When `libServerRoot` is `undefined` (an opaque `$lib`), it still returns `false` before any path check, as it does today.
- A write through a namespace import (`ns.member.set(...)` on `import * as ns`, non-computed) records `member` as the target's `imported`, not `ns`. `storeWriteTargets` and `pendingServerStoreWrites` share that target, so both `dropClientWrites` and `arbitrateServerStoreWrites` then look up the export actually written.
- Not read, by the precision-first rule `parseInMemoryExports` documents: an export whose initializer is not itself a container or a `svelte/store` `writable(...)` call, such as a local wrapper (`export const user = makeUser()`) or a re-export. A write to one is silent in the new locations, as it already is under `src/lib/server`. Step 5's list decides whether any such shape needs reading.

- [ ] **Step 1: Write the failing tests**, modelled on the cases at ~253–300:
  - not flagged: `.set()` in a handler on an import from `'../../server/kv'` in `src/routes/a/+page.server.ts`, and on `'$lib/data/server/user'`;
  - not flagged: on `'../db.server'`;
  - still flagged: on `'./server/store.js'` imported from `src/routes/a/+page.server.ts`, which resolves under `src/routes/`;
  - still flagged: on `'../../serverless/store'`, where `server` is only a prefix of the segment.

  Add one test through the full pipeline, in the same file the existing `src/lib/server` container case lives in. It asserts that an export of `new Map()` from `src/server/cache.ts` is still reported. Also assert that an opaque `$lib` (alias list `[{ find: '$lib', replacement: null, match: 'prefix' }]`) still reports nothing for `'../../server/kv'`.

  Add a second full-pipeline case: a handler's `.set()` on `export const user = writable(null)` (from `svelte/store`) in `src/server/user.ts` is still reported. It passes today and fails once `isServerOnlyPath` alone is in, because `arbitrateServerStoreWrites` promotes only what `parseInMemoryExports` names, and a store factory is not a container. Step 3's `writable` reading makes it pass again. Today the same store under `src/lib/server` is already silent.

  Add a third: a handler's `.set()` on `export const kv = createStore(client)`, with `createStore` imported from a package named `kv-store`, in `src/server/kv.ts` is not reported. A store-named package can wrap a persistent backend, so only a factory known to hold its value in memory counts. It is reported today, because `src/server` is not exempt yet, and silent after Step 3.

  Add two namespace cases. With `import * as stores from '../../server/user'`, a handler's `stores.user.set(...)` on the `writable` export above is still reported: it passes today and fails once `isServerOnlyPath` alone is in. With `import * as clients from '$lib/clients'`, a handler's `clients.db.set(...)` on `export const db = drizzle(url)` is not reported: it is reported today, because `dropClientWrites` looks up `clients`.

- [ ] **Step 2: Run** `pnpm --filter @svelte-vitals/core test -- kit-module-parse kit-module-collect`. Expected: the not-flagged cases, the `kv-store` case and the `clients.db` case FAIL. The still-reported cases pass until `isServerOnlyPath` is in.
- [ ] **Step 3: Implement** `isServerOnlyPath` and the extra condition. Then make `parseInMemoryExports` also name an export initialized by a call to `writable` imported from exactly `svelte/store`. No other factory and no other source counts: the package test `parseClientExports` uses (`/^svelte|store/i`) also matches stores backed by a database, and this function is precision-first. This also starts reporting a `writable` store under `src/lib/server`. Last, record the member name for a namespace write, as Interfaces says.
- [ ] **Step 4: Run** `pnpm --filter @svelte-vitals/core test`. Expected: exit 0.
- [ ] **Step 5: Measure.** Run `pnpm build && pnpm corpus update --cache ~/.cache/svelte-vitals-corpus`, then diff `scripts/corpus/measurement.json`. Get the finding-level diff against the base with `pnpm corpus run` and `pnpm corpus diff`, as `corpus.yml` does.
  - List every `security/handler-state-write` and `security/shared-state-import` finding that disappears or appears, whatever its verdict, each with the initializer of the export it writes to. Show the list to the user before going further.
  - A disappeared finding with no verdict gets one now. If any disappeared finding is a `tp`, do Task 9. Otherwise skip it.
  - The `writable` reading and the namespace key can add findings, also under `src/lib/server`, and the namespace key can remove a client write anywhere. If an added finding is not a real defect, stop and bring it to the user. Keep the store cases either way.
- [ ] **Step 6: Commit.** `feat(core): exempt SvelteKit 3 server-only locations from the shared-state rules`

### Task 9 (only if Task 8 loses a `tp`): Gate the new locations on SvelteKit 3

**Interfaces:**

- Produces: `Project.kitMajor?: number` in `packages/core/src/types.ts`.
  - Both CLI `detectKitConfigFacts` and vite `providers/rendered/project.ts` compute it from the `package.json` source they already read, through `leadingMajor`. Move `leadingMajor` to core `internal.ts` so both sides share it. This adds no `Runtime` call, and `io-budget.test.ts` must not change.
  - An undefined major counts as 2.
- `isServerOnlyPath` is consulted only when `kitMajor >= 3`. Thread the major to `isLocalStateSpecifier` the way `aliases` reaches it.
- `examples/sveltekit-3/package.json` declares `"@sveltejs/kit": "^3.1.1"` literally, because `catalog:kit3` reads as undefined, which counts as 2.

- [ ] **Step 1:** Add tests that run Task 8's cases with `kitMajor: 3`, and the same imports with `kitMajor` undefined and `2`, which must be flagged as today.
- [ ] **Step 2:** Run them and see them fail. Implement. Run `pnpm --filter @svelte-vitals/core test` and `pnpm --filter svelte-vitals test -- io-budget`. Expected: exit 0.
- [ ] **Step 3:** Rerun Step 5 of Task 8. Expected: no `tp` lost. Commit: `feat(core): apply SvelteKit 3 server-only locations only to SvelteKit 3 projects`

### Task 10: Example sample, docs, changeset

- [ ] **Step 1: Sample**
  - Create `examples/sveltekit-3/src/server/kv.ts`, exporting a binding that is not an in-memory container and is not a client. Its `.set()` must be reported outside a server location and exempt inside one. Before choosing the binding, read the exemption rules in `rules/security/handler-state-write.md`.
  - Add `src/routes/kv/+page.server.ts`, whose `load` calls `.set()` on it, and a `+page.svelte`.
- [ ] **Step 2: E2E case.** `staticReport.routes.find((r) => r.route === '/kv')` has no `security/handler-state-write` issue. Check the lever: move `kv.ts` to `src/kv.ts`, fix the import, and expect the case to fail. Then revert.
- [ ] **Step 3: Docs.** Name the exempt locations in both rule pages (en + ja): `src/lib/server`, and any `server` directory outside `src/routes` and `static`, plus any file with a `server` segment in its name. If Task 9 ran, add "in a project that declares `@sveltejs/kit` 3 or later". Stamp the pages.
- [ ] **Step 4: Changeset.** `'@svelte-vitals/core': patch`, `'svelte-vitals': patch`, `'@svelte-vitals/vite': patch`, with one sentence naming the new locations. If Task 9 did not run, add "Findings that these locations now exempt in SvelteKit 2 projects disappear."
- [ ] **Step 5: Commit.** `test: plant a SvelteKit 3 server-directory singleton`

### PR 3 wrap-up

- [ ] Run lint and format from the mirror, then `pnpm typecheck`, `pnpm test` and `pnpm lint:docs`. Expected: exit 0.
- [ ] Commit the updated `measurement.json` and README table from `pnpm corpus update`, after `pnpm format`.
- [ ] Ask the user before pushing or opening the PR. The PR body states the measured finding diff, only as measured.
