# Plan 019: モノレポで SvelteKit アプリを自動検出し、選択式で解析対象を選べるようにする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dad2cce..HEAD -- packages/cli/src/index.ts packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/cli/src/providers/source/project.ts packages/cli/src/runtime/node.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW(既存の成功経路は不変 — 現在 exit 2 で死んでいる経路だけが変わる)
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `dad2cce`, 2026-07-08

## Why this matters

モノレポのルートで `npx svelte-vitals` を実行すると、現在は exit 2
(「No SvelteKit project found…」)の行き止まりで、ユーザーは `./apps/web` のような
path を知って打つ必要がある。この行き止まりを「SvelteKit アプリの自動検出 + 選択」に
変える(メンテナー要望・2026-07-08)。設計は Accepted 済みの
`docs/superpowers/specs/2026-07-08-monorepo-app-picker-design.md`(Step 1 で本計画が
リポジトリに作成する — 内容は本計画の Appendix A が正)。**設計書と本計画が食い違ったら
Appendix A に従い、その旨を報告すること。**

決定済みの要件(メンテナー承認):

1. **発動は失敗時のみ**: path 引数なし かつ `detectProject` が `ProjectError` を投げた時だけ。
   明示 path での失敗は従来どおり即エラー(ユーザーの指定を読み替えない)。
2. **非TTY では絶対にプロンプトを出さない**: 検出一覧 + `npx svelte-vitals apps/web` の
   案内を含む exit 2 エラー。
3. **TTY で 1 件検出**: stderr に通知して自動続行。
4. **TTY で複数検出**: `@clack/prompts` の select で単一選択。キャンセルは exit 0。

## Current state

- **プロジェクト検出**: `packages/cli/src/providers/source/project.ts:24-47` —
  `detectProject(rt, cwd)` は「package.json に `@sveltejs/kit`」または
  「svelte.config.{js,ts} + src/routes」で合格、それ以外は throw:

```ts
throw new ProjectError(
  'No SvelteKit project found in the current directory. ' + 'Run this inside a SvelteKit app, or pass --config.'
);
```

※ 末尾の `--config` は**存在しないフラグ**(古い文言)。本計画で是正する(Step 2)。

- **run() の ProjectError 処理**: `packages/cli/src/index.ts` の `run()` 内 —
  `analyzeProject` を try し、`err instanceof ProjectError` なら `errorLog(err.message)` して
  return 2。スピナーは catch 内で `spinner.stop()` 済み。
- **cwd の由来**: `packages/cli/src/resolve-args.ts` の `resolveArgs` が
  `cwd: positional ?? process.cwd()` を options に入れる — つまり現状 `run()` からは
  「明示 path か否か」が区別できない。本計画で `explicitPath: positional !== undefined` を
  options に追加して区別する(Step 3)。
- **glob**: `packages/cli/src/runtime/node.ts` が `tinyglobby` を直接 import している
  (`glob(pattern, { cwd, dot: false })`)。`tinyglobby` は CLI パッケージの依存として
  利用可能で、`ignore` / `deep` オプションを持つ。検出モジュールは CLI 層の関心なので
  core の `Runtime` を経由せず tinyglobby を直接使ってよい。
- **プロンプト注入の前例**: `packages/cli/src/install/index.ts` — `runInstall(flags, io, prompts)`
  が `InstallPrompts`(clack 実装は `install/cli.ts` の `clackPrompts()`)を注入で受ける。
  clack は `index.ts`(run 本体)に import しない — bin.ts 側の配線で注入する。
- **TTY 判定の前例**: `RunOptions` に `stdoutIsTTY` / `stderrIsTTY` のテスト用オーバーライドが
  既にある。プロンプト可否は `opts.stdoutIsTTY ?? !!process.stdout.isTTY` を使う。
- **fixture の前例**: `packages/cli/test/fixtures/basic-project/`(svelte.config +
  src/routes 構成)。テストは `run({ cwd: fixtureDir, log, errorLog, env: CLEAN_ENV })` +
  capture パターン(`packages/cli/test/run-diff.test.ts` 参照)。

## Commands you will need

| Purpose   | Command                                                                                   | Expected on success |
| --------- | ----------------------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter "./packages/**" install`                                                   | exit 0              |
| Build     | `pnpm --filter "./packages/**" build`                                                     | exit 0              |
| Typecheck | `pnpm typecheck`                                                                          | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`                                                        | all pass            |
| Lint      | `pnpm lint`                                                                               | exit 0              |
| Changeset | changeset ファイルを手書き(svelte-vitals: minor、既存 `.changeset/*.md` の形式に合わせる) | ファイル生成        |

## Scope

**In scope**:

- `docs/superpowers/specs/2026-07-08-monorepo-app-picker-design.md`(新規 — Appendix A の内容で作成)
- `packages/cli/src/discover-apps.ts`(新規)
- `packages/cli/src/index.ts`(`RunOptions` 拡張 + `run()` の ProjectError 分岐)
- `packages/cli/src/resolve-args.ts`(`explicitPath`)、`packages/cli/src/bin.ts`(clack picker の配線)
- `packages/cli/src/providers/source/project.ts`(エラーメッセージ文言のみ)
- `packages/cli/test/discover-apps.test.ts`、`run-discover.test.ts`(新規)、
  `resolve-args.test.ts`(ケース追加)、`packages/cli/test/fixtures/monorepo-project/`(新規 fixture)
- `docs/src/content/docs/guides/cli.md` + `ja/guides/cli.md`(モノレポ節)、`README.md`(1〜2行)
- `.changeset/`

**Out of scope**:

- `packages/core` / `packages/mcp` / `packages/vite` — 検出は CLI の UX の関心。
  `analyzeProject` は従来どおり throw する(検出は `run()` 層)。
- 複数アプリの一括実行・Health 集計。
- workspace マニフェスト(`pnpm-workspace.yaml` 等)の解析。
- `detectProject` の合格条件そのもの(メッセージ文言以外は触らない)。

## Git workflow

- Branch: `advisor/019-monorepo-app-picker`
- Conventional commits、例: `feat(cli): detect SvelteKit apps in a monorepo and offer a picker`
- PR 本文は英語。他社ベンチマークツール名をコミット/PR/docs に書かない(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 設計書をリポジトリに作成

`docs/superpowers/specs/2026-07-08-monorepo-app-picker-design.md` を **Appendix A の内容そのまま**で作成する(改変しない)。

**Verify**: `test -f docs/superpowers/specs/2026-07-08-monorepo-app-picker-design.md` → exit 0

### Step 2: `discover-apps.ts` とエラーメッセージ是正

`packages/cli/src/discover-apps.ts` 新規:

```ts
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { glob } from 'tinyglobby';

/**
 * Find SvelteKit apps under `cwd` for the monorepo picker (design doc
 * 2026-07-08-monorepo-app-picker-design.md): directories containing
 * svelte.config.{js,ts} AND src/routes (excludes component libraries, which
 * have a config but nothing to analyze). Returns sorted cwd-relative POSIX
 * paths. Depth-capped and ignore-listed so a huge repo stays fast.
 */
export async function discoverApps(cwd: string): Promise<string[]> {
  const configs = await glob('**/svelte.config.{js,ts}', {
    cwd,
    dot: false,
    deep: 4,
    ignore: ['**/node_modules/**', '**/.svelte-kit/**', '**/build/**', '**/dist/**', '**/.git/**']
  });
  const dirs = [...new Set(configs.map((c) => dirname(c)))].filter((d) => existsSync(join(cwd, d, 'src', 'routes')));
  return dirs.sort();
}
```

注: cwd 直下(`dirname` が `'.'`)は「detectProject が既に失敗した場所」なので候補に
含めない(`.filter((d) => d !== '.')` を上記 filter に加える)。

`packages/cli/src/providers/source/project.ts` のメッセージを是正:

```ts
throw new ProjectError(
  'No SvelteKit project found in the current directory. Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web).'
);
```

既存テストがこの文言に依存していないか `grep -rn "pass --config" packages/` で確認し、
依存があればテストの期待値も追随させる。

**Verify**: `pnpm typecheck` → exit 0、`grep -rn "pass --config" packages/` → 0 件

### Step 3: `run()` に検出+選択の分岐を追加

- `resolve-args.ts`: options に `explicitPath: positional !== undefined` を追加
  (`ResolvedArgs` 経由で `run` に渡る)。
- `RunOptions`(index.ts)に追加:

```ts
/** True when the user passed a path argument — discovery must not run (design: never reinterpret an explicit target). */
explicitPath?: boolean;
/** Injected picker for the monorepo app selector (bin.ts wires a clack implementation; null = cancelled). */
selectApp?: (apps: string[]) => Promise<string | null>;
```

- `run()` の `catch (err)` 内、`err instanceof ProjectError` の分岐を次のロジックに変える
  (`analyzeProject` の呼び出しは既存の引数のまま関数化するか、素直に再呼び出しする):

```
if ProjectError:
  spinner.stop() は既存どおり
  if opts.explicitPath → errorLog(err.message); return 2      // 従来挙動
  apps = await discoverApps(cwd)
  if apps.length === 0 → errorLog(err.message); return 2       // 従来挙動(文言は Step 2 の新版)
  if apps.length === 1:
    errorLog(`svelte-vitals: detected SvelteKit app at ${apps[0]}; analyzing it.`)
    chosen = apps[0]
  else if (opts.stdoutIsTTY ?? !!process.stdout.isTTY) && opts.selectApp:
    chosen = await opts.selectApp(apps)
    if chosen === null → log('Cancelled.'); return 0
  else:
    errorLog(`svelte-vitals: multiple SvelteKit apps found: ${apps.join(', ')}.`)
    errorLog(`svelte-vitals: pass one as a path, e.g. \`npx svelte-vitals ${apps[0]}\`.`)
    return 2
  effectiveCwd = join(cwd, chosen)
  analysis = await analyzeProject({ ...同じオプション, cwd: effectiveCwd })   // 再 throw はそのまま exit 2 経路へ
```

- **重要**: 選択後の `--diff`/`--staged`/`--baseline` ブロックと `checkoutBaseline` は
  現在 `opts.cwd ?? process.cwd()` を都度計算している — これらが**選択後の cwd** を見るよう、
  `run()` 冒頭で `let cwd = opts.cwd ?? process.cwd()` を1回計算して全箇所をその変数に
  統一し、選択時に `cwd = join(cwd, chosen)` と再代入する。
- 再実行時のスピナーは不要(停止済みのまま進めてよい — 一瞬の解析であり、プロンプト直後に
  スピナーを再起動するとログが乱れる)。
- `analyzeProject` の warnings(config ファイル警告)は再実行分が `analysis.warnings` として
  従来どおり出力されることを確認する。

- `bin.ts`: `run({ ...options, minHealth, noColor, selectApp })` の形で clack 実装を注入:

```ts
import * as p from '@clack/prompts';

async function selectApp(apps: string[]): Promise<string | null> {
  const res = await p.select({
    message: 'Multiple SvelteKit apps found — which one should svelte-vitals analyze?',
    options: apps.map((a) => ({ value: a, label: a }))
  });
  return p.isCancel(res) ? null : (res as string);
}
```

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck` → exit 0

### Step 4: fixture とテスト

fixture `packages/cli/test/fixtures/monorepo-project/`:

```
apps/web/svelte.config.js            // 空 export でよい: `export default {};`
apps/web/src/routes/+page.svelte     // basic-project の +page.svelte を参考に最小構成
apps/admin/svelte.config.js
apps/admin/src/routes/+page.svelte
packages/ui/svelte.config.js         // src/routes なし → 候補から除外されること
```

- `discover-apps.test.ts`: (1) fixture で `['apps/admin', 'apps/web']`(ソート済み)が返る、
  (2) `packages/ui` が含まれない、(3) SvelteKit アプリゼロのディレクトリ(mkdtemp)で `[]`、
  (4) cwd 自身に svelte.config があっても `'.'` は含まれない。
- `run-discover.test.ts`(run-diff.test.ts の capture パターン踏襲):
  (1) monorepo fixture + `selectApp` モックで選択したアプリが解析される(出力に finding が出る)、
  (2) `selectApp` が `null`(キャンセル)→ exit 0 で `Cancelled.`、
  (3) 非TTY(`stdoutIsTTY: false`)→ exit 2 で `multiple SvelteKit apps found` と一覧、
  (4) 1件だけの fixture サブセット(`cwd` を `monorepo-project` の代わりに一時ディレクトリへ
  apps/web のみコピー、または apps/web だけの別 fixture)→ 自動続行の stderr 通知 + 解析実行、
  (5) `explicitPath: true` + 非 SvelteKit cwd → 検出せず即 exit 2(`selectApp` モックが
  呼ばれないこと)、
  (6) 検出 0 件 → 新文言のエラーで exit 2。
- `resolve-args.test.ts`: positional あり → `explicitPath: true` / なし → `explicitPath: false`。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 5: docs + changeset

- `docs/src/content/docs/guides/cli.md`(+ja): 「Monorepos」節を追加 — ルートで実行した
  ときの検出・選択の挙動(1件自動 / 複数選択 / CI では一覧付きエラー)、明示 path が常に
  優先されること。
- `README.md`: `npx svelte-vitals ./apps/web` に触れている箇所に「ルートで実行すれば
  検出・選択できる」旨を 1〜2 行追記(README の既存トーンに合わせて英語)。
- changeset(svelte-vitals: minor)を手書きで追加(英語)。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck && pnpm --filter svelte-vitals test && pnpm lint` → すべて exit 0

## Test plan

Step 4 の通り(最低 12 ケース)。パターン元: `packages/cli/test/run-diff.test.ts`
(capture + モック)、`packages/cli/test/fixtures/basic-project`(fixture 構成)。

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] monorepo fixture でのルート実行: 選択 → 解析 / キャンセル → exit 0 /
      非TTY → 一覧付き exit 2 / 1件 → 自動続行、がテストで固定されている
- [ ] 明示 path の失敗が従来どおり即 exit 2(検出が走らない)
- [ ] `grep -rn "pass --config" packages/` → 0 件
- [ ] 設計書(Appendix A)がリポジトリに存在する
- [ ] docs(en/ja)+ README + changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)
- [ ] `plans/README.md` の 019 行を更新(reviewer 管理の場合はスキップ)

## STOP conditions

- "Current state" の抜粋が実コードと意味的に一致しない。
- `tinyglobby` の `deep` / `ignore` オプションが期待どおり動かない(バージョン都合)—
  代替実装に勝手に切り替えず報告。
- `run()` の分岐が `analyzeProject` 側(index.ts の関数)の変更を要求してくる。
- clack のプロンプトがテスト環境で扱えない — `selectApp` は注入なので通常起きない。起きたら報告。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- 検出述語は「svelte.config.{js,ts} + src/routes」。SvelteKit がデフォルト構成を変えたら
  ここが追随点(`discoverApps` の JSDoc に設計書リンクあり)。
- `deep: 4` の深さ上限で足りない巨大リポジトリの報告が来たら、上限をオプション化するのではなく
  まず実例を見る(YAGNI)。
- MCP に同等機能を足す場合は `discoverApps` を再利用できるが、対話は不可能なので
  「一覧を structuredContent で返す別ツール」になる — 設計から要検討。
- 将来 `install` ウィザードにも「モノレポのどのアプリに vite 統合を入れるか」で同じ検出が
  使える可能性がある(現状 install は cwd 直下の vite.config しか見ない)。

## Appendix A: 設計書全文(Step 1 でこの内容のファイルを作成する)

````markdown
# Monorepo app auto-detection + interactive picker for the CLI

**Date:** 2026-07-08
**Status:** Accepted (maintainer-approved in session; implementation plan: `plans/019-monorepo-app-picker.md`)
**Packages:** `svelte-vitals` (CLI only — no core/mcp/vite changes)

## Goal

Running `npx svelte-vitals` at a monorepo root currently dead-ends with exit 2
("No SvelteKit project found in the current directory"), forcing the user to
know and type the app path (`npx svelte-vitals ./apps/web`). Turn that dead end
into a helpful path: detect SvelteKit apps in the repository and either analyze
the only one found or let the user pick interactively.

Requested by the maintainer on 2026-07-08. This lifts the previous deferral
("monorepo support: wait for real user demand", recorded in `plans/README.md`).

## Decisions (maintainer-approved)

1. **Trigger: failure-time only.** Discovery runs only when (a) no path
   argument was given AND (b) `detectProject(cwd)` threw `ProjectError`. Every
   currently-working invocation is untouched. When an **explicit** path fails
   detection, the CLI still errors immediately — the user's stated target is
   never silently reinterpreted.
2. **Non-TTY (CI, agents): never prompt.** Exit 2 with the detected app list
   embedded in the error and a hint to pass a path
   (`npx svelte-vitals apps/web`). No implicit selection in CI.
3. **TTY, exactly one app: auto-run.** Print
   `svelte-vitals: detected SvelteKit app at apps/web; analyzing it.` to stderr
   and continue. A one-option prompt is noise.
4. **TTY, multiple apps: single-select prompt** via `@clack/prompts` (already a
   CLI dependency; same style as the `install` wizard). Cancel exits 0.

## Detection method

**Chosen: glob for `svelte.config.{js,ts}`, filtered by `src/routes`.**

- Glob `**/svelte.config.{js,ts}` from cwd with ignores
  `node_modules`, `.svelte-kit`, `build`, `dist`, `.git` and a depth cap of 4
  path segments.
- A candidate qualifies only if `<dir>/src/routes` also exists. This excludes
  SvelteKit component libraries (svelte.config without routes) — there is
  nothing for svelte-vitals to analyze there.
- Results are sorted by path for deterministic ordering.

**Rejected alternative: workspace-manifest parsing** (`pnpm-workspace.yaml`
globs / `package.json#workspaces`). More "correct" on paper but needs YAML
parsing, misses monorepos that don't declare workspaces (plain dirs, some Nx
setups), and is more code for a narrower net. The glob approach is
tool-agnostic.

## Flow

```
run(opts)
  └─ analyzeProject(cwd) throws ProjectError
       ├─ opts.cwd was an explicit CLI path → error, exit 2 (unchanged)
       └─ no explicit path:
            apps = discoverApps(cwd)
            ├─ 0 apps            → original error (reworded, see below), exit 2
            ├─ 1 app             → stderr notice, re-run analysis with that dir as cwd
            ├─ >1 apps, TTY      → clack select → re-run with chosen dir (cancel → exit 0)
            └─ >1 apps, non-TTY  → exit 2, error lists apps + "pass a path" hint
```

After selection the chosen directory becomes the analysis `cwd`, so the
`svelte-vitals.config.*` file is read from the selected app (existing
semantics) and `--diff`/`--staged`/`--baseline` keep working — their
subdirectory handling shipped in plans 001/014.

The picker is injected into `run()` as an optional function option
(test-injectable, like the `install` wizard's `InstallPrompts`), defaulting to
a clack implementation in `bin.ts`'s wiring.

## Targeted fix riding along

`detectProject`'s error message ends with "or pass --config." — `--config` is
not a flag that exists. Since this message is being reworked anyway, it becomes:
`No SvelteKit project found in the current directory. Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web).`

## Non-goals (YAGNI)

- Analyzing multiple/all detected apps in one run — aggregate-Health semantics
  is a separate design question.
- The same discovery in `@svelte-vitals/mcp` or `@svelte-vitals/vite`
  (`analyzeProject` keeps throwing; discovery is a CLI-UX concern).
- Workspace-manifest parsing.
- A flag to force the picker (`--pick`) — failure-time trigger covers the need.

## Test plan

Fixture: minimal monorepo under `packages/cli/test/fixtures/` with
`apps/web` + `apps/admin` (both SvelteKit apps with routes) and `packages/ui`
(svelte.config, no routes → must be excluded).

Paths pinned by tests: 0 apps / 1 app auto-run / multiple + TTY select /
multiple + TTY cancel / multiple + non-TTY error / explicit-path failure stays
an immediate error / `packages/ui` exclusion / depth cap and ignore dirs.
````
