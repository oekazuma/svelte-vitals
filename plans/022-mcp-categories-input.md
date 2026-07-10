# Plan 022: MCP `analyze` ツールに `categories` 入力を追加(CLI `--category` の対)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b6cf6b..HEAD -- packages/mcp/src packages/cli/src/index.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW(追加のみ。既存入力のセマンティクス不変)
- **Depends on**: plans/018-cli-category-score-flags.md(DONE — `analyzeProject` は `categories` を受領済み)
- **Category**: dx / direction
- **Planned at**: commit `8b6cf6b`, 2026-07-08

## Why this matters

CLI には `--category`(カテゴリ単位でルールを絞る)が入った(Plan 018 / PR #147)が、
MCP の `analyze` ツールからは同じ絞り込みができず、エージェントは `rules` に個別 id を
列挙するしかない。`analyzeProject` は既に `categories` オプションを受けるため
(Plan 018 で配線済み)、MCP 側は inputSchema と受け渡しの追加だけで CLI と対称になる。
Plan 018 の Maintenance notes に予告済みのフォローアップ。

## Current state

- `packages/mcp/src/tools/analyze.ts:15-49` — zod の `analyzeInputSchema`。`weights` が
  カテゴリ enum を case-insensitive に受ける前例(z.preprocess で小文字化 → enum 検証):

```ts
weights: z.preprocess(
  (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).map(([k, val]) => [String(k).toLowerCase(), val]))
      : v,
  z.partialRecord(z.enum(['seo', 'performance', 'correctness', 'security', 'architecture']), z.number().nonnegative())
).optional();
```

- `packages/mcp/src/tools/analyze.ts:77-85` — `handleAnalyze` の `analyzeProject` 呼び出し
  (`cwd/metaComponents/treatDynamicAs/route/failOn/rules/weights` を渡している)。
- `packages/cli/src/index.ts` の `AnalyzeOptions` — `categories?: Category[]` を受領済み
  (Plan 018):「`selectRules` の結果に対する積集合フィルタ」。
- テストの流儀: `packages/mcp/test/` に 3 ファイル(analyze ツールのユニットテストあり —
  実ファイルを見て命名・構成に合わせる)。
- docs: `docs/src/content/docs/guides/mcp.md`(+ `ja/`)が `analyze` の入力を列挙している場合は
  追随が必要(Step 3 で grep して確認)。

## Commands you will need

| Purpose   | Command                                                          | Expected on success |
| --------- | ---------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter "./packages/**" install`                          | exit 0              |
| Build     | `pnpm --filter "./packages/**" build`                            | exit 0              |
| Typecheck | `pnpm typecheck`                                                 | exit 0              |
| Tests     | `pnpm --filter @svelte-vitals/mcp test`                          | all pass            |
| Lint      | `pnpm lint`                                                      | exit 0              |
| Changeset | 手書き(@svelte-vitals/mcp: minor、既存 `.changeset/*.md` の形式) | ファイル生成        |

## Scope

**In scope**:

- `packages/mcp/src/tools/analyze.ts`
- `packages/mcp/test/`(ケース追加)
- `docs/src/content/docs/guides/mcp.md` + `ja/guides/mcp.md`(入力列挙があれば追随)
- `.changeset/`

**Out of scope**:

- `packages/cli` / `packages/core` — 受け側は実装済み。触らない。
- `explain_rule` ツール、MCP サーバー登録部(`server.ts` は shape を re-export しているだけなら不変)。

## Git workflow

- Branch: `advisor/020-mcp-categories-input`
- Conventional commits、例: `feat(mcp): add categories input to the analyze tool`
- PR 本文は英語。push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: inputSchema と受け渡し

`analyze.ts` の schema に追加(`weights` の直前あたり、`rules`/`ignore` の並びに):

```ts
categories: z
  .preprocess(
    (v) => (Array.isArray(v) ? v.map((c) => String(c).toLowerCase()) : v),
    z.array(z.enum(['seo', 'performance', 'correctness', 'security', 'architecture']))
  )
  .optional()
  .describe(
    'Restrict analysis to rules in these categories (intersection with rules/ignore selection). Case-insensitive. Mirrors the CLI --category flag.'
  ),
```

`handleAnalyze` の `analyzeProject` 呼び出しに `categories: args.categories` を追加。
重複カテゴリは `analyzeProject` 側で害がない(includes フィルタ)ため dedupe 不要だが、
zod の後で `[...new Set(args.categories)]` として渡しても良い(実装の単純な方を選ぶ)。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck` → exit 0

### Step 2: テスト

既存の analyze ツールテストの流儀に合わせて追加:

1. `categories: ['seo']` で結果の issue id がすべて `SEO` プレフィックス(CLI テスト
   `run.test.ts` の `--category` ケースと同じ fixture 戦略 — mcp テストが使う fixture を確認して合わせる)。
2. `categories: ['SEO']`(大文字)が小文字化されて同じ結果になる。
3. 未知カテゴリ(例 `['a11y']`)は zod 検証エラーになる(スキーマ単体で
   `analyzeInputSchema.safeParse` を検証するか、サーバー層の検証経路に合わせる)。
4. `categories` 未指定時は従来どおり全カテゴリ。

**Verify**: `pnpm --filter @svelte-vitals/mcp test` → all pass

### Step 3: docs + changeset

- `grep -n "weights" docs/src/content/docs/guides/mcp.md` で入力列挙の有無を確認し、
  あれば `categories` 行を追加(en/ja 同内容)。列挙が無ければ docs 変更は不要。
- changeset: `@svelte-vitals/mcp` minor(英語)。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0

## Test plan

Step 2 の 4 ケース。パターン元: `packages/mcp/test/` の既存 analyze テスト。

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] `categories: ['seo']` の絞り込みと case-insensitive 正規化がテストで固定
- [ ] docs(入力列挙がある場合 en/ja)+ changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)

## STOP conditions

- `analyzeProject` が `categories` を受けない(Plan 018 が main に無い — Drift check で検出)。
- zod の `preprocess` + enum 配列がサーバーの MCP SDK 登録経路で扱えない。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- カテゴリ enum が 3 箇所目になる(CLI `CATEGORIES`、`weights` スキーマ、本追加)。
  次にカテゴリを増減する時は 3 箇所同期が必要 — その時に単一ソース化を検討する価値がある。
