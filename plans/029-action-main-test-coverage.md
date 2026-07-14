# Plan 029: `@svelte-vitals/action` の `main()` にテストを追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/action/src/index.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW(テスト追加のみ。プロダクションコードは変更しない)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`packages/action/src/index.ts` の `main()` は `@svelte-vitals/action` の全ロジック
(analyze → applyScope → GitHub annotations → job summary → sticky PR コメントの
作成/更新 → fork PR のスキップ判定 → 失敗ゲート)を1関数にまとめたもので、**このリポ
ジトリが生成する GitHub Actions ワークフローの実体そのもの** — 全ユーザーの PR マージ
判定がここを通る。

`packages/action/test/` には `fork.test.ts` と `sticky-comment.test.ts` の2ファイルし
かなく、どちらも `main()` が呼び出す**純粋な補助関数**(`isForkPR`/`planStickyComment`)
だけをテストしている。`main()` 自体 — octokit 呼び出し、fork スキップの分岐、コメント
の作成/更新の分岐、エラー握りつぶし、最終的な `setFailed` ゲート — は一切実行されない
まま今日に至る。`git log --oneline -- packages/action/src/index.ts` を見ると、直近でも
`3aad0e2`(suppressions 用に `config` を渡す変更)のように振る舞いに関わる変更が
テストなしでマージされている。

## Current state

`packages/action/src/index.ts`(全文、86行):

```ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeProject, applyScope } from 'svelte-vitals';
import { formatGithubReport, formatMarkdownReport, summarize, hasFailureAtOrAbove } from '@svelte-vitals/core';
import { isForkPR } from './fork.js';
import { planStickyComment, STICKY_COMMENT_MARKER } from './sticky-comment.js';

async function main(): Promise<void> {
  const path = core.getInput('path') || '.';
  const diff = core.getInput('diff') || undefined;
  const baseline = core.getInput('baseline') || undefined;
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

  const analysis = await analyzeProject({ cwd: path });
  const { config, version } = analysis;
  const results = await applyScope(analysis.results, {
    cwd: path,
    config,
    diffBase: diff,
    baseline,
    errorLog: (line) => core.warning(line)
  });

  const annotations = formatGithubReport(results, config);
  if (annotations) core.info(annotations);

  const markdown = formatMarkdownReport(results, config, { version });
  await core.summary.addRaw(markdown).write();

  const ctx = github.context;
  const pr = ctx.payload.pull_request;
  if (pr && token) {
    const headFullName = (pr as { head?: { repo?: { full_name?: string } } }).head?.repo?.full_name;
    const fork = isForkPR({
      eventName: ctx.eventName,
      repoFullName: `${ctx.repo.owner}/${ctx.repo.repo}`,
      headRepoFullName: headFullName
    });
    if (!fork) {
      try {
        const octokit = github.getOctokit(token);
        const body = `${STICKY_COMMENT_MARKER}\n${markdown}`;
        const { data: comments } = await octokit.rest.issues.listComments({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: pr.number,
          per_page: 100
        });
        const plan = planStickyComment(comments.map((c) => ({ id: c.id, body: c.body })));
        if (plan.op === 'update') {
          await octokit.rest.issues.updateComment({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            comment_id: plan.id,
            body
          });
        } else {
          await octokit.rest.issues.createComment({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            issue_number: pr.number,
            body
          });
        }
      } catch (err) {
        core.warning(
          `svelte-vitals: failed to post/update the PR comment: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  const summary = summarize(results, config);
  if (hasFailureAtOrAbove(summary, config.failOn)) {
    core.setFailed('svelte-vitals found blocking issues (see annotations above).');
  }
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
```

- `main` は `export` されていない — テストから直接呼ぶには **`export`を追加する必要
  がある**(唯一のプロダクションコード変更。振る舞いは変えない)。
- `packages/action/test/fork.test.ts`(全文、既存パターンの参考): `isForkPR` を直接
  import してテストするだけの素朴な `describe`/`it`。
- **モックの参考パターン** — `packages/vite/test/plugin-error.test.ts:1-14` が
  `vi.mock('../src/analyze.js', () => ({ analyze: vi.fn(async () => { throw ... }) }))`
  を `import { svelteVitals } from '../src/index.js'` より前に書くパターンを使ってい
  る。今回も同じ形で `@actions/core`・`@actions/github`・`svelte-vitals`・
  `@svelte-vitals/core` をモックする。
- **`action.yml`** の入力: `path`(default `.`)、`diff`、`baseline`、`github-token`
  (default `${{ github.token }}`)— テストで `core.getInput` のモックが返す値の対応
  関係を把握しておくこと。

## Commands you will need

| Purpose   | Command                                         | Expected on success                          |
| --------- | ----------------------------------------------- | -------------------------------------------- |
| Typecheck | `pnpm --filter @svelte-vitals/action typecheck` | exit 0 (ローカルで動く場合。下記 NOTES 参照) |
| Tests     | `pnpm --filter @svelte-vitals/action test`      | all pass                                     |
| Build     | `pnpm --filter @svelte-vitals/action build`     | exit 0 (同上)                                |
| Lint      | `pnpm lint`                                     | exit 0                                       |

**重要**: `packages/action` の依存(`@actions/core`/`@actions/github`)がサンドボック
ス環境にインストールできないことが過去のプラン(023/026)で確認されている
(`tunnel` パッケージの展開がブロックされるケースがある)。ローカルで `pnpm install`
が通らない場合は、**typecheck/build/test はローカル実行不能** — その旨を Maintenance
notes に明記し、CI の `check`/`test` ジョブでの検証に委ねる。まず
`pnpm --filter @svelte-vitals/action install`(または相当するコマンド)を試し、失敗
したら握りつぶさず正直に記録すること。

## Scope

**In scope**:

- `packages/action/src/index.ts`(`main` に `export` を追加する1行のみ。ロジックは
  一切変更しない)
- `packages/action/test/index.test.ts`(新規作成)

**Out of scope**:

- `main()` 内部のロジック変更・リファクタリング(このプランはテスト追加のみ)。
- `packages/action/dist/`(このプランはソースの `export` 追加のみで dist に影響する
  実害はないが、`main` に `export` を付けても tsup のビルド出力のトップレベル副作用
  は変わらないはず — ただし念のため Step 3 で dist の diff を確認すること)。
- `fork.ts`/`sticky-comment.ts` 自体(既にテスト済み、変更しない)。

## Git workflow

- Branch: `advisor/029-action-main-test-coverage`
- コミット: `test(action): cover main()'s PR-comment, fork-skip, and failure-gate branches`
  (英語、1コミットでよい)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `main` を export する

`packages/action/src/index.ts` の `async function main(): Promise<void> {` を
`export async function main(): Promise<void> {` に変更する。ファイル末尾の
`main().catch((err) => { core.setFailed(...); });` はそのまま(トップレベル実行の
副作用は維持する — これは `action.yml` の `main: 'dist/index.js'` が期待する実行時の
エントリポイントなので消してはいけない)。

**Verify**: この変更単体では振る舞いは変わらない。次のステップでテストから import
できることを確認する。

### Step 2: `packages/action/test/index.test.ts` を新規作成する

`packages/vite/test/plugin-error.test.ts` と同じ「`vi.mock` を先に書いてから対象
モジュールを import する」パターンで、以下のモックを用意する:

- `@actions/core` — `getInput`(呼び出し引数に応じて `path`/`diff`/`baseline`/
  `github-token` を返す)、`info`、`warning`、`setFailed`、`summary.addRaw().write()`
  をすべて `vi.fn()` でモックする(`summary` はチェーン可能なオブジェクトが必要 —
  `{ addRaw: vi.fn(() => ({ write: vi.fn(async () => {}) })) }` のような形)。
- `@actions/github` — `context`(`eventName`/`repo.owner`/`repo.repo`/
  `payload.pull_request` をテストケースごとに差し替えられるようにする)と
  `getOctokit`(`rest.issues.listComments`/`updateComment`/`createComment` を
  `vi.fn()` でモックした octokit ライクなオブジェクトを返す)。
- `svelte-vitals` — `analyzeProject`(固定の `{ results: [...], config: {...},
version: '0.0.0-test' }` を返す)と `applyScope`(受け取った `results` をそのまま
  返す、またはテストケースに応じて critical な finding を混ぜる)。
- `@svelte-vitals/core` — `formatGithubReport`・`formatMarkdownReport`・`summarize`・
  `hasFailureAtOrAbove` を、テストが分岐を制御できる程度の単純な `vi.fn()` にする
  (例: `hasFailureAtOrAbove` はテストごとに `true`/`false` を返すよう
  `mockReturnValueOnce` で切り替える)。

テストケース(すべて `main()` を直接呼び出し、各モックへの呼び出しをアサートする):

1. **同一リポジトリの PR、コメントなし** — `github.context.payload.pull_request` が
   設定され、`headRepoFullName === repoFullName`、`listComments` が空配列を返す →
   `octokit.rest.issues.createComment` が呼ばれ、`updateComment` は呼ばれないこと。
2. **同一リポジトリの PR、既存の sticky コメントあり** — `listComments` が
   `STICKY_COMMENT_MARKER` で始まる `body` を持つコメントを返す →
   `updateComment` が呼ばれ、`createComment` は呼ばれないこと。
3. **fork PR** — `isForkPR` が true になる `eventName`/`headRepoFullName` の組み合わ
   せ → `getOctokit` が一切呼ばれない(コメント関連の呼び出しがすべてスキップされる)
   こと。既存の annotations/summary 処理(`core.info`/`core.summary.addRaw`)は
   fork でも実行されることも併せて確認する。
4. **PR イベントではない(push など)** — `github.context.payload.pull_request` が
   `undefined` → コメント関連の分岐全体がスキップされ、`getOctokit` が呼ばれないこと。
5. **octokit がエラーを投げる**(例: `listComments` が reject する)→ `main()` 自体
   は reject せず完了し、`core.warning` が「failed to post/update the PR comment」
   を含むメッセージで呼ばれること。この失敗が `core.setFailed` を引き起こさないこと
   (コメント投稿の失敗は build を失敗させてはいけない、というコード中のコメントの
   契約)も確認する。
6. **`hasFailureAtOrAbove` が true を返す** → `core.setFailed` が
   `'svelte-vitals found blocking issues (see annotations above).'` で呼ばれること。
7. **`hasFailureAtOrAbove` が false を返す** → `core.setFailed` が一度も呼ばれない
   こと。

**Verify**: `pnpm --filter @svelte-vitals/action test`(ローカルで依存インストールが
可能な場合)→ all pass、7ケース以上 green。依存インストールが不能な場合は Step 4 で
その旨を記録した上で、CI での検証に委ねる。

### Step 3: 波及確認

`export` の追加が `packages/action/dist/` のビルド結果に予期しない差分を生まないか
確認する(依存インストール・ビルドが可能な環境であれば):

```
pnpm --filter @svelte-vitals/action build
git diff --stat -- packages/action/dist
```

差分が出た場合、意味のある変更(例: `main` が named export として出力されるようになる
こと自体は許容される正しい変化)であることを確認し、Maintenance notes に記録する。

### Step 4: 全体検証

**Verify**: `pnpm lint` → exit 0。`pnpm --filter @svelte-vitals/action typecheck`
（可能なら）→ exit 0。ローカルで `packages/action` の依存インストールができない場合
は、その事実と試したコマンド・エラーメッセージを Maintenance notes に記録し、
「CI の `check`/`test` ジョブでの検証が必要」と明記する。

## Test plan

- 新規: `packages/action/test/index.test.ts` — 上記7ケース(同一リポジトリ PR の
  新規/更新コメント、fork PR のスキップ、非 PR イベント、octokit 失敗時の非致命的
  警告、成功/失敗ゲートの両分岐)。
- 既存: `fork.test.ts`・`sticky-comment.test.ts` は無変更のまま green であること。
- 検証: `pnpm --filter @svelte-vitals/action test` → all pass、新規7ケース以上を
  含む。

## Done criteria

- [ ] `packages/action/src/index.ts` の `main` が `export` されている
- [ ] `packages/action/test/index.test.ts` が新規作成され、上記7ケースをすべてカバー
- [ ] `pnpm --filter @svelte-vitals/action test` が all pass(ローカルで実行可能な場
      合)、または CI での実行結果で確認済み
- [ ] `pnpm lint` が exit 0
- [ ] `main()` 内部のロジックが1文字も変わっていない(`git diff -- packages/action/src/index.ts`
      で `export` の追加のみであることを確認)
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `packages/action` の依存インストールがサンドボックスで不能(過去のプラン023/026と
  同様の症状)で、かつテストをローカルで一度も実行して確認できない場合、書いたテスト
  コードをレビュー可能な形で残しつつ、「CI 実行が必須の検証ゲート」であることを明記
  して報告する — 見えないまま「動作確認済み」と主張しない。
- モックの型(`@actions/core`/`@actions/github` の型定義)が想定と異なりテストの
  コンパイルが通らない場合、型を無理に `any` で回避せず、実際の型定義ファイル
  (`node_modules/@actions/*/lib/*.d.ts` など、インストールできていれば)を確認して
  から対応する。2回試して解決しなければ STOP。

## Maintenance notes

- 今後 `main()` に新しい分岐(例: 別の入力オプション追加)を加える PR のレビュアーは、
  このテストファイルに対応するケースが追加されているかを確認すること — このプランの
  存在意義は「`main()` の変更には必ずテストが伴う」という規範を作ることにある。
- サンドボックスで `packages/action` の依存インストールができなかった場合、その制約
  は変わらず残るため、次にこのパッケージを触るプランも同じ制約(CI 依存の検証)を
  引き継ぐ。
