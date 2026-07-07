# Plan 003: CLI と vite に重複する `collectComponentFacts` を core に一本化する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/cli/src/providers/source/components.ts packages/vite/src/providers/source/components.ts packages/core/src/index.ts packages/core/src/component.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-malformed-svelte-characterization.md(空 facts フォールバックの挙動をテストで固定してから動かす)
- **Category**: tech-debt
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

`collectComponentFacts`(`src/**/*.svelte` を glob → `parseComponentFacts` → 失敗時は空 facts)が `packages/cli` と `packages/vite` に**ほぼバイト単位で重複**しており、特に 12 フィールドの空 facts リテラルが2箇所で手動同期されている。`ComponentFacts` へのフィールド追加は直近も繰り返し起きており(`suppressions`, `constableStates`, `namespaceImports`)、そのたびに2ファイルをロックステップで編集する必要がある。1箇所に統合すれば、追加漏れは TypeScript が即座に検知し、挙動も定義上一致する。

## Current state

- `packages/cli/src/providers/source/components.ts`(33 行)— `Runtime` インターフェース経由の実装:

```ts
export async function collectComponentFacts(rt: Runtime, cwd: string): Promise<ComponentFacts[]> {
  const files = await rt.glob('src/**/*.svelte', cwd);
  return Promise.all(
    files.sort().map(async (rel): Promise<ComponentFacts> => {
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
    })
  );
}
```

- `packages/vite/src/providers/source/components.ts`(37 行)— 同一ロジック。差分は I/O だけ: `node:fs/promises` の `readFile` + `tinyglobby` の `glob('src/**/*.svelte', { cwd: root, dot: false })` を直接使う。doc コメント自身が「Mirrors the CLI's `collectComponentFacts`」と認めている。
- `Runtime` インターフェース(`packages/core/src/runtime.ts`): `readFile(path)` / `exists(path)` / `glob(pattern, cwd)` / `join(...parts)` の4メソッド。**core は定義のみ**を持ち、「No `node:` imports, no I/O」が core の設計原則(`packages/core/src/index.ts:1-2` に明記)。`Runtime` 経由の実装は I/O 実装を注入されるだけなので、この原則に反しない(既存の `packages/core/src/component-parse.ts` 等と同じ立ち位置)。
- 呼び出し側:
  - CLI: `packages/cli/src/index.ts:143` — `collectComponentFacts(rt, cwd)`(`rt = createNodeRuntime()`)
  - vite: `packages/vite/src/analyze.ts` — `collectComponentFacts(root)` を import して使用(実際の呼び出し行は executor が確認)
- 既存テスト: `packages/cli/test/collect-component-facts.test.ts` と `packages/vite/test/collect-component-facts.test.ts`。どちらも移行後にそのまま通ることが受け入れ条件。
- core の export 集約は `packages/core/src/index.ts`(`parseComponentFacts` は 24 行目で export 済み)。

## Commands you will need

| Purpose   | Command                                       | Expected on success |
| --------- | --------------------------------------------- | ------------------- |
| Install   | `pnpm install`                                | exit 0              |
| Build     | `pnpm build`(vite/cli は core の dist に依存) | exit 0              |
| Typecheck | `pnpm typecheck`                              | exit 0              |
| Tests     | `pnpm test`                                   | all pass            |
| 公開検証  | `pnpm check:publish`                          | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/core/src/component-collect.ts`(新規)
- `packages/core/src/index.ts`(export 追加)
- `packages/core/test/`(新規テスト1ファイル)
- `packages/cli/src/providers/source/components.ts`(委譲に置換)
- `packages/vite/src/providers/source/components.ts`(委譲に置換)

**Out of scope** (do NOT touch, even though they look related):

- `packages/core/src/component-parse.ts` — パーサー本体は変更しない。
- `packages/cli/src/runtime/node.ts` — Node ランタイムアダプタは現状のまま。
- `packages/cli/src/index.ts` / `packages/vite/src/analyze.ts` の呼び出しシグネチャ — 既存の呼び出し形を保つ(ラッパーを残すため変更不要)。

## Git workflow

- Branch: `advisor/003-dedupe-collect-component-facts`
- コミット例(リポジトリの実例 `a7a91cc feat(core): extract parseComponentFacts from the CLI package` に倣う): `refactor(core): extract shared collectComponentFacts from cli/vite`
- ユーザー可視の挙動変更はないが core の公開 API が増えるので、`@svelte-vitals/core` の patch changeset を追加。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: core に共有実装を追加

`packages/core/src/component-collect.ts` を新規作成。CLI 版の実装をそのまま移し、`Runtime` を受け取る形にする。空 facts リテラルは独立した export 関数に分離する:

```ts
import { parseComponentFacts } from './component-parse.js';
import type { ComponentFacts } from './component.js';
import type { Runtime } from './runtime.js';

/** Parse 失敗時のフォールバック。ComponentFacts のフィールド追加はここ1箇所を更新する。 */
export function emptyComponentFacts(file: string): ComponentFacts {
  /* 現行リテラル */
}

/** src/**\/*.svelte を走査して facts を集める(失敗ファイルは空 facts — dev tooling must never throw)。 */
export async function collectComponentFacts(rt: Runtime, cwd: string): Promise<ComponentFacts[]> {
  /* 現行ロジック */
}
```

`packages/core/src/index.ts` に `export { collectComponentFacts, emptyComponentFacts } from './component-collect.js';` を追加(既存 export ブロックの流儀に合わせ、`parseComponentFacts` の export の近くに置く)。core 原則(No node: imports)を守っていることを確認 — このファイルの import は core 内部と型のみのはず。

**Verify**: `pnpm --filter @svelte-vitals/core build && pnpm --filter @svelte-vitals/core typecheck` → exit 0

### Step 2: core にユニットテストを追加

`packages/core/test/component-collect.test.ts` を新規作成。インメモリ `Runtime`(4メソッドをオブジェクトリテラルで実装)を使い:

- 正常ファイル → facts が得られる
- `readFile` が reject するファイル → `emptyComponentFacts(file)` と deepEqual
- glob 結果がソートされる(`files.sort()` の挙動)

既存の core テスト(`packages/core/test/` 配下の任意のファイル)の describe/it スタイルに合わせる。

**Verify**: `pnpm --filter @svelte-vitals/core test` → all pass

### Step 3: CLI を委譲に置換

`packages/cli/src/providers/source/components.ts` の中身を core への再 export に置換:

```ts
export { collectComponentFacts } from '@svelte-vitals/core';
```

(呼び出し側 `packages/cli/src/index.ts:25` の import は変更不要。)

**Verify**: `pnpm --filter svelte-vitals build && pnpm --filter svelte-vitals test` → all pass(既存の `collect-component-facts.test.ts` と Plan 002 のテストがそのまま通ること)

### Step 4: vite を委譲に置換

`packages/vite/src/providers/source/components.ts` を、インライン `Runtime` アダプタ + core 呼び出しに置換:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import { collectComponentFacts as collect, type ComponentFacts, type Runtime } from '@svelte-vitals/core';

const nodeRuntime: Runtime = {
  readFile: (path) => readFile(path, 'utf8'),
  exists: async () => true, // collectComponentFacts は exists を使わない(下記 STOP 条件参照)
  glob: (pattern, cwd) => glob(pattern, { cwd, dot: false }),
  join: (...parts) => join(...parts)
};

export function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  return collect(nodeRuntime, root);
}
```

元の doc コメントの趣旨(vite は常に Node で動く)を1行で残す。`exists` のダミー実装が気になる場合は `fs.access` ベースで正しく実装してもよい(どちらでも可 — core 実装が呼ばない事実をコメントに書くこと)。

**Verify**: `pnpm --filter @svelte-vitals/vite build && pnpm --filter @svelte-vitals/vite test` → all pass

### Step 5: 全体検証 + changeset

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:publish` → すべて exit 0

changeset(`.changeset/<slug>.md`):

```md
---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
```

## Test plan

- 新規: `packages/core/test/component-collect.test.ts`(Step 2 の 3 ケース)。
- 既存の `packages/cli/test/collect-component-facts.test.ts` / `packages/vite/test/collect-component-facts.test.ts` / Plan 002 のテストが**無変更で**通ることが移行の等価性の証明。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm check:publish` すべて exit 0
- [ ] `grep -c "eachBlocks: \[\]" packages/cli/src packages/vite/src -r` → 0 件(空 facts リテラルが cli/vite から消えている)
- [ ] `grep -n "emptyComponentFacts" packages/core/src/index.ts` → export が存在
- [ ] 既存テストファイルは無変更(`git status` で確認)
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- CLI の `createNodeRuntime()`(`packages/cli/src/runtime/node.ts`)の `glob` 実装が vite 側の `{ dot: false }` と**異なる**セマンティクス(dotfile を含む等)を持つことが判明した場合 — 統合すると挙動が変わるため、差分を報告して指示を待つ。
- core に置いた新モジュールが `pnpm check:publish`(publint / attw)で ESM-only プロファイル違反を出す場合。
- 既存の cli/vite テストのいずれかが移行後に落ち、原因が 15 分以内に特定できない場合。

## Maintenance notes

- 今後 `ComponentFacts` にフィールドを追加する際は `emptyComponentFacts` の1箇所だけ更新すればよい(TS が漏れを検知)。
- レビューで見るべき点: vite 側の glob オプション(`dot: false`)が実質デフォルトであること、`files.sort()` の順序が保たれていること。
- 関連する将来課題(この計画ではやらない): HeadTag 抽出の二重実装(cli `parse.ts` vs vite `parse-html.ts`)の統合 — 監査所見 DEBT-02。より大きい M 工数案件。
