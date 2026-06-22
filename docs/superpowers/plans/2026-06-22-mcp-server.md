# MCP server (`@svelte-vitals/mcp`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stdio MCP server exposing `analyze` and `explain_rule` tools so an AI agent can run svelte-vitals' static-mode analysis inside its tool loop and get structured, fixable findings.

**Architecture:** A new `@svelte-vitals/mcp` package adapts the existing pipeline. The CLI's analysis pipeline is extracted into `analyzeProject()`; core's JSON report is extracted into `buildJsonReport()`; rule metadata (`rationale`/`fix`) is promoted onto the `Rule` object and surfaced via `explainRule()`. The MCP layer only wires these into MCP tools — no rule logic is duplicated.

**Tech Stack:** TypeScript (ESM-only), `@modelcontextprotocol/sdk` `^1.29.0`, `zod` `^4.4.3`, `tsup`, `vitest`, pnpm workspaces.

## Global Constraints

- **ESM-only.** Every package is `"type": "module"`; `tsup` emits `format: ['esm']` only. Never add CJS.
- **Node ≥ 18.** Matches the MCP SDK's `engines`.
- **`target: 'es2022'`** in `tsup.config.ts`, matching the other packages.
- **core stays runtime-agnostic** — no `node:` imports, no I/O in `@svelte-vitals/core` (design §8). The MCP server's I/O goes through the CLI's Node runtime via `analyzeProject`.
- **Dependency versions come from the workspace `catalog:`** in `pnpm-workspace.yaml` where one exists; add new shared deps to the catalog.
- **Commit message trailer:** end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Behaviour-preserving refactors:** Tasks 1 and 3 must not change any existing observable output; all existing tests stay green.

---

### Task 1: Extract `buildJsonReport` in core

**Files:**

- Modify: `packages/core/src/reporter/json.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/json-report.test.ts` (existing — extend)

**Interfaces:**

- Consumes: existing `computeScore`, `summarize`, `effectiveSeverity`, `isPenalized`, `Config`, `Result`.
- Produces:
  - `interface JsonReport { version: string; score: number; scoreModel: ScoreModel; summary: Summary; routes: Array<{ route: string; score: number; issues: JsonIssue[] }>; siteIssues: JsonIssue[] }`
  - `function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport`
  - `formatJsonReport` keeps its existing signature and output.

- [ ] **Step 1: Read the current file** `packages/core/test/json-report.test.ts` to learn the existing assertions and the exact report shape they expect (so the extraction stays behaviour-identical).

- [ ] **Step 2: Write the failing test** — add to `packages/core/test/json-report.test.ts`:

```ts
import { buildJsonReport, formatJsonReport } from '../src/index.js';
// ...reuse whatever `results`/`config` fixture the existing tests build...

it('buildJsonReport returns the object formatJsonReport stringifies', () => {
  const report = buildJsonReport(results, config, { version: '9.9.9' });
  expect(report.version).toBe('9.9.9');
  expect(report).toHaveProperty('score');
  expect(report).toHaveProperty('scoreModel');
  expect(report).toHaveProperty('summary');
  expect(Array.isArray(report.routes)).toBe(true);
  expect(Array.isArray(report.siteIssues)).toBe(true);
  expect(formatJsonReport(results, config, { version: '9.9.9' })).toBe(JSON.stringify(report, null, 2));
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- json-report`
Expected: FAIL — `buildJsonReport is not a function` (not yet exported).

- [ ] **Step 4: Refactor `json.ts`** — split the builder from the stringifier. Replace the file body so the object construction lives in `buildJsonReport` and `formatJsonReport` just stringifies it:

```ts
import type { Config, Result } from '../types.js';
import { computeScore, type ScoreModel } from '../scoring/score.js';
import { summarize, effectiveSeverity, type Summary } from '../summary.js';
import { isPenalized } from '../rule.js';

function issueOf(result: Result) {
  return {
    id: result.id,
    title: result.message,
    detection: result.detection,
    location: result.location,
    recommendation: result.recommendation,
    ...(result.fix ? { fix: result.fix } : {})
  };
}

type JsonIssue = ReturnType<typeof issueOf> & { severity: ReturnType<typeof effectiveSeverity> };

export interface JsonReport {
  version: string;
  score: number;
  scoreModel: ScoreModel;
  summary: Summary;
  routes: Array<{ route: string; score: number; issues: JsonIssue[] }>;
  siteIssues: JsonIssue[];
}

/** Build the structured JSON report object (design §7). Shared by the json reporter and the MCP `analyze` tool. */
export function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport {
  const { score, scoreModel } = computeScore(results, config);
  const summary = summarize(results, config);

  const routeMap = new Map<string, { route: string; results: Result[] }>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routeMap.has(r.route)) routeMap.set(r.route, { route: r.route, results: [] });
    routeMap.get(r.route)!.results.push(r);
  }

  const routes = [...routeMap.values()]
    .sort((a, b) => a.route.localeCompare(b.route))
    .map(({ route, results: rs }) => ({
      route,
      score: computeScore(rs, config, { applyCriticalCap: false }).score,
      issues: rs
        .filter((r) => isPenalized(r.detection, config.treatDynamicAs))
        .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }))
    }));

  const siteIssues = results
    .filter((r) => r.route === undefined && isPenalized(r.detection, config.treatDynamicAs))
    .map((r) => ({ ...issueOf(r), severity: effectiveSeverity(r, config) }));

  return { version: meta.version, score, scoreModel, summary, routes, siteIssues };
}

/** Render results as the documented JSON report string (design §7). */
export function formatJsonReport(results: Result[], config: Config, meta: { version: string }): string {
  return JSON.stringify(buildJsonReport(results, config, meta), null, 2);
}
```

> Note: confirm `ScoreModel` is exported from `./scoring/score.js` and `Summary` from `./summary.js` (both are re-exported by `index.ts` today, so the source modules export them).

- [ ] **Step 5: Export the new symbols** — in `packages/core/src/index.ts`, change the json-reporter export line:

```ts
export { buildJsonReport, formatJsonReport } from './reporter/json.js';
export type { JsonReport } from './reporter/json.js';
```

- [ ] **Step 6: Run core tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (new test + all existing json-report assertions unchanged).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/reporter/json.ts packages/core/src/index.ts packages/core/test/json-report.test.ts
git commit -m "refactor(core): extract buildJsonReport from the json reporter"
```

---

### Task 2: Rule catalog — `rationale`/`fix` on `Rule`, `docsUrlFor`, `explainRule`

**Files:**

- Modify: `packages/core/src/rule.ts` (extend `Rule`, add `docsUrlFor`)
- Modify: `packages/core/src/rules/seo/seo001-title.ts`
- Modify: `packages/core/src/rules/seo/head-tag-rule.ts`
- Modify: `packages/core/src/rules/seo/seo002-005-008.ts`
- Modify: `packages/core/src/rules/seo/project-rules.ts`
- Modify: `packages/core/src/rules/index.ts` (add `explainRule`)
- Modify: `packages/core/src/index.ts` (exports)
- Test: `packages/core/test/explain-rule.test.ts` (new)

**Interfaces:**

- Produces:
  - `Rule` gains `rationale: string` and `fix?: Fix`.
  - `function docsUrlFor(id: string): string` (in `rule.ts`) → `https://svelte-vitals.dev/rules/${id}`.
  - `interface RuleInfo { id: string; title: string; category: Category; severity: Severity; rationale: string; docsUrl: string; fix?: Fix }`
  - `function explainRule(id: string): RuleInfo | undefined` (in `rules/index.ts`).
- Consumes: `allRules` (existing).

- [ ] **Step 1: Write the failing test** — `packages/core/test/explain-rule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { explainRule, allRules } from '../src/index.js';

describe('explainRule', () => {
  it('returns info for a known rule id', () => {
    const info = explainRule('SEO001');
    expect(info).toBeDefined();
    expect(info!.id).toBe('SEO001');
    expect(info!.severity).toBe('critical');
    expect(info!.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
    expect(info!.rationale.length).toBeGreaterThan(0);
    expect(info!.fix?.description.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(explainRule('NOPE999')).toBeUndefined();
  });

  it('every built-in rule has a non-empty rationale and a derivable docs url', () => {
    for (const rule of allRules) {
      const info = explainRule(rule.id);
      expect(info, rule.id).toBeDefined();
      expect(info!.rationale.length, `${rule.id} rationale`).toBeGreaterThan(0);
      expect(info!.docsUrl).toBe(`https://svelte-vitals.dev/rules/${rule.id}`);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- explain-rule`
Expected: FAIL — `explainRule is not a function`.

- [ ] **Step 3: Extend `Rule` and add `docsUrlFor`** — in `packages/core/src/rule.ts`:

Add `Fix` to the type import and extend the interface:

```ts
import type { Category, Config, Detection, Fix, Project, Result, Scope, Severity, TreatDynamicAs } from './types.js';
```

```ts
export interface Rule {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  scope: Scope;
  /** Why this rule matters — one or two sentences, surfaced by explain_rule (issue #24). */
  rationale: string;
  /** Canonical remediation template, shared by findings and explain_rule (issue #24). */
  fix?: Fix;
  check(ctx: RuleContext): Promise<Result[]>;
}

/** Documentation URL for a rule id. Single source so no per-rule URL can drift (issue #24). */
export function docsUrlFor(id: string): string {
  return `https://svelte-vitals.dev/rules/${id}`;
}
```

- [ ] **Step 4: Refactor `seo001-title.ts`** to carry `rationale`/`fix` on the rule and reference them in `check()`:

```ts
import type { Result, Detection, Fix } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const FIX: Fix = {
  description: 'Add a <title> inside <svelte:head> (a dynamic title is fine).',
  snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
  lang: 'svelte'
};

function detectTitle(head: ResolvedHead): Detection {
  const title: HeadTag | undefined = head.tags.find((t) => t.kind === 'title');
  if (!title) return { presence: 'none', value: 'absent' };
  return { presence: title.presence, value: title.value };
}

function messageFor(detection: Detection): string {
  if (detection.presence === 'none') return 'Missing <title>';
  if (detection.value === 'absent') return 'Empty <title>';
  return '<title>';
}

export const seo001Title: Rule = {
  id: 'SEO001',
  title: 'Title presence',
  category: 'seo',
  severity: 'critical',
  scope: 'route',
  rationale:
    'A unique, non-empty <title> is the single strongest on-page SEO signal and the text shown in search results and browser tabs.',
  fix: FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    return ctx.heads.map((head) => {
      const detection = detectTitle(head);
      return {
        id: 'SEO001',
        severity: 'critical',
        detection,
        route: head.route,
        location: head.file,
        message: messageFor(detection),
        recommendation:
          'Add a <title> inside <svelte:head>, e.g. <title>{data.title}</title>, or set it via your meta component.',
        docsUrl: docsUrlFor('SEO001'),
        fix: { ...FIX }
      } satisfies Result;
    });
  }
};
```

- [ ] **Step 5: Refactor `head-tag-rule.ts`** so the factory takes `rationale`, sets `rationale`/`fix` on the rule object, and derives `docsUrl`:

```ts
import type { Detection, Fix, Result, Severity } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface HeadTagRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  match: (tag: HeadTag) => boolean;
  label: string;
  recommendation: string;
  /** Why this rule matters — surfaced by explain_rule (issue #24). */
  rationale: string;
  fix?: Fix;
}

function detect(head: ResolvedHead, match: (t: HeadTag) => boolean): Detection {
  const tag = head.tags.find(match);
  return tag ? { presence: tag.presence, value: tag.value } : { presence: 'none', value: 'absent' };
}

/** Build a route-scope rule asserting the presence of a single head tag (design §11). */
export function headTagRule(opts: HeadTagRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      return ctx.heads.map((head) => {
        const detection = detect(head, opts.match);
        const message =
          detection.presence === 'none'
            ? `Missing ${opts.label}`
            : detection.value === 'absent'
              ? `Empty ${opts.label}`
              : opts.label;
        return {
          id: opts.id,
          severity: opts.severity,
          detection,
          route: head.route,
          location: head.file,
          message,
          recommendation: opts.recommendation,
          docsUrl,
          ...(opts.fix ? { fix: { ...opts.fix } } : {})
        } satisfies Result;
      });
    }
  };
}
```

- [ ] **Step 6: Add `rationale` to each `headTagRule(...)` call** in `packages/core/src/rules/seo/seo002-005-008.ts`. Insert a `rationale` field into each of the five option objects (keep everything else). Use:
  - SEO002: `rationale: 'A meta description is the snippet search engines show under your title; without one they invent one from page text, often poorly.'`
  - SEO003: `rationale: 'A canonical URL tells search engines which URL is authoritative, preventing duplicate-content dilution across query strings and trailing-slash variants.'`
  - SEO004: `rationale: 'og:image is the preview thumbnail shown when the page is shared on social platforms; without it links render bare and get fewer clicks.'`
  - SEO005: `rationale: 'og:title controls the headline shown when the page is shared on social platforms, independent of the document <title>.'`
  - SEO008: `rationale: 'JSON-LD structured data lets search engines render rich results (breadcrumbs, articles, products) for the page.'`

- [ ] **Step 7: Refactor `project-rules.ts`** to carry `rationale`/`fix` on each rule and reference them (use `docsUrlFor`). For each of `seo006Robots`, `seo007Sitemap`, `seo009HtmlLang`, lift the inline `fix` into a module const, set `rationale` + `fix` on the rule object, and emit `fix: { ...FIX }` + `docsUrl: docsUrlFor(id)` in `check()`. Example for SEO006 (apply the same shape to 007 and 009):

```ts
import type { Detection, Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

const present: Detection = { presence: 'own', value: 'static' };
const absent: Detection = { presence: 'none', value: 'absent' };

const SEO006_FIX: Fix = {
  description: 'Create static/robots.txt (or a src/routes/robots.txt/+server endpoint).',
  snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
  lang: 'text'
};

export const seo006Robots: Rule = {
  id: 'SEO006',
  title: 'robots.txt',
  category: 'seo',
  severity: 'warning',
  scope: 'project',
  rationale:
    'robots.txt tells crawlers which paths they may fetch and points them to your sitemap; missing it leaves crawl behaviour to defaults.',
  fix: SEO006_FIX,
  async check(ctx: RuleContext): Promise<Result[]> {
    const detection = ctx.project.hasRobotsTxt ? present : absent;
    return [
      {
        id: 'SEO006',
        severity: 'warning',
        detection,
        message: ctx.project.hasRobotsTxt ? 'robots.txt' : 'Missing robots.txt',
        recommendation: 'Add static/robots.txt or a src/routes/robots.txt/+server endpoint.',
        docsUrl: docsUrlFor('SEO006'),
        fix: { ...SEO006_FIX }
      }
    ];
  }
};
```

- SEO007 `rationale`: `'A sitemap.xml lists your URLs so search engines can discover and prioritise them, especially pages not well linked internally.'` — reuse the existing snippet/description as `SEO007_FIX`.
- SEO009 `rationale`: `'The <html lang> attribute declares the page language for search engines, screen readers, and translation tools.'` — reuse the existing snippet/description as `SEO009_FIX`.

- [ ] **Step 8: Add `explainRule`** in `packages/core/src/rules/index.ts` (append after the `allRules` array, before the re-export block):

```ts
import type { Category, Fix, Severity } from '../types.js';
import { docsUrlFor } from '../rule.js';

export interface RuleInfo {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  rationale: string;
  docsUrl: string;
  fix?: Fix;
}

/** Look up a rule's static metadata for the MCP explain_rule tool (issue #24). */
export function explainRule(id: string): RuleInfo | undefined {
  const rule = allRules.find((r) => r.id === id);
  if (!rule) return undefined;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    rationale: rule.rationale,
    docsUrl: docsUrlFor(rule.id),
    ...(rule.fix ? { fix: rule.fix } : {})
  };
}
```

- [ ] **Step 9: Export the new symbols** in `packages/core/src/index.ts`:

```ts
export { isPenalized, docsUrlFor } from './rule.js';
```

and in the rules export block add `explainRule` plus the type:

```ts
export { allRules, explainRule, seo001Title, /* …unchanged… */ seo009HtmlLang } from './rules/index.js';
export type { RuleInfo } from './rules/index.js';
```

> The current `index.ts` imports `allRules`/rules from `./rules/index.js` in a single statement — add `explainRule` to that list and a separate `export type { RuleInfo }` line.

- [ ] **Step 10: Run core tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS — new `explain-rule` test plus all existing tests (rule-fixes, project-rules, json-report, agent/sarif/github reporters) unchanged, since `recommendation`/`docsUrl`/`fix` emitted by `check()` are byte-identical to before.

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/core/src packages/core/test/explain-rule.test.ts
git commit -m "feat(core): promote rule rationale/fix onto Rule and add explainRule (#24)"
```

---

### Task 3: Extract `analyzeProject` in the CLI

**Files:**

- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/analyze-project.test.ts` (new)

**Interfaces:**

- Produces:
  - `interface AnalyzeOptions { cwd?: string; metaComponents?: string[]; treatDynamicAs?: 'pass'|'warn'|'fail'; route?: string; failOn?: Severity; rules?: Record<string, RuleSetting> }`
  - `interface AnalyzeResult { results: Result[]; config: Config; version: string }`
  - `function analyzeProject(opts?: AnalyzeOptions): Promise<AnalyzeResult>` — throws `ProjectError` for a non-Kit dir.
  - Re-exports `buildRulesConfig`, `findUnknownRuleIds`, `knownRuleIds` from `./rules-config.js`, and `ProjectError` from the project provider.
- Consumes: `analyzeProject` is used by `run()` (refactored) and later by the MCP package.

- [ ] **Step 1: Read** `packages/cli/src/index.ts` again to confirm the exact pipeline lines being moved.

- [ ] **Step 2: Write the failing test** — `packages/cli/test/analyze-project.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeProject } from '../src/index.js';
import { ProjectError } from '../src/providers/source/project.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');

describe('analyzeProject', () => {
  it('returns results, config and version for a SvelteKit project', async () => {
    const { results, config, version } = await analyzeProject({ cwd: fixtureDir });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'SEO001')).toBe(true);
    expect(config.treatDynamicAs).toBe('pass');
    expect(typeof version).toBe('string');
  });

  it('respects the route glob filter', async () => {
    const { results } = await analyzeProject({ cwd: fixtureDir, route: 'none' });
    const routes = new Set(results.filter((r) => r.route).map((r) => r.route));
    for (const route of routes) expect(route).toBe('/none');
  });

  it('throws ProjectError for a non-SvelteKit directory', async () => {
    await expect(analyzeProject({ cwd: here })).rejects.toBeInstanceOf(ProjectError);
  });
});
```

> Confirm the fixture's route paths in `packages/cli/test/fixtures/basic-project` (the existing `run.test.ts` references `/none` and `/dynamic`). Adjust the glob/route assertion to a route that actually exists if needed.

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter svelte-vitals test -- analyze-project`
Expected: FAIL — `analyzeProject is not a function`.

- [ ] **Step 4: Refactor `index.ts`** — extract the pipeline. Replace the current `run()` body so the analysis lives in `analyzeProject` and `run()` consumes it. New code:

```ts
export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  route?: string;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
}

export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
}

/**
 * Run static-mode analysis and return the structured findings + resolved config.
 * Throws ProjectError when `cwd` is not a SvelteKit project. Shared by the CLI's
 * run() and by @svelte-vitals/mcp (issue #24).
 */
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? [],
    rules: opts.rules ?? {},
    failOn: opts.failOn ?? 'critical'
  });

  await detectProject(rt, cwd); // throws ProjectError if not a SvelteKit project

  const matches = routeMatcher(opts.route);
  const heads = (await sourceHeadProvider.collect(rt, cwd, config)).filter((h) => matches(h.route));
  const project = await collectProjectFacts(rt, cwd);
  const rules = selectRules(allRules, config);
  const results = applyRuleSeverities(await runRules(rules, { heads, project, config }), config);
  return { results, config, version: readPackageVersion() };
}
```

Then rewrite `run()` to delegate (preserving the exact error mapping and reporter logic):

```ts
export async function run(opts: RunOptions = {}): Promise<number> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));

  let analysis: AnalyzeResult;
  try {
    analysis = await analyzeProject({
      cwd: opts.cwd ?? process.cwd(),
      metaComponents: opts.metaComponents,
      treatDynamicAs: opts.treatDynamicAs,
      route: opts.route,
      failOn: opts.failOn,
      rules: opts.rules
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      errorLog(err.message);
      return 2;
    }
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  try {
    const { results, config, version } = analysis;
    const env = opts.env ?? process.env;
    const reporter = resolveReporter(opts.reporter, env);
    if (reporter === 'agent' && isAutoDetectedAgent(opts.reporter, env)) {
      errorLog(
        'svelte-vitals: agent reporter auto-selected (AI-agent env detected); override with --reporter console|json.'
      );
    }
    if (reporter === 'github' && isAutoDetectedGithub(opts.reporter, env)) {
      errorLog(
        'svelte-vitals: github reporter auto-selected (GitHub Actions detected); override with --reporter console|json|sarif.'
      );
    }
    if (reporter === 'json') {
      log(formatJsonReport(results, config, { version }));
    } else if (reporter === 'agent') {
      log(formatAgentReport(results, config));
    } else if (reporter === 'sarif') {
      log(formatSarifReport(results, config, { version }));
    } else if (reporter === 'github') {
      const output = formatGithubReport(results, config);
      if (output) log(output);
    } else {
      log(formatConsoleReport(results, config, { byRoute: opts.byRoute ?? false }));
    }
    const summary = summarize(results, config);
    return hasFailureAtOrAbove(summary, config.failOn) ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}
```

> Update imports at the top of `index.ts`: add `type Result`, `type Config` to the `@svelte-vitals/core` import; ensure `ProjectError` is imported from `./providers/source/project.js` (it already is, alongside `detectProject`/`collectProjectFacts`). `readPackageVersion` is already imported.

- [ ] **Step 5: Re-export helpers for the MCP package** — append to `packages/cli/src/index.ts`:

```ts
export { ProjectError } from './providers/source/project.js';
export { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
```

- [ ] **Step 6: Run the full CLI test suite** (the existing `run.test.ts` must stay green — this proves the refactor preserved behaviour):

Run: `pnpm --filter svelte-vitals test`
Expected: PASS — `analyze-project` test + all existing `run()` tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter svelte-vitals typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/test/analyze-project.test.ts
git commit -m "refactor(cli): extract analyzeProject for reuse by the MCP server (#24)"
```

---

### Task 4: Scaffold `@svelte-vitals/mcp` + the `analyze` tool

**Files:**

- Modify: `pnpm-workspace.yaml` (add `@modelcontextprotocol/sdk` and `zod` to `catalog:`)
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/tsup.config.ts`
- Create: `packages/mcp/src/tools/analyze.ts`
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/bin.ts`
- Test: `packages/mcp/test/analyze-tool.test.ts` (new)

**Interfaces:**

- Consumes: `analyzeProject`, `buildRulesConfig`, `findUnknownRuleIds`, `knownRuleIds`, `ProjectError` from `svelte-vitals`; `buildJsonReport` from `@svelte-vitals/core`.
- Produces:
  - `analyzeInputShape` (a zod raw shape object) and `handleAnalyze(args): Promise<McpToolResult>` in `tools/analyze.ts`.
  - `type McpToolResult = { content: Array<{ type: 'text'; text: string }>; structuredContent?: unknown; isError?: boolean }`.
  - `createServer(): McpServer` in `server.ts`.

- [ ] **Step 1: Add the deps to the catalog** — in `pnpm-workspace.yaml`, add under `catalog:` (alphabetical placement is fine):

```yaml
'@modelcontextprotocol/sdk': ^1.29.0
zod: ^4.4.3
```

- [ ] **Step 2: Create `packages/mcp/package.json`:**

```json
{
  "name": "@svelte-vitals/mcp",
  "version": "0.0.0",
  "description": "Model Context Protocol server for svelte-vitals — run SEO analysis inside an agent's tool loop.",
  "type": "module",
  "license": "MIT",
  "author": "Kazuma Oe (https://github.com/oekazuma)",
  "keywords": ["svelte", "sveltekit", "seo", "mcp", "model-context-protocol", "svelte-vitals"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/oekazuma/svelte-vitals.git",
    "directory": "packages/mcp"
  },
  "bugs": { "url": "https://github.com/oekazuma/svelte-vitals/issues" },
  "homepage": "https://github.com/oekazuma/svelte-vitals#readme",
  "bin": { "svelte-vitals-mcp": "./dist/bin.js" },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "catalog:",
    "@svelte-vitals/core": "workspace:*",
    "svelte-vitals": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}
```

> An `index.ts` entry is added in Task 5 (it exports `createServer`). The `exports` map above points to `dist/index.js`; create the entry in Task 5.

- [ ] **Step 3: Create `packages/mcp/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `packages/mcp/tsup.config.ts`** (two entries; types only for the library entry, matching the CLI's pattern):

```ts
import { defineConfig } from 'tsup';

// ESM-only by design (issue #20) — never add 'cjs'.
export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  target: 'es2022'
});
```

- [ ] **Step 5: Install deps** so the SDK resolves:

Run: `pnpm install`
Expected: lockfile updates; `@svelte-vitals/mcp` links `svelte-vitals` and `@svelte-vitals/core` as workspace deps.

- [ ] **Step 6: Write the failing test** — `packages/mcp/test/analyze-tool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handleAnalyze } from '../src/tools/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
// Reuse the CLI's fixture project so we don't duplicate a SvelteKit tree.
const fixtureDir = join(here, '..', '..', 'cli', 'test', 'fixtures', 'basic-project');

describe('analyze tool', () => {
  it('returns a structured JSON report for a project path', async () => {
    const res = await handleAnalyze({ path: fixtureDir });
    expect(res.isError).toBeFalsy();
    const report = res.structuredContent as { score: number; routes: unknown[]; summary: unknown };
    expect(typeof report.score).toBe('number');
    expect(Array.isArray(report.routes)).toBe(true);
    expect(res.content[0]!.text).toContain('score');
  });

  it('reports an error for an unknown rule id', async () => {
    const res = await handleAnalyze({ path: fixtureDir, rules: ['NOPE999'] });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('NOPE999');
  });

  it('reports an error for a non-SvelteKit path', async () => {
    const res = await handleAnalyze({ path: here });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('SvelteKit');
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/mcp test -- analyze-tool`
Expected: FAIL — cannot find `../src/tools/analyze.js`.

- [ ] **Step 8: Implement `packages/mcp/src/tools/analyze.ts`:**

```ts
import { z } from 'zod';
import { analyzeProject, buildRulesConfig, findUnknownRuleIds, knownRuleIds, ProjectError } from 'svelte-vitals';
import { buildJsonReport } from '@svelte-vitals/core';

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function textError(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** zod raw shape for the analyze tool's input (registered with the MCP server). */
export const analyzeInputShape = {
  path: z.string().optional().describe('Project root to analyze (defaults to the server cwd).'),
  route: z.string().optional().describe('Glob to restrict which routes are analyzed, e.g. "blog/**".'),
  treatDynamicAs: z
    .enum(['pass', 'warn', 'fail'])
    .optional()
    .describe('How dynamic ({data.title}) values are scored. Default: pass.'),
  rules: z.array(z.string()).optional().describe('Enable only these rule ids (all others disabled).'),
  ignore: z.array(z.string()).optional().describe('Disable these rule ids.'),
  failOn: z
    .enum(['critical', 'warning', 'info'])
    .optional()
    .describe('Minimum severity that counts as a failure in the summary. Default: critical.')
};

const analyzeInput = z.object(analyzeInputShape);
export type AnalyzeArgs = z.infer<typeof analyzeInput>;

export async function handleAnalyze(args: AnalyzeArgs): Promise<McpToolResult> {
  const allow = args.rules ?? [];
  const ignore = args.ignore ?? [];
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    return textError(`Unknown rule id(s): ${unknown.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}.`);
  }

  try {
    const { results, config, version } = await analyzeProject({
      cwd: args.path,
      treatDynamicAs: args.treatDynamicAs,
      route: args.route,
      failOn: args.failOn,
      rules: buildRulesConfig(allow, ignore)
    });
    const report = buildJsonReport(results, config, { version });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report
    };
  } catch (err) {
    if (err instanceof ProjectError) return textError(err.message);
    return textError(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

- [ ] **Step 9: Run the analyze-tool test**

Run: `pnpm --filter @svelte-vitals/mcp test -- analyze-tool`
Expected: PASS (all three cases).

- [ ] **Step 10: Create `packages/mcp/src/server.ts`** (registers the analyze tool; explain_rule is added in Task 5):

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeInputShape, handleAnalyze } from './tools/analyze.js';

/** Build the svelte-vitals MCP server with all tools registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'svelte-vitals', version: '0.0.0' });

  server.registerTool(
    'analyze',
    {
      title: 'Analyze SvelteKit SEO',
      description:
        'Run svelte-vitals static-mode SEO analysis on a SvelteKit project and return a structured report (per-route and site-wide scores, findings with fix/recommendation/docs).',
      inputSchema: analyzeInputShape
    },
    async (args) => await handleAnalyze(args)
  );

  return server;
}
```

> The server's `version` string is cosmetic; leaving `0.0.0` is fine for v1 (changesets manage the published version). If a real version is preferred, read it from the package at build time in a later polish pass.

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @svelte-vitals/mcp typecheck`
Expected: no errors. (If the SDK's tool callback type complains about the `args` shape, ensure `inputSchema` is the raw shape object `analyzeInputShape`, not `z.object(...)` — the SDK derives the arg type from the raw shape.)

- [ ] **Step 12: Commit**

```bash
git add pnpm-workspace.yaml packages/mcp/package.json packages/mcp/tsconfig.json packages/mcp/tsup.config.ts packages/mcp/src/tools/analyze.ts packages/mcp/src/server.ts packages/mcp/test/analyze-tool.test.ts pnpm-lock.yaml
git commit -m "feat(mcp): scaffold @svelte-vitals/mcp with the analyze tool (#24)"
```

---

### Task 5: `explain_rule` tool, library entry, bin & smoke test

**Files:**

- Create: `packages/mcp/src/tools/explain-rule.ts`
- Modify: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/mcp/src/bin.ts`
- Test: `packages/mcp/test/explain-rule-tool.test.ts` (new)
- Test: `packages/mcp/test/server.test.ts` (new)

**Interfaces:**

- Consumes: `explainRule`, `knownRuleIds`-equivalent. (`knownRuleIds` lives in `svelte-vitals`; import it there.)
- Produces: `explainRuleInputShape`, `handleExplainRule(args)`, `createServer` (now with two tools), `bin.ts` entry that starts a stdio server.

- [ ] **Step 1: Write the failing test** — `packages/mcp/test/explain-rule-tool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { handleExplainRule } from '../src/tools/explain-rule.js';

describe('explain_rule tool', () => {
  it('returns rule info for a known id', async () => {
    const res = await handleExplainRule({ id: 'SEO001' });
    expect(res.isError).toBeFalsy();
    const info = res.structuredContent as { id: string; severity: string; docsUrl: string };
    expect(info.id).toBe('SEO001');
    expect(info.severity).toBe('critical');
    expect(info.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
  });

  it('reports an error for an unknown id', async () => {
    const res = await handleExplainRule({ id: 'NOPE999' });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('NOPE999');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/mcp test -- explain-rule-tool`
Expected: FAIL — cannot find `../src/tools/explain-rule.js`.

- [ ] **Step 3: Implement `packages/mcp/src/tools/explain-rule.ts`:**

```ts
import { z } from 'zod';
import { explainRule } from '@svelte-vitals/core';
import { knownRuleIds } from 'svelte-vitals';
import type { McpToolResult } from './analyze.js';

export const explainRuleInputShape = {
  id: z.string().describe('Rule id to explain, e.g. "SEO001".')
};

const explainRuleInput = z.object(explainRuleInputShape);
export type ExplainRuleArgs = z.infer<typeof explainRuleInput>;

export async function handleExplainRule(args: ExplainRuleArgs): Promise<McpToolResult> {
  const info = explainRule(args.id);
  if (!info) {
    return {
      content: [{ type: 'text', text: `Unknown rule id: ${args.id}. Known rule ids: ${knownRuleIds().join(', ')}.` }],
      isError: true
    };
  }
  const text =
    `${info.id} — ${info.title} (${info.severity}, ${info.category})\n\n` +
    `${info.rationale}\n\nDocs: ${info.docsUrl}` +
    (info.fix ? `\n\nFix: ${info.fix.description}` : '');
  return { content: [{ type: 'text', text }], structuredContent: info };
}
```

- [ ] **Step 4: Register the tool in `server.ts`** — add the import and a second `registerTool` call inside `createServer`, before `return server`:

```ts
import { explainRuleInputShape, handleExplainRule } from './tools/explain-rule.js';
```

```ts
server.registerTool(
  'explain_rule',
  {
    title: 'Explain an SEO rule',
    description: "Return a rule's title, category, default severity, rationale, docs URL, and fix template.",
    inputSchema: explainRuleInputShape
  },
  async (args) => await handleExplainRule(args)
);
```

- [ ] **Step 5: Create the library entry `packages/mcp/src/index.ts`:**

```ts
export { createServer } from './server.js';
export { handleAnalyze, analyzeInputShape } from './tools/analyze.js';
export type { McpToolResult, AnalyzeArgs } from './tools/analyze.js';
export { handleExplainRule, explainRuleInputShape } from './tools/explain-rule.js';
export type { ExplainRuleArgs } from './tools/explain-rule.js';
```

- [ ] **Step 6: Create the bin `packages/mcp/src/bin.ts`:**

```ts
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((err) => {
  // stderr is safe on stdio transport (stdout carries the protocol).
  console.error(`svelte-vitals-mcp: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
```

- [ ] **Step 7: Write the smoke test** — `packages/mcp/test/server.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('builds a server without throwing', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
```

> This is a light registration smoke test (the SDK's `McpServer` does not expose a public tool-list getter to assert against; the per-tool handler tests in this task and Task 4 cover behaviour). If the installed SDK version exposes a way to enumerate registered tools, assert both `analyze` and `explain_rule` are present.

- [ ] **Step 8: Run the mcp test suite**

Run: `pnpm --filter @svelte-vitals/mcp test`
Expected: PASS — analyze-tool, explain-rule-tool, server.

- [ ] **Step 9: Typecheck + build**

Run: `pnpm --filter @svelte-vitals/mcp typecheck && pnpm --filter @svelte-vitals/mcp build`
Expected: no type errors; `dist/bin.js`, `dist/index.js`, `dist/index.d.ts` produced.

- [ ] **Step 10: Manual stdio smoke check** — verify the server speaks MCP over stdio (initialize + tools/list):

Run:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node packages/mcp/dist/bin.js
```

Expected: two JSON-RPC responses on stdout; the `tools/list` result lists `analyze` and `explain_rule`.

- [ ] **Step 11: Commit**

```bash
git add packages/mcp/src packages/mcp/test
git commit -m "feat(mcp): add explain_rule tool, stdio bin and library entry (#24)"
```

---

### Task 6: README, root scripts, changeset

**Files:**

- Modify: `README.md` (roadmap + packages table)
- Modify: `package.json` (root — extend `check:publish` to include the mcp package)
- Create: `packages/mcp/README.md`
- Create: `.changeset/<name>.md`

**Interfaces:** none (docs/release only).

- [ ] **Step 1: Update the README roadmap** — in `README.md`, edit the **Upcoming** list: remove the `--fix` autofix bullet (closed as agent-delegated) and the MCP bullet; move MCP into **Shipped**. Add to the Shipped list:

```md
- **MCP server** (`@svelte-vitals/mcp`) — exposes `analyze` and `explain_rule` tools over stdio so an agent can run analysis in its tool loop and receive structured, fixable findings.
```

And update the **Upcoming** list to:

```md
**Upcoming**

- **More categories** ([#10](https://github.com/oekazuma/svelte-vitals/issues/10)) — Performance, Accessibility, and Upgrade checks, culminating in a combined Health Report at `1.0`.
```

- [ ] **Step 2: Add the package to the packages table** in `README.md`:

```md
| [`@svelte-vitals/mcp`](./packages/mcp) | MCP server: run analysis inside an agent's tool loop |
```

- [ ] **Step 3: Create `packages/mcp/README.md`** — a short usage doc:

````md
# @svelte-vitals/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [svelte-vitals](https://github.com/oekazuma/svelte-vitals). Lets an AI agent run SvelteKit SEO analysis inside its tool loop and receive structured, fixable findings.

## Tools

- **`analyze`** — run static-mode analysis on a project path; returns per-route and site-wide scores plus findings with `fix`/`recommendation`/`docs`. Inputs: `path?`, `route?`, `treatDynamicAs?`, `rules?`, `ignore?`, `failOn?`.
- **`explain_rule`** — given a rule id (e.g. `SEO001`), returns its title, category, severity, rationale, docs URL, and fix template.

## Usage (stdio)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "svelte-vitals": {
      "command": "npx",
      "args": ["-y", "@svelte-vitals/mcp"]
    }
  }
}
```

ESM-only. Requires Node 18+.
````

- [ ] **Step 4: Extend the root publish check** — in `package.json`, add the mcp package to `check:publish`:

```json
"check:publish": "pnpm --filter @svelte-vitals/core --filter @svelte-vitals/vite --filter svelte-vitals --filter @svelte-vitals/mcp exec publint",
```

- [ ] **Step 5: Create the changeset** — `.changeset/mcp-server.md`:

```md
---
'@svelte-vitals/mcp': minor
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the CLI gains `analyzeProject` for reuse.
```

> `@svelte-vitals/mcp` starts at `0.0.0`; a `minor` bump publishes it at `0.1.0`. Confirm the changeset version bumps match the changesets config (the repo uses Changesets + npm Trusted Publishing — do not publish manually).

- [ ] **Step 6: Run the whole repo's checks**

Run: `pnpm -r typecheck && pnpm -r test && pnpm build && pnpm check:publish && pnpm lint`
Expected: all green. (Run `pnpm format` first if `lint`'s prettier check fails.)

- [ ] **Step 7: Commit**

```bash
git add README.md package.json packages/mcp/README.md .changeset/mcp-server.md
git commit -m "docs(mcp): document the MCP server, update roadmap, add changeset (#24)"
```

---

## Self-Review

**Spec coverage:**

- New `@svelte-vitals/mcp` package, stdio, bin `svelte-vitals-mcp` → Task 4 (scaffold) + Task 5 (bin). ✅
- `analyze` tool (structured JSON report, fix metadata, scores; unknown-rule + non-Kit errors) → Task 4. ✅
- `explain_rule` tool (title/category/severity/rationale/docs/fix; unknown-id error) → Task 5. ✅
- Reuse pipeline, no rule duplication: `analyzeProject` (Task 3) + `buildJsonReport` (Task 1) + `explainRule`/Rule catalog (Task 2). ✅
- Error handling via `isError` tool results → Tasks 4 & 5. ✅
- Testing (core/cli/mcp, TDD) → every task is test-first; existing suites kept green in Tasks 1 & 3. ✅
- README roadmap (drop `--fix`, MCP→Shipped), changeset → Task 6. ✅
- `suggest_fix`, HTTP transport, AGENTS.md → explicitly out of scope (not planned). ✅

**Placeholder scan:** No "TBD"/"add error handling"-style placeholders; every code step shows full code. The `0.0.0` server version and the fixture-route confirmation are called out as explicit notes, not gaps.

**Type consistency:** `analyzeProject`/`AnalyzeResult`/`AnalyzeOptions` (Task 3) consumed verbatim in Task 4. `buildJsonReport`/`JsonReport` (Task 1) consumed in Task 4. `explainRule`/`RuleInfo`/`docsUrlFor` (Task 2) consumed in Task 5. `McpToolResult` defined in `tools/analyze.ts` (Task 4) and imported by `tools/explain-rule.ts` (Task 5). `analyzeInputShape`/`explainRuleInputShape` are raw zod shapes passed as `inputSchema` to `registerTool` consistently.
