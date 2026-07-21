# SEO031 — SSR Disabled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SEO031 — a `warning` SEO rule flagging SvelteKit route files that disable server-side rendering (`export const ssr = false`), the official SEO best-practices doc's headline risk.

**Architecture:** Promote the existing CORRECT008 opt-out detector (`hasSsrFalseOptOut` in `kit-module-parse.ts`) to a line-reporting `findSsrFalseOptOut`, record it as the OPTIONAL fact `KitModuleFacts.ssrDisabled` (no literal churn), and build the rule with the `kitModuleRule` factory after widening its `category` type to `'security' | 'seo'`. Root-layout files get an app-wide message variant.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Astro Starlight docs, Changesets.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-seo031-ssr-disabled-design.md`. Branch: `feat/seo031-ssr-disabled` (exists with the spec commit). Run `git fetch origin` first — rebase onto `origin/main` if it moved past `4dae3da6`.
- Rule identity: `id 'SEO031'`, `title 'SSR disabled'`, `category 'seo'`, `severity 'warning'`, `scope 'component'`; message/recommendation/rationale strings verbatim from spec §2.
- `ssrDisabled` is OPTIONAL on `KitModuleFacts` — absent means SSR on; existing test-helper literals need no changes.
- CORRECT008's opt-out behavior is unchanged (truthiness of the renamed helper) — every existing `ssr = false` opt-out test passes untouched.
- NOT flagged: `csr = false`, `ssr = true`, non-literal values (`ssr = dev`), non-exported `const ssr = false`.
- `packages/core/src`: no `node:` imports, no I/O. en/ja docs together. No suppression-range doc edits exist anymore (removed in PR #240). Changeset: core / `svelte-vitals` / vite / mcp — minor. cli tests need `pnpm --filter @svelte-vitals/core build` first. Root verify: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` (2 pre-existing warnings in `packages/cli/test/meta-object.test.ts` are not yours). Final `chore(action)` dist commit if `pnpm build` changes it. Conventional commits.

---

## File Structure

- Modify: `packages/core/src/kit-module-parse.ts` (`hasSsrFalseOptOut` → `findSsrFalseOptOut` + `ssrDisabled` wiring), `packages/core/src/kit-module.ts` (field) — Task 1.
- Modify: `packages/core/test/kit-module-parse.test.ts` (new describe) — Task 1.
- Create: `packages/core/src/rules/seo/seo031-ssr-disabled.ts`; Modify: `packages/core/src/rules/kit-module-rule.ts` (category type), `packages/core/src/rules/index.ts` (3 spots), `packages/core/src/index.ts` (1 spot), `packages/core/test/security-kit-rules.test.ts` (rule tests — the `kit()` helper lives here) — Task 2.
- Create: `docs/src/content/docs/rules/seo031.md` + `ja/rules/seo031.md`, `.changeset/seo031-ssr-disabled.md` — Task 3.

---

### Task 1: The `ssrDisabled` fact

**Files:**

- Modify: `packages/core/src/kit-module.ts` (after the `browserGlobalRefs` field)
- Modify: `packages/core/src/kit-module-parse.ts` (`hasSsrFalseOptOut` ~line 186; its call site ~line 387; the final return ~line 515)
- Modify: `packages/core/test/kit-module-parse.test.ts` (new describe at end)

**Interfaces:**

- Consumes: existing `unwrapExport`, `unwrapTs`, `collectTopLevelBindings`, `lineOf`, the `wrapped` source and the file's `Math.max(0, l - 1)` shift convention.
- Produces (Task 2 reads it): `KitModuleFacts.ssrDisabled?: { line: number }` — set (with the declaration's unwrapped line) when the file disables SSR via either detection form.

- [ ] **Step 1: Rebase check**

```bash
git switch feat/seo031-ssr-disabled
git fetch origin
git log --oneline origin/main -1   # if not 4dae3da6, run: git rebase origin/main
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/test/kit-module-parse.test.ts`:

```ts
describe('parseKitModuleFacts — ssrDisabled (SEO031)', () => {
  it('records the declaration line for an inline export const ssr = false', () => {
    const src = 'export const prerender = true;\nexport const ssr = false;';
    expect(facts(src, 'src/routes/+page.ts').ssrDisabled).toEqual({ line: 2 });
  });
  it('handles satisfies and the alias-export form', () => {
    expect(facts('export const ssr = false satisfies boolean;', 'src/routes/+page.ts').ssrDisabled).toEqual({
      line: 1
    });
    expect(facts('const ssr = false;\nexport { ssr };', 'src/routes/+page.ts').ssrDisabled).toEqual({ line: 1 });
  });
  it('is absent for csr = false, ssr = true, non-literal, and non-exported forms', () => {
    expect(facts('export const csr = false;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
    expect(facts('export const ssr = true;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
    expect(
      facts("import { dev } from '$app/environment';\nexport const ssr = dev;", 'src/routes/+page.ts').ssrDisabled
    ).toBeUndefined();
    expect(facts('const ssr = false;', 'src/routes/+page.ts').ssrDisabled).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- kit-module-parse`
Expected: FAIL — `ssrDisabled` is always `undefined`.

- [ ] **Step 4: Implement**

1. `packages/core/src/kit-module.ts`, after the `browserGlobalRefs` field:

```ts
/** Set when this file disables SSR via `export const ssr = false` (inline or same-file alias export) — the declaration's line (SEO031). */
ssrDisabled?: { line: number };
```

2. `packages/core/src/kit-module-parse.ts` — replace `hasSsrFalseOptOut` with a line-reporting version (same detection logic; note it now takes the wrapped source to compute the line):

```ts
/**
 * The `export const ssr = false` opt-out, when present: inline form
 * (`satisfies`/`as` unwrapped) or same-file alias export (`const ssr = false;
 * export { ssr };`). Returns the declaration's line in the WRAPPED source (the
 * caller applies the −1 shift). Such a file never runs on the server — CORRECT008
 * skips its browser-global scan, and SEO031 reports the flag itself.
 */
function findSsrFalseOptOut(program: Node, source: string): { line: number } | undefined {
  const isFalse = (init: Node): boolean => {
    const v = unwrapTs(init);
    return v?.type === 'Literal' && v.value === false;
  };
  for (const stmt of program.body ?? []) {
    const decl = unwrapExport(stmt);
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.id.name === 'ssr' && d.init && isFalse(d.init)) {
        if (stmt.type === 'ExportNamedDeclaration') return { line: lineOf(source, d.start) };
      }
    }
  }
  // Alias export: `const ssr = false; export { ssr };`
  const bindings = collectTopLevelBindings(program);
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== 'ExportNamedDeclaration' || !stmt.specifiers || stmt.source || stmt.exportKind === 'type')
      continue;
    for (const s of stmt.specifiers) {
      if (s?.exportKind === 'type' || s?.exported?.type !== 'Identifier' || s?.local?.type !== 'Identifier') continue;
      if (s.exported.name !== 'ssr') continue;
      const resolved = bindings.get(s.local.name);
      if (resolved?.type === 'Literal' && resolved.value === false) return { line: lineOf(source, resolved.start) };
    }
  }
  return undefined;
}
```

3. In `parseKitModuleFacts`: where the browser-global scan currently does `if (!hasSsrFalseOptOut(program)) {`, compute once above it:

```ts
const ssrOptOut = findSsrFalseOptOut(program, wrapped);
```

and change the guard to `if (!ssrOptOut) {`. In the FINAL return object add:

```ts
    ...(ssrOptOut ? { ssrDisabled: { line: Math.max(0, ssrOptOut.line - 1) } } : {})
```

(The early `!program` return needs no change — the field is optional.)

- [ ] **Step 5: Run to verify pass (incl. CORRECT008 regression)**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS — every existing `ssr = false` opt-out test unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): record the ssr=false opt-out as KitModuleFacts.ssrDisabled"
```

---

### Task 2: The SEO031 rule

**Files:**

- Modify: `packages/core/src/rules/kit-module-rule.ts` (the `category` option type, currently line ~18: `category: 'security';`)
- Create: `packages/core/src/rules/seo/seo031-ssr-disabled.ts`
- Modify: `packages/core/src/rules/index.ts` (import after the `seo030HeadingOrder` import ~line 39; `allRules` after ~line 93; re-export after ~line 152), `packages/core/src/index.ts` (after `seo030HeadingOrder,` ~line 94)
- Modify: `packages/core/test/security-kit-rules.test.ts` (new describe — the `kit()` helper lives here)

**Interfaces:**

- Consumes: `KitModuleFacts.ssrDisabled` (Task 1), `kitModuleRule`.
- Produces: exported `seo031SsrDisabled: Rule`.

- [ ] **Step 1: Write the failing rule tests**

In `packages/core/test/security-kit-rules.test.ts`: add `seo031SsrDisabled` to the `../src/index.js` import and append:

```ts
describe('SEO031 SSR disabled', () => {
  it('flags a leaf route with the per-route message as an seo warning', async () => {
    const rs = await seo031SsrDisabled.check(
      ctx([kit({ file: 'src/routes/dash/+page.ts', kind: 'universal', ssrDisabled: { line: 1 } })])
    );
    expect(fails(rs)).toHaveLength(1);
    expect(rs[0]!.severity).toBe('warning');
    expect(rs[0]!.category).toBe('seo');
    expect(rs[0]!.line).toBe(1);
    expect(rs[0]!.message).toContain('this route');
  });
  it('uses the app-wide message for the root layout', async () => {
    const rs = await seo031SsrDisabled.check(
      ctx([kit({ file: 'src/routes/+layout.ts', kind: 'universal', ssrDisabled: { line: 2 } })])
    );
    expect(fails(rs)[0]!.message).toContain('whole app');
  });
  it('emits nothing without the flag, honours suppression, and no-ops in rendered mode', async () => {
    expect(await seo031SsrDisabled.check(ctx([kit({})]))).toHaveLength(0);
    const suppressed = await seo031SsrDisabled.check(
      ctx([kit({ ssrDisabled: { line: 3 }, suppressions: [{ line: 3, ruleIds: ['SEO031'] }] })])
    );
    expect(fails(suppressed)).toHaveLength(0);
    expect(await seo031SsrDisabled.check(base as RuleContext)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- security-kit-rules`
Expected: FAIL — `seo031SsrDisabled` not exported.

- [ ] **Step 3: Widen the factory's category type**

In `packages/core/src/rules/kit-module-rule.ts`, change the option:

```ts
/** Kit-file rules report as Security (SEC003–005) or SEO (SEO031). */
category: 'security' | 'seo';
```

- [ ] **Step 4: Implement the rule**

Create `packages/core/src/rules/seo/seo031-ssr-disabled.ts`:

```ts
import { kitModuleRule } from '../kit-module-rule.js';

/** The root layout — disabling SSR there turns the whole app into an SPA. */
const ROOT_LAYOUT_RE = /^src\/routes\/\+layout(\.server)?\.(ts|js)$/;

export const seo031SsrDisabled = kitModuleRule({
  id: 'SEO031',
  title: 'SSR disabled',
  category: 'seo',
  label: 'SSR enabled',
  recommendation:
    "Keep SSR on for indexable pages; restrict ssr = false to routes that don't need SEO (authenticated dashboards, app-only views). For a deliberate SPA, turn this rule off in the config or add an inline suppression.",
  rationale:
    "SvelteKit's SEO guidance is to leave SSR on unless there is a good reason not to: server-rendered content is indexed more frequently and reliably, and SPA mode costs an extra network round trip before anything renders.",
  applies: (m) => m.ssrDisabled !== undefined,
  bad: (m) => [
    {
      line: m.ssrDisabled!.line,
      message: ROOT_LAYOUT_RE.test(m.file)
        ? 'SSR is disabled for the whole app — search engines index server-rendered content more reliably, and SPA mode adds a network round trip before first paint'
        : "SSR is disabled for this route — its content is invisible to crawlers that don't execute JavaScript and indexes less reliably"
    }
  ]
});
```

- [ ] **Step 5: Register (four sites) and verify**

`packages/core/src/rules/index.ts`: `import { seo031SsrDisabled } from './seo/seo031-ssr-disabled.js';` after the `seo030HeadingOrder` import; `seo031SsrDisabled,` after `seo030HeadingOrder,` in `allRules` and in the re-export block. `packages/core/src/index.ts`: `seo031SsrDisabled,` after `seo030HeadingOrder,`.

Run: `grep -rn "seo031SsrDisabled" packages/core/src`
Expected: 5 hits.

- [ ] **Step 6: Run to verify, then commit**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS (cli `docs-links` fails until Task 3 — expected).

```bash
git add packages/core
git commit -m "feat(core): add SEO031 — flag routes that disable server-side rendering"
```

---

### Task 3: Docs (en/ja), changeset, full verification

**Files:**

- Create: `docs/src/content/docs/rules/seo031.md`, `docs/src/content/docs/ja/rules/seo031.md`, `.changeset/seo031-ssr-disabled.md`

- [ ] **Step 1: Write the English rule page**

Create `docs/src/content/docs/rules/seo031.md`:

````md
---
title: SEO031 · SSR disabled
description: export const ssr = false makes a route's content invisible to non-JS crawlers and slower to first paint.
---

**Severity:** warning · **Category:** seo

## What it checks

Flags SvelteKit route files that disable server-side rendering with `export const ssr = false` (the `satisfies` and same-file alias-export forms included). Disabling it in the root `+layout` — which turns the whole app into an SPA — gets a stronger, app-wide message.

Not flagged: `csr = false` (server-only rendering — fine for SEO), non-literal values like `export const ssr = dev` (not statically evaluable), and non-exported `const ssr = false` (has no effect in SvelteKit).

## Why it matters

SvelteKit's own SEO guidance: server-side rendered content is indexed more frequently and reliably — leave SSR on unless you have a good reason not to. On top of the indexing risk, SPA mode ships an empty page that must fetch and run JavaScript before anything renders, adding a network round trip before first paint.

Note that `prerender = true` does not neutralise this: with `ssr = false` the prerendered output is still an empty shell.

## How to fix

Scope `ssr = false` to routes that genuinely don't need SEO:

```ts
// src/routes/(app)/dashboard/+page.ts — authenticated, not indexable
export const ssr = false; // fine — suppress or turn the rule off if this is deliberate
```

For a deliberate full SPA, disable the rule in your config:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    SEO031: 'off'
  }
};
```

or add `// svelte-vitals-disable-next-line SEO031` above the declaration.
````

- [ ] **Step 2: Write the Japanese rule page**

Create `docs/src/content/docs/ja/rules/seo031.md`:

````md
---
title: SEO031 · SSR の無効化
description: export const ssr = false は、JS を実行しないクローラーからコンテンツを見えなくし、初回描画も遅くします。
---

**重大度:** warning · **カテゴリ:** seo

## チェック内容

`export const ssr = false` でサーバーサイドレンダリングを無効化している SvelteKit のルートファイルを検出します(`satisfies` 形式や同一ファイル内のエイリアス export も対象)。ルートの `+layout` での無効化 — アプリ全体が SPA になる — には、より強いアプリ全体向けのメッセージを出します。

検出対象外: `csr = false`(サーバー専用レンダリング — SEO にはむしろ良い)、`export const ssr = dev` のような非リテラル値(静的に評価不能)、export されていない `const ssr = false`(SvelteKit では効果がない)。

## 重要な理由

SvelteKit 公式の SEO ガイダンスいわく: サーバーレンダリングされたコンテンツはより頻繁に・確実にインデックスされる — 正当な理由がない限り SSR は有効のままにすべきです。インデックスのリスクに加えて、SPA モードは空のページを配信して JavaScript の取得・実行を待つため、何かが描画されるまでにネットワークラウンドトリップが1回増えます。

`prerender = true` を併用してもこの問題は解消されません: `ssr = false` では事前レンダリングの出力も空のシェルになります。

## 修正方法

`ssr = false` は SEO が本当に不要なルートに限定します:

```ts
// src/routes/(app)/dashboard/+page.ts — 認証必須、インデックス不要
export const ssr = false; // これが意図的なら suppression するかルールを off に
```

意図的な完全 SPA の場合は、config でルールを無効化します:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    SEO031: 'off'
  }
};
```

または宣言の直前に `// svelte-vitals-disable-next-line SEO031` を書いてください。
````

- [ ] **Step 3: Verify docs-links, add the changeset**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals test -- docs-links`
Expected: PASS.

Create `.changeset/seo031-ssr-disabled.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Add SEO031 (warning): flag SvelteKit route files that disable server-side rendering with `export const ssr = false` — per the official SEO guidance, server-rendered content indexes more reliably, and SPA mode adds a round trip before first paint. The root-layout (app-wide) case gets a dedicated message; deliberate SPAs can turn the rule off or suppress inline.
```

- [ ] **Step 4: Full verification and commits**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

All green (`pnpm format` + fold in if formatting-only failure).

```bash
git add docs/src/content/docs .changeset
git commit -m "docs: add SEO031 rule reference (en/ja) and changeset"
git add packages/action/dist/index.js
git commit -m "chore(action): rebuild dist/ with the SEO031 core changes"
```

(Skip the second commit if no dist change.)

---

## Done criteria

- `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green from the repo root.
- `grep -rn "seo031SsrDisabled" packages/core/src` → 5 hits.
- Every existing CORRECT008 `ssr = false` opt-out test passes unchanged.
- Manual smoke: a fixture `+page.ts` with `export const ssr = false` reports a warning SEO031 at the declaration line; the root-layout fixture gets the app-wide message.
- PR body in English.
