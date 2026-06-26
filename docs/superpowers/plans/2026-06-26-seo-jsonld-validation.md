# JSON-LD Validation Implementation Plan (SEO Phase C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the content of a route's static JSON-LD with six rules (SEO016 validity, SEO017 deprecated type, SEO018 relative URLs, SEO019 non-ISO dates, SEO020 placeholder text, SEO021 required properties).

**Architecture:** Capture the literal JSON-LD text (`HeadTag.jsonld`) from both providers when static; a pure core engine parses + flattens (`@graph`/arrays) + walks the object; SEO016 is a custom rule, SEO017–021 share a `jsonldRule` helper. No browser, no web data, no new deps (`JSON.parse` only).

**Tech Stack:** TypeScript, ESM-only (tsup, `target: es2022`), vitest. No new dependencies.

## Global Constraints

- ESM-only; `@svelte-vitals/core` has no `node:` imports; rules pure over the resolved head; engine uses only `JSON.parse`.
- **No false negatives:** rules run only on a **static, parseable** JSON-LD (dynamic `{@html …}` → not captured → skipped). SEO018/019 act only on closed known key lists; SEO021 only on `@type`s in the curated table (unknown types ignored).
- Severities: SEO016 `warning`, SEO017 `info`, SEO018 `warning`, SEO019 `info`, SEO020 `info`, SEO021 `warning`. Category `seo`, scope `route`.
- Findings use `detection:{presence:'none',value:'absent'}` (penalized via `isPenalized`); a passing/seeding result uses `{presence:'own',value:'static'}`.
- Coverage: static-mode head composition collapses multiple JSON-LD scripts to one (`tagKey:'jsonld'`, last-wins); rendered/plugin mode validates every script.
- Release: `@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/vite` + `@svelte-vitals/mcp` **minor**.

### Reference: existing patterns (read-only)

```ts
// cli parse.ts: valueFromNodes(nodes)->Value ('static'|'dynamic'|'absent'); jsonld branch:
//   tags.push({ kind:'jsonld', value: valueFromNodes(node.fragment?.nodes ?? []) })
// vite parse-html.ts jsonld: tags.push({ kind:'jsonld', presence:'own', value: attrValue(script.text) })
// headTagRule / imageRule / linkRule emission: no relevant signal -> nothing; pass -> one {own,static} result; fail -> {none,absent}+fix
// Result: { id, severity, detection, route?, location?, message, recommendation?, docsUrl?, fix?, category? }
// docsUrlFor(id) from ../../rule.js ; rule ids map to lowercased doc slugs (SEO016 -> /rules/seo016)
```

---

### Task 1: Capture `HeadTag.jsonld` (both providers)

Add the field and populate the literal JSON-LD text when static.

**Files:**
- Modify: `packages/core/src/head.ts` (field)
- Modify: `packages/cli/src/providers/source/parse.ts` (jsonld branch + a `textFromNodes` helper)
- Modify: `packages/vite/src/providers/rendered/parse-html.ts` (jsonld loop)
- Test: `packages/cli/test/parse-jsonld.test.ts`, append to `packages/vite/test/parse-html.test.ts`

**Interfaces:**
- Produces: `HeadTag.jsonld?: string` — the literal JSON-LD script content, set only when the script is static (no dynamic interpolation); undefined otherwise.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/parse-jsonld.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const jsonld = (tags: ReturnType<typeof parseHeadTags>) => tags.find((t) => t.kind === 'jsonld')!;

describe('parse: jsonld raw capture (static)', () => {
  it('captures the literal JSON-LD text', () => {
    const src = head('<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBe('{"@context":"https://schema.org","@type":"WebPage"}');
  });
  it('does not capture a dynamic JSON-LD', () => {
    const src = head('<script type="application/ld+json">{@html ld}</script>');
    expect(jsonld(parseHeadTags(src, 'x.svelte')).jsonld).toBeUndefined();
  });
});
```

Append to `packages/vite/test/parse-html.test.ts`:

```ts
describe('parse-html: jsonld raw capture', () => {
  it('captures the rendered JSON-LD text', () => {
    const { tags } = parseHtmlHead(
      '<html><head><script type="application/ld+json">{"@type":"WebPage"}</script></head><body></body></html>'
    );
    expect(tags.find((t) => t.kind === 'jsonld')!.jsonld).toBe('{"@type":"WebPage"}');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/cli && pnpm vitest run test/parse-jsonld.test.ts` and `cd ../vite && pnpm vitest run test/parse-html.test.ts -t "jsonld raw"`
Expected: FAIL — `jsonld` not set.

- [ ] **Step 3: Add the field**

In `packages/core/src/head.ts`, inside `interface HeadTag`, after `noindex?` add:

```ts
  /** Literal `<script type="application/ld+json">` content, set only when the script is static. Undefined when dynamic. */
  jsonld?: string;
```

- [ ] **Step 4: Capture in the CLI parser**

In `packages/cli/src/providers/source/parse.ts`, add a helper next to `valueFromNodes`:

```ts
/** The literal text of a node list when fully static (no ExpressionTag), else undefined. */
function textFromNodes(nodes: Node[]): string | undefined {
  if (!Array.isArray(nodes) || nodes.some((n) => n?.type === 'ExpressionTag')) return undefined;
  const text = nodes
    .filter((n) => n?.type === 'Text')
    .map((n) => String(n.data ?? ''))
    .join('');
  return text.trim().length > 0 ? text : undefined;
}
```

and replace the jsonld branch:

```ts
    } else if (node.name === 'script' && attrText(node.attributes, 'type') === 'application/ld+json') {
      const nodes = node.fragment?.nodes ?? [];
      const raw = textFromNodes(nodes);
      tags.push({ kind: 'jsonld', value: valueFromNodes(nodes), ...(raw !== undefined ? { jsonld: raw } : {}) });
    }
```

- [ ] **Step 5: Capture in the vite parser**

In `packages/vite/src/providers/rendered/parse-html.ts`, replace the jsonld push:

```ts
    if (script.getAttribute('type') === 'application/ld+json') {
      const raw = script.text;
      tags.push({
        kind: 'jsonld',
        presence: 'own',
        value: attrValue(raw),
        ...(raw && raw.trim().length > 0 ? { jsonld: raw } : {})
      });
    }
```

- [ ] **Step 6: Run to verify pass + full suites**

Run: `cd packages/cli && pnpm vitest run test/parse-jsonld.test.ts` and `cd ../vite && pnpm vitest run test/parse-html.test.ts`
Expected: PASS. Then `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite test` → PASS (no behavior change).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/head.ts packages/cli/src/providers/source/parse.ts packages/vite/src/providers/rendered/parse-html.ts packages/cli/test/parse-jsonld.test.ts packages/vite/test/parse-html.test.ts
git commit -m "feat(core,cli,vite): capture literal JSON-LD content on head tags"
```

---

### Task 2: JSON-LD engine (pure helpers + data tables)

A pure module the rules use: parse + flatten + walk, plus the data tables.

**Files:**
- Create: `packages/core/src/rules/seo/jsonld-engine.ts`
- Test: `packages/core/test/jsonld-engine.test.ts`

**Interfaces:**
- Produces:
  - `type JsonLdNode = Record<string, unknown>`
  - `parseJsonLd(raw: string): { ok: boolean; nodes: JsonLdNode[] }` — `ok:false` on parse error; `nodes` = the root object, top-level array members, and `@graph` members (the container object is included too).
  - `collectValues(nodes: JsonLdNode[], keys: ReadonlySet<string>): string[]` — deep-walk each node (nested objects + arrays) collecting string values under any key in `keys`.
  - `nodeStringValues(node: JsonLdNode): string[]` — the node's own direct string property values (shallow).
  - `isAbsoluteUrl(s: string): boolean`, `isIso8601(s: string): boolean`, `hasPlaceholder(s: string): boolean`
  - `typeOf(node: JsonLdNode): string[]` — `@type` normalized to a string array
  - `URL_KEYS`, `DATE_KEYS`, `DEPRECATED_TYPES` (Sets), `PLACEHOLDERS` (string[]), `REQUIRED_PROPS: Record<string,string[]>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/jsonld-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseJsonLd,
  collectValues,
  isAbsoluteUrl,
  isIso8601,
  hasPlaceholder,
  typeOf,
  URL_KEYS,
  REQUIRED_PROPS
} from '../src/rules/seo/jsonld-engine.js';

describe('parseJsonLd', () => {
  it('flattens a top-level object', () => {
    const r = parseJsonLd('{"@type":"WebPage"}');
    expect(r.ok).toBe(true);
    expect(r.nodes).toHaveLength(1);
  });
  it('flattens @graph members (plus the container)', () => {
    const r = parseJsonLd('{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"Person"}]}');
    expect(r.nodes.map((n) => typeOf(n)[0]).filter(Boolean).sort()).toEqual(['Article', 'Person']);
    expect(r.nodes.some((n) => '@context' in n)).toBe(true);
  });
  it('flattens a top-level array', () => {
    const r = parseJsonLd('[{"@type":"A"},{"@type":"B"}]');
    expect(r.nodes).toHaveLength(2);
  });
  it('reports parse errors', () => {
    expect(parseJsonLd('{bad json').ok).toBe(false);
  });
});

describe('collectValues (deep)', () => {
  it('collects values under known keys through nesting', () => {
    const { nodes } = parseJsonLd('{"@type":"Product","name":"x","image":"/a.png","offers":{"url":"/buy"}}');
    expect(collectValues(nodes, URL_KEYS).sort()).toEqual(['/a.png', '/buy']);
  });
});

describe('predicates', () => {
  it('isAbsoluteUrl', () => {
    expect(isAbsoluteUrl('https://e.com/a')).toBe(true);
    expect(isAbsoluteUrl('/a')).toBe(false);
    expect(isAbsoluteUrl('a/b')).toBe(false);
  });
  it('isIso8601', () => {
    expect(isIso8601('2026-06-26')).toBe(true);
    expect(isIso8601('2026-06-26T10:00:00Z')).toBe(true);
    expect(isIso8601('June 26, 2026')).toBe(false);
  });
  it('hasPlaceholder', () => {
    expect(hasPlaceholder('Lorem ipsum dolor')).toBe(true);
    expect(hasPlaceholder('Your Company Name')).toBe(true);
    expect(hasPlaceholder('Acme Corp')).toBe(false);
  });
});

describe('REQUIRED_PROPS', () => {
  it('covers the common types', () => {
    expect(REQUIRED_PROPS['Product']).toContain('name');
    expect(REQUIRED_PROPS['BreadcrumbList']).toContain('itemListElement');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/core && pnpm vitest run test/jsonld-engine.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the engine**

Create `packages/core/src/rules/seo/jsonld-engine.ts`:

```ts
// Pure JSON-LD inspection helpers + curated data. No node:, no deps (JSON.parse only).
export type JsonLdNode = Record<string, unknown>;

/** Parse JSON-LD and flatten to structured-data objects: root, top-level array members, and @graph members. */
export function parseJsonLd(raw: string): { ok: boolean; nodes: JsonLdNode[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, nodes: [] };
  }
  const nodes: JsonLdNode[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === 'object') {
      const o = v as JsonLdNode;
      nodes.push(o);
      if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(visit);
    }
  };
  visit(data);
  return { ok: true, nodes };
}

/** `@type` normalized to a string array (it may be a string or an array). */
export function typeOf(node: JsonLdNode): string[] {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

/** Deep-walk each node (nested objects + arrays) collecting string values found under any key in `keys`. */
export function collectValues(nodes: JsonLdNode[], keys: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as JsonLdNode)) {
        if (keys.has(k) && typeof val === 'string') out.push(val);
        else if (keys.has(k) && Array.isArray(val)) for (const e of val) if (typeof e === 'string') out.push(e);
        walk(val);
      }
    }
  };
  nodes.forEach(walk);
  return out;
}

/** A node's own direct string property values (shallow), used by the placeholder scan. */
export function nodeStringValues(node: JsonLdNode): string[] {
  return Object.values(node).filter((v): v is string => typeof v === 'string');
}

export function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** ISO-8601 date or date-time (date, optional time + Z/offset). Conservative. */
export function isIso8601(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(s.trim());
}

const PLACEHOLDER_RES = [/lorem ipsum/i, /your company/i, /your-?domain/i, /example company/i, /yourcompany/i, /your name here/i];
export const PLACEHOLDERS = PLACEHOLDER_RES.map((r) => r.source);
export function hasPlaceholder(s: string): boolean {
  return PLACEHOLDER_RES.some((re) => re.test(s));
}

export const URL_KEYS: ReadonlySet<string> = new Set(['url', '@id', 'image', 'logo', 'sameAs', 'contentUrl', 'thumbnailUrl']);
export const DATE_KEYS: ReadonlySet<string> = new Set([
  'datePublished',
  'dateModified',
  'dateCreated',
  'startDate',
  'endDate',
  'uploadDate',
  'validFrom',
  'expires'
]);

/** Types whose Google rich results were dropped/restricted (verify before relying on them). */
export const DEPRECATED_TYPES: ReadonlySet<string> = new Set(['HowTo', 'FAQPage', 'ClaimReview']);

/** Curated @type -> required properties for the rich result (Google structured-data docs). */
export const REQUIRED_PROPS: Record<string, string[]> = {
  Article: ['headline'],
  BlogPosting: ['headline'],
  NewsArticle: ['headline'],
  Product: ['name', 'offers'],
  BreadcrumbList: ['itemListElement'],
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
  Person: ['name'],
  VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  LocalBusiness: ['name', 'address']
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/core && pnpm vitest run test/jsonld-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rules/seo/jsonld-engine.ts packages/core/test/jsonld-engine.test.ts
git commit -m "feat(core): JSON-LD inspection engine (parse/flatten/walk + data tables)"
```

---

### Task 3: Rules SEO016–SEO021 + docs

**Files:**
- Create: `packages/core/src/rules/seo/seo016-021.ts`
- Modify: `packages/core/src/rules/index.ts` (register + re-export), `packages/core/src/index.ts` (export)
- Create: `docs/src/content/docs/rules/seo0{16..21}.md` + `docs/src/content/docs/ja/rules/seo0{16..21}.md` (12 files)
- Test: `packages/core/test/seo-jsonld-rules.test.ts`

**Interfaces:**
- Consumes: the engine (Task 2); `HeadTag.jsonld` (Task 1); `Rule`/`RuleContext`/`docsUrlFor` from `../../rule.js`; `Result` from `../../types.js`.
- Produces: `seo016JsonLdValidity`, `seo017DeprecatedType`, `seo018RelativeUrl`, `seo019DateFormat`, `seo020Placeholder`, `seo021RequiredProps` (all `Rule`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/seo-jsonld-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { RuleContext } from '../src/rule.js';

const headWithJsonLd = (raw?: string): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: [{ kind: 'jsonld', presence: 'own', value: raw ? 'static' : 'dynamic', ...(raw ? { jsonld: raw } : {}) } as HeadTag]
});
const ctx = (head: ResolvedHead): RuleContext => ({ heads: [head], project: defaultProject, config: defineConfig({}) });
const fails = (rs: Awaited<ReturnType<typeof seo016JsonLdValidity.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('SEO016 validity', () => {
  it('flags invalid JSON', async () => {
    expect(fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{bad'))))).toHaveLength(1);
  });
  it('flags missing @context', async () => {
    expect(fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{"@type":"WebPage"}'))))).toHaveLength(1);
  });
  it('flags missing @type', async () => {
    expect(fails(await seo016JsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org"}'))))).toHaveLength(1);
  });
  it('passes valid JSON-LD', async () => {
    const rs = await seo016JsonLdValidity.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"WebPage"}')));
    expect(fails(rs)).toHaveLength(0);
    expect(rs).toHaveLength(1);
  });
  it('skips a dynamic (uncaptured) JSON-LD', async () => {
    expect(await seo016JsonLdValidity.check(ctx(headWithJsonLd(undefined)))).toHaveLength(0);
  });
});

describe('SEO017-021', () => {
  it('SEO017 flags a deprecated type', async () => {
    expect(fails(await seo017DeprecatedType.check(ctx(headWithJsonLd('{"@context":"https://schema.org","@type":"HowTo"}'))))).toHaveLength(1);
  });
  it('SEO018 flags a relative URL under a known key', async () => {
    expect(fails(await seo018RelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"/logo.png"}'))))).toHaveLength(1);
    expect(fails(await seo018RelativeUrl.check(ctx(headWithJsonLd('{"@type":"Org","image":"https://e.com/l.png"}'))))).toHaveLength(0);
  });
  it('SEO019 flags a non-ISO date under a known key', async () => {
    expect(fails(await seo019DateFormat.check(ctx(headWithJsonLd('{"@type":"Article","datePublished":"June 1, 2026"}'))))).toHaveLength(1);
    expect(fails(await seo019DateFormat.check(ctx(headWithJsonLd('{"@type":"Article","datePublished":"2026-06-01"}'))))).toHaveLength(0);
  });
  it('SEO020 flags placeholder text', async () => {
    expect(fails(await seo020Placeholder.check(ctx(headWithJsonLd('{"@type":"Org","name":"Your Company Name"}'))))).toHaveLength(1);
  });
  it('SEO021 flags a missing required property and ignores unknown types', async () => {
    expect(fails(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"Product","name":"x"}'))))).toHaveLength(1); // missing offers
    expect(fails(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"Product","name":"x","offers":{}}'))))).toHaveLength(0);
    expect(await seo021RequiredProps.check(ctx(headWithJsonLd('{"@type":"CustomThing","foo":1}')))).toHaveLength(0); // unknown type → no signal
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/core && pnpm vitest run test/seo-jsonld-rules.test.ts`
Expected: FAIL — rules not exported.

- [ ] **Step 3: Create the rules**

Create `packages/core/src/rules/seo/seo016-021.ts`:

```ts
import type { Fix, Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import {
  parseJsonLd,
  collectValues,
  nodeStringValues,
  typeOf,
  isAbsoluteUrl,
  isIso8601,
  hasPlaceholder,
  URL_KEYS,
  DATE_KEYS,
  DEPRECATED_TYPES,
  REQUIRED_PROPS,
  type JsonLdNode
} from './jsonld-engine.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** Static jsonld tags on a head (those with captured raw content). */
function jsonldTags(head: { tags: HeadTag[] }): HeadTag[] {
  return head.tags.filter((t) => t.kind === 'jsonld' && typeof t.jsonld === 'string');
}

// SEO016 — validity (parse + @context + @type), custom because it owns parse failures.
export const seo016JsonLdValidity: Rule = {
  id: 'SEO016',
  title: 'JSON-LD validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Invalid JSON-LD — unparseable, or missing @context/@type — is silently ignored by search engines, so the structured data does nothing.',
  fix: {
    description: 'Make the JSON-LD valid: parseable JSON with both @context (schema.org) and @type.',
    snippet: '<svelte:head>\n  <script type="application/ld+json">\n    {"@context":"https://schema.org","@type":"WebPage","name":"…"}\n  </script>\n</svelte:head>',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('SEO016');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      for (const tag of jsonldTags(head)) {
        const parsed = parseJsonLd(tag.jsonld as string);
        let problem: string | undefined;
        if (!parsed.ok) problem = 'JSON-LD is not valid JSON';
        else if (!parsed.nodes.some((n) => '@context' in n)) problem = 'JSON-LD is missing @context';
        else if (!parsed.nodes.some((n) => typeOf(n).length > 0)) problem = 'JSON-LD is missing @type';
        out.push(
          problem
            ? {
                id: 'SEO016',
                category: 'seo',
                severity: 'warning',
                detection: PENALIZED,
                route: head.route,
                location: head.file,
                message: problem,
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl,
                fix: { ...(seo016JsonLdValidity.fix as Fix) }
              }
            : {
                id: 'SEO016',
                category: 'seo',
                severity: 'warning',
                detection: PASS,
                route: head.route,
                message: 'JSON-LD validity',
                recommendation: 'Make the JSON-LD valid JSON with both @context and @type.',
                docsUrl
              }
        );
      }
    }
    return out;
  }
};

interface JsonLdRuleOptions {
  id: string;
  title: string;
  severity: 'warning' | 'info';
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** Returns a problem message for the parsed nodes, or undefined when they pass. Only called on parseable JSON-LD. */
  problem: (nodes: JsonLdNode[]) => string | undefined;
}

/** Build a route-scoped JSON-LD rule that runs `problem` over each static, parseable JSON-LD on a route. */
function jsonldRule(opts: JsonLdRuleOptions): Rule {
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
      const out: Result[] = [];
      for (const head of ctx.heads) {
        for (const tag of jsonldTags(head)) {
          const parsed = parseJsonLd(tag.jsonld as string);
          if (!parsed.ok) continue; // SEO016 owns parse failures
          const problem = opts.problem(parsed.nodes);
          out.push(
            problem
              ? {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PENALIZED,
                  route: head.route,
                  location: head.file,
                  message: problem,
                  recommendation: opts.recommendation,
                  docsUrl,
                  ...(opts.fix ? { fix: { ...opts.fix } } : {})
                }
              : {
                  id: opts.id,
                  category: 'seo',
                  severity: opts.severity,
                  detection: PASS,
                  route: head.route,
                  message: opts.label,
                  recommendation: opts.recommendation,
                  docsUrl
                }
          );
        }
      }
      return out;
    }
  };
}

export const seo017DeprecatedType = jsonldRule({
  id: 'SEO017',
  title: 'Deprecated structured-data type',
  severity: 'info',
  label: 'Structured-data type',
  recommendation: 'Verify the rich-result status of this @type; Google dropped or restricted some (e.g. HowTo, FAQPage).',
  rationale: 'Some schema types no longer produce rich results, so the markup adds weight without the SERP benefit.',
  problem: (nodes) => {
    const dep = nodes.flatMap(typeOf).find((t) => DEPRECATED_TYPES.has(t));
    return dep ? `@type "${dep}" no longer reliably produces a Google rich result` : undefined;
  }
});

export const seo018RelativeUrl = jsonldRule({
  id: 'SEO018',
  title: 'JSON-LD relative URL',
  severity: 'warning',
  label: 'JSON-LD URLs',
  recommendation: 'Use absolute https URLs for url/@id/image/logo/sameAs in JSON-LD.',
  rationale: 'Search engines need absolute URLs in structured data; a relative URL cannot be resolved reliably.',
  fix: {
    description: 'Replace relative URLs in JSON-LD with absolute https URLs.',
    snippet: '"image": "https://example.com/logo.png"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, URL_KEYS).find((v) => !isAbsoluteUrl(v));
    return bad ? `Relative URL in JSON-LD: "${bad}" — use an absolute https URL` : undefined;
  }
});

export const seo019DateFormat = jsonldRule({
  id: 'SEO019',
  title: 'JSON-LD date format',
  severity: 'info',
  label: 'JSON-LD dates',
  recommendation: 'Use ISO-8601 dates (e.g. 2026-06-26 or 2026-06-26T10:00:00Z) in JSON-LD.',
  rationale: 'Schema.org date properties expect ISO-8601; other formats may be ignored or misparsed.',
  fix: {
    description: 'Format JSON-LD date properties as ISO-8601.',
    snippet: '"datePublished": "2026-06-26"',
    lang: 'json'
  },
  problem: (nodes) => {
    const bad = collectValues(nodes, DATE_KEYS).find((v) => !isIso8601(v));
    return bad ? `Non-ISO-8601 date in JSON-LD: "${bad}"` : undefined;
  }
});

export const seo020Placeholder = jsonldRule({
  id: 'SEO020',
  title: 'JSON-LD placeholder text',
  severity: 'info',
  label: 'JSON-LD content',
  recommendation: 'Replace placeholder/boilerplate text in JSON-LD with real values.',
  rationale: 'Leftover placeholder text (e.g. "Your Company Name", "lorem ipsum") ships misleading structured data.',
  problem: (nodes) => {
    const bad = nodes.flatMap(nodeStringValues).find(hasPlaceholder);
    return bad ? `Placeholder text in JSON-LD: "${bad}"` : undefined;
  }
});

export const seo021RequiredProps = jsonldRule({
  id: 'SEO021',
  title: 'JSON-LD required properties',
  severity: 'warning',
  label: 'JSON-LD required properties',
  recommendation: "Add the properties Google requires for this @type's rich result.",
  rationale: 'A recognized @type missing its required properties is ineligible for the corresponding rich result.',
  problem: (nodes) => {
    for (const node of nodes) {
      for (const t of typeOf(node)) {
        const required = REQUIRED_PROPS[t];
        if (!required) continue; // unknown/custom type → not flagged
        const missing = required.filter((p) => !(p in node));
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    return undefined;
  }
});
```

- [ ] **Step 4: Register + export**

In `packages/core/src/rules/index.ts`:
- Add the import (after the `seo010-015` import):
```ts
import {
  seo016JsonLdValidity,
  seo017DeprecatedType,
  seo018RelativeUrl,
  seo019DateFormat,
  seo020Placeholder,
  seo021RequiredProps
} from './seo/seo016-021.js';
```
- Add all six to the `allRules` array and to the named re-export block (same order), after the SEO015 entries.

In `packages/core/src/index.ts`, add the six names to the existing `export { … } from './rules/index.js';` rules export.

- [ ] **Step 5: Add the 12 docs pages**

Create the English pages under `docs/src/content/docs/rules/`:

`seo016.md`:
```md
---
title: SEO016 · JSON-LD validity
description: A page's JSON-LD must be valid JSON with @context and @type.
---

**Severity:** warning

## What it checks

For each static `<script type="application/ld+json">`, the content must parse as JSON and contain both `@context` and `@type`. Invalid or incomplete JSON-LD is flagged. A dynamically-built JSON-LD is not checked in static mode.

## Why it matters

Invalid JSON-LD — unparseable, or missing `@context`/`@type` — is silently ignored by search engines, so the structured data does nothing.

## How to fix

```svelte
<svelte:head>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebPage","name":"…"}
  </script>
</svelte:head>
```
```

`seo017.md`:
```md
---
title: SEO017 · Deprecated structured-data type
description: Some schema types no longer produce Google rich results.
---

**Severity:** info

## What it checks

Flags a JSON-LD `@type` whose Google rich result was dropped or restricted (e.g. `HowTo`, `FAQPage`, `ClaimReview`).

## Why it matters

These types no longer reliably produce rich results, so the markup adds page weight without the SERP benefit.

## How to fix

Verify the type's current rich-result status in Google's documentation; remove or replace it if it no longer earns a rich result.
```

`seo018.md`:
```md
---
title: SEO018 · JSON-LD relative URL
description: URLs in JSON-LD should be absolute.
---

**Severity:** warning

## What it checks

Flags a relative value under a known URL key (`url`, `@id`, `image`, `logo`, `sameAs`, `contentUrl`, `thumbnailUrl`) in JSON-LD.

## Why it matters

Search engines need absolute URLs in structured data; a relative URL can't be resolved reliably.

## How to fix

```json
"image": "https://example.com/logo.png"
```
```

`seo019.md`:
```md
---
title: SEO019 · JSON-LD date format
description: Date properties in JSON-LD should be ISO-8601.
---

**Severity:** info

## What it checks

Flags a value under a known date key (`datePublished`, `dateModified`, `startDate`, …) that is not ISO-8601.

## Why it matters

Schema.org date properties expect ISO-8601; other formats may be ignored or misparsed.

## How to fix

```json
"datePublished": "2026-06-26"
```
```

`seo020.md`:
```md
---
title: SEO020 · JSON-LD placeholder text
description: JSON-LD should not contain unreplaced placeholder text.
---

**Severity:** info

## What it checks

Flags obvious placeholder/boilerplate text (e.g. `lorem ipsum`, `Your Company Name`) left in a JSON-LD value.

## Why it matters

Leftover placeholder text ships misleading structured data to search engines.

## How to fix

Replace the placeholder with the real value for the page.
```

`seo021.md`:
```md
---
title: SEO021 · JSON-LD required properties
description: A recognized @type should include the properties its rich result requires.
---

**Severity:** warning

## What it checks

For a recognized `@type` (Article, Product, BreadcrumbList, Organization, WebSite, Event, Recipe, Person, VideoObject, LocalBusiness), checks that Google's required properties are present. Unknown/custom types are not flagged.

## Why it matters

A recognized `@type` missing its required properties is ineligible for the corresponding rich result.

## How to fix

Add the missing properties. For example, a `Product` needs `name` and `offers`:

```json
{"@context":"https://schema.org","@type":"Product","name":"…","offers":{"@type":"Offer","price":"…"}}
```
```

Create the Japanese pages under `docs/src/content/docs/ja/rules/`:

`seo016.md`:
```md
---
title: SEO016 · JSON-LD の妥当性
description: ページの JSON-LD は @context と @type を持つ有効な JSON であるべきです。
---

**重大度:** warning

## チェック内容

各静的な `<script type="application/ld+json">` の内容が JSON として parse でき、`@context` と `@type` の両方を持つ必要があります。無効・不完全な JSON-LD は検出されます。動的に組み立てる JSON-LD は静的モードでは検査しません。

## なぜ重要か

無効な JSON-LD（parse 不能、または `@context`/`@type` 欠落）は検索エンジンに黙って無視されるため、構造化データが何の役にも立ちません。

## 修正方法

```svelte
<svelte:head>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"WebPage","name":"…"}
  </script>
</svelte:head>
```
```

`seo017.md`:
```md
---
title: SEO017 · 非推奨の構造化データ型
description: 一部のスキーマ型は Google のリッチリザルトを生成しなくなりました。
---

**重大度:** info

## チェック内容

Google のリッチリザルトが廃止・制限された JSON-LD の `@type`（`HowTo`・`FAQPage`・`ClaimReview` など）を検出します。

## なぜ重要か

これらの型はリッチリザルトを安定して生成しないため、SERP 上の利点なしにページ重量だけ増やします。

## 修正方法

Google のドキュメントで現在のリッチリザルト状況を確認し、リッチリザルトを得られないなら削除・置換してください。
```

`seo018.md`:
```md
---
title: SEO018 · JSON-LD の相対 URL
description: JSON-LD の URL は絶対 URL であるべきです。
---

**重大度:** warning

## チェック内容

JSON-LD の既知の URL キー（`url`・`@id`・`image`・`logo`・`sameAs`・`contentUrl`・`thumbnailUrl`）の相対値を検出します。

## なぜ重要か

検索エンジンは構造化データに絶対 URL を必要とします。相対 URL は確実に解決できません。

## 修正方法

```json
"image": "https://example.com/logo.png"
```
```

`seo019.md`:
```md
---
title: SEO019 · JSON-LD の日付形式
description: JSON-LD の日付プロパティは ISO-8601 であるべきです。
---

**重大度:** info

## チェック内容

既知の日付キー（`datePublished`・`dateModified`・`startDate` など）が ISO-8601 でない値を検出します。

## なぜ重要か

schema.org の日付プロパティは ISO-8601 を期待します。他の形式は無視・誤解析される可能性があります。

## 修正方法

```json
"datePublished": "2026-06-26"
```
```

`seo020.md`:
```md
---
title: SEO020 · JSON-LD のプレースホルダ
description: JSON-LD に未置換のプレースホルダを残すべきではありません。
---

**重大度:** info

## チェック内容

JSON-LD の値に残った明らかなプレースホルダ/定型文（`lorem ipsum`・`Your Company Name` など）を検出します。

## なぜ重要か

残ったプレースホルダは、誤った構造化データを検索エンジンに送ります。

## 修正方法

プレースホルダをそのページの実際の値に置き換えてください。
```

`seo021.md`:
```md
---
title: SEO021 · JSON-LD の必須プロパティ
description: 認識される @type は、そのリッチリザルトに必要なプロパティを含むべきです。
---

**重大度:** warning

## チェック内容

認識される `@type`（Article・Product・BreadcrumbList・Organization・WebSite・Event・Recipe・Person・VideoObject・LocalBusiness）について、Google が必要とするプロパティの有無を確認します。未知/カスタム型は検出しません。

## なぜ重要か

認識される `@type` が必須プロパティを欠くと、対応するリッチリザルトの対象外になります。

## 修正方法

不足プロパティを追加します。例えば `Product` は `name` と `offers` が必要です：

```json
{"@context":"https://schema.org","@type":"Product","name":"…","offers":{"@type":"Offer","price":"…"}}
```
```

- [ ] **Step 6: Run the rule test + full suites**

Run: `cd packages/core && pnpm vitest run test/seo-jsonld-rules.test.ts`
Expected: PASS.

Then the full suites (build core first so cli/mcp see the new rules; the docs-links test passes only because the 12 pages exist):
Run: `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && pnpm --filter @svelte-vitals/core build && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite --filter @svelte-vitals/mcp test && CI=true pnpm -r typecheck`
Expected: PASS. If any test hard-codes a rule count / enumerates ids, update it. If a CLI/vite test fixture's JSON-LD now trips SEO016–021 (e.g. an existing fixture with relative URLs or a bare `@type`), update that fixture's JSON-LD to be valid (do not loosen assertions).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/seo/seo016-021.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/seo-jsonld-rules.test.ts docs/src/content/docs/rules/seo01[6-9].md docs/src/content/docs/rules/seo02[01].md docs/src/content/docs/ja/rules/seo01[6-9].md docs/src/content/docs/ja/rules/seo02[01].md
git commit -m "feat(core): add SEO016-SEO021 JSON-LD validation rules + docs"
```

---

### Task 4: Changeset + full verification

**Files:**
- Create: `.changeset/seo-jsonld-validation.md`

**Interfaces:** none (release).

- [ ] **Step 1: Add the changeset**

Create `.changeset/seo-jsonld-validation.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Validate JSON-LD content, not just its presence (SEO008): SEO016 (valid JSON with @context/@type),
SEO017 (deprecated/restricted rich-result type), SEO018 (relative URLs under known keys), SEO019
(non-ISO-8601 dates under known keys), SEO020 (placeholder text), and SEO021 (required properties for
recognized @types). Only static, parseable JSON-LD is checked — a dynamically-built script is skipped.
```

- [ ] **Step 2: Full verification**

Run from the repo root (build first so cli/mcp see core's new rules):

```bash
pnpm build && CI=true pnpm -r typecheck && CI=true pnpm -r test && CI=true pnpm --filter docs build && pnpm lint && pnpm check:publish
```
Expected: all green. (Run `pnpm format` first if prettier flags the new Markdown; re-run lint. `attw` inside `check:publish` may fail LOCALLY only — known pre-existing local-cache issue, CI-unaffected; if only attw/npm-pack fails and publint passes, treat it as the known issue.) Confirm `pnpm --filter docs build` succeeds with the 12 new rule pages.

- [ ] **Step 3: Commit**

```bash
git add .changeset/seo-jsonld-validation.md
git commit -m "chore: changeset for SEO016-SEO021 (core + cli + vite + mcp minor)"
```

---

## Self-Review

**Spec coverage:**
- SEO016 validity (parse + @context + @type, warning, custom rule owning parse failures) → Task 3. ✅
- SEO017 deprecated type (info), SEO018 relative URL (warning, known keys), SEO019 non-ISO date (info, known keys), SEO020 placeholder (info), SEO021 required props (warning, curated table, unknown types ignored) → Task 3 via `jsonldRule`. ✅
- Engine: `parseJsonLd` flatten @graph/array, `collectValues` deep, `nodeStringValues`, `isAbsoluteUrl`/`isIso8601`/`hasPlaceholder`, `typeOf`, data tables → Task 2. ✅
- Capture `HeadTag.jsonld` (static only, both providers; dynamic skipped) → Task 1. ✅
- No false negatives (dynamic uncaptured → skipped; closed key lists; unknown @type ignored) → Tasks 1–3. ✅
- Coverage caveat (static dedup to one JSON-LD; rendered validates all) → spec + Global Constraints (rules scan `head.tags` as-is). ✅
- 12 docs pages (en + ja) → Task 3 Step 5 (required by docs-links test). ✅
- core+cli+vite+mcp minor changeset → Task 4. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". Every code step has complete code; all 12 doc pages written in full. The fixture caveat in Task 3 Step 6 gives a concrete instruction (make fixture JSON-LD valid, don't loosen assertions).

**Type consistency:** `HeadTag.jsonld?: string` (Task 1) read by `jsonldTags` (Task 3). Engine signatures (`parseJsonLd → {ok,nodes}`, `collectValues(nodes, keys)`, `typeOf`, `nodeStringValues`, `isAbsoluteUrl`/`isIso8601`/`hasPlaceholder`, `URL_KEYS`/`DATE_KEYS`/`DEPRECATED_TYPES`/`REQUIRED_PROPS`) defined in Task 2 and consumed verbatim in Task 3. The six rule export names match across `seo016-021.ts`, `rules/index.ts`, `core/src/index.ts`, the test imports, and the doc slugs (`SEO016`→`seo016`). Findings use `{presence:'none',value:'absent'}`/`{presence:'own',value:'static'}` consistently; `jsonldRule` mirrors the imageRule/linkRule emission contract. `defaultProject` imported from `../src/types.js`.
