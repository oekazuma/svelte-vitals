# Performance v0.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add static-analysis Performance checks for `<img>` (PERF001 dimensions, PERF002 loading hint) and the multi-category foundation (per-category findings, per-category scores, category-aware reporters) that later categories reuse.

**Architecture:** Mirror the head pipeline for images: the CLI provider collects per-route `<img>` facts across the layout chain into a normalized `ResolvedImages[]`, fed via `RuleContext.images`. New `imageRule`-built PERF rules emit per-image findings tagged `category: 'performance'`. Scoring and reporters split results by `category` (defaulting missing → `'seo'`), so the change is additive and existing SEO output/tests are unchanged.

**Tech Stack:** TypeScript (ESM-only), `svelte/compiler` (modern AST), `vitest`, `tsup`, pnpm workspaces.

## Global Constraints

- **ESM-only**, `tsup` `format: ['esm']`, `target: 'es2022'`; never add CJS (#20).
- **core stays runtime-agnostic** — no `node:` imports / no I/O in `@svelte-vitals/core`; image collection (I/O + AST) lives in `packages/cli`.
- **No false positives**: a dynamically-bound attribute (`width={w}`) counts as **present** and passes — never flag a value we can't prove is missing (mirrors the SEO "dynamic title passes" stance).
- **`category` is optional on `Result`**, but every production rule sets it; all consumers treat a missing category as `'seo'`. PERF rules set `'performance'`.
- **Static mode only** for v0.4; `@svelte-vitals/vite` is untouched (plugin-mode image checks deferred).
- **Additive**: existing SEO findings, scores, and reporter output must not change. All existing tests stay green.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `Result.category` + `line`; tag SEO rules

**Files:**

- Modify: `packages/core/src/types.ts` (add `category?`, `line?` to `Result`)
- Modify: `packages/core/src/rules/seo/seo001-title.ts`, `packages/core/src/rules/seo/head-tag-rule.ts`, `packages/core/src/rules/seo/project-rules.ts` (set `category: 'seo'`)
- Test: `packages/core/test/rule-category.test.ts` (new)

**Interfaces:**

- Produces: `Result.category?: Category`, `Result.line?: number`. Existing SEO rules emit `category: 'seo'`.

- [ ] **Step 1: Write the failing test** — `packages/core/test/rule-category.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allRules, defaultProject, defaultConfig, type ResolvedHead } from '../src/index.js';

const head: ResolvedHead = { route: '/x', source: 'static', file: 'src/routes/x/+page.svelte', tags: [] };
const ctx = { heads: [head], project: defaultProject, config: defaultConfig };

describe('rule results carry a category', () => {
  it('every SEO rule tags its results category "seo"', async () => {
    for (const rule of allRules) {
      const results = await rule.check(ctx);
      for (const r of results) expect(r.category, rule.id).toBe('seo');
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- rule-category`
Expected: FAIL — `category` is `undefined`.

- [ ] **Step 3: Extend `Result`** in `packages/core/src/types.ts` — add two fields to the interface (after `fix?`):

```ts
  /** Agent-actionable remediation (issue #18). */
  fix?: Fix;
  /** Vitals category this finding belongs to (default 'seo' when absent). */
  category?: Category;
  /** 1-based source line for element-level findings (e.g. a specific <img>). */
  line?: number;
}
```

> `Category` is already defined in this file and imported where needed; no new import.

- [ ] **Step 4: Tag `seo001-title.ts`** — in the returned `Result` object literal, add `category: 'seo'` (next to `id: 'SEO001'`):

```ts
      return {
        id: 'SEO001',
        category: 'seo',
        severity: 'critical',
```

- [ ] **Step 5: Tag `head-tag-rule.ts`** — in `check`'s returned `Result`, add `category: 'seo'`:

```ts
        return {
          id: opts.id,
          category: 'seo',
          severity: opts.severity,
```

- [ ] **Step 6: Tag `project-rules.ts`** — add `category: 'seo'` to each of the three returned results (SEO006, SEO007, SEO009), next to their `id`:

```ts
      {
        id: 'SEO006',
        category: 'seo',
        severity: 'warning',
```

(and the same for `SEO007`, `SEO009`)

- [ ] **Step 7: Run core tests**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (new test + all existing unchanged — `category` is additive).

- [ ] **Step 8: Typecheck + commit**

Run: `pnpm --filter @svelte-vitals/core typecheck`

```bash
git add packages/core/src/types.ts packages/core/src/rules/seo packages/core/test/rule-category.test.ts
git commit -m "feat(core): add Result.category/line and tag SEO rules (#10)"
```

---

### Task 2: Image IR, `RuleContext.images`, `imageRule`, PERF001/PERF002

**Files:**

- Create: `packages/core/src/images.ts`
- Modify: `packages/core/src/rule.ts` (add `images?` to `RuleContext`)
- Create: `packages/core/src/rules/perf/image-rule.ts`
- Create: `packages/core/src/rules/perf/images.ts`
- Modify: `packages/core/src/rules/index.ts` (add PERF rules to `allRules` + re-export)
- Modify: `packages/core/src/index.ts` (export `ImageInfo`, `ResolvedImages`, `imageRule`, PERF rules)
- Test: `packages/core/test/perf-rules.test.ts` (new)

**Interfaces:**

- Consumes: `Result`, `Category`, `docsUrlFor`, `Rule`, `RuleContext`.
- Produces:
  - `interface ImageInfo { hasWidth: boolean; hasHeight: boolean; hasLoading: boolean; line: number; file: string }`
  - `interface ResolvedImages { route: string; images: ImageInfo[] }`
  - `RuleContext.images?: ResolvedImages[]`
  - `imageRule(opts): Rule`, `perf001ImageDimensions`, `perf002ImageLoading`.

- [ ] **Step 1: Create `packages/core/src/images.ts`:**

```ts
/**
 * A normalized <img> occurrence — the mode-independent boundary for Performance
 * rules (mirrors head.ts). Attribute presence only: a dynamically-bound attribute
 * (width={w}) still counts as present, so dynamic values are never flagged.
 */
export interface ImageInfo {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** Source file the <img> came from. */
  file: string;
}

/** Resolved <img> elements for a single route (page + layout chain). */
export interface ResolvedImages {
  route: string;
  images: ImageInfo[];
}
```

- [ ] **Step 2: Add `images` to `RuleContext`** in `packages/core/src/rule.ts`:

```ts
import type { ResolvedHead } from './head.js';
import type { ResolvedImages } from './images.js';
```

```ts
export interface RuleContext {
  heads: ResolvedHead[];
  /** Per-route <img> elements for Performance rules (absent in modes that don't collect them). */
  images?: ResolvedImages[];
  project: Project;
  config: Config;
}
```

- [ ] **Step 3: Write the failing test** — `packages/core/test/perf-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { perf001ImageDimensions, perf002ImageLoading, defaultProject, defaultConfig } from '../src/index.js';
import type { ResolvedImages } from '../src/images.js';

const config = defaultConfig;
const img = (over: Partial<{ hasWidth: boolean; hasHeight: boolean; hasLoading: boolean }>) => ({
  hasWidth: true,
  hasHeight: true,
  hasLoading: true,
  line: 7,
  file: 'src/routes/+page.svelte',
  ...over
});
const ctxWith = (images: ResolvedImages[]) => ({ heads: [], images, project: defaultProject, config });

describe('PERF001 image dimensions', () => {
  it('flags an <img> missing width or height, with file and line', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false })] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect(r!.category).toBe('performance');
    expect(r!.severity).toBe('warning');
    expect(r!.route).toBe('/a');
    expect(r!.location).toBe('src/routes/+page.svelte');
    expect(r!.line).toBe(7);
    expect(r!.detection).toEqual({ presence: 'none', value: 'absent' });
  });

  it('passes an <img> with both dimensions (dynamic counts as present)', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({})] }]);
    const [r] = await perf001ImageDimensions.check(ctx);
    expect(r!.detection).toEqual({ presence: 'own', value: 'static' }); // a seeding pass result
  });

  it('emits one passing result for a route with no images', async () => {
    const ctx = ctxWith([{ route: '/empty', images: [] }]);
    const results = await perf001ImageDimensions.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0]!.detection.presence).toBe('own');
  });

  it('emits one finding per offending image', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasWidth: false }), img({ hasHeight: false })] }]);
    const results = await perf001ImageDimensions.check(ctx);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.detection.presence === 'none')).toBe(true);
  });
});

describe('PERF002 image loading', () => {
  it('flags a missing loading attribute as info', async () => {
    const ctx = ctxWith([{ route: '/a', images: [img({ hasLoading: false })] }]);
    const [r] = await perf002ImageLoading.check(ctx);
    expect(r!.severity).toBe('info');
    expect(r!.category).toBe('performance');
    expect(r!.detection.presence).toBe('none');
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- perf-rules`
Expected: FAIL — `perf001ImageDimensions` not exported.

- [ ] **Step 5: Create the factory `packages/core/src/rules/perf/image-rule.ts`:**

```ts
import type { Fix, Result, Severity } from '../../types.js';
import type { ImageInfo } from '../../images.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface ImageRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  /** Noun phrase for messages, e.g. '<img> width/height'. */
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** Returns true when the image satisfies the rule (passes). */
  ok: (img: ImageInfo) => boolean;
}

/** Build a route-scoped Performance rule that checks each <img> against `ok` (issue #10). */
export function imageRule(opts: ImageRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'performance',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const route of ctx.images ?? []) {
        const bad = route.images.filter((img) => !opts.ok(img));
        if (bad.length === 0) {
          // One passing result per route seeds it at 100 for the per-category score.
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'own', value: 'static' },
            route: route.route,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl,
            ...(opts.fix ? { fix: { ...opts.fix } } : {})
          });
          continue;
        }
        for (const img of bad) {
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'none', value: 'absent' },
            route: route.route,
            location: img.file,
            line: img.line,
            message: `Missing ${opts.label}`,
            recommendation: opts.recommendation,
            docsUrl,
            ...(opts.fix ? { fix: { ...opts.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}
```

- [ ] **Step 6: Create `packages/core/src/rules/perf/images.ts`:**

```ts
import { imageRule } from './image-rule.js';

export const perf001ImageDimensions = imageRule({
  id: 'PERF001',
  title: 'Image dimensions',
  severity: 'warning',
  label: '<img> width/height',
  recommendation: 'Set explicit width and height on <img> to reserve space and avoid layout shift (CLS).',
  rationale:
    'An <img> without explicit width and height triggers layout shift (CLS) as it loads, hurting Core Web Vitals and visual stability.',
  fix: {
    description: 'Add explicit width and height attributes to the <img>.',
    snippet: '<img src="/hero.jpg" width="1200" height="630" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasWidth && img.hasHeight
});

export const perf002ImageLoading = imageRule({
  id: 'PERF002',
  title: 'Image loading hint',
  severity: 'info',
  label: '<img> loading attribute',
  recommendation: 'Set loading="lazy" for offscreen images; keep the LCP image eager (consider fetchpriority="high").',
  rationale:
    'A loading attribute lets the browser defer offscreen images; without it images load eagerly and can delay more important content. Static analysis cannot tell which image is the LCP, so this is advisory.',
  fix: {
    description: 'Add loading="lazy" to offscreen <img> elements (leave the LCP/hero image eager).',
    snippet: '<img src="/thumb.jpg" width="320" height="240" loading="lazy" alt="…" />',
    lang: 'svelte'
  },
  ok: (img) => img.hasLoading
});
```

- [ ] **Step 7: Register in `packages/core/src/rules/index.ts`** — import and append the PERF rules to `allRules`, and re-export them:

```ts
import { seo006Robots, seo007Sitemap, seo009HtmlLang } from './seo/project-rules.js';
import { perf001ImageDimensions, perf002ImageLoading } from './perf/images.js';
```

Add to the `allRules` array (after `seo009HtmlLang`):

```ts
  seo009HtmlLang,
  perf001ImageDimensions,
  perf002ImageLoading
];
```

Add to the re-export block:

```ts
  seo009HtmlLang,
  perf001ImageDimensions,
  perf002ImageLoading
};
```

- [ ] **Step 8: Export from `packages/core/src/index.ts`:**

```ts
export type { ImageInfo, ResolvedImages } from './images.js';
```

and add `perf001ImageDimensions, perf002ImageLoading` to the rules export line, plus:

```ts
export { headTagRule } from './rules/seo/head-tag-rule.js';
export { imageRule } from './rules/perf/image-rule.js';
```

- [ ] **Step 9: Run tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test -- perf-rules` then `pnpm --filter @svelte-vitals/core test` and `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS. (`rule-category` test now also iterates PERF rules — they pass `ctx` with no `images`, so `check` returns `[]`; the "every result is seo" loop sees no PERF results and stays green. Confirm.)

> If `rule-category.test` fails because a PERF rule has category 'performance': it won't — with no `images` in that ctx, PERF `check` returns `[]`, so no results are checked. Leave as is.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/images.ts packages/core/src/rule.ts packages/core/src/rules/perf packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/perf-rules.test.ts
git commit -m "feat(core): add image IR, imageRule, PERF001/PERF002 (#10)"
```

---

### Task 3: Per-category scoring (`scoresByCategory`)

**Files:**

- Modify: `packages/core/src/scoring/score.ts` (add `scoresByCategory`)
- Modify: `packages/core/src/index.ts` (export it)
- Test: `packages/core/test/score.test.ts` (extend)

**Interfaces:**

- Consumes: `computeScore`, `ScoreResult`, `Category`, `Result`, `Config`.
- Produces: `function scoresByCategory(results: Result[], config: Config): Partial<Record<Category, ScoreResult>>`.

- [ ] **Step 1: Write the failing test** — append to `packages/core/test/score.test.ts`:

```ts
import { scoresByCategory } from '../src/index.js';

describe('scoresByCategory', () => {
  it('scores each category independently', () => {
    const config = defineConfig({});
    const results = [
      {
        id: 'SEO001',
        category: 'seo',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      },
      {
        id: 'PERF001',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'y'
      },
      {
        id: 'PERF001',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route: '/b',
        message: 'ok'
      }
    ] as const;
    const byCat = scoresByCategory(results as never, config);
    expect(byCat.seo).toBeDefined();
    expect(byCat.performance).toBeDefined();
    // SEO has a critical on its only route → capped/low; performance has one bad route and one clean route.
    expect(byCat.performance!.score).toBeGreaterThan(byCat.seo!.score);
  });

  it('treats a missing category as seo', () => {
    const config = defineConfig({});
    const byCat = scoresByCategory(
      [
        {
          id: 'SEO001',
          severity: 'warning',
          detection: { presence: 'none', value: 'absent' },
          route: '/a',
          message: 'x'
        }
      ] as never,
      config
    );
    expect(byCat.seo).toBeDefined();
    expect(byCat.performance).toBeUndefined();
  });
});
```

> Check the existing `score.test.ts` imports — it already imports `defineConfig`. If not, add it to the import.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- score`
Expected: FAIL — `scoresByCategory` is not a function.

- [ ] **Step 3: Implement `scoresByCategory`** in `packages/core/src/scoring/score.ts` — add the import and the function:

```ts
import type { Category, Config, Result, Severity } from '../types.js';
```

(append at end of file:)

```ts
/** Compute an independent score per category present in `results` (issue #10). */
export function scoresByCategory(results: Result[], config: Config): Partial<Record<Category, ScoreResult>> {
  const byCat = new Map<Category, Result[]>();
  for (const r of results) {
    const cat = r.category ?? 'seo';
    let bucket = byCat.get(cat);
    if (!bucket) byCat.set(cat, (bucket = []));
    bucket.push(r);
  }
  const out: Partial<Record<Category, ScoreResult>> = {};
  for (const [cat, rs] of byCat) out[cat] = computeScore(rs, config);
  return out;
}
```

- [ ] **Step 4: Export** from `packages/core/src/index.ts` — extend the scoring export:

```ts
export { computeScore, scoresByCategory } from './scoring/score.js';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test -- score` then `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scoring/score.ts packages/core/src/index.ts packages/core/test/score.test.ts
git commit -m "feat(core): add scoresByCategory for per-category scores (#10)"
```

---

### Task 4: Collect `<img>` in the CLI provider

**Files:**

- Modify: `packages/cli/src/providers/source/parse.ts` (collect images + line)
- Modify: `packages/cli/src/providers/source/routes.ts` (per-route images → `RuleContext.images`)
- Test: `packages/cli/test/parse-file.test.ts` (extend), `packages/cli/test/source-provider.test.ts` (extend) or a new `packages/cli/test/images.test.ts`

**Interfaces:**

- Consumes: `ResolvedImages`, `ImageInfo` from `@svelte-vitals/core`.
- Produces:
  - `parse.ts`: `interface ParsedImage { hasWidth: boolean; hasHeight: boolean; hasLoading: boolean; line: number }`; `ParsedFile.images: ParsedImage[]`.
  - `routes.ts`: `resolveRoute` builds `ResolvedImages` and `collect` passes `images` into `runRules` context.

- [ ] **Step 1: Write the failing test** — add to `packages/cli/test/parse-file.test.ts`:

```ts
describe('parseFile images', () => {
  it('collects <img> attribute presence and line (dynamic counts as present)', () => {
    const src = `<div>\n  <img src="/a.png" width="10" height="10" loading="lazy" />\n  <img src="/b.png" width={w} />\n</div>`;
    const pf = parseFile(src, 'src/routes/+page.svelte');
    expect(pf.images).toHaveLength(2);
    expect(pf.images[0]).toMatchObject({ hasWidth: true, hasHeight: true, hasLoading: true, line: 2 });
    // width={w} (dynamic) still counts as present; height/loading absent.
    expect(pf.images[1]).toMatchObject({ hasWidth: true, hasHeight: false, hasLoading: false, line: 3 });
  });

  it('finds <img> nested inside a block', () => {
    const pf = parseFile(`{#if cond}<img src="/x.png" />{/if}`, 'x.svelte');
    expect(pf.images).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter svelte-vitals test -- parse-file`
Expected: FAIL — `pf.images` is undefined.

- [ ] **Step 3: Implement image collection in `parse.ts`** — add the type, a line helper, a collector, and wire it into `ParsedFile`/`parseFile`:

```ts
export interface ParsedImage {
  hasWidth: boolean;
  hasHeight: boolean;
  hasLoading: boolean;
  /** 1-based source line, or 0 if unknown. */
  line: number;
}
```

Add a line helper near the top (after `type Node = any;`):

```ts
function lineOf(source: string, offset: unknown): number {
  if (typeof offset !== 'number' || offset < 0) return 0;
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === '\n') line++;
  return line;
}
```

Add a collector (parallels `collectComponents`, reusing `CHILD_NODE_KEYS` and `findAttr`):

```ts
function collectImages(node: Node, source: string, acc: ParsedImage[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, source, acc);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.type === 'RegularElement' && node.name === 'img') {
    const attrs: Node[] = node.attributes ?? [];
    acc.push({
      hasWidth: Boolean(findAttr(attrs, 'width')),
      hasHeight: Boolean(findAttr(attrs, 'height')),
      hasLoading: Boolean(findAttr(attrs, 'loading')),
      line: lineOf(source, node.start)
    });
  }
  for (const key of CHILD_NODE_KEYS) {
    if (key in node) collectImages(node[key], source, acc);
  }
}
```

Extend `ParsedFile`:

```ts
export interface ParsedFile {
  headTags: ParsedTag[];
  components: ComponentUse[];
  imports: ImportMap;
  images: ParsedImage[];
}
```

In `parseFile`, collect and return images:

```ts
const components: ComponentUse[] = [];
collectComponents(ast.fragment ?? ast, components);
const images: ParsedImage[] = [];
collectImages(ast.fragment ?? ast, source, images);
return {
  headTags: heads.flatMap(tagsFromHead),
  components,
  imports: collectImports(ast),
  images
};
```

> `findAttr` returns the attribute node whether its value is a literal or an `ExpressionTag`, so `width={w}` yields `hasWidth: true` — dynamic counts as present, per the no-false-positives constraint.

- [ ] **Step 4: Run the parse-file test**

Run: `pnpm --filter svelte-vitals test -- parse-file`
Expected: PASS.

- [ ] **Step 5: Write the provider test** — add to `packages/cli/test/source-provider.test.ts` (or create `packages/cli/test/images.test.ts`); use the in-memory runtime pattern already used in that file. Minimal new case:

```ts
// Assumes the file's existing in-memory `makeRuntime`/fixture helpers; adapt to them.
it('resolveRoute exposes per-route images including layout images', async () => {
  // A layout with a bad <img> and a page with a good <img>; the route should see both.
  // (Build via the file's existing runtime helper; assert the collect() result drives
  //  PERF findings — or assert ResolvedImages directly if resolveRoute is exported.)
});
```

> If `resolveRoute`/`chainFiles` are not exported, test image collection end-to-end through `sourceHeadProvider`-style flow by adding a fixture under `packages/cli/test/fixtures/` with an `<img>` missing dimensions and asserting (in Task 6's `run` e2e) that PERF001 fires. Keep this step's unit assertion to what the file already exposes; do not export internals solely for the test unless the file already does.

- [ ] **Step 6: Wire images into the rule context in `routes.ts`** — collect per-route images across the chain and pass them to `runRules`.

In `resolveRoute`, accumulate images while walking `files` (it already reads + parses each chain file). Add an `images` accumulator and return it alongside the head. Change `resolveRoute` to also produce `ResolvedImages`, and have `collect` assemble `RuleContext.images`.

The cleanest seam: `routes.ts` currently only builds `ResolvedHead[]` and the rules run elsewhere? **No** — rules run in `packages/cli/src/index.ts` via `runRules(rules, { heads, project, config })` (see `analyzeProject`). So `sourceHeadProvider.collect` returns heads only; images must travel a parallel path. Add an images collector to the provider and thread it into `analyzeProject`'s `runRules` call.

Concretely:

1. In `routes.ts`, add an exported `collectImages(rt, cwd, config): Promise<ResolvedImages[]>` that enumerates route pages, walks each route's chain (reuse `chainFiles`), parses each file, and maps `ParsedImage[]` → `ImageInfo[]` (adding `file`), returning one `ResolvedImages` per route. Factor the chain walk so it isn't duplicated (e.g. have `resolveRoute` and the image collector share `chainFiles`).
2. In `packages/cli/src/index.ts` `analyzeProject`, after collecting heads, also collect images and pass them:

```ts
const heads = (await sourceHeadProvider.collect(rt, cwd, config)).filter((h) => matches(h.route));
const images = (await sourceImageProvider.collect(rt, cwd, config)).filter((i) => matches(i.route));
const project = await collectProjectFacts(rt, cwd);
const rules = selectRules(allRules, config);
const results = applyRuleSeverities(await runRules(rules, { heads, images, project, config }), config);
```

Define `sourceImageProvider` in `routes.ts` next to `sourceHeadProvider`:

```ts
export const sourceImageProvider = {
  async collect(rt: Runtime, cwd: string, config: Config = defaultConfig): Promise<ResolvedImages[]> {
    const pages = await enumerateRoutePages(rt, cwd);
    return Promise.all(pages.map((page) => resolveRouteImages(rt, cwd, page, config)));
  }
};
```

where `resolveRouteImages` walks `chainFiles(rt, cwd, page)`, parses each file, and collects `ImageInfo[]` (tagging `file: rel`, `route: deriveRoute(page)`).

> `config` is currently unused by image collection but is accepted for symmetry/future use.

- [ ] **Step 7: Run CLI tests + typecheck**

Run: `pnpm --filter svelte-vitals test` then `pnpm --filter svelte-vitals typecheck`
Expected: PASS (existing run/provider tests unchanged; image tests pass).

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/routes.ts packages/cli/src/index.ts packages/cli/test
git commit -m "feat(cli): collect <img> facts per route for Performance rules (#10)"
```

---

### Task 5: Category-aware reporters

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Modify: `packages/core/src/reporter/json.ts`
- Modify: `packages/core/src/reporter/agent.ts`
- Modify: `packages/core/src/reporter/github.ts`, `packages/core/src/reporter/sarif.ts` (use `line` when present)
- Test: `packages/core/test/console-report.test.ts`, `json-report.test.ts`, `agent-report.test.ts` (extend with performance fixtures)

**Interfaces:**

- Consumes: `scoresByCategory`, `Result.category`, `Result.line`.
- Produces: console per-category score sections; json `categories` map + per-issue `category`; agent generalized heading; github/sarif line-accurate locations.

- [ ] **Step 1: Write failing reporter tests** — add a performance fixture + assertions.

`console-report.test.ts` — add:

```ts
it('adds a Performance score section when performance findings exist', () => {
  const withPerf: Result[] = [
    ...results,
    {
      id: 'PERF001',
      category: 'performance',
      severity: 'warning',
      detection: { presence: 'none', value: 'absent' },
      route: '/blog',
      location: 'src/routes/blog/+page.svelte',
      line: 42,
      message: 'Missing <img> width/height'
    }
  ];
  const out = formatConsoleReport(withPerf, config);
  expect(out).toMatch(/SEO Score: \d+\/100/);
  expect(out).toMatch(/Performance Score: \d+\/100/);
  expect(out).toContain('PERF001');
  expect(out).toContain('src/routes/blog/+page.svelte:42');
});
```

`json-report.test.ts` — add:

```ts
it('exposes a per-category scores map and tags issues with category', () => {
  const withPerf: Result[] = [
    ...results,
    {
      id: 'PERF001',
      category: 'performance',
      severity: 'warning',
      detection: { presence: 'none', value: 'absent' },
      route: '/blog',
      location: 'src/routes/blog/+page.svelte',
      line: 42,
      message: 'Missing <img> width/height'
    }
  ];
  const json = JSON.parse(formatJsonReport(withPerf, config, { version: '0.1.0' }));
  expect(json.categories.seo.score).toBeTypeOf('number');
  expect(json.categories.performance.score).toBeTypeOf('number');
  const blog = json.routes.find((r: { route: string }) => r.route === '/blog');
  expect(blog.issues[0].category).toBe('performance');
  expect(blog.issues[0].line).toBe(42);
});
```

`agent-report.test.ts` — add (heading generalized, perf grouped):

```ts
it('groups performance findings and uses a category-neutral heading', () => {
  const withPerf: Result[] = [
    ...results,
    {
      id: 'PERF001',
      category: 'performance',
      severity: 'warning',
      detection: { presence: 'none', value: 'absent' },
      route: '/blog',
      location: 'src/routes/blog/+page.svelte',
      line: 42,
      message: 'Missing <img> width/height',
      fix: { description: 'Add width/height.', snippet: '<img width="1" height="1" />', lang: 'svelte' }
    }
  ];
  const md = formatAgentReport(withPerf, config);
  expect(md).toContain('PERF001');
  expect(md).toMatch(/^# svelte-vitals/m); // heading no longer says "SEO fixes"
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- console-report json-report agent-report`
Expected: FAIL (no `Performance Score:`, no `categories`, heading still "SEO fixes").

- [ ] **Step 3: Update `console.ts`** — render a score section per category present, reusing the `"<Label> Score: N/100"` line so existing assertions pass.

Replace `scoreHeader` and the body so categories are iterated. Key changes:

```ts
import { computeScore, scoresByCategory } from '../scoring/score.js';
import type { Category } from '../types.js';

const CATEGORY_LABEL: Partial<Record<Category, string>> = {
  seo: 'SEO',
  performance: 'Performance',
  a11y: 'Accessibility',
  maintainability: 'Maintainability'
};
const CATEGORY_ORDER: Category[] = ['seo', 'performance', 'a11y', 'maintainability'];

function scoreLine(label: string, results: Result[], config: Config): string {
  const { score, scoreModel } = computeScore(results, config);
  const parts = [`route avg ${scoreModel.routeAverage}`];
  if (scoreModel.sitePenalty > 0) parts.push(`site −${scoreModel.sitePenalty}`);
  if (scoreModel.criticalCap !== null) parts.push(`capped at ${scoreModel.criticalCap}: critical present`);
  return `${label} Score: ${score}/100   (${parts.join(' · ')})`;
}
```

In `formatConsoleReport`: replace the single `scoreHeader(...)` header line with one score line per category that has results, and prefix each finding's location with `:line` when present. Concretely, build the header as:

```ts
const byCat = scoresByCategory(results, config);
const present = CATEGORY_ORDER.filter((c) => byCat[c] !== undefined);
const header: string[] = [`Svelte Vitals  (${options.mode ?? 'static mode'})`, ''];
for (const c of present)
  header.push(
    scoreLine(
      CATEGORY_LABEL[c] ?? c,
      results.filter((r) => (r.category ?? 'seo') === c),
      config
    )
  );
const lines: string[] = [...header, ''];
```

And in the failures loop, change the location line to include `line`:

```ts
if (r.location) lines.push(`            ${r.location}${r.line ? `:${r.line}` : ''}`);
```

(Severity buckets and the Passed section stay as-is — findings already show `r.id`, which distinguishes SEO vs PERF.)

> This keeps `SEO Score: N/100` (now per-category) so `console-report.test`'s existing regex passes, and adds `Performance Score: N/100` only when performance results exist. The `byRouteTree` helper is unchanged.

- [ ] **Step 4: Update `json.ts`** — add `categories` and per-issue `category`/`line`.

In `issueOf`, include category and line:

```ts
function issueOf(result: Result) {
  return {
    id: result.id,
    category: result.category ?? 'seo',
    title: result.message,
    detection: result.detection,
    location: result.location,
    ...(result.line !== undefined ? { line: result.line } : {}),
    recommendation: result.recommendation,
    ...(result.docsUrl ? { docsUrl: result.docsUrl } : {}),
    ...(result.fix ? { fix: result.fix } : {})
  };
}
```

In `buildJsonReport`, add a `categories` field (keep top-level `score` = SEO for backward compat):

```ts
import { computeScore, scoresByCategory, type ScoreModel } from '../scoring/score.js';
```

```ts
const byCat = scoresByCategory(results, config);
const categories = Object.fromEntries(
  Object.entries(byCat).map(([cat, sr]) => [cat, { score: sr.score, scoreModel: sr.scoreModel }])
);
return { version: meta.version, score, scoreModel, summary, categories, routes, siteIssues };
```

Add `categories` to the `JsonReport` interface:

```ts
categories: Record<string, { score: number; scoreModel: ScoreModel }>;
```

(Place it after `scoreModel`.) The top-level `score`/`scoreModel` stay computed via `computeScore(results, config)` — which now includes PERF results. **To keep the top-level score = SEO only (backward compat), compute it from the SEO subset:**

```ts
const seoResults = results.filter((r) => (r.category ?? 'seo') === 'seo');
const { score, scoreModel } = computeScore(seoResults, config);
```

> Important: changing the top-level `score` to the SEO subset preserves existing json-report assertions (their fixtures are all SEO, so subset === full). Verify the existing test still sees `summary.critical` etc. — `summary` stays over all results (counts include PERF); the existing fixture has no PERF so unchanged.

- [ ] **Step 5: Update `agent.ts`** — generalize the heading and group by category.

Change the H1 from SEO-specific to neutral, and (minimal) keep the existing file-grouping but ensure PERF findings (which are `fail` and have `fix`) flow through. The only required change for the test is the heading:

```ts
const lines: string[] = ['# svelte-vitals — fixes', ''];
```

and the empty-state line stays `'No issues to fix.'`. PERF findings already classify as `fail` (penalized detection) and carry `fix`, so they render in their `location` group with their snippet automatically. Show `line` in the group header when present:

```ts
const key = r.location ?? r.route ?? '(project)';
```

(unchanged grouping is acceptable; `line` appears via the `## ${loc}` not carrying line — optionally append `:line`. Keep minimal: no line in agent group header for v0.4.)

> Check `agent-report.test.ts`'s "No issues to fix" case (if present) for an H1 assertion; update it to the new `# svelte-vitals — fixes` heading if it checks the old text.

- [ ] **Step 6: Update `github.ts` and `sarif.ts`** to use `r.line` when present.

In `github.ts`, where the annotation line is set (currently defaults to `1`), use `result.line ?? 1`. In `sarif.ts`, set the region `startLine` to `result.line ?? 1`. (Locate the existing line assignment in each file and swap the literal `1` for `result.line ?? 1`.) Add a one-line test in each existing reporter test asserting a PERF finding's line surfaces, mirroring the fixtures above.

- [ ] **Step 7: Run all reporter tests + full core suite + typecheck**

Run: `pnpm --filter @svelte-vitals/core test` then `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS — new performance assertions pass; all existing SEO reporter tests unchanged.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/reporter packages/core/test
git commit -m "feat(core): category-aware reporters with per-category scores (#10)"
```

---

### Task 6: e2e fixture, README, changeset, full verification

**Files:**

- Create: `packages/cli/test/fixtures/basic-project/src/routes/img/+page.svelte` (an `<img>` missing dimensions) — or add an `<img>` to an existing fixture route
- Modify: `packages/cli/test/run.test.ts` (assert PERF001 surfaces end-to-end)
- Modify: `README.md` (roadmap)
- Create: `.changeset/performance-v0.4.md`

**Interfaces:** none (integration + docs/release).

- [ ] **Step 1: Add an e2e fixture image.** Create `packages/cli/test/fixtures/basic-project/src/routes/img/+page.svelte`:

```svelte
<img src="/hero.png" alt="hero" />
```

- [ ] **Step 2: Write the failing e2e assertion** — add to `packages/cli/test/run.test.ts` (json reporter makes assertions robust):

```ts
it('reports a Performance finding for an <img> missing dimensions', async () => {
  const cap = capture();
  await run({ cwd: fixtureDir, reporter: 'json', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
  const json = JSON.parse(cap.out.join('\n'));
  expect(json.categories.performance).toBeDefined();
  const img = json.routes.find((r: { route: string }) => r.route === '/img');
  expect(img.issues.some((i: { id: string }) => i.id === 'PERF001')).toBe(true);
});
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter svelte-vitals test -- run`
Expected: PASS (after Tasks 2 & 4 the pipeline emits PERF001 for `/img`). If the existing `run.test` "returns exit 1 and reports the missing title" asserts exact counts that now include the new `/img` route, adjust those counts. Re-read the assertions and update any route-count-sensitive expectation; the missing-title/critical assertions should be unaffected because `/img` has no title either — **verify**: if `/img` lacks a title, it adds an SEO001 critical. To avoid perturbing existing SEO count assertions, give the fixture page a dynamic title:

```svelte
<svelte:head><title>{data.title}</title></svelte:head>
<img src="/hero.png" alt="hero" />
```

so `/img` passes SEO (dynamic title) and only contributes the PERF finding.

- [ ] **Step 4: Run the full CLI suite** and fix any count drift

Run: `pnpm --filter svelte-vitals test`
Expected: PASS. If a count assertion drifted from the new route, update it to the correct value and note why.

- [ ] **Step 5: Update the README roadmap.** In `README.md`, under **Shipped**, add:

```md
- **Performance checks** (`0.4`) — static `<img>` analysis: `width`/`height` (CLS) and a `loading` advisory, scored as a separate Performance category alongside SEO.
```

And under **Upcoming**, replace the single #10 bullet with:

```md
- **More categories** ([#10](https://github.com/oekazuma/svelte-vitals/issues/10)) — Accessibility and Upgrade checks, then a combined weighted Health Report — all landing across `0.x` ahead of the `1.0` polish.
```

- [ ] **Step 6: Add the changeset** — `.changeset/performance-v0.4.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
`width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
advisory) — with dynamically-bound attributes counting as present. Introduces the
multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
`RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
(per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
are unchanged.
```

- [ ] **Step 7: Full repo verification**

Run: `pnpm -r typecheck && pnpm -r test && pnpm build && pnpm lint && pnpm check:publish`
Expected: all green. (Run `pnpm format` first if prettier flags formatting; locally `check:publish`'s attw step may hit the root-owned npm cache — if so, verify attw via `pnpm --workspace-concurrency=1 --filter … exec attw --pack . --profile esm-only` with `npm_config_cache` set, as in #20.)

- [ ] **Step 8: Commit**

```bash
git add README.md .changeset/performance-v0.4.md packages/cli/test
git commit -m "docs(perf): ship Performance v0.4, roadmap + changeset (#10)"
```

---

## Self-Review

**Spec coverage:**

- PERF001 dimensions + PERF002 loading, dynamic-as-present → Task 2 (rules) + Task 4 (`findAttr` presence). ✅
- Per-image findings with `file` + `line` → Task 2 (imageRule emits per bad image) + Task 4 (`line` from AST). ✅
- Image IR (`ImageInfo`/`ResolvedImages`) + `RuleContext.images` → Task 2. ✅
- Provider collects across layout chain (page + layouts) → Task 4 (`resolveRouteImages` over `chainFiles`). ✅
- `Result.category`/`line`; SEO rules tagged → Task 1. ✅
- Per-category scoring (`scoresByCategory`, reuse `computeScore`) → Task 3. ✅
- Category-aware reporters (console per-category score, json `categories`, agent heading, github/sarif line) → Task 5. ✅
- failOn/exit unchanged → no task changes them; verified in Task 6 e2e. ✅
- README roadmap + changeset → Task 6. ✅
- Out of scope (plugin img, preload/adapter/large-imports, Health Report) → not implemented; noted as later 0.x. ✅

**Placeholder scan:** Task 4 Step 5 (provider unit test) intentionally defers to the file's existing in-memory runtime helpers rather than inventing a harness; the e2e coverage in Task 6 guarantees the path. Task 5 Steps 5–6 reference "the existing line assignment" in github/sarif — these are real, locatable literals (`1`), not placeholders. No "TBD"/"add error handling"-style gaps.

**Type consistency:** `ImageInfo { hasWidth, hasHeight, hasLoading, line, file }` (Task 2) ⇄ `ParsedImage { hasWidth, hasHeight, hasLoading, line }` + `file` added in Task 4. `ResolvedImages { route, images: ImageInfo[] }` consumed by `imageRule` (Task 2) and produced by `sourceImageProvider` (Task 4). `scoresByCategory` (Task 3) consumed by console + json (Task 5). `Result.category`/`line` (Task 1) consumed everywhere. `imageRule`/`perf001ImageDimensions`/`perf002ImageLoading` names consistent across Tasks 2, 5, 6.
