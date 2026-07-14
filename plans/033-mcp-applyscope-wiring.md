# Plan 033: MCP `analyze` tool に `applyScope`(diff/baseline/suppressions)を配線する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/mcp/src/tools/analyze.ts packages/action/src/index.ts packages/cli/src/index.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(既存の公開関数 `applyScope` を追加で呼び出すだけの加法的変更。
  新しい引数はすべて optional)
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`applyScope`(`packages/cli/src/index.ts` からエクスポート、`svelte-vitals` パッケージ
の公開 API)は、`--diff`/`--staged`/`--baseline` によるスコープ絞り込みと
`svelte-vitals-suppressions.json` の適用という「PR ゲートが本当に気にする所見だけに
絞る」ロジックを一箇所に集約したもので、CLI の `run()` と `@svelte-vitals/action` の
両方が既に使っている(`packages/action/src/index.ts` の docblock 自身が
"Shared by `run()` and `@svelte-vitals/action` (issue #154)" と明記)。

ところが `packages/mcp/src/tools/analyze.ts` はこれを一切呼んでいない
(`grep -rn "applyScope\|loadSuppressions" packages/mcp/src` は0件)—
`analyzeProject` の結果をそのまま JSON レポートとして返すだけ。

これは実用上の非対称を生む: `svelte-vitals-suppressions.json` を導入して
「レガシーな所見を受け入れ、新規のものだけをゲートする」運用を始めたプロジェクトで
も、CLI や Action 経由では所見一覧がクリーンに見える一方、**MCP の `analyze` ツール
を使う AI エージェントだけは**、既に受け入れ済みの所見が全部再浮上した状態を見る。
MCP はこのプロジェクトの「AI エージェント統合」という中核方針そのものであり、
まさにこの経路でノイズの多い所見を agent に見せてしまうのは避けたい。

## Current state

`packages/mcp/src/tools/analyze.ts`(全文、69-105行目の `handleAnalyze`):

```ts
export async function handleAnalyze(args: AnalyzeArgs): Promise<McpToolResult> {
  const allow = (args.rules ?? []).map((id) => id.toUpperCase());
  const ignore = (args.ignore ?? []).map((id) => id.toUpperCase());
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    return textError(`Unknown rule id(s): ${unknown.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}.`);
  }

  const rulesConfig = buildRulesConfig(allow, ignore);
  const rules = Object.keys(rulesConfig).length > 0 ? rulesConfig : undefined;

  try {
    const { results, config, version } = await analyzeProject({
      cwd: args.path,
      metaComponents: args.metaComponents,
      treatDynamicAs: args.treatDynamicAs,
      route: args.route,
      failOn: args.failOn,
      rules,
      weights: args.weights,
      categories: args.categories
    });
    const report = buildJsonReport(results, config, { version });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report
    };
  } catch (err) {
    if (err instanceof ProjectError) return textError(err.message);
    return textError(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

`analyzeInputSchema`(1-58行目)は `path`/`metaComponents`/`route`/
`treatDynamicAs`/`rules`/`ignore`/`categories`/`failOn`/`weights` を持つが、
diff/baseline/suppressions に相当するフィールドがない。

**参考実装 — `packages/action/src/index.ts:14-22`**(このプランが模倣する配線):

```ts
  const analysis = await analyzeProject({ cwd: path });
  const { config, version } = analysis;
  const results = await applyScope(analysis.results, {
    cwd: path,
    config,
    diffBase: diff,
    baseline,
    errorLog: (line) => core.warning(line)
  });
```

**`applyScope` のシグネチャ** — `packages/cli/src/index.ts:209-288`
(`ApplyScopeOptions` 型と実装、既に全文読了済み):

```ts
export interface ApplyScopeOptions {
  cwd: string;
  staged?: boolean;
  diffBase?: string;
  baseline?: string;
  config?: Config;
  noSuppressions?: boolean;
  errorLog?: (line: string) => void;
  analyzeOpts?: AnalyzeOptions;
}

export async function applyScope(results: Result[], opts: ApplyScopeOptions): Promise<Result[]>
```

`config` を渡さない呼び出しは suppressions の適用を完全にスキップする
(`ApplyScopeOptions.config` の JSDoc: "Suppression application is skipped entirely
when omitted, keeping such callers' behavior unchanged")。

**CLI 側のフラグ名の対応** — `packages/cli/src/resolve-args.ts:159-171,221-226`
(このプランの MCP スキーマのフィールド名は CLI のフラグ名に極力揃える):
`--diff [ref]`(省略時 `'HEAD'`)、`--staged`、`--baseline <ref>`(省略不可)、
`--no-suppressions`(mri の auto-negation で `argv.suppressions === false` として
現れる)。

## Commands you will need

| Purpose   | Command                                    | Expected on success |
| --------- | --------------------------------------------- | -------------------- |
| Tests     | `pnpm --filter @svelte-vitals/mcp test`      | all pass              |
| Typecheck | `pnpm --filter @svelte-vitals/mcp typecheck` | exit 0                |
| Build     | `pnpm --filter @svelte-vitals/mcp build`     | exit 0                |
| Lint      | `pnpm lint`                                    | exit 0                |

## Scope

**In scope**:

- `packages/mcp/src/tools/analyze.ts`(`analyzeInputSchema` に diff/baseline/
  noSuppressions フィールドを追加し、`handleAnalyze` から `applyScope` を呼ぶ)
- `packages/mcp/test/analyze-tool.test.ts`(新規テストケース)
- `docs/src/content/docs/guides/mcp.md` + `ja/guides/mcp.md`(`analyze` ツールの
  引数一覧に新フィールドを追記 — 既存のドキュメントが引数を列挙している場合)

**Out of scope**:

- `--staged` 相当の入力(MCP はエージェントのツール呼び出しであり、git のステージン
  グ領域という概念は agent 呼び出し元のコンテキストと相性が悪い可能性がある —
  `diff`/`baseline`/`noSuppressions` の3つに絞る。将来 `staged` の需要が出れば別
  プランで追加)。
- `applyScope` 自体のロジック変更。
- `packages/mcp/src/tools/explain-rule.ts`(無関係)。

## Git workflow

- Branch: `advisor/033-mcp-applyscope-wiring`
- コミット: `feat(mcp): apply diff/baseline scoping and suppressions in the analyze tool`
  (英語、1コミットでよい)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 入力スキーマにフィールドを追加する

`packages/mcp/src/tools/analyze.ts` の `analyzeInputSchema` に、既存のフィールドと
同じスタイル(`.optional().describe(...)`)で追加する:

```ts
  diff: z
    .string()
    .optional()
    .describe(
      'Scope findings to files changed vs this git ref (e.g. "origin/main"). Mirrors the CLI --diff flag; omit for no diff scoping.'
    ),
  baseline: z
    .string()
    .optional()
    .describe(
      'Report only findings not already present at this git ref (e.g. "origin/main"). Mirrors the CLI --baseline flag.'
    ),
  noSuppressions: z
    .boolean()
    .optional()
    .describe(
      'Ignore svelte-vitals-suppressions.json for this call, reporting every finding even if previously accepted. Mirrors the CLI --no-suppressions flag.'
    )
```

(挿入位置は既存フィールドの並びの中で自然な場所でよい — 例えば `route` の後、
`treatDynamicAs` の前。)

**Verify**: `pnpm --filter @svelte-vitals/mcp typecheck` → この時点ではまだ
`handleAnalyze` が新フィールドを使っていないためコンパイルは通るはず(未使用でも
optional なので型エラーにはならない)。

### Step 2: `handleAnalyze` から `applyScope` を呼ぶ

`svelte-vitals` からの import に `applyScope` を追加し(1行目)、
`analyzeProject` の呼び出し結果を `applyScope` に通してから `buildJsonReport` に
渡す:

```ts
import { analyzeProject, applyScope, buildRulesConfig, findUnknownRuleIds, knownRuleIds, ProjectError } from 'svelte-vitals';
```

`handleAnalyze` の try ブロック内(既存の `analyzeProject` 呼び出しの直後)を以下の
ように変更する:

```ts
  try {
    const cwd = args.path ?? process.cwd();
    const { results, config, version } = await analyzeProject({
      cwd: args.path,
      metaComponents: args.metaComponents,
      treatDynamicAs: args.treatDynamicAs,
      route: args.route,
      failOn: args.failOn,
      rules,
      weights: args.weights,
      categories: args.categories
    });
    const scoped = await applyScope(results, {
      cwd,
      config,
      diffBase: args.diff,
      baseline: args.baseline,
      noSuppressions: args.noSuppressions
    });
    const report = buildJsonReport(scoped, config, { version });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report
    };
  } catch (err) {
    ...
```

注意点:
- `applyScope` は `cwd: string`(必須)を要求する。`analyzeProject` には
  `cwd: args.path`(`string | undefined`)を渡しているが、`analyzeProject` 内部で
  `opts.cwd ?? process.cwd()` としてデフォルト値を補っている(`packages/cli/src/index.ts:173`)
  ——`applyScope` にはこの補完がないため、`handleAnalyze` 側で同じデフォルト
  (`args.path ?? process.cwd()`)を明示的に計算して渡す必要がある(上記コード例の
  `const cwd = args.path ?? process.cwd();` がそれ)。
- `applyScope` の `errorLog` を省略した場合のデフォルトは `console.error` へのフォー
  ルバック(`packages/cli/src/index.ts:236`)。MCP サーバーの stdout/stderr の扱いに
  ついて `packages/mcp/src/server.ts` の他のエラーハンドリング方針を確認し、
  `console.error` への出力が MCP の stdio トランスポートを汚さないか一度確認する
  こと(stdio トランスポートは stdout を JSON-RPC メッセージ専用に使うため、
  `console.error`(stderr)は安全なはずだが、既存コードで `errorLog` を渡す/渡さない
  の判断基準があるか `packages/action/src/index.ts` の `errorLog: (line) =>
  core.warning(line)` のような明示的な指定パターンと比較して判断する)。
  デフォルトで問題なければ `errorLog` は省略してよい。

**Verify**: `pnpm --filter @svelte-vitals/mcp typecheck && pnpm --filter @svelte-vitals/mcp build`
→ exit 0。

### Step 3: テストを追加する

`packages/mcp/test/analyze-tool.test.ts` は `packages/cli/test/fixtures/basic-project`
と `config-file-project` を再利用しているパターン(9-12行目)。同様に、CLI の
suppressions/diff/baseline テスト(`packages/cli/test/run-suppressions.test.ts`・
`run-diff.test.ts`・`run-baseline.test.ts`)がどのようなフィクスチャ/一時ディレクトリ
セットアップを使っているか読み、同じパターンで以下を検証する新しい `it` ブロックを
`describe('analyze tool', ...)` に追加する:

1. **`diff` を渡すと変更ファイルにスコープされる** — git リポジトリのフィクスチャ
   (一時ディレクトリを作り `git init` してコミットするか、既存の diff テストの
   セットアップヘルパーを再利用)で、`args.diff` を渡した場合と渡さない場合で
   `report.routes`/所見件数が異なることを確認。
2. **`baseline` を渡すと既存所見が除外される** — 同様に baseline 用のセットアップを
   再利用し、`args.baseline` 指定時に新規所見のみが返ることを確認。
3. **`noSuppressions: true` で suppressions ファイルが無視される** —
   `svelte-vitals-suppressions.json` を持つフィクスチャ(`run-suppressions.test.ts`
   のセットアップパターンを参考に一時ディレクトリへ書き出す)に対し、
   `noSuppressions` なしでは抑制された所見が結果に出ず、`noSuppressions: true` では
   出ることを確認。

git 操作を伴うテストのセットアップが複雑になる場合、CLI 側の該当テストファイルが
既に持っているヘルパー関数(一時 git リポジトリの作成など)を import して再利用でき
るか確認すること — 車輪の再発明を避ける。

**Verify**: `pnpm --filter @svelte-vitals/mcp test` → all pass、新規3ケース以上
green、既存ケースも green。

### Step 4: docs を更新する

`docs/src/content/docs/guides/mcp.md` と `ja/guides/mcp.md` を開き、`analyze` ツール
の引数一覧セクションに `diff`/`baseline`/`noSuppressions` を追記する(既存の
`metaComponents`/`categories`/`weights` などの記述と同じ文体・フォーマットで)。
実際のドキュメント構成は開いて確認してから、その構成に自然に合流させること。

**Verify**: 目視で en/ja 両方に同じ内容が反映されていることを確認。

### Step 5: 全体検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0 /
all pass。changeset を追加(`@svelte-vitals/mcp`: minor — 新しいツール引数の追加、
英語で「the `analyze` tool now supports `diff`/`baseline` scoping and
`svelte-vitals-suppressions.json`, matching the CLI and GitHub Action」の趣旨)。

## Test plan

- 新規: `diff`/`baseline`/`noSuppressions` それぞれが `analyze` ツールの結果に
  正しく反映されることを確認する3ケース(`packages/mcp/test/analyze-tool.test.ts`)。
- 既存: 同ファイルの全既存ケースが変更後も green。
- 検証: `pnpm --filter @svelte-vitals/mcp test` → all pass。

## Done criteria

- [ ] `analyzeInputSchema` に `diff`/`baseline`/`noSuppressions` が追加されている
- [ ] `handleAnalyze` が `applyScope` を呼び、結果をそれに通してからレポートを構築
      している
- [ ] 新規3テストケースが green、既存ケースも green
- [ ] `pnpm --filter @svelte-vitals/mcp typecheck && build` が exit 0
- [ ] docs(en/ja)が更新されている
- [ ] changeset が存在する
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- CLI の diff/baseline/suppressions テストのセットアップヘルパーが再利用できない
  形で書かれている(密結合したモジュール内部関数など)場合、無理に import せず、
  MCP 側で最小限の同等のセットアップを自前で書く判断をしてよいが、その場合は
  Maintenance notes に「重複したセットアップコードがある」旨を記録する。
- `applyScope` の `cwd` 必須引数の扱いで `analyzeProject` の実際の解決順序
  (`opts.cwd ?? process.cwd()`)と食い違うことが判明した場合、一度立ち止まって
  `packages/cli/src/index.ts` の該当箇所を再読し、それでも整合しなければ STOP。

## Maintenance notes

- 今後 CLI に diff/baseline/suppressions 関連の新しいフラグが追加された場合、MCP の
  `analyzeInputSchema` にも同じ内容を追加することを検討する(このプランが確立した
  「MCP は CLI/Action と同じスコープ機能を持つ」という対称性を維持するため)。
- `--staged` 相当は意図的にスコープ外とした — MCP 経由での需要が観測されたら追加を
  検討する。
