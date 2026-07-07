# Plan 004: リポジトリ規約を記録した `AGENTS.md` を追加し、エージェントセッションの再発見コストをなくす

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `ls AGENTS.md CLAUDE.md 2>&1`
> どちらかが既に存在する場合は STOP(内容を報告し、統合方針の指示を待つ)。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

このリポジトリは AI エージェント駆動で開発されている(`docs/superpowers/plans|specs/` に約 30 の設計・実装計画、コミット履歴に task-N review の痕跡)にもかかわらず、エージェントが最初に読む `AGENTS.md` / `CLAUDE.md` が存在しない。`.gitignore` は `.claude/` と `.superpowers/` を無視しているため、セッション横断で共有される規約ドキュメントがゼロ。その結果、安定していて非自明な規約 — core の純粋性原則、pnpm catalog、ルールファイルの命名、changeset 必須、en/ja ドキュメント同時更新 — を毎セッション再発見(または推測)している。1ファイル追加で、以後のすべてのエージェント作業の初期精度が上がる。

## Current state

- リポジトリルートには `README.md` / `CONTRIBUTING.md` / `LICENSE.md` のみ。`AGENTS.md` / `CLAUDE.md` は存在しない。
- `.gitignore:9,12` — `.superpowers/` と `.claude/` は無視(コミットされない)。
- 以下は**検証済みの事実**であり、AGENTS.md に記載する内容の情報源:
  - 検証コマンド: `pnpm build` / `pnpm typecheck` / `pnpm test`(vitest)/ `pnpm lint`(prettier --check + eslint)/ `pnpm format` / `pnpm check:publish`(publint + attw esm-only)。CI(`.github/workflows/ci.yml`)は lint / check(build+typecheck+publish 検証)/ test / docs の4ジョブ。
  - core の純粋性原則: `packages/core/src/index.ts:1-2` に「runtime-agnostic core (design §8). No `node:` imports, no I/O, no runtime-specific globals.」と明記。I/O は `Runtime` インターフェース(`packages/core/src/runtime.ts`)経由で注入。
  - 依存は pnpm catalog: ルート `package.json` の devDependencies はすべて `catalog:`、バージョンの実体は `pnpm-workspace.yaml`。
  - パッケージ構成: `packages/core`(ルールエンジン・スコアラー・レポーター)/ `packages/cli`(`svelte-vitals` CLI)/ `packages/vite`(プラグイン+dev オーバーレイ)/ `packages/mcp`(MCP サーバー)/ `docs`(Astro Starlight、en + ja)。
  - ルールの追加規約: `packages/core/src/rules/<category>/` に `xxxNNN-slug.ts`、`packages/core/src/rules/index.ts` の import・`allRules` 配列・re-export の3箇所に登録(現状。Plan 側の監査所見 DEBT-05 で将来簡素化の可能性あり)。注意: performance ルールは歴史的経緯で `rules/perf/`(PERF001–008)と `rules/performance/`(PERF009–010)に分かれている。
  - リリース: Changesets(`pnpm changeset`)。ユーザー向け変更には changeset 必須、main へのマージで release PR が開く。
  - コミット規約: conventional commits(`fix(core):` / `feat(vite):` / `test(cli):` / `docs:` / `chore:` — git log で確認済み)。
  - ドキュメント: `docs/src/content/docs/`(英語)と `docs/src/content/docs/ja/`(日本語)は**同時更新**が慣習(コミット履歴で ja 訳の追随修正が繰り返されている)。
  - 設計ドキュメント: `docs/superpowers/specs/`(設計)と `docs/superpowers/plans/`(実装計画)に日付付きで蓄積。決定済みトレードオフ(例: a11y カテゴリの廃止 = `2026-06-23-remove-a11y-design.md`)はここを参照。
  - Node/pnpm: Node `24.16.0`(`devEngines`)、pnpm `11.9.0`(`packageManager`)。
  - exit コード契約: 0 = 失敗所見なし / 1 = critical(または --fail-on/--min-health 到達)/ 2 = 実行エラー。

## Commands you will need

| Purpose | Command     | Expected on success              |
| ------- | ----------- | -------------------------------- |
| Lint    | `pnpm lint` | exit 0(新規 md も prettier 対象) |

## Scope

**In scope** (the only files you should create/modify):

- `AGENTS.md`(新規、リポジトリルート)
- `CLAUDE.md`(新規、リポジトリルート — AGENTS.md への1行ポインタ)

**Out of scope**:

- `CONTRIBUTING.md` の変更 — 人間向けの既存文書はそのまま。AGENTS.md から参照はする。
- `.gitignore` の変更。
- `docs/` サイトへの掲載。

## Git workflow

- Branch: `advisor/004-agents-md`
- コミット例: `docs: add AGENTS.md with repo conventions for agent sessions`
- changeset 不要(公開パッケージに変更なし)。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `AGENTS.md` を作成

「Current state」の検証済み事実を、以下のセクション構成で簡潔にまとめる(目安 60〜100 行。長い説明より箇条書き。英語で書く — リポジトリのコード・コミット・README は英語が基調):

1. **What this is** — svelte-vitals の1段落(静的コードヘルスチェッカー、5カテゴリ、pre-1.0)
2. **Verify commands** — 表形式で build/typecheck/test/lint/check:publish、および「全部通してから完了を主張する」旨
3. **Package map** — 4パッケージ + docs の1行説明
4. **Hard rules** — core の純粋性(No node:/I/O、原文引用)、catalog: 経由の依存追加、ユーザー向け変更に changeset 必須、en/ja ドキュメント同時更新
5. **Conventions** — conventional commits(実例2つ)、ルール追加手順(3箇所登録 + `rules/perf` と `rules/performance` の注意)、テストは vitest でパッケージごとの `test/` に、フィクスチャは `test/fixtures/`
6. **Design docs** — `docs/superpowers/specs|plans/` の役割と「決定済みトレードオフはまずここを確認」(a11y 廃止を例示)
7. **Exit codes** — 0/1/2 契約

**Verify**: `cat AGENTS.md | head -5` → 見出しが表示される

### Step 2: `CLAUDE.md` を作成

内容は最小のポインタのみ:

```md
See @AGENTS.md for repository conventions, verify commands, and hard rules.
```

**Verify**: `pnpm lint` → exit 0(prettier が両ファイルを整形済みとして通す。落ちる場合は `pnpm format` を実行してから再確認)

## Test plan

コード変更なし。`pnpm lint` が唯一の機械検証。内容の正しさは「Current state」の事実(すべてこの計画に検証済みで転記されている)以外を書かないことで担保する — **推測で規約を追加しない**こと。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `AGENTS.md` と `CLAUDE.md` がルートに存在する
- [ ] `pnpm lint` exits 0
- [ ] AGENTS.md に記載の全コマンドが `package.json` の scripts に実在する(`grep` で照合)
- [ ] `git status` で変更が in-scope の2ファイルのみ
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `AGENTS.md` または `CLAUDE.md` が既に存在する(drift check)。
- この計画に書かれていない規約を追加したくなった場合 — 推測は書かず、計画に含まれる検証済み事実のみで構成する。不足を感じたらその旨を報告。

## Maintenance notes

- 規約が変わったら(例: DEBT-05 のルール登録簡素化、DEBT-04 のディレクトリ統合が実施されたら)AGENTS.md の該当行を更新すること — 古い規約ドキュメントは無いより悪い。
- レビューで見るべき点: 記載事実がすべて現行コードと一致しているか(特にコマンドとパス)。
