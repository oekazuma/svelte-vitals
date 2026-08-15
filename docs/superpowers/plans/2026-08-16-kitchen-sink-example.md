# Kitchen-Sink Example App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `examples/kitchen-sink` — a real SvelteKit app where every rule is demonstrated end to end — plus the e2e regression net that enforces full-rule coverage in CI, per `docs/superpowers/specs/2026-08-16-kitchen-sink-example-design.md`.

**Architecture:** A `private: true` workspace package with defect-gallery routes (`src/routes/gallery/<category>/…`), clean false-positive-canary routes (`src/routes/clean/…`), never-imported prerender-crash samples, and planted project-level defects. Vitest e2e tests run the **built CLI as a child process** and `vite build` in-test (expecting the gate to fail the build and reading the report from `outFile`). A committed `expected-findings.json` plus a meta-test enforce that every rule in `allRules` is covered.

**Tech Stack:** SvelteKit + `@sveltejs/adapter-static`, vitest, workspace catalog deps, execa-style `node:child_process` spawning.

## Global Constraints

- The example has **NO `build` script** in its package.json — root `pnpm build`/`pnpm test` and floor-smoke's `pnpm -r build` fallback must not build it; its `vite build` runs only inside the e2e test.
- Coverage invariant: **every rule id in `allRules` appears in `expected-findings.json`**, with `findings ≥ 1` by default; `passOnly` entries need a reason string AND `findings + passed ≥ 1` in the report. Silent-pass rules (return `[]` when clean, e.g. `seo/sitemap-in-robots`, `performance/minify-disabled`) must be arranged to FAIL — they can never satisfy an exercised-check.
- Clean canaries: no route-scoped finding may carry a `/clean/…` route; no component-scoped finding may name a `src/routes/clean/` or `src/lib/clean/` file.
- Prerender-crashing samples (`correctness/server-browser-global`, `correctness/instance-browser-global`) live in glob-collected but never-imported files.
- The `seo/ssr-disabled` gallery route sets `ssr = false` AND `prerender = false`; adapter-static gets a `fallback` page; the rendered expectations must not count that route.
- Dependencies through the workspace catalog (add `@sveltejs/adapter-static` to the catalog); all deps must install on Node 22.13.0 (floor-smoke job).
- oxlint ignores `examples/kitchen-sink/src/routes/gallery/` and the crash-sample dir; oxfmt formats everything.
- No rule counts in prose (README maps routes → rule ids; the JSON file is the machine truth).
- Verify commands per task: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`. Changesets: none (private example + test-only changes; the bench flag in Task 8 is a dev-script change, also changeset-free).
- Conventional commits, `chore(examples):` / `test(examples):` / `chore(bench):` scopes, each ending with:

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

---

### Task 1: Workspace wiring + app skeleton

**Files:**

- Modify: `pnpm-workspace.yaml` (packages glob + catalog entry)
- Create: `examples/kitchen-sink/package.json`, `svelte.config.js`, `vite.config.ts`, `src/app.html`, `src/app.d.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `.gitignore`
- Modify: `.oxlintrc.json` (`ignorePatterns`)

**Interfaces:**

- Produces: a dev-runnable SvelteKit app at `examples/kitchen-sink` with the vite plugin active (dashboard dogfood) and adapter-static configured with `fallback: '404.html'`. Later tasks add routes and tests into it.

- [ ] **Step 1: Workspace + catalog** — in `pnpm-workspace.yaml`: add `- 'examples/*'` to `packages:`; add `'@sveltejs/adapter-static': ^3.0.10` (check latest 3.x) to the catalog block.
- [ ] **Step 2: package.json** (no `build` script — Global Constraints):

```json
{
  "name": "kitchen-sink",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "svelte-kit sync && tsc --noEmit"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "catalog:",
    "@sveltejs/kit": "catalog:",
    "@sveltejs/vite-plugin-svelte": "catalog:",
    "@svelte-vitals/vite": "workspace:*",
    "svelte": "catalog:",
    "svelte-vitals": "workspace:*",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

(Check `@sveltejs/vite-plugin-svelte` and `typescript` are in the catalog — they are used by docs/demo already; if a name is missing, add it to the catalog rather than inlining a version.)

- [ ] **Step 3: svelte.config.js** — adapter-static with `fallback: '404.html'`; `vite.config.ts` — `sveltekit()` plus `svelteVitals()` from `@svelte-vitals/vite` with `{ outFile: 'svelte-vitals-report.json' }`, and `build: { minify: false }` (a planted defect — `performance/minify-disabled` is silent-pass and must fail). Add `svelte-vitals-report.json`, `.svelte-kit/`, `build/` to the example's `.gitignore`.
- [ ] **Step 4: app.html** — deliberately defective shell: NO doctype (`a11y/doctype`), NO `lang` on `<html>` (`seo/html-lang`), but valid `%sveltekit.head%`/`%sveltekit.body%` placeholders and a `<div id="shell-root">` (id used by a gallery idref later).
- [ ] **Step 5: Root layout + home** — `+layout.svelte`: minimal, `<slot />` only (NOT inside `<main>` — landmark defects must be local to gallery routes, not global). `+page.svelte` (home): a clean page linking to the gallery and clean sections, with full `<svelte:head>` metadata so the home route is itself near-clean.
- [ ] **Step 6: oxlint carve-out** — in `.oxlintrc.json` `ignorePatterns`: add `"examples/kitchen-sink/src/routes/gallery"` and `"examples/kitchen-sink/src/lib/crash-samples"`.
- [ ] **Step 7: Verify** — `pnpm install` (lockfile updates), `pnpm --filter kitchen-sink typecheck`, then from `examples/kitchen-sink` run `pnpm dev` briefly by hand only if debugging; CI-verifiable: `pnpm build && pnpm lint` at root stays green (the example must NOT be built by `pnpm -r build`).
- [ ] **Step 8: Commit** — `chore(examples): scaffold the kitchen-sink app`

### Task 2: Clean canary routes

**Files:**

- Create: `examples/kitchen-sink/src/routes/clean/+layout.svelte`, `clean/+page.svelte`, `clean/list/+page.svelte`, `clean/form/+page.svelte`, `src/lib/clean/Card.svelte`

**Interfaces:**

- Produces: routes `/clean`, `/clean/list`, `/clean/form` that must yield ZERO findings (route-scoped and component-scoped). Task 6 asserts this.

- [ ] **Step 1: Write the canaries** — each page carries complete `<svelte:head>` (title 30–60 chars, description 70–155 chars, canonical, og:title/og:image/og:description/og:url, twitter:card, viewport+charset come from app.html? No — charset/viewport live in app.html normally; ADD `<meta charset>`+viewport to app.html in Task 1 if missing so clean routes don't inherit those findings). Content deliberately exercises the FP patterns the a11y branch fixed:
  - `clean/+layout.svelte`: `<header>` + `<main>` wrapping `<slot />` + `<footer>` (exactly one of each landmark).
  - `clean/+page.svelte`: `{#if}` with one `<main>`-content variant per branch is NOT allowed here (layout owns main) — instead use `{#if}/{:else}` each containing one `<h2>`; a `<button {...rest}>` spread-props pattern via `Card.svelte`; `tabindex="-1"` on a focus-target div; expression-valued `id={x}` NOT used (would poison no-missing-id-ref) — use literal unique ids.
  - `clean/list/+page.svelte`: keyed `{#each items as item (item.id)}` list with `<li>` bullets as list items (use-list must not fire), `<img>` with alt/width/height/loading.
  - `clean/form/+page.svelte`: `<label for>`+`<input id>` pairs, `<select required>` with a placeholder option, `<time datetime="2026-08-16">Aug 16</time>`, aria attributes with valid values.
- [ ] **Step 2: Verify by hand** — `node packages/cli/dist/bin.js examples/kitchen-sink --route /clean --reporter json` (after `pnpm build`) shows zero findings for the routes; iterate until clean.
- [ ] **Step 3: Commit** — `chore(examples): add clean canary routes`

### Task 3: Gallery — SEO + Performance routes

**Files:**

- Create: `examples/kitchen-sink/src/routes/gallery/+layout.svelte` (bare `<slot />`), `gallery/seo/+page.svelte`, `gallery/seo/duplicate-a/+page.svelte`, `gallery/seo/duplicate-b/+page.svelte`, `gallery/seo/jsonld/+page.svelte`, `gallery/seo/ssr-off/+page.svelte` + `+page.ts`, `gallery/perf/+page.svelte`, `gallery/perf/loading/+page.ts` + `+page.svelte`, `static/robots.txt`, `static/sitemap.xml`

**Interfaces:**

- Consumes: rule behaviors as documented in `docs/src/content/docs/rules/{seo,performance}/*.md` — consult each page for the exact trigger.
- Produces: every `seo/*` and `performance/*` rule failing at least once, except the `passOnly` set: `seo/robots-txt`, `seo/sitemap-xml` (must EXIST so `seo/sitemap-in-robots` can fail: write `static/robots.txt` WITHOUT a `Sitemap:` line, plus a valid `static/sitemap.xml`), and any rule whose docs prove its failing state incompatible — record each with a reason in Task 6's expectations.

- [ ] **Step 1: SEO defects** — `gallery/seo/+page.svelte`: missing title (critical — the exit-1 driver), missing description, missing canonical/og/twitter tags, `<h3>` after `<h1>` (heading-level-skip), two `<h1>` (single-h1), `<img>` without alt (image-alt), `<meta name="robots" content="noindex">` on a SEPARATE route if indexability conflicts with other assertions — check the rule doc first. `duplicate-a`/`duplicate-b`: same literal title + same description (duplicate-title/description). `jsonld`: `<script type="application/ld+json">` with invalid JSON, a deprecated type, a relative URL, a placeholder value, a bad date — one block each per the json-ld rule docs. `ssr-off`: `+page.ts` with `export const ssr = false; export const prerender = false;`. Long/short title+description pages for the length rules.
- [ ] **Step 2: Performance defects** — `gallery/perf/+page.svelte`: `<img>` without width/height/loading, no-srcset hero candidate, `<svelte:head>` with render-blocking `<script src>`, font preload without crossorigin, preload without `as`, third-party origin without preconnect, `import * as _ from` a bare package (namespace-import), a heavy-import specimen (`import moment from 'moment'`? — do NOT add real heavy deps; check the rule doc: detection is by specifier string, so the import may reference a devDep-less specifier only if the app still builds — put it in a never-imported glob-collected file instead if the build breaks). `gallery/perf/loading/+page.ts`: sequential `await`s + fetch waterfall per the load-waterfall/sequential-awaits docs. `$state` raw candidate in a component.
- [ ] **Step 3: Verify** — run the built CLI as in Task 2; check every intended rule id appears with ≥1 finding (`--reporter json | jq '.rules'`). Iterate.
- [ ] **Step 4: Commit** — `chore(examples): add seo and performance gallery routes`

### Task 4: Gallery — Correctness + Security + Architecture routes and crash samples

**Files:**

- Create: `gallery/correctness/+page.svelte` (+ helper components under `gallery/correctness/`), `gallery/security/+page.svelte` + `gallery/security/store.svelte.ts` + `+page.server.ts`, `gallery/architecture/…` (a deliberately misshaped unit directory), `src/lib/crash-samples/server-global.svelte.ts`, `src/lib/crash-samples/InstanceGlobal.svelte`, `svelte-vitals.config.mjs`
- Modify: `examples/kitchen-sink/vite.config.ts` only if a rule doc requires a config-level trigger not yet planted.

**Interfaces:**

- Produces: every `correctness/*`, `security/*`, `architecture/*` rule failing at least once; the committed `svelte-vitals.config.mjs` declares the options that wake the six inert Architecture rules (`directory-naming`, `reserved-directory-names`, `reserved-name-placement`, `unit-entry-file`, `private-scope-import`, `doc-link-target` `urlRoots`) — read each rule's doc page for the exact option shape and `svelte-vitals explain <id>` for options.

- [ ] **Step 1: Correctness** — unkeyed `{#each}`, index-keyed `{#each}`, `$effect` used as derived, `$effect` as onMount, unmutated `$state`, prop mutation, stale prop derivation, non-reactive built-in (`new Map()` in `$state` mutated in handlers), `bind:value` on a checkbox, root-relative `<a href="/x">` when `kit.paths.base` is set? — base-path rule needs a base path; DON'T set one globally (it would break the app's routing realism) — check the rule doc: if it only fires with `kit.paths.base` configured, list it `passOnly` with that reason instead. Orphan-effect/orphan-lifecycle: module-scope `$effect`/`onMount` in `src/lib/crash-samples/server-global.svelte.ts`-adjacent files (client-crash class — never imported).
- [ ] **Step 2: Security** — `{@html expr}` (raw-html), literal `javascript:` href, module-scope mutable state in a `.svelte.ts` imported by a server file (shared-state-import per its doc), `+page.server.ts` writing module state in a handler (handler-state-write), server-module-state specimen.
- [ ] **Step 3: Crash samples (never imported)** — `server-global.svelte.ts`: module-scope `localStorage` read; `InstanceGlobal.svelte`: instance-script `window` read. NOTHING imports these files; add a comment in each stating the invariant ("glob-collected, never imported — importing this crashes prerender").
- [ ] **Step 4: Architecture** — an oversized component (generate > component-size threshold lines of plausible markup), a component with > prop-count props, a misnamed directory + reserved-name misplacement + missing unit entry + a private-scope import breach + a doc-link-target violation per the docs of each rule, wired to the options declared in `svelte-vitals.config.mjs`.
- [ ] **Step 5: Verify + commit** — CLI json shows all three categories' rules failing (or documented as passOnly candidates for Task 6); `chore(examples): add correctness, security, and architecture galleries`

### Task 5: Gallery — a11y routes

**Files:**

- Create: `gallery/a11y/+layout.svelte` (wraps children in `<main id="a11y-shell">`), `gallery/a11y/+page.svelte`, `gallery/a11y/landmarks/+page.svelte`, `gallery/a11y/ids/+page.svelte` + a `$lib` component it imports, `gallery/a11y/aria/+page.svelte`

**Interfaces:**

- Produces: all 15 `a11y/*` rules failing, with the cross-component showcases composed across layout+page+`$lib` component (the category's differentiator, demonstrated for real).

- [ ] **Step 1: Cross-component showcases** — `landmarks/+page.svelte` contributes a second `<main>` (duplicate-landmark across layout+page) and an `<aside role="complementary">` inside the layout's `<main>` (top-level-landmark via slot nesting). `ids/+page.svelte` declares `id="dup-x"` and imports a `$lib` component also declaring `id="dup-x"` (cross-file id-duplication); a `<label for="ghost-id">` referencing nothing (no-missing-id-ref — this route's composition must stay fully resolved: literal-only, no spreads, no library components).
- [ ] **Step 2: Element rules** — `aria/+page.svelte`: `role="bogus"`, `role="widget"`, `aria-lable` typo, `<div role="checkbox">` without aria-checked, `aria-hidden="yes"`, `<a href="/x"><button>` nesting, empty `<button></button>`, bare `<label>text</label>`, `• bullet` text outside a list, `<select required>` without placeholder option, `<time>next week</time>`. `a11y/doctype` fires from Task 1's app.html.
- [ ] **Step 3: Verify + commit** — all 15 a11y ids in the json report with ≥1 finding; `chore(examples): add a11y gallery routes`

### Task 6: `expected-findings.json` + static-mode e2e + meta-test

**Files:**

- Create: `examples/kitchen-sink/expected-findings.json`, `examples/kitchen-sink/test/e2e-static.test.ts`, `examples/kitchen-sink/vitest.config.ts`

**Interfaces:**

- Consumes: the built CLI at `packages/cli/dist/bin.js`; `allRules` from `@svelte-vitals/core` (workspace dep of `svelte-vitals`; add `@svelte-vitals/core` as a devDependency `workspace:*` of the example for the meta-test import).
- Produces: the committed coverage ledger later tasks and future rules must keep green.

- [ ] **Step 1: Write the failing meta-test + e2e**:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allRules } from '@svelte-vitals/core';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');
const expected = JSON.parse(readFileSync(join(appDir, 'expected-findings.json'), 'utf8')) as Record<
  string,
  { findings?: number; passOnly?: string }
>;

let report: {
  rules: Record<string, { findings: number; passed: number }>;
  results: { id: string; route?: string; location?: string }[];
};
let exitCode = 0;

beforeAll(() => {
  try {
    const out = execFileSync(process.execPath, [bin, appDir, '--reporter', 'json'], { encoding: 'utf8' });
    report = JSON.parse(out);
  } catch (e) {
    const err = e as { status: number; stdout: string };
    exitCode = err.status;
    report = JSON.parse(err.stdout);
  }
});

describe('kitchen-sink e2e (static mode)', () => {
  it('covers every rule in the expectations file (meta-test)', () => {
    const ids = new Set(allRules.map((r) => r.id));
    expect(Object.keys(expected).sort()).toEqual([...ids].sort());
    for (const [id, entry] of Object.entries(expected)) {
      if (entry.passOnly) expect(entry.passOnly.length, `${id} passOnly reason`).toBeGreaterThan(0);
      else expect(entry.findings, `${id} findings declared`).toBeGreaterThanOrEqual(1);
    }
  });

  it('matches the expected finding count per rule; passOnly rules are exercised', () => {
    for (const [id, entry] of Object.entries(expected)) {
      const got = report.rules[id] ?? { findings: 0, passed: 0 };
      if (entry.passOnly) {
        expect(got.findings, `${id} must not fail (passOnly)`).toBe(0);
        expect(got.findings + got.passed, `${id} exercised`).toBeGreaterThanOrEqual(1);
      } else {
        expect(got.findings, id).toBe(entry.findings);
      }
    }
  });

  it('keeps the clean canaries clean', () => {
    const offenders = report.results.filter(
      (r) =>
        (r.route?.startsWith('/clean') ?? false) ||
        r.location?.startsWith('src/routes/clean/') ||
        r.location?.startsWith('src/lib/clean/')
    );
    expect(offenders).toEqual([]);
  });

  it('exits 1 on the gallery (critical present) and 0 on clean routes', () => {
    expect(exitCode).toBe(1);
    const clean = execFileSync(process.execPath, [bin, appDir, '--route', '/clean', '--reporter', 'json'], {
      encoding: 'utf8'
    });
    expect(JSON.parse(clean).rules).toBeDefined();
  });
});
```

Adapt field names to the real json report shape (`buildJsonReport` in `packages/core/src/reporter/json.ts`) — the shapes above are the contract to verify, not to assume: check whether penalized results live under `results`, whether counts are `findings`/`passed`. `--route /clean` exit code is the child call NOT throwing.

- [ ] **Step 2: Run to fail** — expectations file doesn't exist yet → meta-test fails.
- [ ] **Step 3: Generate the initial `expected-findings.json`** — run the CLI, transcribe per-rule counts; every zero-count rule must either get a gallery fix (go back to Tasks 3–5 files) or a reasoned `passOnly`. Expected `passOnly` set (verify each against its rule doc before writing the reason): `seo/robots-txt`, `seo/sitemap-xml`, possibly `correctness/base-path-navigation` (needs `kit.paths.base`) — if a rule CAN reasonably fail in this app, make it fail instead.
- [ ] **Step 4: All four tests green**; `pnpm -r test` from root passes (build runs first via root script).
- [ ] **Step 5: Commit** — `test(examples): enforce full-rule e2e coverage in static mode`

### Task 7: Build-mode e2e (gate + rendered expectations)

**Files:**

- Create: `examples/kitchen-sink/expected-findings.rendered.json`, `examples/kitchen-sink/test/e2e-build.test.ts`

**Interfaces:**

- Consumes: the vite plugin's `outFile` report (`svelte-vitals-report.json` per Task 1's config), written before the gate throws (`packages/vite/src/plugin.ts` writes then throws).

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(appDir, 'svelte-vitals-report.json');
let buildFailed = false;

beforeAll(() => {
  rmSync(reportPath, { force: true });
  try {
    execFileSync('node', [join(appDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch {
    buildFailed = true;
  }
}, 240_000);

describe('kitchen-sink e2e (build mode)', () => {
  it('the gate fails the build on critical findings, after writing the report', () => {
    expect(buildFailed).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const expected = JSON.parse(readFileSync(join(appDir, 'expected-findings.rendered.json'), 'utf8')) as Record<
      string,
      number
    >;
    for (const [id, count] of Object.entries(expected)) {
      expect(report.rules[id]?.findings ?? 0, id).toBe(count);
    }
  });
});
```

- [ ] **Step 2: Generate `expected-findings.rendered.json`** — run the build once, transcribe the rendered-mode counts. This file is SMALLER by design: component-scoped rules still run (source scan), route-scoped a11y/SEO counts may differ (source/rendered divergence is by design), and the `ssr-off` route must be absent. Do NOT chase parity with the static file.
- [ ] **Step 3: Green; commit** — `test(examples): pin build-mode gate and rendered counts`

### Task 8: Bench `--target` flag

**Files:**

- Modify: `packages/vite/scripts/bench/bench.mjs`
- Modify: `docs/superpowers/specs/2026-08-15-a11y-parity-roadmap.md` — no. Roadmap stays; bench doc note goes in bench.mjs header comment.

**Interfaces:**

- Produces: `pnpm bench --target examples/kitchen-sink` timing the real app; synthetic `--sizes` behavior unchanged (it remains the scaling instrument).

- [ ] **Step 1:** Read `bench.mjs`'s arg parsing; add `--target <dir>`: when present, skip project generation and run the same timed analysis over the given directory. Keep output format identical.
- [ ] **Step 2:** Run `pnpm bench --target examples/kitchen-sink` once; confirm it completes and prints timings.
- [ ] **Step 3: Commit** — `chore(bench): add --target for benchmarking a real project`

### Task 9: README, AGENTS.md note, final verify

**Files:**

- Create: `examples/kitchen-sink/README.md`
- Modify: `AGENTS.md` (package map: one line for `examples/kitchen-sink`)

**Steps:**

- [ ] **Step 1: README** — what the app is (defect gallery + canaries + dogfood), how to run (`pnpm --filter kitchen-sink dev`, `pnpm --filter kitchen-sink test`), the route → rule-id map (ids only, no counts), the never-import invariant for crash samples, and how to update `expected-findings.json` when adding a rule.
- [ ] **Step 2: AGENTS.md** — add `examples/kitchen-sink` to the package map with one line (e2e gallery; every new rule needs a sample here — the meta-test enforces it).
- [ ] **Step 3: Full verify** — `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:publish && pnpm smoke`. Confirm `pnpm -r build` did NOT produce `examples/kitchen-sink/build/`.
- [ ] **Step 4: Commit** — `docs: document the kitchen-sink example` + AGENTS line in the same commit.
