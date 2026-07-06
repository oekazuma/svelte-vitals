# svelte-meta-tags (MetaTags / JsonLd) 検出修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** static モード（CLI）で `svelte-meta-tags` の `MetaTags` / `JsonLd` が出力するタグ（og:description / og:url / twitter:card / JSON-LD）を検出し、SEO008/011/012/013 の false positive を解消する。

**Architecture:** adapter に `openGraph`/`twitter` のインラインオブジェクトリテラル解析を追加（共通ヘルパー化、svelte-meta-tags と svelte-seo で共有）。静的に読めない場合は `broad` 判定にフォールバックし、拡張した `BROAD_KINDS`（og:description / og:url / twitter:card を追加）でカバー。`JsonLd` 用の新規 adapter を追加して JSON-LD を検出する。

**Tech Stack:** TypeScript, Svelte compiler AST (`svelte/compiler`), vitest, pnpm workspace。

Spec: `docs/superpowers/specs/2026-07-06-smt-metatags-jsonld-detection-design.md`
Issue: https://github.com/oekazuma/svelte-vitals/issues/91

## Global Constraints

- **変更範囲は `packages/cli` のみ**。ルール本体（SEO008/011/012/013）は `packages/core` にあるが変更しない。
- **Core purity**（#119 で eslint 強制）: `packages/core` に `node:` import / I/O を追加しない。本プランは core を触らないため該当なし。
- **Conventional commits**、パッケージスコープ付き: `fix(cli): ...` / `test(cli): ...`。
- **Changeset 必須**: user-facing なバグ修正のため `pnpm changeset`（`svelte-vitals`: patch）。
- **Verify（完了前に必須）**: `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm lint` が pass すること。
- AST ノードは既存パターンに合わせ `type Node = any;` ＋ ファイル先頭に `/* eslint-disable @typescript-eslint/no-explicit-any */`。
- テストは vitest、`packages/cli/test/`。テスト実行は `pnpm --filter svelte-vitals test`（または `pnpm -r test`）。

---

### Task 1: 共通メタオブジェクト解析ヘルパー

`openGraph` / `twitter` のインラインオブジェクトリテラルからキーを列挙し、対応する head タグを emit するヘルパーを新設する。両 adapter がこれを共有する。

**Files:**

- Create: `packages/cli/src/providers/source/adapters/meta-object.ts`
- Test: `packages/cli/test/meta-object.test.ts`

**Interfaces:**

- Consumes: `ParsedTag`（`../parse.js`）, `Value`（`@svelte-vitals/core`）
- Produces:
  - `exprValue(node: Node): Value` — ESTree 式ノードの値種別（文字列リテラル非空→`'static'`、他リテラル→`'static'`、`Identifier`/`Member`/`Array`/`Object` 等→`'dynamic'`、null→`'absent'`）
  - `resolveMetaObject(attr: Node | undefined, keyMap: Record<string, (value: Value) => ParsedTag>): { tags: ParsedTag[]; opaque: boolean }` — attr が無ければ `{tags:[], opaque:false}`、インラインオブジェクトリテラルなら各キーを `keyMap` で変換、リテラルでない（変数渡し等）なら `{tags:[], opaque:true}`、オブジェクト内 spread があれば `opaque:true`
  - `OPEN_GRAPH_KEYS: Record<string, (value: Value) => ParsedTag>` — title→og:title, description→og:description, url→og:url, images→og:image, type→og:type
  - `TWITTER_KEYS: Record<string, (value: Value) => ParsedTag>` — cardType→twitter:card, card→twitter:card

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/test/meta-object.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import {
  exprValue,
  resolveMetaObject,
  OPEN_GRAPH_KEYS,
  TWITTER_KEYS
} from '../src/providers/source/adapters/meta-object.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attrOf(tag: string, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ast = parse(`<script></script>${tag}`, { modern: true, filename: 'x.svelte' }) as any;
  const component = ast.fragment.nodes.find((n: any) => n.type === 'Component');
  return component.attributes.find((a: any) => a.type === 'Attribute' && a.name === name);
}

describe('resolveMetaObject', () => {
  it('emits og:url / og:description tags from an inline openGraph literal', () => {
    const attr = attrOf('<MetaTags openGraph={{ type: "website", url: SITE, description: "d" }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:description', value: 'static' });
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:type', value: 'static' });
  });

  it('does NOT emit a tag for a key the literal omits (precise)', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: SITE }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.tags.some((t) => t.kind === 'meta' && t.property === 'og:image')).toBe(false);
  });

  it('marks opaque when openGraph is a variable (not an inline literal)', () => {
    const attr = attrOf('<MetaTags openGraph={cfg} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(true);
    expect(r.tags).toHaveLength(0);
  });

  it('marks opaque when the object literal contains a spread', () => {
    const attr = attrOf('<MetaTags openGraph={{ ...defaults, url: SITE }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(true);
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
  });

  it('returns nothing (not opaque) when the prop is absent', () => {
    const r = resolveMetaObject(undefined, OPEN_GRAPH_KEYS);
    expect(r).toEqual({ tags: [], opaque: false });
  });

  it('maps twitter cardType and card to twitter:card', () => {
    const smt = resolveMetaObject(attrOf('<MetaTags twitter={{ cardType: "summary" }} />', 'twitter'), TWITTER_KEYS);
    expect(smt.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
    const seo = resolveMetaObject(attrOf('<Seo twitter={{ card: "summary" }} />', 'twitter'), TWITTER_KEYS);
    expect(seo.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
  });
});

describe('exprValue', () => {
  it('classifies a non-empty string literal as static', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: "https://x" }} />', 'openGraph');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (attr.value.expression.properties as any[])[0];
    expect(exprValue(prop.value)).toBe('static');
  });

  it('classifies an identifier as dynamic', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: SITE }} />', 'openGraph');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (attr.value.expression.properties as any[])[0];
    expect(exprValue(prop.value)).toBe('dynamic');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/meta-object.test.ts`
Expected: FAIL（`meta-object.js` が存在しない / import エラー）

- [ ] **Step 3: ヘルパーを実装**

`packages/cli/src/providers/source/adapters/meta-object.ts`:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Value } from '@svelte-vitals/core';
import type { ParsedTag } from '../parse.js';

type Node = any;

/** Value kind of an ESTree expression used as a prop or object-property value. */
export function exprValue(node: Node): Value {
  if (!node) return 'absent';
  if (node.type === 'Literal') {
    // A non-empty string literal is a concrete static value; other literals
    // (number/boolean) are static-present too. An empty string is absent.
    if (typeof node.value === 'string') return node.value.trim().length > 0 ? 'static' : 'absent';
    return 'static';
  }
  // Identifier / MemberExpression / TemplateLiteral / ArrayExpression / ObjectExpression / CallExpression …
  return 'dynamic';
}

export interface MetaObjectResult {
  /** Tags derived from the inline object literal's keys. */
  tags: ParsedTag[];
  /**
   * True when the prop is present but not fully readable as an inline literal
   * (a variable, or an object with a spread) — the caller should fall back to
   * broad coverage. False when absent or fully enumerated.
   */
  opaque: boolean;
}

/**
 * Introspect an inline object-literal prop (`openGraph` / `twitter`). Each known
 * key is mapped to a ParsedTag via `keyMap`. A non-literal prop (`openGraph={cfg}`)
 * or an object with a spread (`{...d, url}`) can't be fully enumerated, so it is
 * reported opaque for the caller to broaden.
 */
export function resolveMetaObject(
  attr: Node | undefined,
  keyMap: Record<string, (value: Value) => ParsedTag>
): MetaObjectResult {
  if (!attr) return { tags: [], opaque: false };
  const expr = attr.value?.type === 'ExpressionTag' ? attr.value.expression : undefined;
  if (!expr || expr.type !== 'ObjectExpression') return { tags: [], opaque: true };

  const tags: ParsedTag[] = [];
  let opaque = false;
  for (const prop of expr.properties ?? []) {
    if (prop?.type !== 'Property') {
      opaque = true; // SpreadElement — unknown extra keys
      continue;
    }
    const key = prop.key?.name ?? prop.key?.value;
    const make = typeof key === 'string' ? keyMap[key] : undefined;
    if (make) tags.push(make(exprValue(prop.value)));
  }
  return { tags, opaque };
}

/** openGraph keys → tags. Shared by svelte-meta-tags and svelte-seo (both mirror OG names). */
export const OPEN_GRAPH_KEYS: Record<string, (value: Value) => ParsedTag> = {
  title: (value) => ({ kind: 'meta', property: 'og:title', value }),
  description: (value) => ({ kind: 'meta', property: 'og:description', value }),
  url: (value) => ({ kind: 'meta', property: 'og:url', value }),
  images: (value) => ({ kind: 'meta', property: 'og:image', value }),
  type: (value) => ({ kind: 'meta', property: 'og:type', value })
};

/** twitter keys → twitter:card. svelte-meta-tags uses `cardType`; svelte-seo uses `card`. */
export const TWITTER_KEYS: Record<string, (value: Value) => ParsedTag> = {
  cardType: (value) => ({ kind: 'meta', name: 'twitter:card', value }),
  card: (value) => ({ kind: 'meta', name: 'twitter:card', value })
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/meta-object.test.ts`
Expected: PASS（全 8 ケース）

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/providers/source/adapters/meta-object.ts packages/cli/test/meta-object.test.ts
git commit -m "feat(cli): add shared openGraph/twitter object-literal introspection helper"
```

---

### Task 2: svelte-meta-tags adapter を配線

`MetaTags` の `openGraph` / `twitter` をヘルパーで解析し、`broad` を精密化する。

**Files:**

- Modify: `packages/cli/src/providers/source/adapters/svelte-meta-tags.ts:50-55`
- Test: `packages/cli/test/adapters-smt.test.ts`（ケース追加）

**Interfaces:**

- Consumes: `resolveMetaObject`, `OPEN_GRAPH_KEYS`, `TWITTER_KEYS`（Task 1）
- Produces: 変更後の `svelteMetaTagsAdapter.resolve` は openGraph/twitter リテラルから og:\*/twitter:card タグを含み、`broad = hasSpread || openGraph opaque || twitter opaque`

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/test/adapters-smt.test.ts` の `describe` 内末尾に追加:

```typescript
it('emits og:url / og:description / og:image tags from an inline openGraph literal', () => {
  const r = svelteMetaTagsAdapter.resolve(
    useOf('<MetaTags openGraph={{ type: "website", url: u, description: "d", images: [{ url: i }], title: t }} />')
  );
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:description', value: 'static' });
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:image', value: 'dynamic' });
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:title', value: 'dynamic' });
  expect(r.broad).toBe(false);
});

it('emits twitter:card from an inline twitter literal', () => {
  const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags twitter={{ cardType: "summary_large_image" }} />'));
  expect(r.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
  expect(r.broad).toBe(false);
});

it('falls back to broad when openGraph is a variable (not an inline literal)', () => {
  const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags openGraph={cfg} />'));
  expect(r.broad).toBe(true);
  expect(r.tags.some((t) => t.kind === 'meta' && t.property === 'og:url')).toBe(false);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-smt.test.ts`
Expected: FAIL（`og:url` タグが出ない / broad が旧ロジックで true）

- [ ] **Step 3: adapter を実装**

`packages/cli/src/providers/source/adapters/svelte-meta-tags.ts` — import 追加とロジック差し替え。

ファイル上部の import に追加:

```typescript
import { resolveMetaObject, OPEN_GRAPH_KEYS, TWITTER_KEYS } from './meta-object.js';
```

現在の該当ブロック（50-55 行付近）:

```typescript
// openGraph is an object prop we don't introspect; treat it as a broad og:* source.
const openGraph = findAttr(attrs, 'openGraph');
const broad = use.hasSpread || Boolean(openGraph);

return { tags, broad };
```

を次に置き換える:

```typescript
// Introspect inline openGraph / twitter object literals into specific og:*/twitter:card
// tags. A variable-passed object (openGraph={cfg}) or a spread is unreadable → fall back
// to broad coverage (BROAD_KINDS fills the og family + twitter:card).
const og = resolveMetaObject(findAttr(attrs, 'openGraph'), OPEN_GRAPH_KEYS);
const tw = resolveMetaObject(findAttr(attrs, 'twitter'), TWITTER_KEYS);
tags.push(...og.tags, ...tw.tags);
const broad = use.hasSpread || og.opaque || tw.opaque;

return { tags, broad };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-smt.test.ts`
Expected: PASS（既存ケース + 追加 3 ケース）

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/providers/source/adapters/svelte-meta-tags.ts packages/cli/test/adapters-smt.test.ts
git commit -m "fix(cli): introspect svelte-meta-tags openGraph/twitter literals (SEO011/012/013)"
```

---

### Task 3: svelte-seo adapter を配線

`svelte-seo` も同一の `openGraph` / `twitter` 解析を共有する。

**Files:**

- Modify: `packages/cli/src/providers/source/adapters/svelte-seo.ts:39-42`
- Test: `packages/cli/test/adapters-registry.test.ts`（ケース追加）

**Interfaces:**

- Consumes: `resolveMetaObject`, `OPEN_GRAPH_KEYS`, `TWITTER_KEYS`（Task 1）
- Produces: `svelteSeoAdapter.resolve` が og:\*/twitter:card タグを含み、`broad = hasSpread || openGraph opaque || twitter opaque`

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/test/adapters-registry.test.ts` の `describe('adapter registry', ...)` 内に追加:

```typescript
it('introspects the svelte-seo openGraph/twitter literals', () => {
  const adapter = findAdapter({ source: 'svelte-seo', imported: 'default' })!;
  const r = adapter.resolve(
    useOf(
      `import Seo from 'svelte-seo';`,
      '<Seo openGraph={{ url: u, description: "d" }} twitter={{ card: "summary" }} />'
    )
  );
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
  expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:description', value: 'static' });
  expect(r.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
  expect(r.broad).toBe(false);
});

it('falls back to broad when svelte-seo openGraph is a variable', () => {
  const adapter = findAdapter({ source: 'svelte-seo', imported: 'default' })!;
  const r = adapter.resolve(useOf(`import Seo from 'svelte-seo';`, '<Seo openGraph={cfg} />'));
  expect(r.broad).toBe(true);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-registry.test.ts`
Expected: FAIL（og:url タグが出ない）

- [ ] **Step 3: adapter を実装**

`packages/cli/src/providers/source/adapters/svelte-seo.ts` — import 追加とロジック差し替え。

ファイル上部の import に追加:

```typescript
import { resolveMetaObject, OPEN_GRAPH_KEYS, TWITTER_KEYS } from './meta-object.js';
```

現在の該当ブロック（39-42 行付近）:

```typescript
const openGraph = findAttr(attrs, 'openGraph');
const broad = use.hasSpread || Boolean(openGraph);

return { tags, broad };
```

を次に置き換える:

```typescript
const og = resolveMetaObject(findAttr(attrs, 'openGraph'), OPEN_GRAPH_KEYS);
const tw = resolveMetaObject(findAttr(attrs, 'twitter'), TWITTER_KEYS);
tags.push(...og.tags, ...tw.tags);
const broad = use.hasSpread || og.opaque || tw.opaque;

return { tags, broad };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-registry.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/providers/source/adapters/svelte-seo.ts packages/cli/test/adapters-registry.test.ts
git commit -m "fix(cli): introspect svelte-seo openGraph/twitter literals"
```

---

### Task 4: JsonLd adapter を新設・登録

`svelte-meta-tags` の `JsonLd` コンポーネントを検出し、`jsonld` タグを emit する（SEO008 解消）。

**Files:**

- Create: `packages/cli/src/providers/source/adapters/svelte-meta-tags-jsonld.ts`
- Modify: `packages/cli/src/providers/source/adapters/index.ts:3-9`
- Test: `packages/cli/test/adapters-jsonld.test.ts`

**Interfaces:**

- Consumes: `Adapter`, `AdapterResult`（`./types.js`）, `ImportInfo`（`../imports.js`）, `ComponentUse`, `ParsedTag`（`../parse.js`）
- Produces: `svelteMetaTagsJsonLdAdapter: Adapter`。`builtinAdapters` に登録され、`JsonLd`（named）/ `svelte-meta-tags/JsonLd.svelte`（default）にマッチ、`{ kind: 'jsonld', value: 'dynamic' }` を emit。

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/test/adapters-jsonld.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { svelteMetaTagsJsonLdAdapter } from '../src/providers/source/adapters/svelte-meta-tags-jsonld.js';
import { findAdapter } from '../src/providers/source/adapters/index.js';
import { parseFile } from '../src/providers/source/parse.js';

function useOf(imp: string, tag: string) {
  return parseFile(`<script>${imp}</script>${tag}`, 'x.svelte').components[0]!;
}

describe('svelteMetaTagsJsonLdAdapter', () => {
  it('matches the JsonLd named import', () => {
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags', imported: 'JsonLd' })).toBe(true);
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags', imported: 'MetaTags' })).toBe(false);
  });

  it('matches the JsonLd.svelte default import subpath', () => {
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags/JsonLd.svelte', imported: 'default' })).toBe(
      true
    );
  });

  it('emits a dynamic jsonld tag', () => {
    const r = svelteMetaTagsJsonLdAdapter.resolve(
      useOf(`import { JsonLd } from 'svelte-meta-tags';`, '<JsonLd schema={s} />')
    );
    expect(r.broad).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'jsonld', value: 'dynamic' });
  });

  it('is discoverable via findAdapter', () => {
    expect(findAdapter({ source: 'svelte-meta-tags', imported: 'JsonLd' })).toBe(svelteMetaTagsJsonLdAdapter);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-jsonld.test.ts`
Expected: FAIL（`svelte-meta-tags-jsonld.js` が存在しない）

- [ ] **Step 3: adapter を実装**

`packages/cli/src/providers/source/adapters/svelte-meta-tags-jsonld.ts`:

```typescript
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import type { Adapter, AdapterResult } from './types.js';

/**
 * svelte-meta-tags <JsonLd> (named import) or the JsonLd.svelte subpath (default import).
 * It renders a <script type="application/ld+json"> via a split-string {@html}, so it
 * can't be caught statically as literal JSON — model it as a dynamic jsonld tag so SEO008 passes.
 */
export const svelteMetaTagsJsonLdAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    if (info.source === 'svelte-meta-tags') return info.imported === 'JsonLd';
    if (info.source === 'svelte-meta-tags/JsonLd.svelte') return info.imported === 'default';
    return false;
  },

  resolve(_use: ComponentUse): AdapterResult {
    const tags: ParsedTag[] = [{ kind: 'jsonld', value: 'dynamic' }];
    return { tags, broad: false };
  }
};
```

- [ ] **Step 4: レジストリに登録**

`packages/cli/src/providers/source/adapters/index.ts` を編集。

import 行に追加:

```typescript
import { svelteMetaTagsJsonLdAdapter } from './svelte-meta-tags-jsonld.js';
```

`builtinAdapters` 配列を更新:

```typescript
export const builtinAdapters: Adapter[] = [svelteMetaTagsAdapter, svelteMetaTagsJsonLdAdapter, svelteSeoAdapter];
```

- [ ] **Step 5: テストが通ることを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/adapters-jsonld.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add packages/cli/src/providers/source/adapters/svelte-meta-tags-jsonld.ts packages/cli/src/providers/source/adapters/index.ts packages/cli/test/adapters-jsonld.test.ts
git commit -m "fix(cli): detect svelte-meta-tags JsonLd component (SEO008)"
```

---

### Task 5: BROAD_KINDS を拡張

不透明ソース（`config.metaComponents`・spread・変数 openGraph）でも og:description / og:url / twitter:card を dynamic 補完する。

**Files:**

- Modify: `packages/cli/src/providers/source/resolve.ts:11-19`
- Test: `packages/cli/test/resolve.test.ts`（ケース追加）

**Interfaces:**

- Produces: 拡張後の `BROAD_KINDS` に `{ kind: 'meta', property: 'og:description', value: 'dynamic' }` / `{ kind: 'meta', property: 'og:url', value: 'dynamic' }` / `{ kind: 'meta', name: 'twitter:card', value: 'dynamic' }` を含む（`jsonld` は含まない）

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/test/resolve.test.ts` の `describe` 内に追加:

```typescript
it('BROAD_KINDS covers og:description, og:url and twitter:card', () => {
  expect(BROAD_KINDS).toContainEqual({ kind: 'meta', property: 'og:description', value: 'dynamic' });
  expect(BROAD_KINDS).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
  expect(BROAD_KINDS).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'dynamic' });
});

it('BROAD_KINDS does NOT cover jsonld (structured data is a separate concern)', () => {
  expect(BROAD_KINDS.some((t) => t.kind === 'jsonld')).toBe(false);
});
```

（`BROAD_KINDS` は既に import 済み。broad 判定自体は既存テスト「marks broad for a metaComponents-declared component」でカバー済みのため追加不要。）

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/resolve.test.ts`
Expected: FAIL（og:description / og:url / twitter:card が BROAD_KINDS に無い）

- [ ] **Step 3: BROAD_KINDS を拡張**

`packages/cli/src/providers/source/resolve.ts` の `BROAD_KINDS` を次に置き換える:

```typescript
/** Tag kinds a broad (opaque) meta source is assumed to possibly set, all dynamic. */
export const BROAD_KINDS: ParsedTag[] = [
  { kind: 'title', value: 'dynamic' },
  { kind: 'meta', name: 'description', value: 'dynamic' },
  { kind: 'link', rel: 'canonical', value: 'dynamic' },
  { kind: 'meta', property: 'og:title', value: 'dynamic' },
  { kind: 'meta', property: 'og:description', value: 'dynamic' },
  { kind: 'meta', property: 'og:image', value: 'dynamic' },
  { kind: 'meta', property: 'og:url', value: 'dynamic' },
  { kind: 'meta', name: 'twitter:card', value: 'dynamic' },
  { kind: 'meta', name: 'robots', value: 'dynamic' }
  // jsonld is intentionally omitted: structured data is a distinct concern, not a
  // meta-tag family a broad meta source implies (JsonLd has its own adapter).
];
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter svelte-vitals exec vitest run test/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/providers/source/resolve.ts packages/cli/test/resolve.test.ts
git commit -m "fix(cli): broaden BROAD_KINDS to cover og:description/og:url/twitter:card"
```

---

### Task 6: 統合テスト（実フィクスチャ）

`/smt` フィクスチャに openGraph / twitter / JsonLd を追加し、実 Node ランタイムで全タグが検出されることを検証する。

**Files:**

- Modify: `packages/cli/test/fixtures/basic-project/src/routes/smt/+page.svelte`
- Modify: `packages/cli/test/source-provider.test.ts`（import に `HeadTag` 追加、ケース追加）

**Interfaces:**

- Consumes: Task 2・4・5 の成果（adapter 解析 + JsonLd adapter + BROAD_KINDS）
- Produces: `/smt` の `ResolvedHead.tags` に og:url / og:description / twitter:card / jsonld を含む

- [ ] **Step 1: フィクスチャを更新**

`packages/cli/test/fixtures/basic-project/src/routes/smt/+page.svelte` を次の内容に置き換える:

```svelte
<script>
  import { JsonLd, MetaTags } from 'svelte-meta-tags';
  let { data } = $props();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'SMT' };
</script>

<MetaTags
  title={data.title}
  description="A page"
  openGraph={{
    type: 'website',
    url: data.url,
    description: data.description,
    images: [{ url: data.image }],
    title: data.title
  }}
  twitter={{ cardType: 'summary_large_image' }}
/>
<JsonLd schema={jsonLd} />
```

- [ ] **Step 2: 失敗するテストを書く**

`packages/cli/test/source-provider.test.ts` の import 文（4-12 行）の型 import に `HeadTag` を追加:

```typescript
import {
  seo001Title,
  type Detection,
  type HeadTag,
  type ImageInfo,
  type ResolvedHead,
  defaultConfig,
  defaultProject,
  defineConfig
} from '@svelte-vitals/core';
```

`describe('SourceHeadProvider (Node runtime, real fixture)', ...)` 内に追加:

```typescript
it('detects svelte-meta-tags openGraph/twitter/JsonLd tags on the /smt route (issue #91)', async () => {
  const rt = createNodeRuntime();
  const heads = await sourceHeadProvider.collect(rt, fixtureDir);
  const smt = new Map(heads.map((h) => [h.route, h])).get('/smt')!;
  const has = (pred: (t: HeadTag) => boolean) => smt.tags.some(pred);
  expect(has((t) => t.kind === 'meta' && t.property === 'og:url')).toBe(true);
  expect(has((t) => t.kind === 'meta' && t.property === 'og:description')).toBe(true);
  expect(has((t) => t.kind === 'meta' && t.name === 'twitter:card')).toBe(true);
  expect(has((t) => t.kind === 'jsonld')).toBe(true);
});
```

- [ ] **Step 3: テストが失敗しない（実装済みなので通る）ことを確認 / 回帰チェック**

Run: `pnpm --filter svelte-vitals exec vitest run test/source-provider.test.ts`
Expected: PASS（新規ケース含む。既存の `/smt` title 判定 `{presence:'own', value:'dynamic'}` とルート一覧も維持）

注: Task 2・4・5 が先に完了しているため本ケースは実装済み。ここは統合レベルの回帰確認。もし FAIL する場合は Task 2/4/5 の配線漏れを疑う。

- [ ] **Step 4: コミット**

```bash
git add packages/cli/test/fixtures/basic-project/src/routes/smt/+page.svelte packages/cli/test/source-provider.test.ts
git commit -m "test(cli): cover svelte-meta-tags og/twitter/JsonLd detection on /smt fixture"
```

---

### Task 7: Changeset ＋ 全体 Verify

**Files:**

- Create: `.changeset/fix-smt-metatags-jsonld-detection.md`

- [ ] **Step 1: changeset を作成**

`.changeset/fix-smt-metatags-jsonld-detection.md`:

```markdown
---
'svelte-vitals': patch
---

Detect Open Graph (`og:description`, `og:url`), `twitter:card`, and JSON-LD tags emitted by `svelte-meta-tags` (`MetaTags` / `JsonLd`) in static mode. Inline `openGraph` / `twitter` object literals are now introspected key-by-key, non-literal configs fall back to broad coverage, and the `JsonLd` component is recognized — resolving SEO008/011/012/013 false positives (#91). The same `openGraph`/`twitter` introspection applies to `svelte-seo`.
```

- [ ] **Step 2: 全体 Verify を実行**

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Expected: 4 コマンドすべて成功（exit 0）。lint が Prettier 整形を要求したら `pnpm format` を実行して差分をコミットに含める。

- [ ] **Step 3: コミット**

```bash
git add .changeset/fix-smt-metatags-jsonld-detection.md
git commit -m "chore(cli): add changeset for svelte-meta-tags detection fix (#91)"
```

---

## 完了条件

- SEO008 / SEO011 / SEO012 / SEO013 が svelte-meta-tags 使用ルートで false positive を出さない
- 新規・既存テストがすべて pass、`pnpm build` / `typecheck` / `test` / `lint` が緑
- changeset 追加済み
- 変更は `packages/cli` に限定（core purity 維持）
