# Plan 002: 不正な `.svelte` ファイルに対する挙動をキャラクタリゼーションテストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/cli/src/providers/source/routes.ts packages/cli/src/providers/source/components.ts packages/cli/test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

svelte-vitals には構文的に壊れた `.svelte` ファイルへの対応が**2つの経路で非対称**に存在する: コンポーネントパス(`collectComponentFacts`)はパース失敗を握りつぶして空 facts を返すが、ルートパス(`resolveRoute`)には try/catch がなく、壊れた `+page.svelte` / `+layout.svelte` が1つあると解析全体が exit 2(実行エラー)で中断する。どちらの挙動も**テストで固定されていない**ため、(1) 将来のリファクタ(特に Plan 007 のパースキャッシュ導入)が挙動を無自覚に変えうる、(2) コンポーネントパスの空 facts フォールバックは `ComponentFacts` にフィールドが追加されるたびに手で同期されており、漏れを検知する網がない。この計画はテストのみを追加し、現状の挙動(非対称を含む)を意図的な契約として文書化・固定する。

## Current state

- `packages/cli/src/providers/source/routes.ts:146-148` — ルートパス。try/catch なし:

```ts
for (const { rel, isPage } of files) {
  const source = await rt.readFile(rt.join(cwd, rel));
  const parsed = parseFile(source, rel);
```

`parseFile`(`packages/cli/src/providers/source/parse.ts`)は内部で `svelte/compiler` の `parse()` を呼び、不正構文で throw する。throw は `collectRoutes` の `Promise.all`(routes.ts:196)→ `analyzeProject`(`packages/cli/src/index.ts:136`)へ伝播し、`run()` の catch(index.ts:187-195)が exit 2 にマップする。

- `packages/cli/src/providers/source/components.ts:11-29` — コンポーネントパス。握りつぶして空 facts:

```ts
try {
  const source = await rt.readFile(rt.join(cwd, rel));
  return { file: rel, ...parseComponentFacts(source, rel) };
} catch {
  return {
    file: rel,
    eachBlocks: [],
    effects: [],
    htmlTags: [],
    javascriptUrls: [],
    loc: 0,
    propCount: 0,
    imports: [],
    namespaceImports: [],
    constableStates: [],
    suppressions: []
  };
}
```

- 既存テストの状況:
  - `packages/cli/test/collect-component-facts.test.ts` — 正常系のみ。catch 経路のテストなし。
  - `packages/cli/test/analyze-project.test.ts` — throw 系は「SvelteKit プロジェクトでない」`ProjectError` ケースのみ。
  - `packages/cli/test/run.test.ts` — exit コードのアサーション多数(構造の手本にする)。
  - テストは `packages/cli/test/fixtures/` 配下のフィクスチャプロジェクト(例 `basic-project`)+ `test/helpers/` を使う流儀。
- exit コード契約(README・bin.ts のヘルプに明記): `0` = 失敗所見なし / `1` = critical あり / `2` = 実行エラー。

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Install   | `pnpm install`                          | exit 0              |
| Typecheck | `pnpm --filter svelte-vitals typecheck` | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`      | all pass            |
| Lint      | `pnpm lint`                             | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/cli/test/malformed-svelte.test.ts`(新規)
- `packages/cli/test/fixtures/` 配下の新規フィクスチャ(例 `malformed-component-project/`, `malformed-route-project/`)

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/providers/source/routes.ts` / `components.ts` — **挙動変更はこの計画ではしない**。非対称の解消(壊れたルートファイルを所見として報告する等)はメンテナーの製品判断であり、Maintenance notes に別途記録する。
- `packages/core/src/component-parse.ts` — パーサー本体。
- 既存テストファイルの変更(追加は新規ファイルで行う)。

## Git workflow

- Branch: `advisor/002-malformed-svelte-characterization`
- コミット例: `test(cli): pin behavior for malformed .svelte files in both passes`
- テストのみの変更なので changeset は不要(リポジトリの慣習上、ユーザー向け変更がないため)。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: フィクスチャを作成

`packages/cli/test/fixtures/basic-project` の構成(`package.json` に `@sveltejs/kit` 依存、`src/routes/...`)を参照し、同じ最小構成で2つ作る:

1. `malformed-component-project/` — 正常な `src/routes/+page.svelte`(`<svelte:head><title>t</title></svelte:head>` を含む)+ 構文エラーを持つ非ルートコンポーネント `src/lib/Broken.svelte`(例: `{#if x}` を閉じない)。
2. `malformed-route-project/` — 構文エラーを持つ `src/routes/+page.svelte` そのもの。

**Verify**: `ls packages/cli/test/fixtures/malformed-component-project/src/lib` → `Broken.svelte` が存在

### Step 2: コンポーネントパスの挙動を固定するテスト

`packages/cli/test/malformed-svelte.test.ts` を新規作成。`packages/cli/test/run.test.ts` の capture パターン(`log`/`errorLog` を配列に集める)に合わせる。

- ケース A: `collectComponentFacts(createNodeRuntime(), fixtureDir)` を直接呼び、`Broken.svelte` のエントリが `loc: 0`・全配列空の「空 facts」であること、**他の**正常ファイルの facts は通常どおり得られることをアサート。
- ケース B: `run({ cwd: malformedComponentProject, env: {} })` が throw せず完走し、exit コードが `2` **ではない**こと(正常ファイル由来の所見に応じて 0 または 1)をアサート。
- ケース C(読み取り不能ファイル): インメモリの `Runtime` 実装(`readFile` が特定パスで reject する)を渡して `collectComponentFacts` が同じ空 facts を返すことをアサート。`Runtime` インターフェースは `@svelte-vitals/core` が export(`readFile`/`exists`/`glob`/`join` の4メソッド)。

各テストに「この空 facts フォールバックは `components.ts` の意図的な仕様(dev tooling must never throw)である」旨のコメントを付ける。

**Verify**: `pnpm --filter svelte-vitals test -- malformed` → 新規ケースが pass

### Step 3: ルートパスの挙動を固定するテスト

同ファイルに追加:

- ケース D: `run({ cwd: malformedRouteProject, env: {} })` が **exit 2** を返し、`errorLog` に `svelte-vitals:` で始まるエラーメッセージが出ることをアサート。
- テストコメントに明記: 「壊れたルートファイルは現状 _解析全体を_ exit 2 で中断する。コンポーネントパス(握りつぶし)との非対称は既知であり、挙動を変える場合はこのテストを意図的に更新すること(plans/002 参照)」。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

## Test plan

上記 Steps がテスト計画そのもの(ケース A〜D)。構造の手本: `packages/cli/test/run.test.ts`(run + capture)、`packages/cli/test/collect-component-facts.test.ts`(collector 直接呼び出し)。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0、`malformed-svelte.test.ts` に 4+ ケースが存在して pass
- [ ] `git status` で変更が in-scope のパスのみ
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- ケース B で run() が exit 2 を返す(= コンポーネントパスの握りつぶしが実際には機能していない — それ自体が新しいバグ報告に値する)。
- ケース D で exit 2 に**ならない**(= どこかに既に catch が入っておりこの計画の前提が古い)。
- `svelte/compiler` の `parse()` が想定した構文エラーで throw しない(フィクスチャの壊し方を1度変えても再現しない場合)。

## Maintenance notes

- **メンテナーへの決定事項(この計画では未解決のまま固定)**: 壊れたルートファイルで解析全体を exit 2 にするのは妥当か? 代替案は「そのルートをスキップして warning を stderr に出す」または「パース不能を critical 所見として報告する」。後者に変える場合、ケース D を更新し、`resolveRoute`(routes.ts:146-148)に try/catch を足すのが変更点になる。
- Plan 007(パースキャッシュ)はこのテストが固定する挙動の上で行うこと(依存関係)。
- `ComponentFacts` にフィールドを追加する際、ケース A が空 facts の形状ずれを検知する(Plan 003 のファクトリ化が入ればテスト側の更新も1箇所で済む)。
