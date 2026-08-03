# architecture/doc-link-target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report a documentation link written in a component comment whose target no longer exists, which
no other check in the toolchain can see.

**Architecture:** `parseComponentFacts` gains a line-oriented scan that records Markdown links found inside
comments (`ComponentFacts.commentLinks`) — no new I/O, since the parser already holds the source. A
`componentRule` strips a declared URL prefix from each link and reports the ones whose remainder names
neither a file nor a directory in `ctx.sourceFiles`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, oxlint + oxfmt, Astro Starlight docs.

**Spec:** `docs/superpowers/specs/2026-08-03-doc-link-target-design.md` — read it before Task 1. It was
field-checked against a real monorepo and several of its decisions look arbitrary until you have.

> **Executed 2026-08-03; superseded in two respects.** This file is the historical plan, kept as written.
> Review found `commentLinks` still optional, which let an unwired parse path pass 1163 tests while
> emitting no findings; it shipped **required** on `ComponentFacts` instead, with `emptyComponentFacts`
> covering it and no `?? []` fallback in the rule. And the three-step resolution below grew two steps in
> response to measured false positives: a `#fragment`/`?query` is stripped before matching a root, and a
> remainder outside `src/` is silent rather than reported. Read the design doc's Resolution section and
> `packages/core/test/doc-link-target.test.ts` for the current contract.

## Global Constraints

- **Directory matching is a precondition, not an enhancement.** `ctx.sourceFiles` lists **files**, so a
  directory never appears as an entry. All 114 measured targets are directories and **none is a file**. A
  resolver that checks only for a file reports every real-world reference as broken. Implement the
  directory test first; file matching is for the case measurement did not find.
- **Longest declared prefix wins**, not the first match. `string-list` appends, so one entry can be a
  prefix of another; first-match-wins would make the answer depend on declaration order, and a shorter
  strip that happens to leave an existing path swallows a broken reference silently. This is deliberately
  the opposite of the alias resolver's first-match rule — that one reproduces a bundler, this list is ours.
- **A URL matching no declared prefix is ignored entirely.** That is the precision gate: an external link,
  a documentation slug, a `mailto:` and a URL with no path are all silent because they were never claimed
  as references. Never decide by the shape of the target — measurement showed slugs and legitimate
  directory references are shape-identical.
- **Inert until declared.** `urlRoots` defaults to empty; with nothing declared the rule reports nothing.
- **Do not scan by splitting on `//`.** It fires inside `https://`. Follow `collectSuppressions`'s
  approach: match anchored patterns, never hunt for a comment opener mid-line.
- `packages/core/src/` must contain no `node:` imports, no I/O, and no runtime-specific globals.
- **Comments earn their place only when they say something the code cannot** (`AGENTS.md`): a constraint, a
  rejected alternative, a non-local dependency. Prefer one line over three.
- **Registering a rule touches four places**, and TypeScript catches only three: the import, the `allRules`
  array and the re-export block in `packages/core/src/rules/index.ts`, plus the duplicated
  `export { … } from './rules/index.js'` list in `packages/core/src/index.ts`.
- **Rule docs are load-bearing:** `packages/cli/test/docs-links.test.ts` fails if either language's page is
  missing; `packages/cli/test/rules-index.test.mjs` fails if the generated index is stale.
- **en/ja docs ship together**; write real, idiomatic Japanese. Never hard-code rule counts in docs.
- **Never name other tools** (linters, plugins, competing products) in code, docs, or commits.
- **A changeset is required, and `feat` takes `minor`** in this repo, naming every package that ships it.
- **Verify commands:** per-package `node_modules/.bin/{vitest,tsc,oxlint,oxfmt}`. Rebuild `packages/core`
  with `tsup` and typecheck **core, cli and vite separately** — a text search for a changed type's name is
  not a substitute, as an earlier branch learned. (`packages/mcp` has no `tsconfig.json`; skip it.) A
  full-workspace `pnpm` command fails in this sandbox for a pre-existing reason unrelated to this work.
- **Conventional commits, scoped by package:** `feat(core):`, `docs:`.

## File Structure

| File                                                                  | Responsibility                                     | Task |
| --------------------------------------------------------------------- | -------------------------------------------------- | ---- |
| `packages/core/src/component.ts`                                      | the `commentLinks` field                           | 1    |
| `packages/core/src/component-parse.ts`                                | `collectCommentLinks`, wired into both parse paths | 1    |
| `packages/core/src/rules/architecture/doc-link-target.ts`             | the rule                                           | 2    |
| `packages/core/src/rules/index.ts`, `packages/core/src/index.ts`      | the four registration sites                        | 3    |
| `docs/src/content/docs/rules/architecture/doc-link-target.md` + `ja/` | rule pages                                         | 3    |
| `.changeset/doc-link-target.md`                                       | release note                                       | 3    |

Tests: `packages/core/test/component-parse.test.ts` (Task 1),
`packages/core/test/doc-link-target.test.ts` (new, Task 2), and the two CLI doc gates (Task 3).

---

### Task 1: `commentLinks` — Markdown links found inside comments

**Files:**

- Modify: `packages/core/src/component.ts` (add the field beside `suppressions`)
- Modify: `packages/core/src/component-parse.ts` (add `collectCommentLinks`; wire it into
  `parseComponentFacts` and `parseModuleFacts`)
- Test: `packages/core/test/component-parse.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `ComponentFacts.commentLinks?: { url: string; line: number }[]` — every Markdown link
  `[label](url)` appearing inside a comment, with its 1-based line. Task 2 reads it.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/component-parse.test.ts`:

```ts
describe('parseComponentFacts — links inside comments', () => {
  const links = (src: string) => parseComponentFacts(src, 'src/lib/A/A.svelte').commentLinks;

  it('finds a link in a markup comment', () => {
    expect(links(`<!-- see [guide](https://x.test/a/b) -->\n<p>hi</p>`)).toEqual([
      { url: 'https://x.test/a/b', line: 1 }
    ]);
  });

  it('finds a link in a markup comment spanning lines', () => {
    const src = ['<!--', '  see [guide](https://x.test/a/b)', '-->'].join('\n');
    expect(links(src)).toEqual([{ url: 'https://x.test/a/b', line: 2 }]);
  });

  it('finds a link in a script line comment', () => {
    expect(links(`<script>\n  // see [guide](https://x.test/a/b)\n</script>`)).toEqual([
      { url: 'https://x.test/a/b', line: 2 }
    ]);
  });

  it('ignores a link in rendered markup', () => {
    // Not a reference to a repository path — it is content.
    expect(links(`<p>see [guide](https://x.test/a/b)</p>`)).toEqual([]);
  });

  it('is not fooled by the // inside a URL', () => {
    // A scan that treated `//` as a comment opener would read the rest of this line as a comment.
    expect(links(`<script>\n  const u = 'https://x.test/[a](b)';\n</script>`)).toEqual([]);
  });

  it('finds every link on one line', () => {
    expect(links(`<!-- [a](https://x.test/1) and [b](https://x.test/2) -->`)).toEqual([
      { url: 'https://x.test/1', line: 1 },
      { url: 'https://x.test/2', line: 1 }
    ]);
  });

  it('records nothing for a component with no comments', () => {
    expect(links(`<p>hi</p>`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `../../node_modules/.bin/vitest run component-parse`
Expected: FAIL — `commentLinks` is undefined, so every case mismatches.

- [ ] **Step 3: Add the field**

In `packages/core/src/component.ts`, beside `suppressions`:

```ts
  /** Markdown links `[label](url)` appearing inside a comment (architecture/doc-link-target). */
  commentLinks?: { url: string; line: number }[];
```

- [ ] **Step 4: Implement the scan**

In `packages/core/src/component-parse.ts`, beside `collectSuppressions`:

```ts
const MD_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/**
 * Markdown links inside comments. A plain text scan, like `collectSuppressions` — a link in a comment is
 * not an AST node. `//` counts as a comment opener only at the start of a line, which is what keeps the
 * scan off the `//` in `https://`; a trailing `// [x](y)` is therefore missed, and measurement found no
 * such link, so the cost is a case that does not occur rather than one this rule needs.
 */
export function collectCommentLinks(source: string): { url: string; line: number }[] {
  const out: { url: string; line: number }[] = [];
  let open = false; // inside a multi-line <!-- … -->
  source.split('\n').forEach((line, i) => {
    let text = '';
    let rest = line;
    while (rest.length > 0) {
      if (open) {
        const end = rest.indexOf('-->');
        if (end === -1) {
          text += rest;
          break;
        }
        text += rest.slice(0, end);
        open = false;
        rest = rest.slice(end + 3);
        continue;
      }
      const start = rest.indexOf('<!--');
      if (start === -1) break;
      open = true;
      rest = rest.slice(start + 4);
    }
    if (text === '' && /^\s*\/\//.test(line)) text = line.replace(/^\s*\/\//, '');
    for (const m of text.matchAll(MD_LINK)) {
      if (m[1] !== undefined) out.push({ url: m[1], line: i + 1 });
    }
  });
  return out;
}
```

- [ ] **Step 5: Wire it into both parse paths**

`parseComponentFacts` and `parseModuleFacts` both build a facts object. Add
`commentLinks: collectCommentLinks(source)` to each, beside the existing `suppressions:
collectSuppressions(source)`. Grep for `collectSuppressions(source)` to find both sites — a `.svelte.ts`
module can carry the same comment, and a rule that silently ignored those would be a surprise.

- [ ] **Step 6: Run the tests**

Run: from `packages/core`, `../../node_modules/.bin/vitest run component-parse`
Expected: PASS, with the file's pre-existing cases unaffected.

- [ ] **Step 7: Prove the `//` guard is load-bearing**

Change `if (text === '' && /^\s*\/\//.test(line))` to `if (text === '' && line.includes('//'))` and re-run.
Expected: the "not fooled by the `//` inside a URL" test FAILS. Restore and re-run to confirm it passes.

- [ ] **Step 8: Verify across packages, then commit**

```bash
cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsup
cd ../cli && ../../node_modules/.bin/vitest run
cd ../vite && ../../node_modules/.bin/vitest run
cd ../.. && for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json) || echo "FAIL $p"; done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/core
git commit -m "feat(core): record Markdown links found inside component comments"
```

The field is optional, so no fixture that constructs `ComponentFacts` should break. The cross-package
typecheck is what proves that rather than assuming it.

---

### Task 2: the rule

**Files:**

- Create: `packages/core/src/rules/architecture/doc-link-target.ts`
- Test: `packages/core/test/doc-link-target.test.ts`

**Interfaces:**

- Consumes: `ComponentFacts.commentLinks` (Task 1); `ctx.sourceFiles?: string[]`;
  `componentRule` from `../component-rule.js`, whose `applies`/`bad` receive `(c, o, ctx)`;
  `listOption(options, key): string[]` from `../../rule-options.js`.
- Produces: `architectureDocLinkTarget`, a `Rule`. Task 3 registers it.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/doc-link-target.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { architectureDocLinkTarget } from '../src/rules/architecture/doc-link-target.js';
import { defineConfig, defaultProject } from '../src/types.js';
import type { ComponentFacts } from '../src/component.js';
import type { RuleContext } from '../src/rule.js';
import type { Result } from '../src/types.js';

const ROOT = 'https://x.test/c/pkg/ui/';
const fails = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
const passes = (rs: Result[]) => rs.filter((r) => r.detection.presence === 'own');

const comp = (links: ComponentFacts['commentLinks']): ComponentFacts =>
  ({ file: 'src/lib/A/A.svelte', commentLinks: links, suppressions: [] }) as unknown as ComponentFacts;

const ctx = (links: ComponentFacts['commentLinks'], sourceFiles: string[], roots: string[]): RuleContext =>
  ({
    heads: [],
    project: defaultProject,
    components: [comp(links)],
    sourceFiles,
    config: defineConfig(
      roots.length ? { rules: { 'architecture/doc-link-target': { options: { urlRoots: roots } } } } : {}
    )
  }) as RuleContext;

describe('architecture/doc-link-target', () => {
  it('reports a declared-prefix link whose target does not exist', async () => {
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Gone`, line: 4 }], ['src/lib/A/A.svelte'], [ROOT])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(fails(rs)[0]!.line).toBe(4);
    expect(fails(rs)[0]!.route).toBe('src/lib/A/A.svelte');
  });

  it('emits nothing when no urlRoots is declared', async () => {
    // The L3 guarantee: inert until the project declares its own prefix.
    expect(await architectureDocLinkTarget.check(ctx([{ url: `${ROOT}src/lib/Gone`, line: 4 }], [], []))).toEqual([]);
  });

  it('is silent when the target is a directory, which is how every measured reference resolves', async () => {
    // `sourceFiles` lists files only, so a directory exists iff some entry sits under it.
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Card`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT])
    );
    expect(fails(rs)).toEqual([]);
    expect(passes(rs)).toHaveLength(1);
  });

  it('is silent when the target is a file', async () => {
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${ROOT}src/lib/Card/Card.svelte`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT])
    );
    expect(fails(rs)).toEqual([]);
  });

  it('ignores a URL under no declared prefix', async () => {
    // An external host, a slug with no slash, and a URL with no path — all measured, none may report.
    const rs = await architectureDocLinkTarget.check(
      ctx(
        [
          { url: 'https://other.test/a/b', line: 1 },
          { url: 'guide', line: 2 },
          { url: 'https://x.test', line: 3 }
        ],
        ['src/lib/A/A.svelte'],
        [ROOT]
      )
    );
    expect(rs).toEqual([]);
  });

  it('takes the longest matching prefix, whatever order they are declared in', async () => {
    // Under first-match-wins the short root strips less, leaving `pkg/ui/src/lib/Card` — which is not a
    // project-relative path, so a real reference would be reported as broken.
    const short = 'https://x.test/c/';
    const files = ['src/lib/Card/Card.svelte'];
    const link = [{ url: `${ROOT}src/lib/Card`, line: 1 }];
    for (const roots of [
      [short, ROOT],
      [ROOT, short]
    ]) {
      expect(fails(await architectureDocLinkTarget.check(ctx(link, files, roots))), roots.join()).toEqual([]);
    }
  });

  it('resolves the same reference under a second declared root', async () => {
    const staging = 'https://staging.test/c/pkg/ui/';
    const rs = await architectureDocLinkTarget.check(
      ctx([{ url: `${staging}src/lib/Gone`, line: 1 }], ['src/lib/Card/Card.svelte'], [ROOT, staging])
    );
    expect(fails(rs)).toHaveLength(1);
  });

  it('emits nothing for a component whose comments hold no declared-prefix link', async () => {
    expect(await architectureDocLinkTarget.check(ctx([], ['src/lib/A/A.svelte'], [ROOT]))).toEqual([]);
  });

  it('emits nothing when no file inventory was collected', async () => {
    // `sourceFiles` is optional and absent in rendered (plugin) mode. Without the guard every reference
    // would look broken there, because an empty inventory contains no target.
    const bare = {
      heads: [],
      project: defaultProject,
      components: [comp([{ url: `${ROOT}src/lib/Card`, line: 1 }])],
      config: defineConfig({ rules: { 'architecture/doc-link-target': { options: { urlRoots: [ROOT] } } } })
    } as RuleContext;
    expect(await architectureDocLinkTarget.check(bare)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: from `packages/core`, `../../node_modules/.bin/vitest run doc-link-target`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the rule**

Create `packages/core/src/rules/architecture/doc-link-target.ts`:

```ts
import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';

const ID = 'architecture/doc-link-target';

/** The declared prefix this URL sits under, longest first so a nested root cannot be shadowed. */
function rootFor(url: string, roots: string[]): string | undefined {
  let best: string | undefined;
  for (const r of roots) {
    if (url.startsWith(r) && (best === undefined || r.length > best.length)) best = r;
  }
  return best;
}

/** `sourceFiles` lists files, so a directory exists exactly when some entry sits under it. */
function targetExists(path: string, sourceFiles: readonly string[]): boolean {
  const prefix = `${path}/`;
  return sourceFiles.some((f) => f === path || f.startsWith(prefix));
}

/** The declared-prefix links in this component, paired with their project-relative target. */
function references(links: { url: string; line: number }[], roots: string[]): { line: number; target: string }[] {
  const out: { line: number; target: string }[] = [];
  for (const { url, line } of links) {
    const root = rootFor(url, roots);
    // No declared root — not claimed as a reference. This is the precision gate: shape never decides.
    if (root === undefined) continue;
    out.push({ line, target: url.slice(root.length) });
  }
  return out;
}

export const architectureDocLinkTarget = componentRule({
  id: ID,
  title: 'Documentation link target',
  category: 'architecture',
  severity: 'info',
  label: 'Documentation link targets',
  options: { urlRoots: { kind: 'string-list', default: [] } },
  recommendation:
    'Point the link at the unit that exists now, or remove it. A link inside a comment has nothing to resolve it, so a rename leaves it silently broken.',
  rationale:
    'A documentation link written in a comment is invisible to type checking, module resolution and the test runner, so a convention-driven rename leaves it pointing at nothing and only human review notices.',
  applies: (c, o, ctx) =>
    ctx.sourceFiles !== undefined && references(c.commentLinks ?? [], listOption(o, 'urlRoots')).length > 0,
  bad: (c, o, ctx) =>
    references(c.commentLinks ?? [], listOption(o, 'urlRoots'))
      .filter(({ target }) => !targetExists(target, ctx.sourceFiles ?? []))
      .map(({ line, target }) => ({ line, message: `${target} does not exist` }))
});
```

- [ ] **Step 4: Run the tests**

Run: from `packages/core`, `../../node_modules/.bin/vitest run doc-link-target`
Expected: PASS.

- [ ] **Step 5: Prove three mechanisms are load-bearing**

Each mutation must break a test; restore after each.

1. In `targetExists`, drop the `f.startsWith(prefix)` clause (file matching only).
   Expected: the directory test FAILS. This is the mutation that matters most — the spec records that a
   file-only resolver reports every measured reference as broken.
2. In `rootFor`, return the first match instead of the longest.
   Expected: the longest-prefix test FAILS for one of the two declaration orders.
3. Delete the `if (root === undefined) continue;` guard.
   Expected: the unmatched-URL test FAILS.

- [ ] **Step 6: Verify and commit**

```bash
cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json
cd ../.. && node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
git add packages/core
git commit -m "feat(core): add architecture/doc-link-target"
```

Do **not** register the rule here — Task 3 does that together with the docs pages
`packages/cli/test/docs-links.test.ts` requires, and registering early makes that test fail.

---

### Task 3: register, document, release

**Files:**

- Modify: `packages/core/src/rules/index.ts` (three sites), `packages/core/src/index.ts` (one site)
- Create: `docs/src/content/docs/rules/architecture/doc-link-target.md` and its `ja/` counterpart
- Modify: `docs/src/content/docs/rules/**/index.mdx` (regenerated, never hand-edited)
- Create: `.changeset/doc-link-target.md`

**Interfaces:**

- Consumes: `architectureDocLinkTarget` from
  `packages/core/src/rules/architecture/doc-link-target.js` (Task 2).
- Produces: nothing.

- [ ] **Step 1: Register in all four places**

Grep for `architectureRouteComponentImport` — the most recently added rule occupies the same four sites.
Add `architectureDocLinkTarget` beside it in each: the import, the `allRules` array and the re-export block
in `packages/core/src/rules/index.ts`, and the `export { … } from './rules/index.js'` list in
`packages/core/src/index.ts`. **TypeScript will not catch a miss in the fourth**, so verify:

```bash
grep -rn "architectureDocLinkTarget" packages/core/src/ | grep -v "rules/architecture/doc-link-target.ts"
```

Expected: four lines.

- [ ] **Step 2: Write the English rule page**

Create `docs/src/content/docs/rules/architecture/doc-link-target.md`, matching the structure of
`docs/src/content/docs/rules/architecture/private-scope-import.md`:

````md
---
title: architecture/doc-link-target · Documentation link target
description: A documentation link written in a comment must still point at something that exists.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a Markdown link inside a component comment whose target no longer exists — when that link's URL sits
under a prefix you have declared as standing for your project root.

This rule is **off until you configure it**: it cannot guess which URLs on the internet correspond to paths
in your repository.

## Why it matters

A link written in a comment has nothing to resolve it. No type refers to it, no module imports it, and no
test renders it, so a rename that moves its target leaves it silently broken — reachable only by clicking
it. A reorganisation that renames many units can break every such link at once.

## How to fix

Point the link at the unit that exists now, or remove it.

## Configuration

| Option     | Type          | Default |
| ---------- | ------------- | ------- |
| `urlRoots` | `string-list` | `[]`    |

Each entry is a **URL prefix that stands for this project's root**. A link whose URL starts with one has
that prefix stripped, and the remainder is looked up among the files under `src/`.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/doc-link-target': {
      options: { urlRoots: ['https://example.test/components/packages/ui/'] }
    }
  }
};
```

Declare the whole prefix, including any workspace directories your published URL happens to contain — that
part varies with your publishing scheme, so it cannot be derived from where the analysis runs.

The longest matching entry wins, so a broad prefix and a narrower one can coexist. Entries **add** to the
list rather than replacing it, which is how a project reachable under a second host (a staging deployment,
say) declares both.

## Not reported

- A URL under no declared prefix — an external link, a documentation slug, a `mailto:`. The declaration is
  what makes something a reference; the shape of the target never is.
- A link outside a comment. Rendered markup is content.
- A relative link, or a link in a `.md` file. This rule reads component comments only.
- A trailing `// [label](url)` comment on a line of code. `//` counts as a comment opener only at the start
  of a line, which is what keeps the scan out of the `//` in `https://`.
````

- [ ] **Step 3: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/architecture/doc-link-target.md` with the same structure and the
same claims, in idiomatic Japanese. Match the tone and headings of
`docs/src/content/docs/ja/rules/architecture/private-scope-import.md`. Keep code blocks, option names and
rule ids in their original form.

- [ ] **Step 4: Regenerate the rule index pages**

```bash
cd packages/core && ../../node_modules/.bin/tsup
cd ../.. && node packages/cli/scripts/gen-rules-index.mjs
node_modules/.bin/oxfmt --write docs
```

Never hand-edit the generated `index.mdx` files. (`pnpm --filter svelte-vitals run gen:rules-index` wraps
these two steps but fails in this sandbox on the workspace-level install.)

- [ ] **Step 5: Add the changeset**

Create `.changeset/doc-link-target.md`. `feat` takes `minor` in this repo, and every package that ships the
rule is named:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `architecture/doc-link-target`, which reports a documentation link inside a component comment whose
target no longer exists.

Such a link has nothing to resolve it — no type refers to it, no module imports it, no test renders it — so
a rename leaves it silently broken and only human review notices. A reorganisation that renames many units
can break every one of them at once.

**Off until configured.** Declare `urlRoots` with the URL prefixes that stand for your project's root; a
link under one of them has that prefix stripped and the remainder looked up among the files under `src/`. A
URL under no declared prefix is ignored, which is what keeps external links and documentation slugs out of
the results.
```

- [ ] **Step 6: Run every gate**

```bash
cd packages/core && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsup
cd ../cli && ../../node_modules/.bin/vitest run
cd ../vite && ../../node_modules/.bin/vitest run
cd ../.. && for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json) || echo "FAIL $p"; done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: PASS throughout, **including** `packages/cli/test/docs-links.test.ts` (both language pages exist)
and `packages/cli/test/rules-index.test.mjs` (the generated index is current). If either fails, fix the
docs or regenerate — do not edit those tests.

The docs site build cannot run in this sandbox; check the two new pages' frontmatter and MDX by eye and say
in your report that the build was not run — CI's `docs` job is the gate.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src docs .changeset
git commit -m "feat(core): register and document architecture/doc-link-target"
```

---

## Self-Review

**Spec coverage.** The declaration and its `string-list` kind → Task 2's `options`. Longest-prefix-wins →
`rootFor`, pinned by Task 2 Step 5's second mutation. The `commentLinks` fact and its line-oriented scan →
Task 1. Directory-or-file resolution → `targetExists`, with the directory case first in both the tests and
the mutation list. The precision gate → the `root === undefined` guard and the unmatched-URL test. Both
comment forms → Task 1's tests. The `//` hazard → Task 1's guard, Step 7's mutation, and a "Not reported"
bullet. The spec's seven test items all appear; item 5 (a second root not displacing the first) is Task 2's
staging-host test.

**One deliberate addition, now pinned.** `applies` requires `ctx.sourceFiles !== undefined`. The spec does
not mention it because it is not a design decision, but the field is optional on `RuleContext` — it is
`undefined` in rendered (plugin) mode, where no file inventory is collected, and without the guard every
reference would look broken there. Task 2's `ctx` helper always supplies it, so the first draft of this plan
left the guard asserted only indirectly; Task 2 now carries a test that builds a context without the field.

**A fourth mutation worth running if the reviewer wants it**, beyond Task 2 Step 5's three: delete the
`ctx.sourceFiles !== undefined` clause and confirm the rendered-mode test fails. It is listed here rather
than in the steps because the three in Step 5 cover the spec's own claims and this one covers a harness
property.

**Type consistency.** `commentLinks` is `{ url: string; line: number }[]` in the fact, the collector's
return, and both rule helpers. `urlRoots` is the option name in the rule, the tests, the docs and the
changeset. `architectureDocLinkTarget` is the exported name in Task 2 and all four Task 3 sites.
