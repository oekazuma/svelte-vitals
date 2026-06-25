# SEO Head Completeness + Robots Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six SEO rules — SEO010 noindex detection, SEO011 Twitter Card, SEO012 og:description, SEO013 og:url, SEO014 viewport, SEO015 sitemap-referenced-in-robots — decidable from the resolved `<head>` and project facts.

**Architecture:** Two small targeted captures (`HeadTag.noindex`, `Project.robotsReferencesSitemap`) populated by both providers, then four `headTagRule` instances (SEO011–014), one custom flag-on-presence rule (SEO010), and one project rule (SEO015). Pure functions over the resolved head/project; no browser/web data.

**Tech Stack:** TypeScript, ESM-only (tsup, `target: es2022`), vitest. No new dependencies.

## Global Constraints

- ESM-only; `@svelte-vitals/core` has no `node:` imports; rules are pure functions over resolved heads/images/project.
- **No false negatives:** SEO010 fires only on a statically-resolvable `noindex`/`none` token (a dynamic `content={x}` is never flagged); presence rules behave like the existing SEO rules.
- `HeadTag.noindex?: boolean` is set only on a `<meta name="robots">` whose literal `content` contains `noindex` or `none`. `Project.robotsReferencesSitemap?: boolean` is set only from the **static** `static/robots.txt` file (left `undefined` for a `+server` endpoint or when absent/unreadable — never guessed).
- Severities: SEO012 (og:description) and SEO014 (viewport) = `warning`; SEO010, SEO011, SEO013, SEO015 = `info`.
- SEO010's finding uses `detection: { presence: 'none', value: 'absent' }` so it is penalized/surfaced (per `isPenalized`), at `info` severity (minimal score impact).
- Coverage: `<meta name="robots">` and `<meta name="viewport">` often live in `app.html` (seen only in rendered/plugin mode); og/twitter usually in `<svelte:head>` (both modes).
- Release: `@svelte-vitals/core` + `svelte-vitals` + `@svelte-vitals/vite` + `@svelte-vitals/mcp` **minor**.

### Reference: existing patterns (read-only)

```ts
// headTagRule (packages/core/src/rules/seo/head-tag-rule.ts): { id,title,severity,match:(t:HeadTag)=>boolean,label,recommendation,rationale,fix? } → Rule
//   e.g. SEO002 match: t.kind==='meta' && t.name==='description'; SEO004 match: t.kind==='meta' && t.property==='og:image'
// project rule (packages/core/src/rules/seo/project-rules.ts): scope:'project', reads ctx.project, returns one Result
// isPenalized: presence==='none' OR value==='absent' → penalized (so a surfaced finding uses {presence:'none',value:'absent'})
// docsUrlFor(id) from ../../rule.js → the docsUrl; rule ids map to lowercased doc slugs (SEO010 → /rules/seo010)
// Runtime (cli): rt.exists(path), rt.readFile(path):Promise<string>, rt.join(...parts)
// ROBOTS_SOURCE_PATHS[0] === 'static/robots.txt' (the static file; [1],[2] are +server endpoints)
```

---

### Task 1: Captures — `HeadTag.noindex` + `Project.robotsReferencesSitemap` (both providers)

Add the two fields and populate them from the CLI (source) and vite (rendered) parsers + project collectors. No rules yet — no behavior change.

**Files:**
- Modify: `packages/core/src/head.ts` (HeadTag field), `packages/core/src/types.ts` (Project field)
- Modify: `packages/cli/src/providers/source/parse.ts` (robots-meta noindex), `packages/cli/src/providers/source/project.ts` (robots sitemap ref)
- Modify: `packages/vite/src/providers/rendered/parse-html.ts` (robots-meta noindex), `packages/vite/src/providers/rendered/project.ts` (robots sitemap ref)
- Test: `packages/cli/test/parse-robots.test.ts`, `packages/cli/test/project-robots-ref.test.ts`, and append to `packages/vite/test/parse-html.test.ts` + `packages/vite/test/project.test.ts`

**Interfaces:**
- Produces: `HeadTag.noindex?: boolean` (true when a `<meta name="robots">` literal content contains `noindex`/`none`; undefined otherwise). `Project.robotsReferencesSitemap?: boolean` (true/false from static `static/robots.txt`; undefined when endpoint/absent/unreadable).

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/parse-robots.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHeadTags } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;
const robots = (tags: ReturnType<typeof parseHeadTags>) => tags.find((t) => t.kind === 'meta' && t.name === 'robots')!;

describe('parse: robots noindex (static)', () => {
  it('flags a literal noindex', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="noindex, follow" />'), 'x.svelte')).noindex).toBe(true);
  });
  it('flags content="none" (== noindex,nofollow)', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="none" />'), 'x.svelte')).noindex).toBe(true);
  });
  it('does not flag index,follow', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content="index, follow" />'), 'x.svelte')).noindex).toBeUndefined();
  });
  it('does not flag a dynamic content', () => {
    expect(robots(parseHeadTags(head('<meta name="robots" content={r} />'), 'x.svelte')).noindex).toBeUndefined();
  });
});
```

Create `packages/cli/test/project-robots-ref.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { createNodeRuntime } from '../src/runtime/node.js';

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'sv-robots-'));
  await mkdir(join(cwd, 'static'), { recursive: true });
});
afterEach(async () => rm(cwd, { recursive: true, force: true }));

describe('collectProjectFacts: robotsReferencesSitemap', () => {
  it('true when static/robots.txt has a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://e.com/sitemap.xml\n');
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBe(true);
  });
  it('false when static/robots.txt lacks a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\n');
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBe(false);
  });
  it('undefined when there is no static robots.txt', async () => {
    expect((await collectProjectFacts(createNodeRuntime(), cwd)).robotsReferencesSitemap).toBeUndefined();
  });
});
```

Append to `packages/vite/test/parse-html.test.ts`:

```ts
describe('parse-html: robots noindex', () => {
  it('flags a rendered noindex robots meta', () => {
    const { tags } = parseHtmlHead('<html><head><meta name="robots" content="noindex"></head><body></body></html>');
    expect(tags.find((t) => t.kind === 'meta' && t.name === 'robots')!.noindex).toBe(true);
  });
  it('does not flag index,follow', () => {
    const { tags } = parseHtmlHead('<html><head><meta name="robots" content="index,follow"></head><body></body></html>');
    expect(tags.find((t) => t.kind === 'meta' && t.name === 'robots')!.noindex).toBeUndefined();
  });
});
```

Append to `packages/vite/test/project.test.ts` (match its existing tmpdir setup; if it has none, create `packages/vite/test/project-robots-ref.test.ts` with the same tmpdir pattern as the CLI test but calling `collectRenderedProject(cwd, { presence:'none', value:'absent' })`):

```ts
import { collectRenderedProject } from '../src/providers/rendered/project.js';
// in a tmpdir with static/robots.txt containing 'Sitemap: https://e.com/sitemap.xml':
//   expect((await collectRenderedProject(dir, { presence:'none', value:'absent' })).robotsReferencesSitemap).toBe(true);
// without the line → false; without the file → undefined.
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run test/parse-robots.test.ts test/project-robots-ref.test.ts` and `cd ../vite && pnpm vitest run test/parse-html.test.ts -t "robots noindex"`
Expected: FAIL — fields not populated.

- [ ] **Step 3: Add the fields to core**

In `packages/core/src/head.ts`, inside `interface HeadTag`, after the `hasCrossorigin?` line add:

```ts
  /** True when a <meta name="robots"> literal content contains `noindex`/`none`. Undefined when dynamic or absent. */
  noindex?: boolean;
```

In `packages/core/src/types.ts`, inside `interface Project`, after `htmlLang: Detection;` add:

```ts
  /** Whether the static static/robots.txt references a sitemap (`Sitemap:` line). Undefined for a +server endpoint / absent / unreadable. */
  robotsReferencesSitemap?: boolean;
```

- [ ] **Step 4: Populate `noindex` in the CLI parser**

In `packages/cli/src/providers/source/parse.ts`, replace the `meta` branch in `tagsFromHead`:

```ts
    if (node.name === 'meta') {
      const name = attrText(node.attributes, 'name');
      const property = attrText(node.attributes, 'property');
      const content = name === 'robots' ? attrText(node.attributes, 'content') : undefined;
      const noindex = content !== undefined && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
      tags.push({
        kind: 'meta',
        ...(name ? { name } : {}),
        ...(property ? { property } : {}),
        value: attrValue(node.attributes, 'content'),
        ...(noindex ? { noindex: true } : {})
      });
    } else if (node.name === 'link') {
```

(Leave the rest of the `link`/`jsonld` branches unchanged.)

- [ ] **Step 5: Populate `robotsReferencesSitemap` in the CLI project collector**

In `packages/cli/src/providers/source/project.ts`, add a helper and call it in `collectProjectFacts`:

```ts
async function robotsRefsSitemap(rt: Runtime, cwd: string): Promise<boolean | undefined> {
  // Only the static file is statically inspectable; a +server endpoint generates
  // its output at runtime, so we must not guess (no false positives).
  const p = rt.join(cwd, 'static/robots.txt');
  if (!(await rt.exists(p))) return undefined;
  try {
    return /^\s*sitemap:/im.test(await rt.readFile(p));
  } catch {
    return undefined;
  }
}
```

and change the return of `collectProjectFacts`:

```ts
  const robotsReferencesSitemap = await robotsRefsSitemap(rt, cwd);
  return { hasRobotsTxt, hasSitemap, htmlLang, ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}) };
```

(`Runtime` is already imported in this file via the existing signature; if not, add `import type { Runtime } from '@svelte-vitals/core';`.)

- [ ] **Step 6: Populate both fields in the vite providers**

In `packages/vite/src/providers/rendered/parse-html.ts`, replace the `meta` loop body:

```ts
  for (const meta of head.querySelectorAll('meta')) {
    const name = meta.getAttribute('name');
    const property = meta.getAttribute('property');
    if (!name && !property) continue;
    const content = name === 'robots' ? meta.getAttribute('content') : null;
    const noindex = content != null && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
    tags.push({
      kind: 'meta',
      ...(name ? { name } : {}),
      ...(property ? { property } : {}),
      presence: 'own',
      value: attrValue(meta.getAttribute('content')),
      ...(noindex ? { noindex: true } : {})
    });
  }
```

In `packages/vite/src/providers/rendered/project.ts`, add a helper and use it in `collectRenderedProject`:

```ts
import { readFile } from 'node:fs/promises';
// …existing imports…

async function robotsRefsSitemap(cwd: string): Promise<boolean | undefined> {
  try {
    return /^\s*sitemap:/im.test(await readFile(join(cwd, 'static/robots.txt'), 'utf8'));
  } catch {
    return undefined; // endpoint / absent / unreadable — don't guess
  }
}
```

and update its return:

```ts
  const robotsReferencesSitemap = await robotsRefsSitemap(cwd);
  return { hasRobotsTxt, hasSitemap, htmlLang, ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}) };
```

- [ ] **Step 7: Run the tests to verify they pass + full suites**

Run: `cd packages/cli && pnpm vitest run test/parse-robots.test.ts test/project-robots-ref.test.ts` and `cd ../vite && pnpm vitest run test/parse-html.test.ts test/project.test.ts`
Expected: PASS. Then full regression: `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite test`
Expected: PASS (optional fields change no existing behavior).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/head.ts packages/core/src/types.ts packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/project.ts packages/vite/src/providers/rendered/parse-html.ts packages/vite/src/providers/rendered/project.ts packages/cli/test/parse-robots.test.ts packages/cli/test/project-robots-ref.test.ts packages/vite/test/parse-html.test.ts packages/vite/test/project.test.ts
git commit -m "feat(core,cli,vite): capture robots noindex + robots.txt sitemap reference"
```

---

### Task 2: Rules SEO010–SEO015 + docs

Add the six rules and their 12 docs pages.

**Files:**
- Create: `packages/core/src/rules/seo/seo010-015.ts`
- Modify: `packages/core/src/rules/index.ts` (register + re-export), `packages/core/src/index.ts` (export)
- Create: `docs/src/content/docs/rules/seo01{0..5}.md` + `docs/src/content/docs/ja/rules/seo01{0..5}.md` (12 files)
- Test: `packages/core/test/seo-head-completeness.test.ts`

**Interfaces:**
- Consumes: `HeadTag.noindex` / `Project.robotsReferencesSitemap` (Task 1); `headTagRule` from `./head-tag-rule.js`; `Rule`, `RuleContext`, `docsUrlFor` from `../../rule.js`; `Result` from `../../types.js`.
- Produces: `seo010Indexability`, `seo011TwitterCard`, `seo012OgDescription`, `seo013OgUrl`, `seo014Viewport`, `seo015SitemapInRobots` (all `Rule`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/seo-head-completeness.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots
} from '../src/index.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { HeadTag, ResolvedHead } from '../src/head.js';
import type { Project } from '../src/types.js';
import type { RuleContext } from '../src/rule.js';

const headWith = (tags: Array<Partial<HeadTag>>): ResolvedHead => ({
  route: '/x',
  source: 'rendered',
  file: 'x',
  tags: tags.map((t) => ({ presence: 'own', value: 'static', ...t }) as HeadTag)
});
const ctx = (head: ResolvedHead, project: Project = defaultProject): RuleContext => ({
  heads: [head],
  project,
  config: defineConfig({})
});
const fails = (rs: Awaited<ReturnType<typeof seo010Indexability.check>>) =>
  rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');

describe('SEO010 indexability', () => {
  it('flags a route whose robots meta is noindex', async () => {
    const rs = await seo010Indexability.check(ctx(headWith([{ kind: 'meta', name: 'robots', noindex: true }])));
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('info');
  });
  it('does not flag when robots meta is not noindex', async () => {
    const rs = await seo010Indexability.check(ctx(headWith([{ kind: 'meta', name: 'robots' }])));
    expect(rs).toHaveLength(0);
  });
});

describe('SEO011-014 head presence', () => {
  it('SEO011 flags missing twitter:card, passes present', async () => {
    expect(fails(await seo011TwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'description' }]))))).toHaveLength(1);
    expect(fails(await seo011TwitterCard.check(ctx(headWith([{ kind: 'meta', name: 'twitter:card' }]))))).toHaveLength(0);
  });
  it('SEO012 matches og:description (warning)', async () => {
    expect(seo012OgDescription.severity).toBe('warning');
    expect(fails(await seo012OgDescription.check(ctx(headWith([{ kind: 'meta', property: 'og:description' }]))))).toHaveLength(0);
  });
  it('SEO013 matches og:url', async () => {
    expect(fails(await seo013OgUrl.check(ctx(headWith([{ kind: 'meta', property: 'og:url' }]))))).toHaveLength(0);
  });
  it('SEO014 matches viewport (warning)', async () => {
    expect(seo014Viewport.severity).toBe('warning');
    expect(fails(await seo014Viewport.check(ctx(headWith([{ kind: 'meta', name: 'viewport' }]))))).toHaveLength(0);
  });
});

describe('SEO015 sitemap-in-robots', () => {
  const proj = (p: Partial<Project>): Project => ({ ...defaultProject, ...p });
  it('flags when robots+sitemap exist but robots does not reference the sitemap', async () => {
    const rs = await seo015SitemapInRobots.check(ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: false })));
    expect(fails(rs)).toHaveLength(1);
  });
  it('passes when robots references the sitemap', async () => {
    const rs = await seo015SitemapInRobots.check(ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true, robotsReferencesSitemap: true })));
    expect(fails(rs)).toHaveLength(0);
  });
  it('emits nothing when robotsReferencesSitemap is undefined (endpoint/absent)', async () => {
    const rs = await seo015SitemapInRobots.check(ctx(headWith([]), proj({ hasRobotsTxt: true, hasSitemap: true })));
    expect(rs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/core && pnpm vitest run test/seo-head-completeness.test.ts`
Expected: FAIL — rules not exported.

- [ ] **Step 3: Create the rules**

Create `packages/core/src/rules/seo/seo010-015.ts`:

```ts
import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { headTagRule } from './head-tag-rule.js';

// SEO010 — flag-on-presence: a route whose robots meta is noindex. info advisory.
export const seo010Indexability: Rule = {
  id: 'SEO010',
  title: 'Indexability',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it.',
  fix: {
    description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
    snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
    lang: 'svelte'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const docsUrl = docsUrlFor('SEO010');
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const noindexed = head.tags.some((t) => t.kind === 'meta' && t.name === 'robots' && t.noindex === true);
      if (!noindexed) continue;
      out.push({
        id: 'SEO010',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' }, // surfaced as an issue (isPenalized)
        route: head.route,
        location: head.file,
        message: 'Route is noindex — verify this is intentional',
        recommendation: 'If this route should be indexed, remove noindex from its <meta name="robots">.',
        docsUrl,
        fix: {
          description: 'If this route should be indexed, drop noindex from its <meta name="robots">.',
          snippet: '<svelte:head>\n  <meta name="robots" content="index, follow" />\n</svelte:head>',
          lang: 'svelte'
        }
      });
    }
    return out;
  }
};

export const seo011TwitterCard = headTagRule({
  id: 'SEO011',
  title: 'Twitter Card',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.name === 'twitter:card',
  label: '<meta name="twitter:card">',
  recommendation: 'Add <meta name="twitter:card" content="summary_large_image"> so X/Twitter renders a rich card.',
  rationale:
    'twitter:card selects how the page renders when shared on X/Twitter; without it the platform falls back to a basic link (Open Graph tags are used as fallbacks for the rest).',
  fix: {
    description: 'Add a twitter:card meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta name="twitter:card" content="summary_large_image" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo012OgDescription = headTagRule({
  id: 'SEO012',
  title: 'Open Graph description',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.property === 'og:description',
  label: '<meta property="og:description">',
  recommendation: 'Add <meta property="og:description">, or set openGraph.description on your meta component.',
  rationale:
    'og:description is the summary shown under the title in social previews; without it platforms guess or show nothing, lowering click-through.',
  fix: {
    description: 'Add an og:description meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:description" content="A concise page summary." />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo013OgUrl = headTagRule({
  id: 'SEO013',
  title: 'Open Graph URL',
  severity: 'info',
  match: (t) => t.kind === 'meta' && t.property === 'og:url',
  label: '<meta property="og:url">',
  recommendation: 'Add <meta property="og:url"> with the canonical URL, or set openGraph.url on your meta component.',
  rationale:
    'og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.',
  fix: {
    description: 'Add an og:url meta tag in <svelte:head>.',
    snippet: '<svelte:head>\n  <meta property="og:url" content="https://example.com/this-page" />\n</svelte:head>',
    lang: 'svelte'
  }
});

export const seo014Viewport = headTagRule({
  id: 'SEO014',
  title: 'Viewport',
  severity: 'warning',
  match: (t) => t.kind === 'meta' && t.name === 'viewport',
  label: '<meta name="viewport">',
  recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> (usually in app.html).',
  rationale:
    'Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.',
  fix: {
    description: 'Add the viewport meta tag (typically in src/app.html <head>).',
    snippet: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    lang: 'html'
  }
});

// SEO015 — project rule: robots.txt should point crawlers at the sitemap.
export const seo015SitemapInRobots: Rule = {
  id: 'SEO015',
  title: 'Sitemap referenced in robots.txt',
  category: 'seo',
  severity: 'info',
  scope: 'project',
  rationale:
    'A Sitemap: line in robots.txt helps crawlers discover your sitemap; without it discovery relies on manual submission.',
  fix: {
    description: 'Add a Sitemap: line to static/robots.txt.',
    snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
    lang: 'text'
  },
  async check(ctx: RuleContext): Promise<Result[]> {
    const { hasRobotsTxt, hasSitemap, robotsReferencesSitemap } = ctx.project;
    // Only meaningful when both exist AND we could read the static robots.txt and found no reference.
    if (!(hasRobotsTxt && hasSitemap && robotsReferencesSitemap === false)) return [];
    return [
      {
        id: 'SEO015',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'robots.txt does not reference your sitemap',
        recommendation: 'Add a Sitemap: line to static/robots.txt pointing at your sitemap.xml.',
        docsUrl: docsUrlFor('SEO015'),
        fix: {
          description: 'Add a Sitemap: line to static/robots.txt.',
          snippet: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml',
          lang: 'text'
        }
      }
    ];
  }
};
```

- [ ] **Step 4: Register + export the rules**

In `packages/core/src/rules/index.ts`:
- Add the import (after the `perf003/perf004` import line):
```ts
import {
  seo010Indexability,
  seo011TwitterCard,
  seo012OgDescription,
  seo013OgUrl,
  seo014Viewport,
  seo015SitemapInRobots
} from './seo/seo010-015.js';
```
- Add all six to the `allRules` array (after the last perf rule) and to the named re-export block (after the last perf rule), in the same order.

In `packages/core/src/index.ts`, add the six names to the existing `export { … } from './rules/index.js';` rules export.

- [ ] **Step 5: Add the 12 docs pages**

Create the English pages under `docs/src/content/docs/rules/`:

`seo010.md`:
```md
---
title: SEO010 · Indexability
description: A route should not be accidentally set to noindex.
---

**Severity:** info

## What it checks

If a route's `<meta name="robots">` statically resolves to `noindex` (or `none`), it is surfaced so you can confirm the de-indexing is intentional. A dynamically-set robots value is not flagged.

## Why it matters

A noindex directive removes the page from search results; an accidental noindex on a public route silently deindexes it — one of the most damaging SEO mistakes.

## How to fix

If this route should be indexed, remove `noindex` from its robots meta:

```svelte
<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>
```
```

`seo011.md`:
```md
---
title: SEO011 · Twitter Card
description: Pages should declare a twitter:card for rich sharing on X/Twitter.
---

**Severity:** info

## What it checks

Every route should include a `<meta name="twitter:card">` tag (own or inherited). A missing tag is flagged.

## Why it matters

twitter:card selects how the page renders when shared on X/Twitter; without it the platform shows a basic link. (Open Graph tags act as fallbacks for the card's title and image.)

## How to fix

```svelte
<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```
```

`seo012.md`:
```md
---
title: SEO012 · Open Graph description
description: Every route should include an og:description.
---

**Severity:** warning

## What it checks

Every route must include a `<meta property="og:description">` tag (own or inherited). A missing or empty tag is flagged.

## Why it matters

og:description is the summary shown under the title in social previews; without one, platforms guess or show nothing, lowering click-through.

## How to fix

```svelte
<svelte:head>
  <meta property="og:description" content="A concise page summary." />
</svelte:head>
```
```

`seo013.md`:
```md
---
title: SEO013 · Open Graph URL
description: Every route should include an og:url with its canonical address.
---

**Severity:** info

## What it checks

Every route should include a `<meta property="og:url">` tag (own or inherited). A missing tag is flagged.

## Why it matters

og:url tells social platforms the canonical address to attribute shares and likes to, consolidating engagement on one URL.

## How to fix

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```
```

`seo014.md`:
```md
---
title: SEO014 · Viewport
description: Pages should declare a responsive viewport meta tag.
---

**Severity:** warning

## What it checks

Every route must expose a `<meta name="viewport">` tag (usually set once in `app.html`). A missing tag is flagged.

## Why it matters

Without a viewport meta tag the page is not mobile-responsive, which Google penalizes under mobile-first indexing.

## How to fix

Add the viewport meta tag, typically in `src/app.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
```

`seo015.md`:
```md
---
title: SEO015 · Sitemap referenced in robots.txt
description: robots.txt should point crawlers at your sitemap.
---

**Severity:** info

## What it checks

When both `robots.txt` and a sitemap exist, the static `static/robots.txt` should contain a `Sitemap:` line. (A `+server` robots endpoint is not inspected statically.)

## Why it matters

A `Sitemap:` line in robots.txt helps crawlers discover your sitemap; without it, discovery relies on manual submission.

## How to fix

Add a `Sitemap:` line to `static/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
```

Create the Japanese pages under `docs/src/content/docs/ja/rules/`:

`seo010.md`:
```md
---
title: SEO010 · インデックス可否
description: ルートが誤って noindex になっていないか確認します。
---

**重大度:** info

## チェック内容

ルートの `<meta name="robots">` が静的に `noindex`（または `none`）に解決される場合、意図的なデインデックスかを確認できるよう提示します。動的に設定された robots 値は検出しません。

## なぜ重要か

noindex はページを検索結果から除外します。公開ルートでの誤った noindex は気づかぬうちにデインデックスを招く、最も影響の大きいミスの一つです。

## 修正方法

このルートをインデックスさせたい場合は robots メタから `noindex` を外します：

```svelte
<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>
```
```

`seo011.md`:
```md
---
title: SEO011 · Twitter Card
description: X/Twitter でのリッチ共有のため twitter:card を宣言すべきです。
---

**重大度:** info

## チェック内容

すべてのルートは `<meta name="twitter:card">` を持つべきです（own または継承）。欠落していると検出されます。

## なぜ重要か

twitter:card は X/Twitter で共有された際の表示形式を決めます。無い場合は基本的なリンク表示になります（カードのタイトルや画像は Open Graph タグがフォールバックとして使われます）。

## 修正方法

```svelte
<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```
```

`seo012.md`:
```md
---
title: SEO012 · Open Graph description
description: すべてのルートに og:description を含めるべきです。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta property="og:description">` を持つ必要があります（own または継承）。欠落または空の場合は検出されます。

## なぜ重要か

og:description はソーシャルプレビューでタイトル下に表示される要約です。無いとプラットフォームが推測するか何も表示されず、クリック率が下がります。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:description" content="ページの簡潔な要約。" />
</svelte:head>
```
```

`seo013.md`:
```md
---
title: SEO013 · Open Graph URL
description: すべてのルートに正規URLの og:url を含めるべきです。
---

**重大度:** info

## チェック内容

すべてのルートは `<meta property="og:url">` を持つべきです（own または継承）。欠落していると検出されます。

## なぜ重要か

og:url はシェアやいいねを集約する正規アドレスをソーシャルプラットフォームに伝え、エンゲージメントを一つのURLに統合します。

## 修正方法

```svelte
<svelte:head>
  <meta property="og:url" content="https://example.com/this-page" />
</svelte:head>
```
```

`seo014.md`:
```md
---
title: SEO014 · ビューポート
description: レスポンシブな viewport メタタグを宣言すべきです。
---

**重大度:** warning

## チェック内容

すべてのルートは `<meta name="viewport">` を公開する必要があります（通常 `app.html` で一度設定）。欠落していると検出されます。

## なぜ重要か

viewport メタタグが無いとページはモバイル対応にならず、モバイルファーストインデックスで Google に評価されません。

## 修正方法

通常は `src/app.html` に viewport メタタグを追加します：

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
```

`seo015.md`:
```md
---
title: SEO015 · robots.txt の sitemap 参照
description: robots.txt はクローラーに sitemap を示すべきです。
---

**重大度:** info

## チェック内容

robots.txt と sitemap の両方が存在する場合、静的な `static/robots.txt` に `Sitemap:` 行があるべきです。（`+server` の robots エンドポイントは静的には検査しません。）

## なぜ重要か

robots.txt の `Sitemap:` 行はクローラーによる sitemap の発見を助けます。無い場合は手動送信に依存します。

## 修正方法

`static/robots.txt` に `Sitemap:` 行を追加します：

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
```

- [ ] **Step 6: Run the rule test + full suites**

Run: `cd packages/core && pnpm vitest run test/seo-head-completeness.test.ts`
Expected: PASS.

Then the **full** suites (adding rules to `allRules` is picked up dynamically by MCP/scoring/docs-links, but run them to confirm; the docs-links test passes only because the 12 pages exist):
Run: `cd /Users/oe.kazuma/localRepo/oss/svelte-vitals && CI=true pnpm --filter @svelte-vitals/core --filter svelte-vitals --filter @svelte-vitals/vite --filter @svelte-vitals/mcp test`
Expected: PASS. If any test hard-codes a rule count or enumerates ids (search: `grep -rn "allRules\|toHaveLength" packages/*/test | grep -iE "length|count"`), update it.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rules/seo/seo010-015.ts packages/core/src/rules/index.ts packages/core/src/index.ts packages/core/test/seo-head-completeness.test.ts docs/src/content/docs/rules/seo01*.md docs/src/content/docs/ja/rules/seo01*.md
git commit -m "feat(core): add SEO010-SEO015 (indexability, twitter, og, viewport, sitemap-in-robots) + docs"
```

---

### Task 3: Changeset + full verification

**Files:**
- Create: `.changeset/seo-head-completeness.md`

**Interfaces:** none (release).

- [ ] **Step 1: Add the changeset**

Create `.changeset/seo-head-completeness.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
viewport tags placed in `app.html` are covered in plugin/rendered mode.
```

- [ ] **Step 2: Full verification**

Run from the repo root (build first so cli/mcp see core's new rules):

```bash
pnpm build && CI=true pnpm -r typecheck && CI=true pnpm -r test && CI=true pnpm --filter docs build && pnpm lint && pnpm check:publish
```
Expected: all green. (Run `pnpm format` first if prettier flags the new Markdown; re-run lint. `attw` inside `check:publish` may fail LOCALLY only — known pre-existing local-cache issue, CI-unaffected; if only attw/npm-pack fails and publint passes, treat it as the known issue.) Confirm `pnpm --filter docs build` succeeds with the 12 new rule pages.

- [ ] **Step 3: Commit**

```bash
git add .changeset/seo-head-completeness.md
git commit -m "chore: changeset for SEO010-SEO015 (core + cli + vite + mcp minor)"
```

---

## Self-Review

**Spec coverage:**
- SEO010 noindex (info, flag-on-presence, static-only, surfaced via {none,absent}) → Task 2. ✅
- SEO011 twitter:card (info), SEO012 og:description (warning), SEO013 og:url (info), SEO014 viewport (warning) → Task 2 headTagRule instances. ✅
- SEO015 sitemap-in-robots (info, project rule, fires only when robots+sitemap exist and robotsReferencesSitemap===false) → Task 2. ✅
- `HeadTag.noindex` + `Project.robotsReferencesSitemap` captured in both providers; static-file-only robots read; dynamic content never flagged → Task 1. ✅
- No false negatives (dynamic `content={x}` → noindex unset) → Task 1 (cli `attrText` undefined for dynamic; vite rendered = literal). ✅
- 12 docs pages (en + ja) → Task 2 Step 5 (required by docs-links test). ✅
- core+cli+vite+mcp minor changeset → Task 3. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". Every code step has complete code; the vite project test references the existing tmpdir pattern with a concrete fallback file. All 12 doc pages are written in full.

**Type consistency:** `HeadTag.noindex?: boolean` and `Project.robotsReferencesSitemap?: boolean` (Task 1) are read by `seo010Indexability` and `seo015SitemapInRobots` (Task 2). The six rule export names match across `seo010-015.ts`, `rules/index.ts`, `core/src/index.ts`, the test imports, and the doc slugs (`SEO010`→`seo010`). `headTagRule({match,label,severity,recommendation,rationale,fix})` matches its existing signature; `match` reads `t.kind/name/property`. SEO010/SEO015 findings use `detection: {presence:'none', value:'absent'}` so `isPenalized` surfaces them; SEO010 is route-scoped, SEO015 project-scoped. `defaultProject` imported from `../src/types.js` (exported there).
