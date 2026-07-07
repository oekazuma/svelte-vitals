# Plan 007: ルート解決にパースキャッシュを導入し、共有レイアウト/コンポーネントの再パースをなくす

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/cli/src/providers/source/routes.ts packages/cli/src/providers/source/resolve.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-malformed-svelte-characterization.md(パース失敗時の挙動をテストで固定してから)
- **Category**: perf
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

静的モードのルート解決は、ルートごとに独立してレイアウトチェーンを読み・パースする。ルート `+layout.svelte` は**すべての**ルートのチェーンに含まれるため、ルート数 N のプロジェクトでは同じファイルが N 回 `svelte/compiler` の `parse()` にかけられる。共有 SEO コンポーネント(`$lib/Seo.svelte` 等)を N ページが import していれば、これも N 回パースされる。`parse()` はこのアナライザーの支配的コストなので、深い共有レイアウトを持つ大規模 SvelteKit アプリでは必要量の数倍のパース処理を毎回払っている。実行単位の `Map<パス, ParsedFile>` メモ化で、ファイルごとに一度のパースにする。

## Current state

- `packages/cli/src/providers/source/routes.ts:132-165` — `resolveRoute` はチェーン内の各ファイルを毎回 `rt.readFile` + `parseFile`:

```ts
// routes.ts:146-148
for (const { rel, isPage } of files) {
  const source = await rt.readFile(rt.join(cwd, rel));
  const parsed = parseFile(source, rel);
```

- `packages/cli/src/providers/source/routes.ts:190-202` — `collectRoutes` が全ページを `Promise.all(pages.map((page) => resolveRoute(rt, cwd, page, config, layouts)))` で並列解決。キャッシュはどこにもない。
- `packages/cli/src/providers/source/resolve.ts:98-109` — `resolveFileTags` の transitive 解決(layer 3)も子コンポーネントを毎回読み・パース:

```ts
// resolve.ts:100-107
if (childRel && depth > 0 && !visited.has(childRel)) {
  const abs = rt.join(cwd, childRel);
  if (await rt.exists(abs)) {
    const childParsed = parseFile(await rt.readFile(abs), childRel);
```

`visited` は**1ルートの再帰内**のサイクルガードにすぎず、ルート横断の共有には効かない。

- パスの基準: `rel` / `childRel` はどちらも**プロジェクトルート相対**の正規化済みパス(`chainFiles` は glob 由来、`childRel` は `resolveComponentPath`(resolve.ts:38-62)が `src/...` 形式に正規化)。したがってキャッシュキーは rel パスで衝突しない。
- `parseFile(source, rel): ParsedFile`(`packages/cli/src/providers/source/parse.ts`)は純関数で、戻り値 `ParsedFile` は呼び出し側で**ミューテートされない**(routes.ts は `parsed.images` / `parsed.headings` をスプレッドコピーして push、resolve.ts は `[...parsed.headTags]` とコピーする)— 共有インスタンスを返しても安全。executor は着手時にこの2点(コピーしてから変更している)を目視確認すること。
- 関連テスト: `packages/cli/test/resolve.test.ts`, `resolve-transitive.test.ts`, `layout-breakouts.test.ts`, `source-provider.test.ts`, `parse-file.test.ts`。挙動(出力)は不変なので全テストが無変更で通ることが等価性の証明。

## Commands you will need

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Install   | `pnpm install`                          | exit 0              |
| Typecheck | `pnpm --filter svelte-vitals typecheck` | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`      | all pass            |
| 全体      | `pnpm build && pnpm test && pnpm lint`  | all pass / exit 0   |

## Scope

**In scope** (the only files you should modify/create):

- `packages/cli/src/providers/source/routes.ts`
- `packages/cli/src/providers/source/resolve.ts`
- `packages/cli/test/parse-cache.test.ts`(新規)

**Out of scope**:

- `packages/cli/src/providers/source/parse.ts` — `parseFile` 自体は変更しない。
- **ルートパスとコンポーネントパスの横断キャッシュ**(`collectComponentFacts` との AST 共有)— 別案件(監査所見 PERF-02/DEBT-03)。core と cli にまたがる L 工数のリファクタで、この計画のスコープ外。
- `packages/cli/src/index.ts` — `collectRoutes` のシグネチャは変えない(キャッシュは `collectRoutes` 内部で生成)。

## Git workflow

- Branch: `advisor/007-route-parse-cache`
- コミット例: `perf(cli): parse each source file once per run via a per-run parse cache`
- `svelte-vitals` の patch changeset を追加。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: キャッシュ型とヘルパーを定義

`resolve.ts`(または routes.ts — 両方から import しやすい方。循環 import に注意: 現状 routes.ts → resolve.ts の一方向依存なので **resolve.ts に置く**)に追加:

```ts
/** 実行単位の read+parse メモ。キーはプロジェクトルート相対パス(chainFiles / resolveComponentPath が正規化済み)。 */
export type ParseCache = Map<string, Promise<ParsedFile>>;

export function readAndParse(rt: Runtime, cwd: string, rel: string, cache: ParseCache): Promise<ParsedFile> {
  let hit = cache.get(rel);
  if (!hit) {
    hit = rt.readFile(rt.join(cwd, rel)).then((source) => parseFile(source, rel));
    cache.set(rel, hit);
  }
  return hit;
}
```

値を `Promise<ParsedFile>` にするのが重要: `collectRoutes` は全ルートを並列実行するため、同じファイルへの同時アクセスでもパースが一度で済む(Promise を共有)。**パース失敗時の注意**: reject した Promise がキャッシュに残ると全ルートが同じ理由で落ちる — これは現行挙動(1つの壊れたルートファイルで exit 2、Plan 002 が固定)と一致するため、そのままでよい。この点をコメントに記す。

**Verify**: `pnpm --filter svelte-vitals typecheck` → exit 0

### Step 2: `collectRoutes` でキャッシュを生成し、`resolveRoute` に通す

`routes.ts`: `collectRoutes` 内で `const cache: ParseCache = new Map();` を作り、`resolveRoute(rt, cwd, page, config, layouts, cache)` に渡す。`resolveRoute` の読み取り+パース(146-148 行目)を `const parsed = await readAndParse(rt, cwd, rel, cache);` に置換。

**Verify**: `pnpm --filter svelte-vitals test -- resolve` → 既存テスト pass

### Step 3: `resolveFileTags` にキャッシュを通す

`resolve.ts`: `resolveFileTags` のシグネチャに `cache: ParseCache` を追加し、transitive 解決(103 行目)を `const childParsed = await readAndParse(rt, cwd, childRel, cache);` に置換。再帰呼び出しと routes.ts:157 の呼び出し元も更新。

注意: 現行コードは `rt.exists(abs)` を先にチェックしてから読む。キャッシュ導入後もこの順序を保つ(存在しないファイルを reject Promise としてキャッシュしない)。

**Verify**: `pnpm --filter svelte-vitals test` → 全テスト無変更で pass

### Step 4: キャッシュの効果を固定するテスト

`packages/cli/test/parse-cache.test.ts` を新規作成。インメモリ `Runtime`(`readFile` 呼び出し回数をカウントする spy 付き)で、共有レイアウト + 2 ルート + 両ルートから import される共有コンポーネントのプロジェクトを構成し:

- `collectRoutes` 実行後、`+layout.svelte` と共有コンポーネントの `readFile` がそれぞれ **1 回**であることをアサート
- 出力(heads/images/headings)がキャッシュなしの期待値と一致すること(既存の `resolve-transitive.test.ts` のアサーションスタイルに合わせる)

**Verify**: `pnpm --filter svelte-vitals test -- parse-cache` → pass

### Step 5: 全体検証 + changeset

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0 / all pass

changeset:

```md
---
'svelte-vitals': patch
---

Parse each source file at most once per static-mode run: shared layouts and components imported by many routes were previously re-parsed per route.
```

## Test plan

- 新規: `parse-cache.test.ts`(Step 4 — 呼び出し回数 + 出力等価)。
- 等価性の主証明は**既存テスト群が無変更で通ること**: `resolve.test.ts`, `resolve-transitive.test.ts`, `layout-breakouts.test.ts`, `source-provider.test.ts`, Plan 002 の `malformed-svelte.test.ts`(壊れたルートファイル → exit 2 が保たれること)。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] `parse-cache.test.ts` が存在し、共有ファイルの readFile 1 回をアサートして pass
- [ ] 既存テストファイルは無変更(`git status`)
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `ParsedFile` の戻り値がどこかで**ミューテートされている**ことを発見した場合(Current state の「コピーしてから変更」前提が崩れる — 共有インスタンスは危険)。
- Plan 002 の malformed テストが未実施(plans/README.md で 002 が DONE でない)場合 — 依存関係違反。
- 既存テストのいずれかが落ち、出力順序の違い(Map の走査順など)が原因と思われる場合 — 挙動等価が守れていないので報告。

## Maintenance notes

- このキャッシュは**1 回の実行(collectRoutes 呼び出し)単位**。watch モードや live UI で解析を繰り返す機能を将来足す場合は、実行ごとに新しい Map を作ること(ファイル変更後の stale ヒットを防ぐ)。
- 次の最適化候補(意図的にスコープ外): ルートパス(`parseFile`)とコンポーネントパス(`parseComponentFacts`)が同じファイルを別々に `svelte/compiler parse()` している二重パース(監査所見 PERF-02/DEBT-03)。解消には core の `parseComponentFacts` が事前パース済み AST を受け取れるようにする API 変更が必要で、characterization テストを先に増やしてから着手するのが安全。
- レビューで見るべき点: reject Promise のキャッシュ滞留に関するコメントが残っているか(Step 1)。
