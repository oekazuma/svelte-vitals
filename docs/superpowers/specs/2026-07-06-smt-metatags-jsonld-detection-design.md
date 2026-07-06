# Design: svelte-meta-tags (MetaTags / JsonLd) の false positive 解消

Issue: [#91](https://github.com/oekazuma/svelte-vitals/issues/91)

## 問題

`svelte-meta-tags` の `MetaTags` / `JsonLd` が出力するタグが static モード（CLI）で検出されず、prerender された HTML には存在するにもかかわらず「Missing」と報告される。

- SEO012 (og:description)
- SEO013 (og:url)
- SEO011 (twitter:card)
- SEO008 (JSON-LD)

一方、同じ `MetaTags` の `openGraph` config から来る SEO002 (description) / SEO003 (canonical) / SEO004 (og:image) / SEO005 (og:title) は `↯ dynamic` として通っている。

## 根本原因

static モードには 4 層の head 検出がある（`packages/cli/src/providers/source/resolve.ts`）。

- Layer 1: ファイル内の `<svelte:head>` リテラル
- Layer 2: 既知ライブラリの adapter（svelte-meta-tags / svelte-seo）
- Layer 3: `src/` 内のユーザーコンポーネントを再帰解析（`MAX_DEPTH` まで）
- Layer 4: `config.metaComponents` 宣言の不透明コンポーネント → broad 扱い

なお `↯ dynamic`（reporter 上は "verified at runtime"）は「静的解析で値が動的と判定されたが、タグの存在は確認できた」の意味で、実行時検証ではない。

2 つのギャップがある。

### ギャップ 1: broad ソースのカバレッジ不足

`MetaTags` に `openGraph`（オブジェクト prop）を渡すと adapter が `broad: true` を返し（`adapters/svelte-meta-tags.ts:52`）、`routes.ts:170` がこの broad ソースに対して `BROAD_KINDS` の 6 種類だけを `dynamic` タグとして補完する。

```
title / description / canonical / og:title / og:image / robots
```

`og:description` / `og:url` / `twitter:card` はこのリストに無いため「Missing」になる。

### ギャップ 2: JsonLd が未モデル化

`svelte-meta-tags` の `JsonLd` 用 adapter が存在せず（`adapters/index.ts` は MetaTags と svelte-seo のみ）、`jsonld` も `BROAD_KINDS` に無いため SEO008 も Missing になる。

## 方針

「インラインオブジェクトリテラルは精密に解析し、静的に読めない場合は broad 補完でフォールバック」の 2 段構え。ライブラリ名には依存せず、Layer 3 の再帰解析で自作 wrapper も自動でカバーする。

## 変更点

### ① adapter にオブジェクトリテラル解析を追加（共通ヘルパー化）

対象: `adapters/svelte-meta-tags.ts` / `adapters/svelte-seo.ts`

`openGraph` / `twitter` prop がインラインの `{{ ... }}`（AST 上 `ExpressionTag` の `expression.type === 'ObjectExpression'`）のとき、`properties[].key.name` を列挙して対応タグを個別に emit する。

openGraph キー → タグ:

| openGraph キー | タグ           |
| -------------- | -------------- |
| `title`        | og:title       |
| `description`  | og:description |
| `url`          | og:url         |
| `images`       | og:image       |
| `type`         | og:type        |

twitter キー → タグ:

| twitter キー                                         | タグ         |
| ---------------------------------------------------- | ------------ |
| `cardType`（svelte-meta-tags）/ `card`（svelte-seo） | twitter:card |

- 各タグの `value` は該当プロパティ値が静的なら `static`、式なら `dynamic`。
- キーが存在しないプロパティのタグは emit しない（精密）。例: `openGraph` に `url` が無ければ SEO013 は正しく Missing のまま。
- ライブラリごとにキーマップを差し込む共通ヘルパー `resolveMetaObject()` を新設し、両 adapter で共有する。svelte-meta-tags と svelte-seo で twitter card のキー名が異なる（`cardType` vs `card`）ため、キーマップは引数で渡す。
- ヘルパーは AST（`ObjectExpression`）を読むため、プロパティ値の kind 判定は `parse.ts` に置く小ヘルパー（例: プロパティ node の value から `Value` を返す）を再利用/新設する。

### ② `broad` の判定を精密化

`broad = hasSpread || (openGraph が非リテラル式) || (twitter が非リテラル式)`

インラインリテラルを解析できた場合は broad に頼らない。spread や変数渡し（`openGraph={someVar}`）のときだけ broad にフォールバックする。

**挙動変更（精密化）**: 従来は「openGraph があれば broad」で `BROAD_KINDS` が og:title / og:image を無条件に補完していた。本変更後、openGraph がリテラルの場合は broad=false になり `BROAD_KINDS` による補完は効かないため、リテラルに `images` / `title` キーが**無ければ** SEO004 / SEO005 は正しく Missing として surface する。これは Q1 で選択した「リテラル解析＝精密」の意図通りの変更であり、従来の false negative（未設定の og:image が pass していた）を是正する。Issue #91 の repro は `images` を含む想定のため og:image は引き続き pass する。

### ③ `BROAD_KINDS` の拡張 ＋ JsonLd adapter 新設

`resolve.ts`:

- `BROAD_KINDS` に `og:description` / `og:url` / `twitter:card` を追加。中身が不透明なメタソース（`config.metaComponents` 宣言・spread・変数渡しの openGraph）でもライブラリ非依存でカバーする。
- `jsonld` は「メタソースとは別概念（構造化データ）」なので `BROAD_KINDS` には含めない。

`adapters/`:

- 新規 `svelteMetaTagsJsonLdAdapter` を追加。
  - match: `source === 'svelte-meta-tags' && imported === 'JsonLd'`、または `source === 'svelte-meta-tags/JsonLd.svelte' && imported === 'default'`。
  - resolve: `{ kind: 'jsonld', value: 'dynamic' }` を emit、`broad: false`。
  - `builtinAdapters`（`adapters/index.ts`）に登録。
- 自作 wrapper 内の `<JsonLd>` は Layer 3 の再帰解析で自動カバーされる。

## 解決する範囲

- SEO012 (og:description) / SEO013 (og:url) / SEO011 (twitter:card): ① で精密に検出、③ でフォールバックカバー
- SEO008 (JSON-LD): ③ の JsonLd adapter で検出
- svelte-seo 利用者の同種 false positive も同時解消
- 自作 wrapper コンポーネント（内部で MetaTags / JsonLd 使用）は Layer 3 で自動対応

## トレードオフ

- リテラル解析はインライン `{{ ... }}` のみ。変数渡し（`openGraph={cfg}`）は ③ のフォールバック（broad）で拾うため、その場合は「未設定の og:url」等を見逃す可能性がある（承認済み。対象ルールは warning/info で低致命度、false positive 抑制を優先）。
- ② の精密化により、リテラル openGraph で `images` / `title` キーを省いていた既存ユーザーは、これまで pass していた SEO004 / SEO005 が Missing に変わる可能性がある（false negative の是正だが、出力は変化する）。テストの期待値も併せて更新する。

## 規約遵守（AGENTS.md）

- **変更範囲は `packages/cli` のみ**（adapters / parse / resolve）。ルール本体（SEO008/011/012/013）は `packages/core` にあるが変更しない。core purity（`node:` import 禁止・I/O 禁止、#119 で eslint 強制）には抵触しない。
- **Changeset 必須**: user-facing なバグ修正のため `pnpm changeset` を追加する（patch、`@svelte-vitals/cli` 対象）。
- **Conventional commits**: パッケージスコープ付きで `fix(cli): ...`。
- **docs**: 検出挙動のコード修正のみで en/ja docs の更新は不要（該当ドキュメントがある場合のみ同期）。
- **Verify**: 完了前に `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm lint` を実行して pass を確認する。

## テスト

- `adapters-smt.test.ts`: openGraph / twitter インラインリテラル解析ケースを追加（キーが有る場合に og:\*/twitter:card を emit、無い場合に emit しないこと、静的値/式で value が変わること）。
- JsonLd adapter の新規テストファイル（named import / default import のマッチと jsonld emit）。
- svelte-seo adapter テスト（既存が無ければ新設。openGraph/twitter リテラル解析と `card` キーの差異）。
- `resolve.test.ts`: `BROAD_KINDS` 拡張の検証（不透明ソースで og:description / og:url / twitter:card が dynamic 補完されること、jsonld は補完されないこと）。
- フィクスチャ `smt/+page.svelte` に openGraph / twitter / JsonLd を含む統合ケースを追加し、run レベルで SEO008/011/012/013 が Missing にならないことを検証。
