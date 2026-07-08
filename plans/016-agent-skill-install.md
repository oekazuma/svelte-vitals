# Plan 016: `install` にエージェントスキル配布を追加(Claude Code スキル / Cursor ルール)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d0c76c9..HEAD -- packages/cli/src/install packages/core/src/rules/index.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW(新規ファイルの書き出しが中心。既存の MCP/Vite インストール経路は不変)
- **Depends on**: none(014/015 と独立。並行可)
- **Category**: direction
- **Planned at**: commit `d0c76c9`, 2026-07-08

## Why this matters

現在の `svelte-vitals install` は MCP サーバーと Vite 統合の配線のみで、エージェントへの
働きかけは「事後検出」(スキャンして直させる)に限られる。エージェントが**最初から**
悪いパターンを書かないようにするには、ルール知識(何が悪いか・なぜ・どう書くべきか)と
トリアージ手順(いつ何を実行するか)をエージェントの指示ファイルとして配布するのが
効果的で、これはプロダクト方針「AI エージェント統合」の柱に直結する。本計画で
install ウィザードに 2 ターゲットを追加する: Claude Code スキル
(`.claude/skills/svelte-vitals/SKILL.md`)と Cursor ルール
(`.cursor/rules/svelte-vitals.mdc`)。内容は core のルールメタデータ
(id/title/rationale/fix)から**インストール時に生成**するため、ルール追加に自動追随する。

## Current state

- **ターゲットの型と選択肢**: `packages/cli/src/install/index.ts:10` —
  `export type TargetId = ClientId | ViteTargetId;`。ウィザードの選択肢は
  index.ts:120-123 で `CLIENTS` + `VITE_TARGETS` から組み立てる。
- **Vite ターゲットの前例**(新ターゲット種別の追い方): `packages/cli/src/install/vite-targets.ts`
  が `{ id, label, hint }` の配列 + `isViteTargetId` ガードを定義し、
  index.ts:76-86 の `planForVitePlugin`/`planForDevOverlay` が `PlanRow` を作り、
  index.ts:172-174 で plan に合流、書き込みループ(index.ts:197-217)は `PlanRow.status`
  (`WriteStatus`: `packages/cli/src/install/codemod-types.ts`)で分岐する。
- **--client の検証**: `packages/cli/src/install/args.ts` が `--client` のカンマ区切りを
  `TargetId` として検証している(未知 id はエラー)。新 id を追加したらここも更新。
- **ヘルプ**: `packages/cli/src/install/cli.ts:12-26` の `INSTALL_HELP` に
  `--client <ids>` の列挙がある(bin.ts:12 のトップレベルヘルプにも install の説明 1 行)。
- **ルールメタデータ**(生成の材料): `packages/core/src/rules/index.ts` の `allRules`
  (49 ルール)。各 `Rule` は `id`, `title`, `category`, `severity`, `rationale`
  (1〜2 文の理由)、任意の `fix`(`{ description, snippet?, lang? }`)を持つ
  (`packages/core/src/rule.ts:20-37`)。docs URL は `docsUrlFor(id)`
  (`packages/core/src/rule.ts:40-42`)。CLI は `@svelte-vitals/core` に依存済みなので
  install 時に import して整形するだけでよい(ビルド時生成は不要)。
- **既存テストの流儀**: `packages/cli/test/install/` に args/cli/clients/vite-targets ほか
  ユニットテストがあり、`InstallIO` をメモリ実装で注入している。

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

- `packages/cli/src/install/agent-targets.ts`(新規: ターゲット定義)
- `packages/cli/src/install/skill-content.ts`(新規: 生成ロジック)
- `packages/cli/src/install/index.ts`、`args.ts`、`cli.ts`(配線 + ヘルプ)
- `packages/cli/src/bin.ts`(install の説明 1 行を更新)
- `packages/cli/test/install/agent-targets.test.ts`、`skill-content.test.ts`(新規)、
  既存 `args.test.ts` / `cli.test.ts` へのケース追加
- `docs/src/content/docs/guides/`(install を説明しているガイド — `mcp.md` か
  `getting-started.md` のうち install ウィザードを記述している箇所)+ `ja/` の対応ファイル
- `.changeset/`

**Out of scope**:

- `packages/core` — メタデータは読むだけ。core に生成コードを置かない(純粋性維持のため
  置けなくはないが、この出力形式は CLI の関心)。
- Codex / OpenCode 等その他エージェント向けの形式 — 需要が出てから追加
  (agent-targets.ts の配列に足すだけの構造にしておく)。
- MCP エントリの書き込みロジック(`clients.ts`/`merge.ts`)— 一切触らない。

## Git workflow

- Branch: `advisor/016-agent-skill-install`
- Conventional commits、例: `feat(cli): install agent skill / rules files for Claude Code and Cursor`
- PR 本文は英語。**他社ベンチマークツール名をコミット/PR/docs に書かない**(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `agent-targets.ts` — ターゲット定義

`vite-targets.ts` を鋳型に:

```ts
export type AgentTargetId = 'claude-skill' | 'cursor-rules';

export interface AgentTarget {
  id: AgentTargetId;
  label: string;
  hint: string;
  /** cwd 相対の書き込み先。 */
  relPath: string;
}

export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'claude-skill',
    label: 'Claude Code skill',
    hint: 'Teaches the agent svelte-vitals rules + when to run the scanner',
    relPath: '.claude/skills/svelte-vitals/SKILL.md'
  },
  {
    id: 'cursor-rules',
    label: 'Cursor rules',
    hint: 'Project rules file so Cursor avoids flagged patterns up front',
    relPath: '.cursor/rules/svelte-vitals.mdc'
  }
];

export function isAgentTargetId(id: string): id is AgentTargetId {
  /* vite-targets と同型 */
}
```

**Verify**: `pnpm typecheck` → exit 0

### Step 2: `skill-content.ts` — インストール時生成

```ts
import { allRules, docsUrlFor } from '@svelte-vitals/core';

export function buildSkillMarkdown(version: string): string; // SKILL.md 全文
export function buildCursorRules(version: string): string; // .mdc 全文
```

共通の本文(両関数で共有し、フロントマターだけ変える):

1. **ヘッダー**: `<!-- Generated by \`svelte-vitals install\` (svelte-vitals <version>). Re-run with --force to refresh. -->`
2. **When to use**: SvelteKit プロジェクトで `.svelte` / route ファイルを書く・レビューする時。
3. **Playbook**(番号付き手順):
   - 変更を書き終えたら `npx svelte-vitals . --diff --reporter agent` を実行し、指摘を修正する
   - コミット前ゲートは `npx svelte-vitals . --staged`
   - ルールの詳細・修正例は MCP ツール `explain_rule`(svelte-vitals MCP サーバー)か
     docs URL を参照する
4. **Rule digest**: カテゴリごと(seo / performance / correctness / security / architecture)に
   `- **<id> — <title>** (<severity>): <rationale>` を `allRules` から列挙。
   `fix.description` があれば ` Fix: <description>` を続ける(snippet は長いので入れない)。
   各行末に `([docs](<docsUrlFor(id)>))`。

フロントマター:

- SKILL.md(Claude Code スキル形式):

```markdown
---
name: svelte-vitals
description: Use when writing or reviewing SvelteKit routes/components — svelte-vitals rule knowledge (SEO, performance, correctness, security, architecture) and how to run the scanner.
---
```

- `.mdc`(Cursor ルール形式):

```markdown
---
description: svelte-vitals code-health rules for SvelteKit (SEO, performance, correctness, security, architecture)
globs: ['**/*.svelte', 'src/routes/**']
alwaysApply: false
---
```

出力は決定的(ルール順は `allRules` の登録順)にし、スナップショットではなく
「SEO001 と CORRECT005 の行が存在する」「カテゴリ見出しが 5 つ」等の構造アサーションで
テスト可能にする。

**Verify**: `pnpm --filter svelte-vitals test`(Step 4 のテスト作成後にまとめて可)

### Step 3: ウィザードへの配線

`packages/cli/src/install/index.ts`:

- `TargetId` を `ClientId | ViteTargetId | AgentTargetId` に拡張。
- 選択肢(index.ts:120-123)に `AGENT_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))` を追加。
- TTY 自動検出(index.ts:113-119): `.claude/` ディレクトリ配下に何か
  (`.claude/settings.json` など)があれば `claude-skill` を、`.cursor/` があれば
  `cursor-rules` をデフォルト選択に含める — 判定は `configExists` と同様に
  `io.readFile` ベースで代表ファイルを見る(ディレクトリ存在チェック API は `InstallIO` に
  無い。**`InstallIO` にメソッドを足さない**こと。代表ファイルが無ければ検出なしで良い)。
- `planForAgentTarget(target, io, force, version): PlanRow` を追加:
  `io.readFile(join(io.cwd, target.relPath))` が存在 + `force=false` → `status: 'exists'`、
  それ以外 → `status: 'created'`(force 時は `'updated'`)+ `content` に生成文字列。
  **vite ターゲットと違い `--force` での上書きを許可**する(生成物は再生成可能で
  codemod ではないため安全)。cli.ts の INSTALL_HELP にある「--force does not apply to
  either」の注記は vite 2 ターゲット限定の記述なので、agent ターゲットには適用しない
  ことがヘルプから読めるよう文言を調整する。
- 書き込みループの `exists` ヒント(index.ts:201-203)は `isViteTargetId` で分岐している —
  agent ターゲットは `--force` ヒントを**出す**側に含める。
- version は `readPackageVersion()`(`packages/cli/src/version.ts`、bin.ts:42 で使用例)を
  install 経路に渡す。

`args.ts`: `--client` の許容 id に `claude-skill,cursor-rules` を追加。
`cli.ts` の INSTALL_HELP: `--client` 列挙を
`claude-code,cursor,codex,vite-plugin,vite-dev-overlay,claude-skill,cursor-rules` に更新し、
2 ターゲットの 1 行説明を足す。`bin.ts:12` の install 説明も
`Set up the MCP server / Vite integration / agent skills` 程度に更新。

**Verify**: `pnpm --filter svelte-vitals build && cd $(mktemp -d) && node <repoAbs>/packages/cli/dist/bin.js install --client claude-skill,cursor-rules --yes` → 2 ファイル生成。`head -5 .claude/skills/svelte-vitals/SKILL.md` にフロントマター、`grep -c '^### ' ...` 等でカテゴリ節を確認。再実行 → `exists`、`--force` → 再生成

### Step 4: テスト

- `skill-content.test.ts`: (1) フロントマターの形式(SKILL.md は `name:`/`description:`、
  .mdc は `globs:`)、(2) 5 カテゴリの見出しが揃う、(3) `SEO001` と `ARCH002` の行が
  ある(全ルール網羅の代表点)、(4) version がヘッダーに埋まる、(5) `rationale` に
  Markdown 特殊文字が来ても行構造が壊れない。
- `agent-targets.test.ts`: `isAgentTargetId` の真偽。
- `cli.test.ts` / `args.test.ts` 追加ケース: `--client claude-skill` が通る、未知 id は
  従来どおりエラー、`--force` 上書き、exists 冪等、dry-run で書かれない。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 5: docs + changeset

- install ウィザードを説明している既存ガイド(`docs/src/content/docs/guides/` 配下を
  `grep -rl "svelte-vitals install" docs/src/content/docs` で特定)に 2 ターゲットを追記。
  **en と ja の両方**を必ず更新(en/ja 同期規約)。
- `pnpm changeset`: `svelte-vitals` minor。本文は英語。

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0

## Test plan

Step 4 の通り。パターン元: `packages/cli/test/install/vite-targets.test.ts`(ターゲット
定義)、`packages/cli/test/install/cli.test.ts`(メモリ IO でのエンドツーエンド)。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] 一時ディレクトリで `install --client claude-skill,cursor-rules --yes` → 2 ファイル生成、
      内容に 5 カテゴリ + 49 ルール分の行、再実行 `exists`、`--force` で再生成
- [ ] インタラクティブ選択肢に 2 ターゲットが表示される(cli.test.ts で固定)
- [ ] docs(en/ja 両方)に 2 ターゲットの記述がある
- [ ] changeset がある
- [ ] In scope 外のファイルに変更がない(`git status`)
- [ ] `plans/README.md` の 016 行を更新

## STOP conditions

- `TargetId` 拡張が `clients.ts`/`merge.ts` の変更を要求してくる(設計想定と違う)。
- Cursor `.mdc` / Claude Code SKILL.md のフロントマター仕様が本計画の記載と実際で
  食い違うことに気づいた — 手元の推測で直さず、根拠(公式 docs の URL)と共に報告。
- `InstallIO` にディレクトリ列挙などの新メソッドが必要になった。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- ルール digest はインストール時に `allRules` から生成するため、**ルールを追加しても
  この機能のコード変更は不要**。ただしユーザーのプロジェクトに置かれた生成物は
  古くなる — ヘッダーの「Re-run with --force to refresh」が更新経路。将来
  `svelte-vitals install --refresh`(生成物だけ一括再生成)を足す余地がある。
- レビューで見るべき点: 生成 Markdown の実レンダリング(Claude Code でスキルとして
  読み込めるか)、`rationale` 由来の文字列のエスケープ。
- Codex(`~/.codex/` 配下の AGENTS.md 系)や OpenCode への対応は `AGENT_TARGETS` に
  エントリを足すだけで済む構造にしてある。
