# Plan 025: `install --refresh` — 生成済みエージェントファイルを現行ルールセットで一括再生成する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e37dfb4..HEAD -- packages/cli/src/install`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW(既存ターゲット機構の新モード。既存経路は不変)
- **Depends on**: plans/016-agent-skill-install.md(DONE — AGENT_TARGETS / skill-content が前提)
- **Category**: dx
- **Planned at**: commit `e37dfb4`, 2026-07-13

## Why this matters

Plan 016 の生成物(`.claude/skills/svelte-vitals/SKILL.md`、`.cursor/rules/svelte-vitals.mdc`)は
インストール時点のルールセットのスナップショットで、ルール追加・rationale 改善のたびに
陳腐化する。現在の更新手段は `install --client claude-skill,cursor-rules --force --yes` と
長く、どのファイルを入れていたか覚えている必要もある。`install --refresh` は
**ディスク上に存在する生成済みエージェントファイルだけ**を現行の `allRules` で再生成する
1コマンドのメンテナンス手段(生成物ヘッダーの「Re-run with --force to refresh」の正式版)。

決定済み設計(メンテナーがモデルに設計委任・2026-07-13):

1. `--refresh` は**既存ファイルの再生成のみ** — 無いファイルは作らない(refresh ≠ install)。
2. 対象は `AGENT_TARGETS` の全エントリ(現在 claude-skill / cursor-rules。将来増えても自動追随)。
3. 対話ピッカーなし・確認なしで即実行(`--dry-run` は尊重)。`--client` と同時指定は fatal。
4. 1件も存在しない場合は案内(`no generated agent files found — run \`svelte-vitals install --client claude-skill,cursor-rules\` first.`)を stderr に出して exit 0(メンテナンスコマンドとして冪等)。

## Current state

- **ターゲット定義**: `packages/cli/src/install/agent-targets.ts` — `AGENT_TARGETS: AgentTarget[]`
  (`{ id, label, hint, relPath }`)、`isAgentTargetId`。
- **生成関数**: `packages/cli/src/install/skill-content.ts` — `buildSkillMarkdown(version)` /
  `buildCursorRules(version)`(claude-skill / cursor-rules に対応。id→関数の対応は
  `packages/cli/src/install/index.ts` の `planForAgentTarget` を参照)。
- **既存の書き込み経路**: `packages/cli/src/install/index.ts` — `planForAgentTarget(target, io, force, version): PlanRow`
  (existing+force→'updated' / 無し→'created')と書き込みループ。`runInstall(flags, io, prompts, version)`。
- **フラグ解析**: `packages/cli/src/install/args.ts` — `resolveInstallArgs(argv)` が
  `InstallFlags { client?, scope?, yes?, dryRun?, force? }` を返す。ヘルプは
  `packages/cli/src/install/cli.ts` の `INSTALL_HELP`。
- **テストの流儀**: `packages/cli/test/install/`(メモリ `InstallIO` 注入。`run.test.ts` が
  runInstall のエンドツーエンド)。
- **注意**: Plan 023/024 が並行 PR 中だが `packages/cli/src/install` は両方とも触っていない。
  bin.ts の install 説明行は触らない(変更は install/ 配下 + テスト + docs に留める)。

## Commands you will need

| Purpose   | Command                                                                                                                     | Expected on success |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter svelte-vitals --filter @svelte-vitals/core --filter @svelte-vitals/mcp --filter @svelte-vitals/vite install` | exit 0              |
| Build     | `pnpm --filter svelte-vitals build`                                                                                         | exit 0              |
| Typecheck | 同4パッケージへの `--filter … typecheck`                                                                                    | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`                                                                                          | all pass            |
| Lint      | `pnpm lint`                                                                                                                 | exit 0              |
| Changeset | 手書き(svelte-vitals: minor)                                                                                                | ファイル生成        |

## Scope

**In scope**:

- `packages/cli/src/install/index.ts`(`runRefresh` 相当のモード追加 — 実装配置は
  index.ts 内の関数で可)、`args.ts`(`--refresh` + `--client` との排他)、`cli.ts`(ヘルプ)
- `packages/cli/test/install/`(refresh のケース追加 — run.test.ts か新規ファイル)
- install を説明している docs(`grep -rl "svelte-vitals install" docs/src/content/docs/guides` で
  特定した en/ja — Plan 016 が更新した cli.md の install 節)
- `.changeset/`

**Out of scope**:

- `agent-targets.ts` / `skill-content.ts` — 読むだけ(生成内容は不変)。
- MCP 設定・Vite 統合(`clients.ts` / vite-targets / codemod)— refresh の対象外。
- `ci upgrade`(Plan 024)/ ワークフローファイル。
- `packages/cli/src/bin.ts`(023/024 とのコンフリクト回避 — install ヘルプは install/cli.ts 側のみ)。

## Git workflow

- Branch: `advisor/025-install-refresh`
- Conventional commits、例: `feat(cli): add install --refresh to regenerate existing agent skill files`
- PR 本文は英語。push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `--refresh` モード

- `args.ts`: `InstallFlags` に `refresh?: boolean` を追加、mri boolean に `'refresh'`、
  `--refresh` と `--client` の同時指定は fatal
  (`svelte-vitals: --refresh regenerates existing files and cannot be combined with --client.`)。
  `--scope`/`--yes`/`--force` が同時に来た場合は無視して warning 1 行(refresh には不要)。
- `install/index.ts`: `runInstall` の冒頭で `flags.refresh` なら refresh フローへ:
  1. `AGENT_TARGETS` を走査し、`io.readFile(join(io.cwd, t.relPath))` が存在するものだけ
     `planForAgentTarget(t, io, /* force */ true, version)`(= 'updated')で PlanRow 化。
  2. 0 件なら案内(設計4)を errorLog して return 0。
  3. `Plan:` プレビュー表示 → `--dry-run` なら書かず return 0 → 書き込みループ(既存の
     ループ/エラーハンドリングを再利用できる形で)→ `✓ refreshed N file(s).` → return 0。
- `cli.ts` の `INSTALL_HELP` に `--refresh` の行を追加
  (`Regenerate existing agent skill/rules files with the current rule set`)。

**Verify**: `pnpm --filter svelte-vitals build` → exit 0、一時ディレクトリで
`node <repo>/packages/cli/dist/bin.js install --refresh` → 0 件案内 + exit 0

### Step 2: テスト

メモリ IO で: (1) 両ファイル存在 → 両方 'updated' で内容が現行 version ヘッダーに更新、
(2) 片方のみ存在 → そのファイルだけ更新・もう片方は**作られない**、(3) 0 件 → 案内 + exit 0、
(4) `--dry-run` → 書かれない、(5) `--refresh --client …` → fatal、(6) MCP 設定ファイル
(.mcp.json 等)が存在しても**触られない**。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 3: docs + changeset

- install 節のある docs(en/ja)に `--refresh` を追記(ルール追加後の更新手段として)。
- changeset: svelte-vitals minor(英語)。

**Verify**: build + 4パッケージ typecheck + `pnpm --filter svelte-vitals test` + `pnpm lint` → すべて exit 0

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] テストで「存在するものだけ更新・無いものは作らない・MCP 設定不触・排他エラー」が固定
- [ ] 実機: `install --client claude-skill --yes` → SKILL.md のみ生成 → `install --refresh` →
      SKILL.md だけ再生成され .mdc は現れない
- [ ] docs(en/ja)+ changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)

## STOP conditions

- `runInstall` / `planForAgentTarget` / `AGENT_TARGETS` の形が本計画の想定と大きく異なる。
- refresh の実装が `bin.ts` や MCP/Vite 経路の変更を要求してくる。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- 将来 `AGENT_TARGETS` にターゲットを足せば `--refresh` は自動追随する(設計2)。
- 生成物ヘッダーの「Re-run with --force to refresh」文言は据え置き(--force 経路も有効なまま)。
  次に skill-content を触る際、ヘッダー文言を `--refresh` 案内に更新する価値あり。
