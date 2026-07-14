# Plan 028: PERF009(heavy import)の finding に正しい行番号を持たせる

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/core/src/component.ts packages/core/src/component-parse.ts packages/core/src/component-collect.ts packages/core/src/rules/perf/perf009-heavy-import.ts packages/core/src/rules/component-rule.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW(`ComponentFacts` に新規フィールドを追加するだけの加法的変更。既存の
  `imports: string[]` フィールドは変更しない)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`PERF009`(重い依存パッケージの import を検出するルール)は、常に `line: 0` を報告する。
`packages/core/src/rules/component-rule.ts:58` の suppression チェックは
`b.line > 0 && isSuppressed(c, opts.id, b.line)` という条件で、`line` が正の数でなけれ
ば抑制ディレクティブを一切見にいかない。つまり `// svelte-vitals-disable-next-line
PERF009` をコンポーネントに書いても、**PERF009 だけは絶対に抑制できない** —
ユーザーから見ると、抑制ディレクティブがパースエラーもなく黙って無視される。

同じ「Bundle 系」ルールである PERF010(namespace import)は既に import ごとの正しい行
番号(`namespaceImports: { source: string; line: number }[]`)を持っており、抑制も正常
に機能する。PERF009 だけが `imports: string[]`(行情報なし)という別の弱いデータソース
を使っているのが原因。

## Current state

- **`ComponentFacts`** 型定義 — `packages/core/src/component.ts:53-56`:

```ts
  /** Module specifiers of every `import` in the instance + module scripts (Bundle PERF009). */
  imports: string[];
  /** Value `import * as X from '<bare pkg>'` namespace imports (type-only excluded) — Bundle PERF010. */
  namespaceImports: { source: string; line: number }[];
```

- **収集ロジック** — `packages/core/src/component-parse.ts:504-509`(行番号を捨てている
  張本人):

```ts
/** Module specifiers of every `import` in an ESTree program (Bundle PERF009). */
function collectImportSources(program: Node, acc: string[]): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') acc.push(n.source.value);
  });
}
```

対して `collectNamespaceImports`(517-526行目)は同じ `walkEstree` パターンで
`lineOf(source, n.start)` を使って行を記録している — このプランはそれと同じ仕組みを
import 収集全体に広げる。

- **呼び出し元** — `packages/core/src/component-parse.ts:575-581`(module/instance の
  両方のスクリプトで `imports`/`namespaceImports` を集める)と、戻り値オブジェクト
  626-637行目(`imports, namespaceImports, ...` をそのまま返す)。
- **`emptyComponentFacts`** — `packages/core/src/component-collect.ts:11-24` はコメント
  で「add new `ComponentFacts` fields HERE so TypeScript catches every call site」と明記
  している、新フィールド追加時に必ず更新すべき箇所。
- **PERF009 ルール本体** — `packages/core/src/rules/perf/perf009-heavy-import.ts`(全文):

```ts
import { componentRule } from '../component-rule.js';

const HEAVY_PACKAGES: Record<string, string> = {
  lodash: 'import a submodule (lodash/debounce) or use lodash-es for tree-shaking',
  moment: 'use a lighter date library (date-fns or dayjs) — moment is large and not tree-shakeable'
};

export const perf009HeavyImport = componentRule({
  id: 'PERF009',
  title: 'Heavy dependency import',
  category: 'performance',
  severity: 'info',
  label: 'No heavy imports',
  recommendation: 'Import a submodule or switch to a lighter, tree-shakeable alternative.',
  rationale:
    'Importing a large, non-tree-shakeable package pulls its whole weight into the bundle even when only a fraction is used, slowing load.',
  applies: (c) => c.imports.length > 0,
  bad: (c) => {
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    for (const src of c.imports) {
      if (!Object.hasOwn(HEAVY_PACKAGES, src) || seen.has(src)) continue;
      seen.add(src);
      out.push({ line: 0, message: `Heavy import "${src}" — ${HEAVY_PACKAGES[src]}` });
    }
    return out;
  }
});
```

- **既存テスト** — `packages/core/test/bundle-rules.test.ts:12-20` のヘルパー:

```ts
const comp = (imports: string[]): ComponentFacts => ({
  ...
  imports,
  ...
});
```

このヘルパーが PERF009/PERF010 両方のテストで使われている(47行目・91行目付近)。
- **抑制の仕組み** — `packages/core/src/rules/component-rule.ts:35-37`(`isSuppressed`)
  と 58行目(`bad.filter((b) => !(b.line > 0 && isSuppressed(...)))`)。今回のフィックス
  はこの2箇所を変更しない — PERF009 が正しい `line` を渡すようになれば、既存の抑制ロジ
  ックがそのまま機能するようになる。

## Design decision

`ComponentFacts.imports: string[]` は **変更しない**(型を変えると `applies: (c) =>
c.imports.length > 0` 以外の潜在的な外部消費者がいた場合に壊れる可能性があり、
`ComponentFacts` は `packages/core/src/index.ts` から公開エクスポートされている公開
API 型のため、不要な破壊的変更を避ける)。代わりに、`namespaceImports` と同じ形の
**新しいフィールド `importSpans: { source: string; line: number }[]`** を追加し、
PERF009 はそちらを見るように変更する。これは加法的変更であり、`imports` を消費する
既存コード(PERF009 の `applies` チェックのみ)はそのまま動く。

## Commands you will need

| Purpose   | Command                                        | Expected on success |
| --------- | ----------------------------------------------- | -------------------- |
| Build     | `pnpm --filter @svelte-vitals/core build`      | exit 0                |
| Typecheck | `pnpm --filter @svelte-vitals/core typecheck`  | exit 0                |
| Tests     | `pnpm --filter @svelte-vitals/core test`       | all pass              |
| Lint      | `pnpm lint`                                     | exit 0                |
| 全体確認  | `pnpm build && pnpm typecheck && pnpm test`    | exit 0 / all pass     |

## Scope

**In scope**:

- `packages/core/src/component.ts`(`ComponentFacts` に `importSpans` を追加)
- `packages/core/src/component-parse.ts`(`collectImportSources` を行番号付きに拡張、
  `parseComponentFacts` の戻り値の型と実装に `importSpans` を追加)
- `packages/core/src/component-collect.ts`(`emptyComponentFacts` に `importSpans: []`
  を追加)
- `packages/core/src/rules/perf/perf009-heavy-import.ts`(`c.imports` ではなく
  `c.importSpans` を走査するよう変更)
- `packages/core/test/bundle-rules.test.ts`(PERF009 のテストを行番号ありで書き直す)
- `.changeset/`

**Out of scope**:

- `ComponentFacts.imports` の型変更・削除 — 既存のまま維持する。
- `PERF010`(`namespaceImports`)のロジック — 参考にするだけで変更しない。
- `packages/core/test/component-rule.test.ts`、`security-rules.test.ts`、
  `correctness-rules.test.ts`、`architecture-rules.test.ts`、
  `component-collect.test.ts` — これらは全て `imports: []`(空配列)を使っているだけな
  ので型互換性は保たれるが、**`importSpans` フィールドが必須(non-optional)になる場合
  はこれらのフィクスチャにも `importSpans: []` を足す必要がある** — Step 1 で `?` を付
  けるかどうかを決める際にこの点を考慮すること(推奨: 必須にして忘れを防ぐ。TypeScript
  のコンパイルエラーがどのファイルを直すべきか教えてくれる)。

## Git workflow

- Branch: `advisor/028-perf009-line-tracking`
- コミット: 1つでよい。`fix(core): give PERF009 findings a real line number` のような
  conventional commit(英語)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `ComponentFacts` に `importSpans` を追加する

`packages/core/src/component.ts` の `imports: string[];` の直後に以下を追加(必須フィ
ールドにする — `?` を付けない):

```ts
  /** Module specifiers of every `import`, each with its source line (Bundle PERF009). */
  importSpans: { source: string; line: number }[];
```

**Verify**: `pnpm --filter @svelte-vitals/core typecheck` → この時点ではまだ他のファイ
ルが未更新なのでコンパイルエラーになるはず(次のステップで解消)。エラーメッセージが
`component-collect.ts`・`component-parse.ts` の返り値の型不一致を指していることを確認
してから次に進む。

### Step 2: `collectImportSources` を行番号付きに拡張する

`packages/core/src/component-parse.ts` の `collectImportSources` を、`collectNamespaceImports`
と同じパターンで書き換える:

```ts
/** Module specifiers of every `import`, each with its source line (Bundle PERF009). */
function collectImportSources(program: Node, source: string, acc: { source: string; line: number }[]): void {
  walkEstree(program, (n) => {
    if (n.type === 'ImportDeclaration' && typeof n.source?.value === 'string') {
      acc.push({ source: n.source.value, line: lineOf(source, n.start) });
    }
  });
}
```

呼び出し元(575〜581行目付近、`ast.module?.content` と `ast.instance?.content` の2箇所)
を新しいシグネチャに合わせて更新する:

```ts
  const imports: string[] = [];
  const importSpans: { source: string; line: number }[] = [];
  const namespaceImports: { source: string; line: number }[] = [];
  if (ast.module?.content) {
    collectImportSources(ast.module.content, source, importSpans);
    collectNamespaceImports(ast.module.content, source, namespaceImports);
  }
  ...
  if (program) {
    collectImportSources(program, source, importSpans);
    collectNamespaceImports(program, source, namespaceImports);
    ...
  }
```

`imports: string[]` は既存の公開フィールドとして残す必要があるため、`importSpans` から
導出する(二重の AST 走査を避ける):

```ts
  const imports = importSpans.map((s) => s.source);
```

(この1行を、`imports`/`namespaceImports` を集め終えた直後、戻り値オブジェクトを組み立
てる前に追加する。`imports` のローカル変数宣言 `const imports: string[] = [];` は削除
してこの導出行に置き換える。)

`parseComponentFacts` の戻り値の型注釈(553-565行目付近)に `importSpans: { source:
string; line: number }[];` を追加し、関数末尾の返り値オブジェクト(626行目付近)に
`importSpans` を追加する。

**Verify**: `pnpm --filter @svelte-vitals/core typecheck` → `component-collect.ts` の
不一致のみが残っているはず。

### Step 3: `emptyComponentFacts` を更新する

`packages/core/src/component-collect.ts` の `emptyComponentFacts` に
`importSpans: [],` を追加する(コメント自身が「新フィールドはここに追加せよ」と指示し
ている場所)。

**Verify**: `pnpm --filter @svelte-vitals/core typecheck` → exit 0(このパッケージ内は
解消されるはず)。

### Step 4: PERF009 ルールを `importSpans` を使うように変更する

`packages/core/src/rules/perf/perf009-heavy-import.ts` の `applies`/`bad` を変更する:

```ts
  applies: (c) => c.importSpans.length > 0,
  bad: (c) => {
    // `Object.hasOwn` (not `in`) so inherited keys like `toString` never match;
    // dedupe so the same package imported in both scripts isn't double-penalized.
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    for (const { source: src, line } of c.importSpans) {
      if (!Object.hasOwn(HEAVY_PACKAGES, src) || seen.has(src)) continue;
      seen.add(src);
      out.push({ line, message: `Heavy import "${src}" — ${HEAVY_PACKAGES[src]}` });
    }
    return out;
  }
```

(同じ specifier が module スクリプトと instance スクリプトの両方に出現した場合、
`importSpans` には2エントリ入りうるが `seen` の dedup は既存どおり最初に出現した行を
採用する — 挙動は今までの「最初に見つかった行」という暗黙の優先順位と変わらない。)

**Verify**: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter @svelte-vitals/core build`
→ exit 0(パッケージ全体のコンパイルが通ること)。

### Step 5: テストを更新する

`packages/core/test/bundle-rules.test.ts` の `comp` ヘルパー(`imports: string[]` を受
け取る)を、`importSpans` も設定するように変更する。最小の変更方法: ヘルパーの引数を
`imports: string[]` のまま維持し、内部で `importSpans: imports.map((source, i) => ({
source, line: i + 1 }))` のように仮の行番号を生成してもよいが、**PERF009 が正しい行番
号を報告することを検証するのがこのプランの目的**なので、既存の PERF009 関連テスト
(`'emits nothing for a component with no imports'` など、47行目周辺)を実際の意味の
ある行番号(例: `line: 5`)を持つケースに書き換え、`result.line` がその行番号と一致す
ることをアサートする新しいテストケースを追加すること。既存の PERF010 テスト(91行目
「passes a component with no namespace imports」)は `namespaceImports` を直接使うヘ
ルパー引数なので変更不要。

追加すべきテストケース(新規):
- `lodash` を import しているコンポーネントで PERF009 の finding が `line: 0` ではな
  く実際の import 文の行番号を持つこと。
- 同じ重い import に対して `// svelte-vitals-disable-next-line PERF009` を直前行に置
  いたとき、finding が抑制される(結果に出ない)こと — これがこのバグの本質的な回帰
  テストであり、`component-rule.test.ts` の既存の suppression テスト(`isSuppressed`
  を経由するもの)と同じパターンで書く。

**Verify**: `pnpm --filter @svelte-vitals/core test` → all pass、新規テストが green。

### Step 6: 全体検証 + changeset

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0 /
all pass(core を消費する cli/vite/mcp/action もビルド・型チェックが通ることを確認)。

changeset を追加(`@svelte-vitals/core`: patch — 公開型への加法的フィールド追加 + バ
グ修正、既存フィールドの破壊的変更はないため patch が妥当。ただし本リポジトリの他の
プランは「振る舞いが変わる公開挙動の変更」を minor にしている例もあるため、
`ComponentFacts` という公開型にフィールドが増える点を踏まえ **minor** を選んでもよい
— 判断に迷ったら `@svelte-vitals/core` の既存 CHANGELOG.md で類似の「型に新フィールド
追加」の過去の扱いを確認し、それに合わせること)。changeset 本文は英語で、「PERF009
findings now report the correct source line, so `svelte-vitals-disable-next-line
PERF009` suppression directives work」の趣旨を書く。

## Test plan

- 新規: PERF009 が実際の import 行番号を報告するテスト(`packages/core/test/bundle-rules.test.ts`)。
- 新規: PERF009 の finding が `svelte-vitals-disable-next-line PERF009` で抑制される
  回帰テスト(同ファイル、または `component-rule.test.ts` の既存パターンに倣う)。
- 既存: `bundle-rules.test.ts` の他のケース(PERF010、"no imports"、非対象パッケージ)
  は変更後も green であること。
- 検証: `pnpm --filter @svelte-vitals/core test` → all pass、new tests included。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0 / all pass
- [ ] `packages/core/src/rules/perf/perf009-heavy-import.ts` の finding が `line: 0` を
      ハードコードしていない(`grep -n "line: 0" packages/core/src/rules/perf/perf009-heavy-import.ts` が0件)
- [ ] 新規テストで「実際の行番号」と「抑制ディレクティブが効くこと」の両方を確認済み
- [ ] `ComponentFacts.imports`(既存フィールド)の型・振る舞いが変わっていない
      (`git diff` で `imports: string[]` の宣言行が変更されていないことを確認)
- [ ] changeset が `.changeset/` に存在する
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `walkEstree`/`lineOf` の呼び出し規約が想定と異なる(例: `lineOf` が `n.start` 以外の
  引数を要求する)場合、`collectNamespaceImports` の実装を再度読み直し、それでも解決し
  なければ STOP。
- `ComponentFacts` を消費する外部パッケージ(vite/mcp/action)のいずれかが `imports`
  フィールドの**要素の型**(単なる string であること)に依存したコードを持っている
  ことが分かった場合(grep で確認)、`importSpans` 追加だけでは解決できない可能性があ
  るため STOP して報告する。
- テストの追加・修正で 2 回失敗した場合。

## Maintenance notes

- 将来 `imports: string[]` を廃止して `importSpans` に統一したくなった場合、消費者が
  PERF009 の `applies`/`bad` だけであることを確認済みなので置き換えは低リスクだが、
  それは別プランのスコープ(公開型の破壊的変更は pre-1.0 の「無警告での削除可」ポリシ
  ーに従うにしても、独立した意思決定として扱う)。
- 新しい Bundle 系ルール(PERF009/PERF010 以外)を追加する場合、行番号を持つ
  `importSpans`/`namespaceImports` のどちらかを再利用すべきで、行番号なしの `imports`
  を新規ルールの主データソースにしないこと。
