# Plan 026: Action に suppressions を配線 + cli の日本語コメント一掃

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90664c..HEAD -- packages/action/src packages/cli/src/mascot.ts packages/cli/src/baseline.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3 / **Effort**: S / **Risk**: LOW(1行の配線 + コメントのみの変更)
- **Depends on**: plans/023(DONE — suppressions 本体)
- **Category**: dx / cleanup
- **Planned at**: commit `c90664c`, 2026-07-13

## Why this matters

1. **Action の suppressions 対応**(plans/README.md の 023 行に記録済みの follow-up):
   Plan 023 は `applyScope` の suppressions 適用を `opts.config` があるときだけ動く設計にし、
   `@svelte-vitals/action` は config を渡していないため**抑制ファイルが Action ベースの
   CI で効かない**。導入ランプの主用途は CI ゲートなので、これは実用上の穴。修正は
   Action が既に持っている `config` を `applyScope` に渡すだけ。
2. **日本語コメント一掃**(PR #196 レビューで指摘された規約違反の残り):
   コード内コメントは英語がリポジトリ規約。残存は `packages/cli/src/baseline.ts`
   (checkoutBaseline / filterToNewFindings の docblock、PR #142 由来)と
   `packages/cli/src/mascot.ts` の2ファイルのみ(CJK grep で確認済み)。

両方とも **`packages/action` がバンドルする CLI ソース**(または action 自身)に触れるため、
1つの PR にまとめて dist 再ビルド(オペレーター実機作業)を1回で済ませる。

## Current state

- **Action の applyScope 呼び出し**: `packages/action/src/index.ts:14-21` —

```ts
const analysis = await analyzeProject({ cwd: path });
const { config, version } = analysis;
const results = await applyScope(analysis.results, {
  cwd: path,
  diffBase: diff,
  baseline,
  errorLog: (line) => core.warning(line)
});
```

`config` は既にスコープにある。`ApplyScopeOptions.config`(`packages/cli/src/index.ts` —
Plan 023 で追加、JSDoc に「callers that don't pass a config keep their previous behavior」)
に渡すだけで suppressions が有効化される。

- **日本語コメント残存ファイル**(`grep -rlP '[぀-ヿ一-鿿]' packages/*/src --include='*.ts'` の結果):
  `packages/cli/src/baseline.ts`、`packages/cli/src/mascot.ts`。実ファイルを読み、
  CJK を含むコメント(docblock・行コメント)を意味を保って英訳する。**コード・文字列
  リテラルは変更しない**(mascot に日本語の表示文字列があれば、それはコメントではないので
  据え置き — コメントだけが対象)。
- **CLI 側の挙動テスト**: `packages/cli/test/run-suppressions.test.ts` が config 付き
  applyScope の suppressions 適用を既に固定している(action 側の1行はその経路に乗るだけ)。
- **サンドボックス制約(重要)**: `packages/action` の依存はこの環境にインストール不能
  (`tunnel` の `.idea/` 展開がブロック)。したがって **action の typecheck・テスト・
  dist 再ビルドはローカル実行不能** — CI の `check` ジョブが検証ゲート。
  `pnpm lint`(prettier + eslint)は action ソースにも効くので実行する。
- **docs**: `docs/src/content/docs/guides/ci.md`(+ja)に Plan 023 が足した
  「既存プロジェクトへの導入ランプ」段落がある — Action でも抑制ファイルが自動適用される旨を
  実文面に合わせて追記/更新する(実ファイルを読んで現行の文面に合わせること)。

## Commands you will need

| Purpose   | Command                                                                                                                     | Expected on success |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter svelte-vitals --filter @svelte-vitals/core --filter @svelte-vitals/mcp --filter @svelte-vitals/vite install` | exit 0              |
| Build     | `pnpm --filter svelte-vitals build`(core 未ビルドなら先に core)                                                             | exit 0              |
| Typecheck | 同4パッケージ `--filter … typecheck`(**action は CI 委譲**)                                                                 | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`                                                                                          | all pass            |
| Lint      | `pnpm lint`                                                                                                                 | exit 0              |
| Changeset | 手書き(@svelte-vitals/action: minor)                                                                                        | ファイル生成        |

## Scope

**In scope**:

- `packages/action/src/index.ts`(`config,` の1行)
- `packages/cli/src/baseline.ts`、`packages/cli/src/mascot.ts`(コメント英訳のみ)
- `docs/src/content/docs/guides/ci.md` + `ja/guides/ci.md`(Action の suppressions 言及)
- `.changeset/`

**Out of scope**:

- `packages/action/dist/` — **触らない**(オペレーターが実機で再ビルドして同ブランチに
  push する。executor はソースのみ)。
- Action への `no-suppressions` 入力の追加(需要が出てから。自動適用のみで CLI と対称)。
- `packages/core` / `packages/mcp` / `packages/vite`。
- コメント以外のコード変更(mascot.ts のロジック・表示文字列を含む)。

## Git workflow

- Branch: `advisor/026-action-suppressions-and-comment-sweep`
- コミットは2つに分割: `feat(action): apply the suppressions file in the action gate` /
  `docs(cli): translate remaining Japanese comments to English`
- PR 本文は英語。push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: Action の配線

`packages/action/src/index.ts` の `applyScope` オプションに `config,` を追加(上の抜粋の
`cwd: path,` の並び)。これだけ — Plan 023 の設計により、抑制ファイルがあれば自動適用され、
suppressed/stale 件数は `errorLog`(= `core.warning`)経由でジョブログに出る。

**Verify**: `pnpm lint` → exit 0(action の typecheck は CI 委譲 — NOTES に明記すること)

### Step 2: コメント英訳

`baseline.ts`(checkoutBaseline / filterToNewFindings の docblock ほか CJK を含む全コメント)と
`mascot.ts` の CJK コメントを英訳。意味・注意点(なぜそうするか)を落とさないこと。
終了時に `grep -rlP '[぀-ヿ一-鿿]' packages/*/src --include='*.ts'` が **0 件**
(コメント以外の日本語文字列リテラルが mascot にある場合はその行のみ許容 — NOTES で報告)。

**Verify**: `pnpm --filter svelte-vitals test` → all pass(コメントのみなので既存テスト不変)

### Step 3: docs + changeset

- `guides/ci.md`(+ja)の導入ランプ段落に「Action ワークフローでも
  `svelte-vitals-suppressions.json` は自動適用される」旨を追記(現行文面に自然に合流させる)。
- changeset: `@svelte-vitals/action` minor(英語。suppressions 適用の1点)。

**Verify**: build + 4パッケージ typecheck + `pnpm --filter svelte-vitals test` + `pnpm lint` → すべて exit 0

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0(action の typecheck/dist は CI 委譲と NOTES に明記)
- [ ] `packages/action/src/index.ts` の applyScope 呼び出しに `config` が渡っている
- [ ] `grep -rlP '[぀-ヿ一-鿿]' packages/*/src --include='*.ts'` がコメント由来 0 件
- [ ] docs(en/ja)+ changeset が揃っている
- [ ] `packages/action/dist/` に変更がない(`git status`)

## STOP conditions

- `applyScope` のシグネチャ/`config` の扱いが Plan 023 の記載と異なる。
- mascot.ts の CJK がコメントではなくロジックに絡む形で使われている(表示リテラルを除く)。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- **マージ前にオペレーターの実機作業が必須**: この PR は action がバンドルするソースを
  変えるため、`chore(action): rebuild dist/ …` コミットを実機(サンドボックス外)で
  同ブランチに積むまで CI の「Verify action dist is up to date」は red のまま。
- Action の suppressions は自動適用のみ(無効化入力なし)。要望が出たら `no-suppressions`
  入力を検討。
