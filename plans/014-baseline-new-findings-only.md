# Plan 014: `--baseline <ref>` — 変更が「新たに導入した」finding だけを報告する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d0c76c9..HEAD -- packages/cli/src/index.ts packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/cli/src/changed-files.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED(git worktree の生成・破棄が絡む — 失敗時は必ず「フィルタなしで続行+警告」に倒す)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `d0c76c9`, 2026-07-08

## Why this matters

現在の `--diff [ref]` は「変更されたファイルに絞る」フィルタであり、変更ファイル上に
**元からあった** finding も混ざって報告される。PR ゲートとしては「この変更が新たに
導入した issue だけを報告し、既存の負債では落とさない」挙動が求められる(plans/README.md の
方向性メモ DIR-03 が指す導入ランプの中核)。本計画で `--baseline <ref>` を追加する:
基準 ref 時点のプロジェクトを解析して finding 集合を取り、現在の finding から差し引く。
Plan 015(CI scaffolding)が生成するワークフローはこのフラグを前提にする。

## Current state

- `packages/cli/src/changed-files.ts` — `--diff`/`--staged` の git 層。
  `getChangedFiles(cwd, opts): Set<string> | undefined`(失敗時 `undefined`)と
  `filterToChangedFiles(results, changed)`(`location` が変更ファイル集合に含まれる
  finding のみ残す)。**ファイル単位**のフィルタであり、finding の新旧は見ない。
- `packages/cli/src/index.ts:226-239` — `run()` 内のフィルタ適用点:

```ts
// --staged / --diff: scope findings to the changed files (gate "what the agent wrote").
if (opts.staged || opts.diffBase !== undefined) {
  const cwd = opts.cwd ?? process.cwd();
  const changed = opts.staged ? getChangedFiles(cwd, { staged: true }) : getChangedFiles(cwd, { base: opts.diffBase });
  if (changed === undefined) {
    errorLog(
      'svelte-vitals: could not determine changed files (not a git repo, git unavailable, or bad ref); analyzing all.'
    );
  } else {
    results = filterToChangedFiles(results, changed);
  }
}
```

- `packages/cli/src/resolve-args.ts:122-124` — フラグの正規化(`--diff` 単独 → `'HEAD'`):

```ts
// --diff (string): `--diff` alone → '' ⇒ default base 'HEAD'; `--diff main` → 'main'.
const diffBase = typeof argv.diff === 'string' ? argv.diff || 'HEAD' : undefined;
const staged = Boolean(argv.staged);
```

- `packages/cli/src/bin.ts:51-67` — mri のパース設定。`string` 配列に `'diff'` 等が並ぶ。
  ヘルプ文字列は bin.ts:8-40。
- `analyzeProject(opts)`(`packages/cli/src/index.ts:137-171`)— 解析の唯一の入口。
  `cwd` を受け、config ファイルは **その cwd から**読まれる(`loadConfigFile(cwd)`)。
  ベースライン解析でも同関数を worktree の cwd で呼べばよい(基準 ref 時点の config が
  自然に適用される — これは意図した仕様とする)。
- `Result` 型(`packages/core/src/types.ts`)— finding は `id`、任意の `route` /
  `location` / `line` を持つ。
- テストの流儀: `packages/cli/test/run-diff.test.ts` が git 層(`changed-files.js`)を
  `vi.mock` して `run()` の挙動を固定している。本計画も同じ形で baseline 層をモックする。

## Commands you will need

| Purpose   | Command                                  | Expected on success |
| --------- | ---------------------------------------- | ------------------- |
| Install   | `pnpm install`                           | exit 0              |
| Build     | `pnpm build`                             | exit 0              |
| Typecheck | `pnpm typecheck`                         | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`       | all pass            |
| Lint      | `pnpm lint`                              | exit 0              |
| Changeset | `pnpm changeset`(minor, `svelte-vitals`) | ファイル生成        |

## Scope

**In scope**(変更してよいファイル):

- `packages/cli/src/baseline.ts`(新規)
- `packages/cli/src/index.ts`(`RunOptions` 追加 + `run()` のフィルタ配線)
- `packages/cli/src/resolve-args.ts`、`packages/cli/src/bin.ts`(フラグ)
- `packages/cli/test/baseline.test.ts`、`packages/cli/test/run-baseline.test.ts`(新規)
- `packages/cli/test/resolve-args.test.ts`(ケース追加)
- `docs/src/content/docs/guides/cli.md` と `docs/src/content/docs/ja/guides/cli.md`
- `.changeset/`(新規 changeset 1件)

**Out of scope**(触らない):

- `packages/core` 全体 — finding の同一性判定は CLI 層の関心。core にキー関数を足さない。
- `packages/mcp` — MCP への `baseline` 入力追加は需要が出てから(Maintenance notes 参照)。
- `changed-files.ts` の既存挙動 — `--diff`/`--staged` の意味は変えない。

## Git workflow

- Branch: `advisor/014-baseline-new-findings-only`
- Conventional commits、例: `feat(cli): add --baseline <ref> to report only newly introduced findings`
- PR 本文は英語。**他社ベンチマークツール名をコミット/PR/docs に書かない**(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `packages/cli/src/baseline.ts` を新規作成

以下の 3 関数を実装する。`changed-files.ts` の「git が答えられなければ `undefined`」
という契約(JSDoc 含む)に合わせること。

```ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Result } from '@svelte-vitals/core';

/** finding の同一性キー。line は含めない — 無関係な行ズレで「新規」誤検出しないため。 */
export function findingKey(r: Result): string {
  return `${r.id}::${r.route ?? ''}::${r.location ?? ''}`;
}

/**
 * `ref` 時点のプロジェクトを一時 git worktree に展開し、そのパス(解析すべき cwd)を返す。
 * 返り値 undefined = git が答えられない(repo 外 / ref 不在 / git 不在)。
 * 呼び出し側は必ず cleanup コールバックを finally で呼ぶこと。
 */
export function checkoutBaseline(cwd: string, ref: string): { analyzeCwd: string; cleanup: () => void } | undefined {
  /* … */
}

/** 現在の results から、baseline に存在した finding(同一キー)を取り除く。 */
export function filterToNewFindings(results: Result[], baselineResults: Result[]): Result[] {
  /* … */
}
```

`checkoutBaseline` の実装要件:

1. `git rev-parse --show-toplevel` と `git rev-parse --show-prefix` を `cwd` で実行し、
   リポジトリルートとルートからの相対パスを得る(`changed-files.ts` と同じく
   `execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })`)。
2. `mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-'))` で一時ディレクトリを作り、
   `git worktree add --detach <tmp>/wt <ref>` をリポジトリルートで実行する。
3. `analyzeCwd = join(<tmp>/wt, showPrefix)` — モノレポのサブディレクトリ実行
   (Plan 001 で直した `--relative` と同じ理由)に対応する。
4. `cleanup` は `git worktree remove --force <tmp>/wt` を実行し、失敗しても
   `rmSync(tmp, { recursive: true, force: true })` まで必ず行う(worktree remove が
   失敗したら `git worktree prune` も best-effort で呼ぶ)。cleanup 自体は throw しない。
5. どの git 呼び出しが失敗しても `undefined` を返す(部分的に作った tmp は消す)。

**Verify**: `pnpm --filter svelte-vitals typecheck`(package に個別 typecheck が無ければ
`pnpm typecheck`)→ exit 0

### Step 2: `run()` に配線する

- `RunOptions`(`packages/cli/src/index.ts:35-67`)に
  `/** Report only findings not present when analyzing this git ref (e.g. the PR base). */ baseline?: string;` を追加。
- `run()` の既存 `--staged / --diff` ブロック(index.ts:226-239)の**直後**に追加:

```ts
if (opts.baseline !== undefined) {
  const cwd = opts.cwd ?? process.cwd();
  const checkout = checkoutBaseline(cwd, opts.baseline);
  if (checkout === undefined) {
    errorLog(
      `svelte-vitals: could not analyze baseline '${opts.baseline}' (not a git repo, git unavailable, or bad ref); reporting all findings.`
    );
  } else {
    try {
      const base = await analyzeProject({
        cwd: checkout.analyzeCwd,
        metaComponents: opts.metaComponents,
        treatDynamicAs: opts.treatDynamicAs,
        route: opts.route,
        failOn: opts.failOn,
        rules: opts.rules,
        weights: opts.weights
      });
      results = filterToNewFindings(results, base.results);
    } catch {
      errorLog(`svelte-vitals: baseline analysis of '${opts.baseline}' failed; reporting all findings.`);
    } finally {
      checkout.cleanup();
    }
  }
}
```

順序が重要: `--diff`(ファイル絞り込み)→ `--baseline`(新規絞り込み)の順で合成可能に
する。ベースライン解析の失敗は**常に非致命**(警告してフィルタなし続行)— `--diff` の
`undefined` 分岐(index.ts:232-235)と同じ思想。

**Verify**: `pnpm typecheck` → exit 0

### Step 3: フラグを追加する

- `resolve-args.ts`: `const baselineRef = typeof argv.baseline === 'string' && argv.baseline.trim() !== '' ? argv.baseline : undefined;`
  を追加し、`options` に `...(baselineRef !== undefined ? { baseline: baselineRef } : {})` を足す。
  `--baseline` が値なし(mri は `''` を返す)の場合は fatal error を push する:
  `svelte-vitals: --baseline requires a git ref (e.g. --baseline origin/main).`
  (`--diff` と違いデフォルト HEAD にしない — HEAD 比較は「未コミット変更の新規分」で
  意味はあるが、暗黙のデフォルトにすると CI での指定漏れに気づけない。)
- `bin.ts`: mri の `string` 配列に `'baseline'` を追加し、ヘルプ(bin.ts:18-19 の
  `--diff`/`--staged` の直後)に 1 行足す:
  `--baseline <ref>            Report only findings not present at ref (compare against e.g. origin/main)`

**Verify**: `pnpm --filter svelte-vitals build && node packages/cli/dist/bin.js --help | grep baseline` → ヘルプ行が出る

### Step 4: テスト

- `packages/cli/test/baseline.test.ts`(新規): `findingKey` と `filterToNewFindings` の
  純粋ロジック(同一キーの除去 / route・location 欠落時 / line 差は同一扱い)。
  さらに `checkoutBaseline` の実 git 統合テストを 1 本: `mkdtemp` に実リポジトリを
  `git init` → コミット2つ → 旧コミットを baseline に checkout し、`analyzeCwd` の中身が
  旧コミットの内容であること・`cleanup()` 後に worktree が消えることを確認
  (`changed-files.test.ts` が実 git を使っているならその流儀に合わせる)。
- `packages/cli/test/run-baseline.test.ts`(新規): `run-diff.test.ts` の
  `vi.mock` パターンを踏襲し `../src/baseline.js` をモックして、
  (1) baseline に存在する finding が除去され exit 0 になる、
  (2) `checkoutBaseline` が `undefined` の時に警告して全 finding 報告、
  (3) `--diff` と併用時に両フィルタが順に効く、を固定する。
- `resolve-args.test.ts`: `--baseline main` が options に載る / 値なし `--baseline` が
  errors になる、の 2 ケース追加。

**Verify**: `pnpm --filter svelte-vitals test` → all pass(新規テスト含む)

### Step 5: docs + changeset

- `docs/src/content/docs/guides/cli.md` の `--diff`/`--staged` 節の並びに `--baseline` 節を
  追加(PR ゲートでの推奨: `--diff origin/main --baseline origin/main` の併用例)。
  `docs/src/content/docs/ja/guides/cli.md` にも**同内容の日本語版**を必ず追加(en/ja 同期規約)。
- `pnpm changeset` で `svelte-vitals` パッケージに minor を切る(本文は英語)。

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0

## Test plan

上記 Step 4 の通り。パターン元: `packages/cli/test/run-diff.test.ts`(モック構成)、
`packages/cli/test/changed-files.test.ts`(git 層)。新規テストは最低 8 ケース。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] `node packages/cli/dist/bin.js --help` に `--baseline` が載る
- [ ] `filterToNewFindings` / `checkoutBaseline` 失敗経路のテストが存在し pass
- [ ] `docs/src/content/docs/guides/cli.md` と `ja/guides/cli.md` の両方に節がある
- [ ] `.changeset/` に minor エントリがある
- [ ] In scope 外のファイルに変更がない(`git status`)
- [ ] `plans/README.md` の 014 行を更新

## STOP conditions

- "Current state" の抜粋が実コードと一致しない(ドリフト)。
- `git worktree add` がテスト環境で動かない(git バージョン都合など)— 代替実装
  (`git archive` 展開)に**勝手に切り替えず**報告する。
- ベースライン解析が fixture で 5 秒を超えるなど、明らかに遅い — 設計見直しを報告。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- **キーに line を含めない**トレードオフ: 同一ファイル内で同じルールの 2 個目の違反を
  新規に足しても既存 1 個目に隠れて報告されない。運用で問題になったら
  「baseline 側の同一キー数を数え、超過分だけ新規扱い」に拡張する。
- Plan 015 の CI ワークフローは `--baseline origin/${{ github.base_ref }}` を使う。
  checkout の `fetch-depth: 0`(または base ref の明示 fetch)が前提 — shallow clone だと
  ref 不在で警告フォールバックする。
- MCP の `analyze` ツールへの `baseline` 入力追加は意図的に見送り(I/O と一時 worktree の
  ライフサイクルをツール呼び出しに持ち込む判断が必要)。需要が出たら別計画。
- DIR-03 の「抑制ファイル型 baseline」(現状を記録して恒久的に受け入れる)とは別物。
  両方やる場合、フラグ名の整合(`--baseline` は ref 比較、ファイル型は別名)に注意。
