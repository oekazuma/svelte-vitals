# Plan 059: landmark 収集の role 解決を `resolveRole` に揃える(fallback role リストの先頭トークン直取りをやめる)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 690dd5e4..HEAD -- packages/core/src/internal.ts packages/cli/src/providers/source/parse.ts packages/vite/src/providers/rendered/parse-html.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P1       | S      | LOW  | none       | bug      | commit `690dd5e4`, 2026-08-28 |

## Why this matters

ARIA の role 属性はフォールバックリスト(`role="section main"` のような複数トークン)を許し、ユーザーエージェントは「**concrete(非 abstract)な role を名指す最初のトークン**」を採用する。このプロジェクト自身が a11y ルール検証レビュー(`docs/superpowers/specs/2026-08-16-a11y-rule-validity-review.md` の row 4)でこの規則を採択し、`invalid-role` 等は共有ヘルパー `resolveRole` に統一済み。しかし landmark 収集だけが両プロバイダで先頭トークンを無条件に取っており、先頭が abstract/未知トークンのリスト(`role="section main"`)はブラウザでは `main` になるのに svelte-vitals には landmark として見えない。結果、`a11y/duplicate-landmark`・`a11y/top-level-landmark`・`a11y/required-element` が static/rendered 両モードで silent false negative(2 個目の `main` を見逃す)や false positive(required な `main` が「無い」と報告される)を出す。記録済みの決定とコードのドリフトであり、修正は既存ヘルパーへの置き換え 2 箇所+export 1 行。

## Current state

- `packages/cli/src/providers/source/parse.ts:424-427`(source プロバイダ、HEAD の実コード):

  ```ts
  const roleAttr = findAttr(attrs, 'role');
  // ARIA fallback role lists (role="switch checkbox") resolve to the first supported token; a
  // non-literal or non-landmark role suppresses the tag mapping rather than falling through to it.
  const role = roleAttr ? splitTokens(attrTextOf(roleAttr))[0] : undefined;
  let landmark = roleAttr ? (role && LANDMARK_ROLES.has(role) ? role : undefined) : LANDMARK_TAGS.get(node.name);
  ```

  コメントの主張(「first supported token」)と実装(`[0]` 無条件)が既に食い違っている点に注意 — 修正後はコメントも実装に合わせて直す。

- `packages/vite/src/providers/rendered/parse-html.ts:107-110`(rendered プロバイダ、同じ欠陥):

  ```ts
  if (roleAttr !== undefined) {
    const role = splitTokens(roleAttr)[0];
    landmark = role && LANDMARK_ROLES.has(role) ? role : undefined;
  } else if (tag === 'main') {
  ```

- 使うべきヘルパー — `packages/core/src/rules/a11y/aria-data.ts:40-42`:

  ```ts
  export function resolveRole(tokens: readonly string[]): string | undefined {
    return tokens.find(isConcreteRole);
  }
  ```

  ただし **`resolveRole` は `@svelte-vitals/core/internal` から export されていない**(検証済み: `node -e "import('./packages/core/dist/internal.js').then(m=>console.log(typeof m.resolveRole))"` → `undefined`)。`packages/core/src/internal.ts` に export を足す必要がある(`LANDMARK_ROLES` は同ファイル :23 で export 済み)。`internal.ts` は semver 保証なしの共有面なので追加は自由(AGENTS.md の「New cross-package exports go in internal.ts」)。

- 意味論の要点: `resolveRole` を先に適用し、**その結果**を `LANDMARK_ROLES.has` で判定する。`role="button main"` は `button` に解決される(concrete)ので landmark ではない — 正しい。`role="section main"` は `main` に解決され landmark になる — これが修正で変わる挙動。role 属性がある限りタグマッピングにフォールバックしない現挙動は維持する。

- テストの手本: `packages/cli/test/` の parse 系テスト(`parse-link-attrs.test.ts` 等)と `packages/vite/test/parse-html.test.ts`(:55-79 に head 属性系の既存パターン)。kitchen-sink には手を入れない(gallery のフィクスチャ追加は `expected-findings.json` とメタテストに波及するため、この計画ではプロバイダ単体テストで固定する)。

- docs 確認: 検証レビュー row 4 は「first token」と書いた docs を誤りと認定済み。`docs/src/content/docs/rules/a11y/duplicate-landmark.md`・`top-level-landmark.md`(en/ja)に「first token」の記述が残っていれば直し、`pnpm --filter docs run translate:stamp <en ファイル>` で stamp する。残っていなければ docs は無変更。

## Commands you will need

| Purpose    | Command                                      | Expected on success |
| ---------- | -------------------------------------------- | ------------------- |
| Install    | `pnpm install`                               | exit 0              |
| Build      | `pnpm build`                                 | exit 0              |
| CLI tests  | `pnpm --filter svelte-vitals run test`       | all pass            |
| Vite tests | `pnpm --filter @svelte-vitals/vite run test` | all pass            |
| e2e(回帰)  | `pnpm build && pnpm e2e`                     | exit 0              |
| Full       | `pnpm test && pnpm lint`                     | exit 0              |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/core/src/internal.ts`(`resolveRole` の export 追加 1 行)
- `packages/cli/src/providers/source/parse.ts`
- `packages/vite/src/providers/rendered/parse-html.ts`
- `packages/cli/test/` の parse 系テスト 1 ファイル(追加)
- `packages/vite/test/parse-html.test.ts`(追加)
- 「first token」記述が実在した場合のみ: `docs/src/content/docs/rules/a11y/{duplicate-landmark,top-level-landmark}.md` とその `ja/` 対、および `docs/blume.translations.json`(stamp コマンド経由でのみ)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/core/src/rules/a11y/aria-data.ts` — `resolveRole` 本体は変更しない。
- `examples/kitchen-sink/` — gallery への fixture 追加はしない(expected-findings 波及を避ける)。
- `a11y/invalid-role` 等、既に `resolveRole` を使っているルール。
- `LANDMARK_TAGS` のタグマッピング(`aside` 降格ロジック含む)。

## Git workflow

- Branch: `advisor/059-landmark-resolve-role`
- Conventional commits、例: `fix(cli,vite): resolve landmark role token lists with resolveRole, not the first token`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `resolveRole` を internal から export する

`packages/core/src/internal.ts` の a11y 系 export 群の近くに `export { resolveRole } from './rules/a11y/aria-data.js';` を追加する。

**Verify**: `pnpm build && node -e "import('./packages/core/dist/internal.js').then(m=>console.log(typeof m.resolveRole))"` → `function`

注意 — core の `index.ts`(semver-stable 面)には**追加しない**。type-closed チェックにも触れない。

### Step 2: 失敗するテストを先に追加する(TDD red)

1. `packages/cli/test/` の parse 系テスト(既存の landmark を扱うテストがあればそこ、なければ `parse-file.test.ts` のパターンで追加)に、`<div role="section main">` を含むルートで landmark が `main` として収集されることを assert するケースを追加。あわせて `<div role="button main">` が landmark に**ならない**ことも 1 ケース。
2. `packages/vite/test/parse-html.test.ts` に同じ 2 ケース(rendered HTML 版)。

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test && pnpm --filter @svelte-vitals/vite run test` → 新 `section main` ケースが両パッケージで **fail**、`button main` ケースは pass

### Step 3: 両プロバイダを `resolveRole` に置き換える

- `parse.ts:426` — `const role = roleAttr ? resolveRole(splitTokens(attrTextOf(roleAttr))) : undefined;`(import を `@svelte-vitals/core/internal` の既存 import 行に追加)
- `parse-html.ts:108` — `const role = resolveRole(splitTokens(roleAttr));`
- 両所のコメントを実装に合わせて更新(英語)。例: "ARIA fallback role lists resolve to the first token naming a concrete role (resolveRole); a resolved non-landmark role suppresses the tag mapping rather than falling through to it."

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test && pnpm --filter @svelte-vitals/vite run test` → all pass(Step 2 の 4 ケース含む)

### Step 4: 回帰の広がりを確認する

kitchen-sink の e2e が無変更で green であることを確認する(gallery に fallback role リストのサンプルは現状ないはず — 変化したら STOP)。

**Verify**: `pnpm test && pnpm e2e` → all pass、`examples/kitchen-sink/expected-findings.json` に diff なし

### Step 5: docs の「first token」残存を確認・修正する

`grep -rn "first token" docs/src/content/docs/rules/a11y/duplicate-landmark.md docs/src/content/docs/rules/a11y/top-level-landmark.md docs/src/content/docs/ja/rules/a11y/` を実行。ヒットがあれば en を直し、ja 対を同内容で直し、`pnpm --filter docs run translate:stamp <en ファイルパス>` を実行。ヒットゼロなら docs は無変更(このステップをスキップした旨を README 状態欄に書く)。

**Verify**: ヒットがあった場合のみ `pnpm --filter docs run translate:stamp ...` → exit 0

### Step 6: changeset と最終検証

`pnpm changeset` で `svelte-vitals` patch + `@svelte-vitals/vite` patch + `@svelte-vitals/core` patch(export 追加)。英語。内容例: "Landmark collection now resolves ARIA fallback role lists (`role=\"section main\"`) the way user agents do — first concrete token — instead of taking the first token unconditionally."

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0

## Test plan

- 追加 4 ケース(source/rendered × `section main`/`button main`)。
- 既存の landmark 系テスト・kitchen-sink e2e は無変更で pass すること(この修正は「先頭が非 concrete トークンのリスト」だけ挙動を変える。単一トークン role は `resolveRole` でも同じ結果 — `main` は concrete、未知トークン単体は undefined で従来と同じ)。

## Done criteria

- [ ] `role="section main"` が両モードで landmark `main` として収集される(テストで pin)
- [ ] `role="button main"` が landmark にならない(テストで pin)
- [ ] `examples/kitchen-sink/expected-findings.json` に diff なし
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm e2e && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(core+cli+vite patch、英語)が存在する
- [ ] `plans/README.md` の 059 行を更新済み

## STOP conditions

- "Current state" の抜粋と実コードが不一致。
- Step 4 で kitchen-sink の findings が変化する(gallery に fallback role リストが既に存在する — 影響を報告して判断を仰ぐ)。
- 単一トークン role のケースで既存テストが落ちる(`resolveRole` の意味論が想定と違う — `isConcreteRole` の定義を確認して報告)。
- `resolveRole` の export が type-closed チェック(core の公開面テスト)に引っかかる(internal 側への追加で起きないはずの事象 — 起きたら報告)。

## Maintenance notes

- 今後 role 属性を解釈する新コードは必ず `resolveRole` を使うこと。`splitTokens(...)[0]` の新規出現はレビューで弾く。
- `a11y/required-element` の `elements` 設定で landmark role を要求しているプロジェクトでは、この修正により false positive が 1 段減る(記録済み suppressions には影響しない — findingKey は変わらないか、そもそも finding が消える方向)。
- 検証レビュー row 4 の残件(`invalid-role` の per-token hygiene 論点)は本計画のスコープ外のまま。
