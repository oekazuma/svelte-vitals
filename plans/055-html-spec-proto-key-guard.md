# Plan 055: `HTML_SPEC` の lookup を `Object.prototype` 由来キーから守る(`<constructor>` で a11y/deprecated-attr がクラッシュする)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 690dd5e4..HEAD -- packages/core/src/html-spec/index.ts packages/core/src/html-spec/content-model.ts packages/core/src/rules/a11y/role-candidates.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P1       | S      | LOW  | none       | bug      | commit `690dd5e4`, 2026-08-28 |

## Why this matters

`HTML_SPEC.elements` は `JSON.parse` の出力(`packages/core/src/html-spec/generated.ts`)なので `Object.prototype` を継承している。author が書けるタグ名 `constructor` で索引すると `Object` 関数(non-nullish)が返り、`?.` が短絡せず `.attributes` が `undefined` になって throw する。**再現済み**: `<constructor data-x="1"></constructor>` を含むコンポーネント 1 つで `a11y/deprecated-attr` の `check()` が `TypeError: Cannot read properties of undefined (reading 'data-x')` を投げる。ルールが fail すると `withFailedRulesOff`(`packages/cli/src/index.ts`)がそのルールをスコアリングから外すため、stderr の警告 1 行だけを残して採点対象ルールが 1 つ静かに消える(exit code は変わらない = CI ゲートは green のまま)。リポジトリ自身が別所で同じクラスを防いでいる(`packages/vite/src/providers/rendered/collect.ts:17` の `Object.create(null)`、`packages/cli/src/providers/source/routes.ts:397` の「never index by shell id」コメント)ので、これは既存標準との不整合の修正であって新ポリシーではない。

## Current state

- `packages/core/src/html-spec/index.ts:8-10` — クラッシュの根本:

  ```ts
  export function htmlElement(tag: string): HtmlElementSpec | undefined {
    return HTML_SPEC.elements[tag.toLowerCase()];
  }
  ```

  `elementAttr`(:29-31)・`isObsoleteElement`(:20-22)・`isDeprecatedAttr`(:37-40)は全て `htmlElement` 経由なので、ここを直せば `a11y/deprecated-attr`(`packages/core/src/rules/a11y/deprecated-attr.ts` — `htmlElement(e.tag)?.obsolete` と `isDeprecatedAttr(e.tag, a.name)` の両方で到達)と `a11y/deprecated-element` が直る。

- `packages/core/src/rules/a11y/role-candidates.ts:49-53` — 同根で今は非クラッシュ(`Object` 関数の `.implicitRole`/`.conditions` が undefined で benign path に落ちる)だが、フィールドアクセス 1 つで同じ失敗になる:

  ```ts
  const el = HTML_SPEC.elements[e.tag];
  if (!el) return undefined;
  // An override replaces the element's ARIA facts wholesale — role, prohibition and conditions.
  const aria: Pick<typeof el.aria, 'implicitRole' | 'namingProhibited' | 'conditions'> =
    ELEMENT_FACT_OVERRIDES[e.tag] ?? el.aria;
  ```

  `ELEMENT_FACT_OVERRIDES` は TS のオブジェクトリテラルなのでこちらも `Object.prototype` を継承しており、同じ `hasOwn` ガードが要る。

- `packages/core/src/html-spec/content-model.ts:273` — `const spec = HTML_SPEC.elements[holder.tag];`。`holder.tag`(祖先要素のタグ)は author 制御。今日は直後の `!spec?.contentModel` が `Object` 関数上で undefined になり無害だが、同じ `hasOwn` パターンで防御しておく。

- `packages/core/src/rules/a11y/role-candidates.ts:66` の `HTML_SPEC.aria.roles[role]` は**ガード不要**(スコープ外の判断として記録): `role` は `resolveRole` → `isConcreteRole` → aria-query の `Map.has` を通過したトークンか spec データ由来の `implicitRole` に限られ、`constructor` は `Map.has` を通らない。

- 再現手順(修正前に fail することの確認に使う):

  ```bash
  node -e "
  import('./packages/core/dist/internal.js').then(async (core) => {
    const facts = core.parseComponentFacts('<constructor data-x=\"1\"></constructor>', 'X.svelte');
    const rule = core.allRules.find(r=>r.id==='a11y/deprecated-attr');
    const cfg = { treatDynamicAs:'unknown', metaComponents:[], rules:{}, failOn:'critical', weights:{}, overrides:[] };
    try { await rule.check({ config: cfg, routes: [], components: [facts], componentFacts: [facts], kitModules: [] }); console.log('no crash'); }
    catch(e) { console.log('CRASH:', String(e).slice(0,120)); }
  });"
  ```

  HEAD では `CRASH: TypeError: Cannot read properties of undefined (reading 'data-x')` が出る(`pnpm build` 後に実行)。

- リポジトリ規約: core は純粋(`node:` import 禁止)。コードコメントは英語のみ(過去 PR #199 で CJK コメントを一掃済み)。コメントは WHY のみ — このガードには「JSON.parse output carries Object.prototype; `constructor` is a legal author tag」相当の 1 行が付く価値がある(`routes.ts:397` の既存コメントが文体の手本)。

## Commands you will need

| Purpose    | Command                                      | Expected on success |
| ---------- | -------------------------------------------- | ------------------- |
| Install    | `pnpm install`                               | exit 0              |
| Build      | `pnpm build`                                 | exit 0              |
| Typecheck  | `pnpm typecheck`                             | exit 0              |
| Core tests | `pnpm --filter @svelte-vitals/core run test` | all pass            |
| Full test  | `pnpm test`(build 込み)                      | all pass            |
| Lint       | `pnpm lint`                                  | exit 0              |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/core/src/html-spec/index.ts`
- `packages/core/src/rules/a11y/role-candidates.ts`
- `packages/core/src/html-spec/content-model.ts`
- `packages/core/test/html-spec.test.ts`(unit 追加)
- `packages/core/test/a11y-spec-data-rules.test.ts`(ルールレベル回帰テスト追加)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/core/src/html-spec/generated.ts` — 生成物。手編集厳禁(drift テストが落ちる)。プロトタイプを剥がす加工を generated 側や import 時に行わない(`setPrototypeOf` はロード順依存で脆い。ガードは consumer 側に置く)。
- `packages/core/scripts/html-spec.js` — 生成器。変更不要。
- `role-candidates.ts:66` の `HTML_SPEC.aria.roles[role]` — 上記の通り到達不能と検証済み。
- `packages/cli/src/index.ts` の `withFailedRulesOff` 周り — ルール失敗の隔離機構自体は設計どおり。

## Git workflow

- Branch: `advisor/055-html-spec-proto-key-guard`
- Conventional commits、例: `fix(core): guard HTML_SPEC lookups against Object.prototype keys`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `htmlElement` に `Object.hasOwn` ガードを入れる

`packages/core/src/html-spec/index.ts` の `htmlElement` を次のように書き換える。

```ts
export function htmlElement(tag: string): HtmlElementSpec | undefined {
  const key = tag.toLowerCase();
  // JSON.parse output inherits Object.prototype, and `constructor` is a legal author tag —
  // an unguarded index would return Object's function instead of undefined.
  return Object.hasOwn(HTML_SPEC.elements, key) ? HTML_SPEC.elements[key] : undefined;
}
```

**Verify**: `pnpm --filter @svelte-vitals/core run typecheck` → exit 0

### Step 2: `role-candidates.ts` と `content-model.ts` の直接索引を同じパターンでガードする

- `role-candidates.ts:49` — `const el = Object.hasOwn(HTML_SPEC.elements, e.tag) ? HTML_SPEC.elements[e.tag] : undefined;`
- `role-candidates.ts:53` — `ELEMENT_FACT_OVERRIDES[e.tag]` を `Object.hasOwn(ELEMENT_FACT_OVERRIDES, e.tag) ? ELEMENT_FACT_OVERRIDES[e.tag] : undefined` に(`?? el.aria` フォールバックは維持)。
- `content-model.ts:273` — `const spec = Object.hasOwn(HTML_SPEC.elements, holder.tag) ? HTML_SPEC.elements[holder.tag] : undefined;`

ヘルパー関数化するか 3 箇所インラインかは実装裁量(3 箇所なら inline で十分。`htmlElement` は lowercase する点で他と違うので無理に共通化しない)。

**Verify**: `pnpm --filter @svelte-vitals/core run typecheck` → exit 0

### Step 3: テストを追加する

1. `packages/core/test/html-spec.test.ts` — 既存の `describe('html-spec: what the projection must and must not carry', ...)` の近くに unit 追加:
   - `htmlElement('constructor')` / `htmlElement('toString')` / `htmlElement('valueOf')` → `undefined`
   - `isDeprecatedAttr('constructor', 'data-x')` → `false`(throw しない)
2. `packages/core/test/a11y-spec-data-rules.test.ts` — ルールレベル回帰(既存の deprecated-attr テストのパターンに合わせる): `<constructor data-x="1"></constructor>` を `parseComponentFacts` して `a11y/deprecated-attr` と `a11y/role-candidates` 系ルールを実行し、throw しない+finding 0 件を確認。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/core run test` → all pass(新テスト含む)

### Step 4: changeset を書く(英語)

`pnpm changeset` で `@svelte-vitals/core` patch。内容例: "Guard HTML spec lookups against `Object.prototype` keys: a component containing `<constructor>` (or another prototype-key tag) no longer crashes `a11y/deprecated-attr` and silently drops the rule from scoring."

**Verify**: `.changeset/*.md` が 1 件増えている(`git status`)

### Step 5: 最終検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。加えて "Current state" の再現スクリプトを再実行 → `no crash` が出る。

## Test plan

- 新規: Step 3 の unit 3 本+ルールレベル回帰 1〜2 本。パターンは `packages/core/test/a11y-spec-data-rules.test.ts` の既存 deprecated-attr ケースに合わせる。
- 既存テスト(`html-spec.test.ts` の drift テスト含む)は全て無変更で pass すること — このガードは `undefined` を返す範囲を広げるだけで、正しい判定は 1 つも変わらない。

## Done criteria

- [ ] "Current state" の再現スクリプトが `no crash` を出す
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(core patch、英語)が存在する
- [ ] `plans/README.md` の 055 行を更新済み

## STOP conditions

- "Current state" の抜粋と実コードが一致しない(ドリフト)。
- 再現スクリプトが HEAD で CRASH を出さない(前提が崩れている — 誰かが先に直した可能性)。
- Step 3 で既存テストが落ち、その原因が「正しい判定の変化」に見える場合(このガードは判定を変えないはず — 変わったら設計前提が誤り)。
- `generated.ts` の変更が必要に見える場合(必要ない設計。必要に見えたら報告)。

## Maintenance notes

- 今後 `HTML_SPEC` を author 制御キーで索引する新コードは同じ `Object.hasOwn` ガードが必要。レビュー時は `HTML_SPEC.elements[`・`ELEMENT_FACT_OVERRIDES[` の新規出現を疑うこと。
- `role-candidates.ts:66` を将来 author 制御値で索引するよう変えるなら、その時点でガード追加が必要(現在は `resolveRole` が門番)。
