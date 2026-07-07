# Plan 009: core の純粋性原則(No `node:` imports / no runtime globals)を ESLint で機構的に強制する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2f0bb14..HEAD -- eslint.config.js packages/core/src/`
> eslint.config.js が変わっていたら "Current state" の抜粋と突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `2f0bb14`, 2026-07-06

## Why this matters

`@svelte-vitals/core` の最重要規約は「runtime-agnostic — No `node:` imports, no I/O, no runtime-specific globals」(`packages/core/src/index.ts:1-2` に明記)だが、現在この規約は**ドキュメントとコードレビューでのみ**守られており、機構的な強制がない。エージェント駆動で開発が速いこのリポジトリでは、「禁止制約はドキュメントではなく機構(lint/hooks)で強制する」のがベストプラクティス(Anthropic の Claude Code steering ガイドの原則)。ESLint の `no-restricted-imports` / `no-restricted-globals` を `packages/core/src/**` にスコープして追加すれば、違反は `pnpm lint`(CI の lint ジョブ)で即座に落ち、規約が CI ゲートになる。

## Current state

- `eslint.config.js`(全 29 行)— フラット config。現在 `no-restricted-imports` の設定は存在しない:

```js
export default ts.config(
  includeIgnoreFile(gitignorePath),
  // Test fixtures are intentionally minimal/varied SvelteKit inputs, not source.
  { ignores: ['**/test/fixtures/**'] },
  // Astro-generated type files (listed in docs/.gitignore, not root .gitignore)
  { ignores: ['**/.astro/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
);
```

- 規約の原文: `packages/core/src/index.ts:1-2` — `// @svelte-vitals/core — runtime-agnostic core (design §8).` / `// No 'node:' imports, no I/O, no runtime-specific globals.`
- 事前調査(この計画の執筆時点、commit `2f0bb14` で確認済み): `grep -rn "from 'node:" packages/core/src/` → **0 件**。`grep -rnE "\bprocess\.|__dirname|__filename|Buffer\b|require\(" packages/core/src/` → **0 件**。つまりルールを入れても現状のコードは通る(はず — Step 2 で必ず再確認)。
- lint コマンド: `pnpm lint` = `prettier --check . && eslint .`(ルート `package.json`)。CI の `lint` ジョブが実行する。
- 注意: `packages/core/test/` は対象外とする(テストは Node で走り、`node:` import が正当。純粋性が要求されるのは `src/` のみ)。

## Commands you will need

| Purpose | Command        | Expected on success |
| ------- | -------------- | ------------------- |
| Install | `pnpm install` | exit 0              |
| Lint    | `pnpm lint`    | exit 0              |
| Tests   | `pnpm test`    | all pass            |

## Scope

**In scope** (the only files you should modify):

- `eslint.config.js`

**Out of scope**:

- `packages/core/src/**` — ルール追加で違反が出た場合、コードを「直して」通そうとしない(STOP して報告)。
- `AGENTS.md` — 別 PR(#118)で追加中のため触らない。マージ後に「(enforced by ESLint)」の注記を足すのは将来の小タスク。
- 他パッケージへの同種ルール適用 — core だけが純粋性契約を持つ。
- changeset — 内部ツーリングのみの変更で公開パッケージの挙動は不変のため不要。

## Git workflow

- Branch: worktree の既存ブランチをそのまま使ってよい。
- コミット例: `chore: enforce @svelte-vitals/core runtime-purity with eslint no-restricted-imports`
- Do NOT push or open a PR.

## Steps

### Step 1: eslint.config.js にスコープ付きルールブロックを追加

`ts.config(...)` の引数リスト末尾(既存の `languageOptions` ブロックの後)に追加:

```js
// @svelte-vitals/core is runtime-agnostic by contract (design §8, see packages/core/src/index.ts):
// no node: imports, no I/O, no runtime-specific globals. Enforce it here so a violation
// fails `pnpm lint` / CI instead of relying on review. I/O is injected via the Runtime interface.
{
  files: ['packages/core/src/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'url', 'child_process', 'http', 'https', 'crypto', 'util', 'stream', 'events'],
            message:
              '@svelte-vitals/core is runtime-agnostic (design §8): no Node builtins here — inject I/O through the Runtime interface (src/runtime.ts).'
          }
        ]
      }
    ],
    'no-restricted-globals': [
      'error',
      { name: 'process', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
      { name: '__dirname', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
      { name: '__filename', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' },
      { name: 'Buffer', message: 'core is runtime-agnostic (design §8): no runtime-specific globals.' }
    ]
  }
}
```

**Verify**: `pnpm lint` → exit 0(既存コードは事前調査どおり違反ゼロのはず)

### Step 2: ルールが実際に「効く」ことを実証してから片付ける

一時ファイルで陽性テストを行う(コミットしない):

1. `packages/core/src/__purity_probe.ts` を作成し、内容を `import { readFileSync } from 'node:fs'; export const x = readFileSync;` とする
2. `pnpm exec eslint packages/core/src/__purity_probe.ts` → **エラーで exit 非0**、メッセージに `runtime-agnostic` が含まれること
3. 同ファイルを `export const x = process.env;` に書き換え → 同コマンドが `no-restricted-globals` で落ちること
4. `rm packages/core/src/__purity_probe.ts` で削除し、`git status` がクリーンであること

**Verify**: 上記 2 と 3 が非0 exit、削除後 `pnpm lint` → exit 0

### Step 3: 全体検証

**Verify**: `pnpm lint && pnpm typecheck && pnpm test` → すべて exit 0 / all pass

## Test plan

Step 2 の陽性プローブが「ルールが機能する」ことの証明(コミットには含めない)。恒久テストは不要 — ESLint 設定はそれ自体が宣言的な検査。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "no-restricted-imports" eslint.config.js` → ヒットあり
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `git status` で変更が `eslint.config.js` のみ
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 の `pnpm lint` で `packages/core/src/**` に**既存の違反**が出る(事前調査と食い違う = コードがドリフトしている。違反箇所を列挙して報告 — コードを直すのはこの計画のスコープ外)。
- Step 2 の陽性プローブがエラーに**ならない**(ルールの書き方が flat config で効いていない — 設定形式を1度だけ修正して再試行し、それでもダメなら STOP)。
- `eslint-plugin-svelte` / `typescript-eslint` の既存設定と競合して他パッケージの lint 結果が変わる場合。

## Maintenance notes

- 制限リスト(`fs`, `path` 等の bare 指定)は網羅ではなく主要どころ — `node:*` プレフィックスが主防壁で、bare 指定は保険。新しい違反パターンが見つかったら group に追加する。
- `packages/core/test/` は意図的に対象外(テストは Node 前提で正当)。src と test の境界を跨ぐリファクタ時はこの前提に注意。
- PR #118(AGENTS.md)マージ後、AGENTS.md の core 純粋性の行に「(enforced by ESLint — eslint.config.js)」と注記を足すと文書と機構の対応が明示される(1行、将来のついで作業)。
