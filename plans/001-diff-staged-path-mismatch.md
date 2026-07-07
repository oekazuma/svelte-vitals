# Plan 001: `--diff`/`--staged` をプロジェクトが git リポジトリのサブディレクトリにある場合でも正しく機能させる

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/cli/src/changed-files.ts packages/cli/test/changed-files.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

`svelte-vitals --diff` / `--staged` は「変更したファイルの所見だけを報告する」CI/pre-commit ゲートだが、解析対象の SvelteKit プロジェクトが git リポジトリのルートに**ない**場合(モノレポの `apps/web/` 等)、全所見が黙って落ちて exit 0 になる。原因はパス基準の不一致: `git diff --name-only` の出力は**リポジトリルート相対**(例 `apps/web/src/routes/+page.svelte`)なのに対し、所見の `location` は**解析 cwd 相対**(例 `src/routes/+page.svelte`)なので、`changed.has(location)` が常に false になる。ゲートとして使うユーザーにとって最悪の故障モード(偽陰性の素通し)である。

さらに微妙な点: `git ls-files --others`(未追跡ファイルの合流)はデフォルトで **cwd 相対**を返すため、未追跡ファイルだけは正しく比較され、追跡済みファイルの diff だけが壊れる — 症状が一貫せずユーザーが気付きにくい。

## Current state

- `packages/cli/src/changed-files.ts` — 変更ファイル集合の取得とフィルタ。全体で 47 行。

```ts
// packages/cli/src/changed-files.ts:25-37(現状)
export function getChangedFiles(cwd: string, opts: ChangedFilesOptions): Set<string> | undefined {
  try {
    const files = opts.staged
      ? git(['diff', '--name-only', '--cached', '--diff-filter=d'], cwd)
      : [
          ...git(['diff', '--name-only', '--diff-filter=d', '--merge-base', opts.base ?? 'HEAD'], cwd),
          ...git(['ls-files', '--others', '--exclude-standard'], cwd) // untracked / new files
        ];
    return new Set(files.map((s) => s.trim()).filter(Boolean));
  } catch {
    return undefined;
  }
}
```

```ts
// packages/cli/src/changed-files.ts:44-46(現状)
export function filterToChangedFiles(results: Result[], changed: Set<string>): Result[] {
  return results.filter((r) => r.location !== undefined && changed.has(r.location));
}
```

- 所見の `location` の由来: `packages/cli/src/index.ts:143` の `collectComponentFacts(rt, cwd)` と `collectRoutes(rt, cwd)` は `rt.glob('src/**/*.svelte', cwd)` 等で **cwd 相対**パス(`src/...`)を生成し、それが `Result.location` になる。
- 呼び出し箇所: `packages/cli/src/index.ts:203-215` — `run()` が `getChangedFiles(cwd, ...)` を呼び、`filterToChangedFiles(results, changed)` でフィルタする。この呼び出し側は変更不要。
- 既存テスト: `packages/cli/test/changed-files.test.ts` は `filterToChangedFiles` の純関数テストのみ(git 実行なし)。`packages/cli/test/run-diff.test.ts` は `getChangedFiles` を `vi.mock` して `run()` のゲート動作をテストする。**実際の git を使うテストは存在しない** — 今回のバグが素通りした理由。

## 修正方針

`git diff` に `--relative` オプションを追加する。`--relative` は出力パスを cwd 相対に変換し、かつ cwd 外のファイルを除外する — まさに必要な動作。`git ls-files --others` は元々 cwd 相対・cwd 配下限定なので変更不要。

## Commands you will need

| Purpose    | Command                                 | Expected on success |
| ---------- | --------------------------------------- | ------------------- |
| Install    | `pnpm install`                          | exit 0              |
| Typecheck  | `pnpm --filter svelte-vitals typecheck` | exit 0              |
| Tests      | `pnpm --filter svelte-vitals test`      | all pass            |
| Lint       | `pnpm lint`                             | exit 0              |
| 全体テスト | `pnpm test`                             | all pass            |

## Scope

**In scope** (the only files you should modify):

- `packages/cli/src/changed-files.ts`
- `packages/cli/test/changed-files.test.ts`(テスト追加)

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/index.ts` — 呼び出し側のロジックは正しい。フィルタの比較基準を直すのはここではない。
- `packages/cli/test/run-diff.test.ts` — `getChangedFiles` をモックしており、この修正の影響を受けない。
- `Result.location` の形式変更 — 全レポーターが cwd 相対パスに依存している。

## Git workflow

- Branch: `advisor/001-diff-staged-path-mismatch`
- コミットメッセージは conventional commits(リポジトリ慣習)。例: `fix(cli): make --diff/--staged work when the project is not at the git repo root`
- ユーザー向け変更なので `pnpm changeset` で patch changeset を追加する(`svelte-vitals` パッケージ、patch)。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `--relative` を両方の diff 呼び出しに追加

`packages/cli/src/changed-files.ts` の `getChangedFiles` を変更:

```ts
const files = opts.staged
  ? git(['diff', '--name-only', '--relative', '--cached', '--diff-filter=d'], cwd)
  : [
      ...git(['diff', '--name-only', '--relative', '--diff-filter=d', '--merge-base', opts.base ?? 'HEAD'], cwd),
      ...git(['ls-files', '--others', '--exclude-standard'], cwd)
    ];
```

関数の doc コメント(15-24 行目)も更新し、「パスは **`cwd` 相対**(`--relative`)であり、`Result.location` と同じ基準」であることと、`ls-files --others` が元々 cwd 相対である旨を1〜2文で記す。

**Verify**: `pnpm --filter svelte-vitals typecheck` → exit 0

### Step 2: 実 git リポジトリを使う回帰テストを追加

`packages/cli/test/changed-files.test.ts` に `getChangedFiles` の describe ブロックを追加。`node:fs` の `mkdtempSync` + `node:child_process` の `execFileSync('git', ...)` で一時リポジトリを作る:

1. 一時ディレクトリに `git init`(`git config user.email/user.name` をローカル設定し、`commit` が CI でも動くようにする)
2. サブディレクトリ `apps/web/src/routes/` を作り `+page.svelte` をコミット
3. ファイルを変更(未コミット)し、`getChangedFiles(join(repo, 'apps/web'), { base: 'HEAD' })` を呼ぶ
4. 期待値: `Set { 'src/routes/+page.svelte' }`(**cwd 相対** — これが回帰の核心)
5. 同様に `--staged`(`git add` 後、`{ staged: true }`)と、未追跡ファイル(`ls-files --others` 経路)のケースも 1 ケースずつ
6. リポジトリルート直下で実行した場合(サブディレクトリなし)も従来どおり動くケースを 1 つ

テスト後は `afterEach`/`afterAll` で一時ディレクトリを `rmSync(dir, { recursive: true, force: true })` する。既存の `filterToChangedFiles` テスト(同ファイル)の構造・スタイルに合わせる。

**Verify**: `pnpm --filter svelte-vitals test` → all pass(新規 4+ ケースを含む)

### Step 3: changeset を追加

`pnpm changeset` は対話式なので、`.changeset/<slug>.md` を直接作成してもよい:

```md
---
'svelte-vitals': patch
---

Fix `--diff`/`--staged` silently reporting zero findings when the analyzed project is not at the git repository root (monorepos): git paths are now resolved relative to the analyzed directory.
```

**Verify**: `pnpm lint` → exit 0

## Test plan

- 新規テスト(Step 2 の 4+ ケース)を `packages/cli/test/changed-files.test.ts` に追加。パターンは同ファイルの既存 describe に合わせる。
- 回帰の核心ケース: 「git ルート ≠ 解析 cwd」で cwd 相対パスが返ること。
- Verification: `pnpm test` → 全パッケージで all pass。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0(新規テスト含む)
- [ ] `grep -n "relative" packages/cli/src/changed-files.ts` が両方の diff 呼び出しでヒットする
- [ ] `git status` で in-scope 外のファイルに変更がない(changeset ファイルを除く)
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- "Current state" の抜粋が実コードと一致しない(コードベースがドリフトしている)。
- Step 2 のテストで `git ls-files --others` が cwd 相対**でない**パスを返す(この計画の前提が false — その場合は ls-files 出力にも正規化が必要になる)。
- CI 環境等で `git init` を使うテストが 2 回の修正でも安定しない。
- 修正が `packages/cli/src/index.ts` の変更を必要とするように見える。

## Maintenance notes

- 将来 `--diff` の比較対象に「リポジトリ全体の変更(cwd 外含む)」を渡したくなった場合、`--relative` が cwd 外のファイルを**除外する**仕様であることに注意(現状はそれが望ましい挙動)。
- レビューで見るべき点: Windows での git 出力は POSIX 区切りなので `Result.location`(同じく POSIX)との比較は問題ないこと。
- 明示的にやらないこと: `filterToChangedFiles` の API 変更(現行シグネチャで十分)。
