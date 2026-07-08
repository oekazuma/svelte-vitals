# Plan 018: CLI 利便性フラグ — `--category` と `--score`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d0c76c9..HEAD -- packages/cli/src/index.ts packages/cli/src/resolve-args.ts packages/cli/src/bin.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。
> (Plan 014/015 が先にマージされ同ファイルに差分が出ている場合は、抜粋との**意味的な**
> 一致 — 該当関数がまだ同じ形か — を確認して続行してよい。)

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none(014/015 と同一ファイルを触るためコンフリクト回避として**最後に**実行推奨)
- **Category**: dx / direction
- **Planned at**: commit `d0c76c9`, 2026-07-08

## Why this matters

カテゴリ単位の実行(「まず SEO だけ見たい」)は現状 `--rules` に 30 個の id を並べる
しかなく、実用にならない。またスクリプトやシェルプロンプトから Health スコアだけ欲しい
場合に JSON をパースさせるのは大げさ。`--category <cats>`(カテゴリでルールを絞る)と
`--score`(Health の数値のみを stdout に出す)を追加し、小さいが日常的な摩擦を除く。

## Current state

- **カテゴリ一覧の定義**: `packages/cli/src/resolve-args.ts:7` —
  `const CATEGORIES: Category[] = ['seo', 'performance', 'correctness', 'security', 'architecture'];`
  `parseWeights`(resolve-args.ts:16-74)が「カテゴリ名を case-insensitive に検証し、
  未知はエラー 2 本(`unknown category(ies)…` + `Known categories: …`)を push する」前例。
- **ルール選択**: `packages/cli/src/index.ts:165` — `const rules = selectRules(allRules, config);`
  の後に `runRules` へ渡る。`Rule` は `category` フィールドを持つ(`packages/core/src/rule.ts:23`)。
- **`AnalyzeOptions`**(index.ts:106-116)と **`RunOptions`**(index.ts:35-67)。
  `analyzeProject` は MCP からも呼ばれる共有入口(index.ts:137-171)。
- **スコア計算**: `computeHealth(results, config)` が `{ health, categories, weights }` を返す
  (`packages/core/src/scoring/score.ts`、使用例 index.ts:290)。
- **レポーター分岐**: index.ts:251-287。exit code 判定は index.ts:288-291
  (`hasFailureAtOrAbove` + `minHealth`)。
- **ヘルプ**: bin.ts:14-31。mri 設定: bin.ts:51-67(`boolean` / `string` リスト)。

## Commands you will need

| Purpose   | Command                                | Expected on success |
| --------- | -------------------------------------- | ------------------- |
| Install   | `pnpm install`                         | exit 0              |
| Build     | `pnpm build`                           | exit 0              |
| Typecheck | `pnpm typecheck`                       | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`     | all pass            |
| Lint      | `pnpm lint`                            | exit 0              |
| Changeset | `pnpm changeset`(svelte-vitals: minor) | ファイル生成        |

## Scope

**In scope**:

- `packages/cli/src/index.ts`、`resolve-args.ts`、`bin.ts`
- `packages/cli/test/resolve-args.test.ts`、`run.test.ts`(ケース追加)
- `docs/src/content/docs/guides/cli.md` + `ja/guides/cli.md`
- `.changeset/`

**Out of scope**:

- `packages/core` — `selectRules` のシグネチャ変更はしない(フィルタは CLI 層で)。
- `packages/mcp` — `analyze` ツールへの `categories` 入力追加はしない(`rules` 入力で
  代替可能。需要が出たら 1 行で足せる)。
- `--weights` / `--rules` / `--ignore` の既存セマンティクス。

## Git workflow

- Branch: `advisor/018-cli-category-score-flags`
- Conventional commits、例: `feat(cli): add --category filter and --score output`
- PR 本文は英語。**他社ベンチマークツール名をコミット/PR/docs に書かない**(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `--category` を resolve-args に追加

- `parseCategories(raw: unknown, errors: string[]): Category[] | undefined` を
  `parseWeights` の直後に追加。挙動は parseWeights と同じ流儀:
  カンマ区切り・trim・小文字化・`CATEGORIES` に無ければ
  `svelte-vitals: unknown category(ies) in --category: …` + `Known categories: …` を errors に
  push。空(`--category` に値なし)は
  `svelte-vitals: --category was passed but contains no categories.` を push。
  フラグ未指定(`raw` が string でない)は `undefined`。
- `ResolvedArgs` の options に `...(categories !== undefined ? { categories } : {})`。

### Step 2: 解析経路に配線

- `AnalyzeOptions` と `RunOptions` に
  `/** Restrict analysis to rules in these categories (after rules/ignore selection). */ categories?: Category[];`
  を追加。
- `analyzeProject`(index.ts:165)のルール選択を:

```ts
const selected = selectRules(allRules, config);
const rules = opts.categories ? selected.filter((r) => opts.categories!.includes(r.category)) : selected;
```

- `run()` から `analyzeProject` へ `categories: opts.categories` を渡す(index.ts:200-208 の
  呼び出しに 1 行追加)。

セマンティクス(docs にも書く): `--category` は `--rules`/`--ignore`/config の選択結果に
対する**積集合**。カテゴリを絞ると Health は「存在するカテゴリのみの加重平均」になる
(`computeHealth` の既存挙動 — 全カテゴリを 0 重みにしない限り安全)。

### Step 3: `--score` を追加

- `RunOptions` に `/** Print only the combined Health score (integer) to stdout. */ score?: boolean;`。
- `resolve-args.ts`: `score: Boolean(argv.score)` を options に(false は省く)。
  `--score` と `--reporter`/`--json` が同時指定なら warnings に
  `svelte-vitals: --score overrides --reporter; reporter output suppressed.` を push。
- `run()` のレポーター分岐全体(index.ts:251-287)を `if (opts.score) { log(String(computeHealth(results, config).health)); } else { …既存分岐… }` で包む。
  exit code 計算(index.ts:288-291)は不変 — `--score --min-health 80` がゲートとして機能する。
  スピナー(index.ts:188-196)は `reporter === 'console'` 判定なので `--score` 時は
  `spinnerEnabled` に渡る前に抑止する: `enabled: !opts.score && spinnerEnabled({ … })`。
- `bin.ts`: mri `boolean` 配列に `'score'`、`string` 配列に `'category'` を追加。ヘルプに:

```
  --category <cats>           Comma-separated categories to analyze: seo | performance | correctness | security | architecture
  --score                     Print only the combined Health score (works with --min-health for gating)
```

**Verify**: `pnpm --filter svelte-vitals build && node packages/cli/dist/bin.js packages/cli/test/fixtures/basic-project --score` → 整数 1 行のみが stdout に出る

### Step 4: テスト

- `resolve-args.test.ts`: `--category seo,SECURITY`(大文字混在)→ 正規化されて options に
  載る / 未知カテゴリ → errors / 値なし → errors / `--score` + `--json` → warning。
- `run.test.ts`(既存の capture パターンを踏襲):
  (1) `--category seo` で correctness ルール(CORRECT001 等)の finding が出ない、
  (2) `--score` で stdout が `/^\d+$/` の 1 行、
  (3) `--score` + `minHealth: 100` で exit 1(fixture に finding がある前提 — basic-project は
  SEO001 を出す。run-diff.test.ts:55 参照)。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 5: docs + changeset

- `docs/src/content/docs/guides/cli.md` + `ja/guides/cli.md` に両フラグの節を追加
  (`--category` の積集合セマンティクスと Health への影響、`--score`+`--min-health` の
  ゲート例)。
- `pnpm changeset`: `svelte-vitals` minor。本文は英語。

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0

## Test plan

Step 4 の通り。パターン元: `packages/cli/test/resolve-args.test.ts`(フラグ検証)、
`packages/cli/test/run-diff.test.ts`(`run()` + fixture + capture)。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] `--category seo` 実行で SEO 以外の finding が出ない(テストで固定)
- [ ] `--score` の stdout が数値 1 行のみ、`--min-health` と組んで exit 1/0 が正しい
- [ ] ヘルプ・docs(en/ja)・changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)
- [ ] `plans/README.md` の 018 行を更新

## STOP conditions

- "Current state" と実コードの**意味的**不一致(014/015 由来の行ズレは可、関数の形が
  変わっていたら STOP)。
- `selectRules` や core 側の変更が必要に見えてきた。
- `--score` の出力に finding 警告等の stdout 混入が避けられない構造だと判明した
  (stderr へ出すのが既存流儀 — index.ts:220 参照 — なので通常は起きない)。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- MCP の `analyze` に `categories` 入力を足す場合、`analyzeProject` は既に受けるので
  `packages/mcp/src/tools/analyze.ts` の inputSchema と受け渡しだけで済む。
- Plan 015 の生成ワークフローや docs の例に `--category` を使う場合は積集合の説明への
  リンクを添える。
- 新カテゴリを追加する日が来たら `CATEGORIES`(resolve-args.ts:7)が単一の正 —
  `--weights` と `--category` の両方がここを見る。
