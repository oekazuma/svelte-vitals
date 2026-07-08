# Plan 015: `svelte-vitals ci install` — GitHub Actions ワークフロー生成と PR サマリーコメント

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `node packages/cli/dist/bin.js --help | grep -q baseline; echo $?` が `0` でなければ Plan 014 未マージ → STOP。続けて
> `git diff --stat d0c76c9..HEAD -- packages/cli/src/bin.ts packages/cli/src/install packages/core/src/reporter packages/cli/src/reporter-resolve.ts`
> に差分があれば "Current state" の抜粋と突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1
- **Effort**: L(md レポーター + ci サブコマンドの 2 スライスに分けて直列実行)
- **Risk**: MED(生成する YAML はユーザーの CI で動く — テンプレートの正しさが命)
- **Depends on**: plans/014-baseline-new-findings-only.md(ワークフローが `--baseline` を使う)
- **Category**: direction
- **Planned at**: commit `d0c76c9`, 2026-07-08

## Why this matters

CLI には CI に必要な部品(github アノテーションレポーター、SARIF、`--diff`、`--fail-on`、
`--min-health`、そして Plan 014 の `--baseline`)が揃っているが、ユーザーはワークフロー
YAML を手書きしなければならない。導入障壁を最小化するため、`svelte-vitals ci install`
一発で「PR ごとにスキャンし、インラインアノテーション + ジョブサマリー + PR への
サマリーコメント(sticky、更新型)を出し、新規 finding だけでゲートする」ワークフローを
生成する。あわせて PR コメント/ジョブサマリー用のコンパクトな Markdown レポーター
(`--reporter md`)を core に追加する(agent レポーターは修復手順書で、要約には冗長すぎる)。

## Current state

- **サブコマンドの分岐**: `packages/cli/src/bin.ts:44-49` — `install` は mri より前に
  生 argv で分岐している。`ci` も同じ場所に並べる:

```ts
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === 'install') {
    const code = await runInstallCli(rawArgs.slice(1));
    process.exit(code);
  }
```

- **install ウィザードの構造**(踏襲元): `packages/cli/src/install/cli.ts` —
  ヘルプ定数 + `mri` パース + `realIO()`(readFile/writeFile/log/isTTY を注入可能に) +
  `runInstall(flags, io, prompts)`。プレビュー → `--dry-run` / 確認 → 書き込み、
  既存ファイルは `exists` ステータスで冪等、という流れ(`packages/cli/src/install/index.ts:100-242`)。
  テストは `packages/cli/test/install/*.test.ts` が `InstallIO` をメモリ実装で差し替えている。
- **レポーターの登録点**(md 追加時に全部触る):
  - `packages/core/src/reporter/` に console/json/agent/sarif/github/html の 6 実装。
    形の参考: `github.ts` は `formatGithubReport(results, config): string`。
  - `packages/core/src/index.ts:104-113` 付近の re-export リスト。
  - `packages/cli/src/reporter-resolve.ts` の `ReporterName` / `isReporterName`。
  - `packages/cli/src/resolve-args.ts:140` のエラーメッセージ
    `Valid values: console, json, agent, sarif, github, html.`
  - `packages/cli/src/index.ts:251-287` の `run()` レポーター分岐。
  - `packages/cli/src/bin.ts:21` のヘルプ行。
- **md レポーターの材料**(すべて core に既存):
  `computeHealth(results, config)` → `{ health, categories, weights }`、
  `summarize(results, config)` → `{ critical, warning, info, passed, dynamic }`
  (`packages/core/src/summary.ts:4-12`)、`buildJsonReport`(`packages/core/src/reporter/json.ts:33-63`)
  が route 別 issue 整形の完全な前例。`docsUrlFor(id)`(`packages/core/src/rule.ts:40-42`)。
- **core 純粋性の鉄則**: `packages/core` に `node:` import・I/O 禁止(packages/core/CLAUDE.md)。
  md レポーターは文字列を返すだけにする。

## Commands you will need

| Purpose   | Command                                             | Expected on success |
| --------- | --------------------------------------------------- | ------------------- |
| Install   | `pnpm install`                                      | exit 0              |
| Build     | `pnpm build`                                        | exit 0              |
| Typecheck | `pnpm typecheck`                                    | exit 0              |
| Tests     | `pnpm test`                                         | all pass            |
| Lint      | `pnpm lint`                                         | exit 0              |
| YAML 検証 | `node -e "…js-yaml等は追加しない…"`(Step 5 参照)    | —                   |
| Changeset | `pnpm changeset`(core: minor, svelte-vitals: minor) | ファイル生成        |

## Scope

**In scope**:

- `packages/core/src/reporter/markdown.ts`(新規)+ `packages/core/src/index.ts`(re-export)
- `packages/core/test/`(md レポーターのテスト新規)
- `packages/cli/src/reporter-resolve.ts`、`packages/cli/src/resolve-args.ts`、
  `packages/cli/src/index.ts`(run の分岐)、`packages/cli/src/bin.ts`
- `packages/cli/src/ci/`(新規: `cli.ts`, `workflow.ts`)
- `packages/cli/test/ci/`(新規)
- `docs/src/content/docs/guides/`(`ci.md` 新規 + `reporters.md` 追記)と `ja/` の対応ファイル
- `.changeset/`

**Out of scope**:

- `ci config` / `ci upgrade` サブコマンド(将来計画 — 生成 YAML にバージョンコメントを
  残すだけに留める)
- GitLab / CircleCI 等、GitHub Actions 以外のテンプレート
- 専用 GitHub Action(marketplace)の作成 — `npx` 直叩きテンプレートで始める
- `packages/vite`、`packages/mcp`

## Git workflow

- Branch: `advisor/015-ci-install-command`
- Conventional commits、例: `feat(core): add markdown summary reporter` /
  `feat(cli): add \`ci install\` to scaffold a GitHub Actions PR gate`
- PR 本文は英語。**他社ベンチマークツール名をコミット/PR/docs に書かない**(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: core に `formatMarkdownReport` を追加

`packages/core/src/reporter/markdown.ts` 新規。シグネチャは他レポーターと同型:
`formatMarkdownReport(results: Result[], config: Config, meta: { version: string }): string`。
実装は `buildJsonReport` を呼んで整形するだけにする(集計ロジックを二重化しない)。

出力仕様(GitHub コメント/ジョブサマリーでそのまま読める、コンパクト志向):

```markdown
## svelte-vitals — Health 87/100

| Category    | Score |
| ----------- | ----- |
| seo         | 92    |
| performance | 78    |

**2 critical · 3 warning · 1 info** (48 checks passed)

### Findings

| Severity    | Rule                                                            | Location                | Message         |
| ----------- | --------------------------------------------------------------- | ----------------------- | --------------- |
| 🔴 critical | [SEO001](https://oekazuma.github.io/svelte-vitals/rules/seo001) | src/routes/+page.svelte | Missing <title> |
```

- ルール ID は `docsUrlFor(id)` でリンクする。Location は `route`(route-scoped)または
  `location`+`:line`。finding 0 件なら Findings 節を省き `✅ No issues found.` を出す。
- finding が 50 件を超えたら表を 50 件で打ち切り
  `…and N more (run \`npx svelte-vitals\` locally for the full report)` を足す
  (PR コメントの上限対策)。
- Message 内の `|` と改行はエスケープ(`\|` / スペース化)する。

`packages/core/src/index.ts` の reporter re-export ブロックに `formatMarkdownReport` を追加。

**Verify**: `pnpm --filter @svelte-vitals/core test` → 新規テスト含め pass

### Step 2: CLI に `--reporter md` を配線

- `reporter-resolve.ts`: `ReporterName` に `'md'` を追加(auto-detect の対象にはしない)。
- `resolve-args.ts:140` の Valid values 文字列に `md` を追加。
- `index.ts` の `run()` 分岐に `else if (reporter === 'md') { log(formatMarkdownReport(results, config, { version })); }` を追加。
- `bin.ts:21` のヘルプ行の列挙に `md` を追加。

**Verify**: `pnpm --filter svelte-vitals build && node packages/cli/dist/bin.js packages/cli/test/fixtures/basic-project --reporter md` → Markdown が stdout に出る(exit code は finding 次第で 0/1)

### Step 3: `packages/cli/src/ci/workflow.ts` — テンプレートと書き込み判定

エクスポート:

```ts
export const WORKFLOW_PATH = '.github/workflows/svelte-vitals.yml';
export function buildWorkflowYaml(opts: { version: string }): string;
export function planWorkflowWrite(
  existing: string | undefined,
  force: boolean
): { status: 'created' | 'exists' | 'updated'; content?: string };
```

`planWorkflowWrite` は install の `WriteStatus` 流儀に合わせる: 既存ファイルあり+
`force=false` → `exists`(何もしない)、`force=true` → `updated`。

`buildWorkflowYaml` が返すテンプレート(これが本計画の核。逐語で採用し、
`__VERSION__` だけ `opts.version` で置換する):

```yaml
# Generated by `svelte-vitals ci install` (svelte-vitals __VERSION__).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Scan (inline annotations + gate)
        id: scan
        continue-on-error: true
        run: >
          npx -y svelte-vitals@__VERSION__ .
          --diff origin/${{ github.base_ref }}
          --baseline origin/${{ github.base_ref }}
          --reporter github
      - name: Markdown summary
        run: >
          npx -y svelte-vitals@__VERSION__ .
          --diff origin/${{ github.base_ref }}
          --baseline origin/${{ github.base_ref }}
          --reporter md > svelte-vitals-report.md || true
      - name: Job summary
        run: cat svelte-vitals-report.md >> "$GITHUB_STEP_SUMMARY"
      - name: PR comment (sticky)
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const marker = '<!-- svelte-vitals-report -->';
            const body = marker + '\n' + fs.readFileSync('svelte-vitals-report.md', 'utf8');
            const { data: comments } = await github.rest.issues.listComments({
              ...context.repo, issue_number: context.issue.number, per_page: 100
            });
            const mine = comments.find(c => c.body && c.body.startsWith(marker));
            if (mine) {
              await github.rest.issues.updateComment({ ...context.repo, comment_id: mine.id, body });
            } else {
              await github.rest.issues.createComment({ ...context.repo, issue_number: context.issue.number, body });
            }
      - name: Gate
        if: steps.scan.outcome == 'failure'
        run: |
          echo "svelte-vitals found blocking issues (see annotations above)."
          exit 1
```

設計意図(コメントとして plan にのみ残す — YAML には書かない):
スキャンを 2 回走らせるのは「アノテーション用」と「Markdown 用」でレポーターを
分けるため。静的解析は数秒なので許容し、単純さを取る。ゲートは step `scan` の
outcome を最後に判定することで、失敗時もコメント投稿まで必ず走る。

### Step 4: `packages/cli/src/ci/cli.ts` と bin.ts 配線

- `runCiCli(args: string[], io?)` を作る。`install/cli.ts` の形を踏襲(ヘルプ、mri、
  `realIO()` 相当の注入可能 IO — install の `InstallIO` を import して再利用してよい)。
- サブコマンド: `svelte-vitals ci install [--force] [--dry-run]` のみ。
  それ以外(`ci` 単独や未知サブコマンド)はヘルプを出して exit 2。
- 動作: `io.readFile(WORKFLOW_PATH)` → `planWorkflowWrite` → プレビュー表示
  (`Plan:` 行 + パス + status)→ `--dry-run` なら終了 → 書き込み
  (`io.writeFile` は親ディレクトリを作る — install の realIO と同じ)。
  `exists` の場合は `= already installed (.github/workflows/svelte-vitals.yml) — use --force to regenerate.` を出して exit 0。
  最後に `Done. Commit the workflow file and open a PR to see it in action.` を出す。
- `bin.ts`: `install` 分岐の直後に `if (rawArgs[0] === 'ci') { const code = await runCiCli(rawArgs.slice(1)); process.exit(code); }`。
  トップレベルのヘルプ(bin.ts:11-12 の Usage)に
  `svelte-vitals ci install       Add a GitHub Actions PR gate (annotations + summary comment)` を追記。

**Verify**: `pnpm --filter svelte-vitals build && cd $(mktemp -d) && node <repoAbs>/packages/cli/dist/bin.js ci install --dry-run` → プレビューが出て何も書かれない。`--dry-run` なしで実行 → `.github/workflows/svelte-vitals.yml` が生成され、再実行で `exists`

### Step 5: テスト

- `packages/core/test/`(既存の reporter テストの隣、命名は既存に合わせる):
  md レポーターの (1) 表出力、(2) 0 件時、(3) 50 件超の打ち切り、(4) `|`/改行エスケープ。
- `packages/cli/test/ci/workflow.test.ts`: `planWorkflowWrite` の created/exists/updated、
  `buildWorkflowYaml` に `__VERSION__` が残っていないこと、`--baseline` と
  `fetch-depth: 0` が含まれること(Plan 014 前提の退行防止)。
- `packages/cli/test/ci/cli.test.ts`: install テストの流儀(メモリ IO)で
  dry-run / 書き込み / exists / --force を固定。
- YAML の構文妥当性: 依存を足さず、テスト内で
  `expect(yaml).not.toMatch(/\t/)`(タブ禁止)+ インデント崩れを固定する
  スナップショットテストとする(スナップショットは `toMatchInlineSnapshot` ではなく
  通常アサーションで主要行を検証)。

**Verify**: `pnpm test` → all pass

### Step 6: docs + changeset

- `docs/src/content/docs/guides/ci.md`(新規): `ci install` の使い方、生成される
  ワークフローの説明(権限、sticky コメント、`--baseline` の意味)、手書きしたい人向けの
  最小 YAML。**`ja/guides/ci.md` も同内容で必ず作成**。
- `docs/src/content/docs/guides/reporters.md`(+ja)に `md` レポーターの節を追加。
- changeset 2 本(または 1 本にまとめて両パッケージ指定): `@svelte-vitals/core` minor
  (markdown reporter)、`svelte-vitals` minor(`ci install`, `--reporter md`)。本文は英語。

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0
(docs-links.test.ts はルール docs のみ対象なので guides 追加で落ちないはずだが、
落ちたら STOP せず原因を読む — ガイドの相互リンク切れなら直す)

## Test plan

Step 5 の通り。パターン元: `packages/cli/test/install/cli.test.ts`(IO 注入)、
`packages/core/src/reporter/json.ts` のテスト(レポーター単体)。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] 一時ディレクトリで `ci install` → 生成、再実行 → `exists`、`--force` → 再生成
- [ ] 生成 YAML に `--baseline origin/${{ github.base_ref }}` と `fetch-depth: 0` がある
- [ ] `--reporter md` が CLI ヘルプ・エラーメッセージ・docs(en/ja)に揃って載る
- [ ] `docs/src/content/docs/guides/ci.md` と `ja/guides/ci.md` の両方が存在する
- [ ] changeset がある(core minor + svelte-vitals minor)
- [ ] `plans/README.md` の 015 行を更新

## STOP conditions

- Plan 014(`--baseline`)が main に無い(Drift check で検出)。
- `packages/core` に `node:` import を足したくなった — 設計が間違っている。戻って報告。
- 生成ワークフローの設計(2 回スキャン、github-script でのコメント)を変えたくなった —
  改善案は報告に書き、このテンプレートのまま実装する。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- テンプレートには生成時の CLI バージョンを `npx -y svelte-vitals@<version>` で固定して
  埋め込む。将来の `ci upgrade`(スコープ外)がこのピンを更新する設計余地。
- `permissions: pull-requests: write` は fork からの PR では降格され、コメント投稿が
  失敗しうる。github-script step に `continue-on-error: true` を付けるかは docs で言及
  (v1 は付けない — 失敗が見えるほうがデバッグしやすい)。
- レビューで見るべき点: YAML のインデント、`${{ }}` 式のエスケープ(テンプレート文字列内
  でバッククォートと `$` の取り扱いを間違えやすい)、md レポーターの GitHub 上での実レンダリング。
- 将来 marketplace Action 化する場合も、この md レポーターと `--baseline` がそのまま部品になる。
