# Plan 005: 公開パッケージの `engines.node` フロアを実際にサポートする値に是正し、CI で検証する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/core/package.json packages/cli/package.json packages/vite/package.json packages/mcp/package.json .github/workflows/ci.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

公開4パッケージ(core / cli / vite / mcp)はすべて `"engines": { "node": ">=18.20.8" }` を宣言しているが、Node 18 は 2025-04-30 に EOL 済みで、CI は Node 24(ルート `package.json` の `devEngines.runtime.version = 24.16.0` から導出)**のみ**でビルド・テストしている。つまり「Node 18 で動く」という公開上の約束を誰も一度も検証していない。Node 20+/22+ 専用 API が紛れ込んでも、宣言フロアのユーザー環境で初めて発覚する。フロアを現実(サポート中の LTS)に合わせ、そのフロアを CI マトリクスで実際に検証可能にする。

## Current state

- `packages/core/package.json:24` / `packages/cli/package.json:26` / `packages/vite/package.json:25` / `packages/mcp/package.json:26` — いずれも `"node": ">=18.20.8"`。
- `.github/workflows/setup-node/action.yml:14-22` — CI の Node バージョンはルート `package.json` の `devEngines.runtime.version`(現在 `24.16.0`)を jq で読んで単一バージョンをセットアップ。マトリクスなし。
- `.github/workflows/ci.yml` — ジョブは `lint` / `check` / `test` / `docs` の4つ。`test` ジョブ(45-55 行目付近)が `pnpm build` → `pnpm test` を実行。
- 2026-07 時点の Node.js サポート状況: 18 は EOL(2025-04)、20 も EOL(2026-04)、**22 は Maintenance LTS(2027-04 まで)、24 は Active LTS**。したがって意味のある最低サポートラインは 22。

## 決定(この計画で採用する値)

- `engines.node` を4パッケージとも **`">=22.12.0"`** に統一する(22 系の LTS 開始バージョン)。pre-1.0 でありユーザーへの影響は限定的だが、フロア引き上げは実質破壊的変更として **minor** の changeset を付ける(pre-1.0 の慣習では minor が breaking を表す)。
- CI の `test` ジョブに Node `[22, 24]` のマトリクスを追加し、フロアが常に検証される状態にする。他ジョブ(lint / check / docs)は単一バージョンのまま。

## Commands you will need

| Purpose    | Command                   | Expected on success |
| ---------- | ------------------------- | ------------------- |
| Install    | `pnpm install`            | exit 0              |
| Build+Test | `pnpm build && pnpm test` | all pass            |
| Lint       | `pnpm lint`               | exit 0              |
| 公開検証   | `pnpm check:publish`      | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `packages/core/package.json`
- `packages/cli/package.json`
- `packages/vite/package.json`
- `packages/mcp/package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/setup-node/action.yml`(node-version の外部注入を許す入力を足す場合のみ)
- `.changeset/<slug>.md`(新規)

**Out of scope**:

- ルート `package.json` の `devEngines`(開発環境は 24 のまま)。
- `docs/package.json` — 非公開パッケージで engines 宣言なし。
- `.github/workflows/release.yml` / `deploy-docs.yml` — リリースフローは触らない。

## Git workflow

- Branch: `advisor/005-node-engines-floor`
- コミット例: `chore: raise engines.node floor to >=22.12.0 and test it in CI`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: engines フィールドを4箇所更新

各 `packages/*/package.json` の `"node": ">=18.20.8"` を `"node": ">=22.12.0"` に変更。

**Verify**: `grep -n '"node"' packages/*/package.json` → 4件とも `>=22.12.0`

### Step 2: CI の test ジョブにマトリクスを追加

`.github/workflows/ci.yml` の `test` ジョブに `strategy.matrix.node-version: [22, 24]` を追加。現在 Node バージョンは composite action(`setup-node`)が `devEngines` から読むため、方法は2択 — どちらでもよいが (a) を推奨:

- (a) `setup-node` action に省略可能入力 `node-version` を追加(`inputs.node-version` が空なら従来どおり `devEngines` から読む)し、`test` ジョブから `with: node-version: ${{ matrix.node-version }}` で渡す。
- (b) `test` ジョブだけ composite action を使わず `actions/setup-node` + pnpm セットアップを直書きする(重複が増えるので非推奨)。

注意: このリポジトリの workflow は action を SHA ピンで参照している(例 `actions/checkout@9c091bb... # v7.0.0`)。新規に action を参照する場合は同様に SHA ピン + バージョンコメントにすること。

**Verify**: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!/matrix/.test(y)) process.exit(1)"` → exit 0

### Step 3: ローカルで全検証 + changeset

CI マトリクスの実行はローカルでは確認できないため、YAML の構文と現行 Node での全検証を行う:

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:publish` → すべて exit 0

changeset(`.changeset/<slug>.md`):

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.12.0. Node 22 and 24 are now exercised in CI.
```

## Test plan

- コードの挙動変更はないため新規ユニットテストなし。検証は Step 3 の全コマンド + マージ後の CI マトリクス実行(オペレーターが PR を開いた際に Node 22 ジョブが green になること)。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn '18.20.8' packages/` → 0 件
- [ ] `.github/workflows/ci.yml` の test ジョブに node 22 と 24 のマトリクスが存在
- [ ] `pnpm build && pnpm test && pnpm lint && pnpm check:publish` すべて exit 0
- [ ] minor changeset が存在
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- いずれかのパッケージの依存(例: vite 8 系、`@modelcontextprotocol/sdk`)が Node 22 より高いフロアを要求していることが判明した場合(`node_modules/<dep>/package.json` の engines を確認)— その場合フロア値の再決定が必要。
- `setup-node` composite action の改修が `release.yml` / `deploy-docs.yml` の呼び出しと互換でなくなる場合(両ファイルは読むだけにし、入力追加が後方互換であることを確認する)。

## Maintenance notes

- Node 22 が Maintenance を終える 2027-04 頃に再度フロアを見直すこと(そのときは 24 へ)。
- レビューで見るべき点: composite action の入力追加が既存の呼び出し(引数なし)と後方互換であること。
- 将来 `engines` 違反を install 時に強制したい場合は `.npmrc` の `engine-strict=true` が選択肢(この計画では導入しない — ユーザー側の急な breakage を避ける)。
