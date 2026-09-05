# Plan 067: vite プラグインで解析の警告(クラッシュしたルール、空の選択、読めないファイル)を dashboard でも表面化し、build 経路のクラッシュ報告をテストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/vite/src/ui/analysis.ts packages/vite/src/plugin.ts packages/vite/src/analyze.ts packages/vite/test/ui-analysis.test.ts packages/vite/test/analyze.test.ts packages/vite/test/ui-plugin.test.ts packages/cli/src/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on                                          | Category                    | Planned at                                                                   |
| -------- | ------ | ---- | --------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| P2       | S      | LOW  | 063 と同じ `plugin.ts` を触るので、063 の後に直列で | correctness / test-coverage | commit `13aa7ad0`(= `origin/main` `d3828d9e` と同内容のファイル)、2026-09-03 |

## Why this matters

`analyzeProject`(`packages/cli/src/index.ts`)は結果と一緒に `warnings: string[]` を返す。中身は、`--route` や overrides の glob が何にもマッチしなかった通知(`emptySelections`。`collect-all.ts` のコメントが「#510 が隠れていた原因」と書くクラス)、未知の inline directive id、バージョン床、読めなかった / パースできなかったファイル(`skippedFileWarnings`)、そして**クラッシュしたルール**の人間向けメッセージ(`rule X failed and was skipped: …`)である。CLI はこれを stderr に出す。

vite の dev dashboard は同じ `analyzeProject` を呼びながら、**warnings を構造的に捨てている**。`packages/vite/src/ui/analysis.ts` の `AnalyzeFn` の戻り値型が `{ results, failedRuleIds? }` で `warnings` を持たず、`onResults(results, failedRuleIds)` が唯一の出口。`plugin.ts` の `onResults` は store に書くだけで、プラグインが持つ `warn()` シンク(config 読み込み失敗には使っている)には流れない。結果として、overrides の `files` glob が空振りしていても、コンポーネントが読めなくても、ルールがクラッシュしていても、dashboard の利用者には何も見えない。クラッシュしたルールは `withFailedRulesOff` で採点から外れる(正しい)が、「どのルールが、なぜ」がどこにも出ない。

build 経路(`vite build`)は逆に、警告を `warn()` に流している(`analyze.ts:126` → `plugin.ts:242`)。しかし**クラッシュしたルールの警告が出ることを確かめるテストがない**。CLI 側には `packages/cli/test/rule-failure-isolation.test.ts:52-58` が正確な stderr 行を pin しており、dev handle 側には `dev-handle.test.ts:192-214` が id の転送を pin しているが、build 経路だけが空白。#632 で 3 つのパイプラインを `runAnalysis` に統合した根拠は「3 つが同じ振る舞いをする」ことなので、その 1 辺を固定する。

## Current state

- `packages/vite/src/ui/analysis.ts:5-13`(`AnalyzeFn`):

  ```ts
  /** The subset of `analyzeProject` (from `svelte-vitals`) the runner needs. Injectable for tests. */
  export type AnalyzeFn = (opts: {
    cwd: string;
    treatDynamicAs?: TreatDynamicAs;
    metaComponents?: string[];
    rules?: Record<string, RuleSetting>;
    failOn?: Severity;
    parseCache?: ParseCache;
  }) => Promise<{ results: Result[]; failedRuleIds?: string[] }>;
  ```

  `:24-30`(`AnalysisRunnerOptions` の callback 群):

  ```ts
  onResults(results: Result[], failedRuleIds?: string[]): void;
  onError(err: unknown): void;
  onStatusChange?(analyzing: boolean): void;
  ```

  `:55-80`(`runOnce`): `const { results, failedRuleIds } = await analyze({...})` → `if (!stopped) { if (failedRuleIds !== undefined) opts.onResults(results, failedRuleIds); else opts.onResults(results); }`。コメントが「第 2 引数は定義されているときだけ渡す(呼び出し引数を厳密に assert するテストを壊さないため)」と書いている。

- `packages/cli/src/index.ts:355-366`(`analyzeProject` の return): `warnings: [...warnings, ...skippedFileWarnings([...components, ...kitModules]), ...failedRuleWarnings(failedRules)]`。`AnalyzeResult.warnings` の JSDoc は `:219`。

- `packages/vite/src/plugin.ts:46-47`: `const warn = (line: string): void => console.warn(terminalSafe(line));`。`:299-316`(runner 生成、063 適用後も同じ形):

  ```ts
  const runner = createAnalysisRunner({
    root: uiRoot,
    treatDynamicAs: options.treatDynamicAs,
    metaComponents: options.metaComponents,
    rules: options.rules,
    failOn: options.failOn,
    onResults: (results, failedRuleIds) => {
      store.setStatic(results);
      staticFailedRuleIds = failedRuleIds ?? [];
    },
    onError: (err) => warn(`svelte-vitals: dev analysis failed: ${err instanceof Error ? err.message : String(err)}`),
    onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
  });
  ```

- `packages/vite/src/analyze.ts:120-126`(build 経路の警告組み立て):

  ```ts
  warnings.push(...skippedFileWarnings([...components, ...kitModules]));
  warnings.push(...unknownDirectiveIds(directives, allRules));
  for (const f of failedRules) warnings.push(formatFailedRuleWarning(f));
  ```

  `packages/vite/src/plugin.ts:242`: `for (const w of result.warnings) warn(\`svelte-vitals: ${w}\`);`。`formatFailedRuleWarning`(`packages/core/src/config-apply.ts:53-55`)は `rule ${id} failed and was skipped: ${message の 1 行目}` を返す。

- 既存テスト:
  - `packages/vite/test/ui-analysis.test.ts:36-50` — `vi.fn<AnalyzeFn>(async () => ({ results: [...] }))` を注入し、`onResults` の呼び出し引数を `toHaveBeenCalledWith([R('seo/title-presence')])` で**厳密に** assert している(第 2 引数を渡すと壊れるので、runner は `failedRuleIds` 未定義時に 1 引数で呼ぶ)。`vi.useFakeTimers()` を使う。
  - `packages/vite/test/analyze.test.ts:250-260` — `r.warnings` に config-file の警告が入ることを assert(`makeProject(configSource)` が一時プロジェクトを作る)。`:262-270` は `a11y/unverified-id-ref` の inert 通知。
  - `packages/vite/test/ui-plugin.test.ts:1-18` — `vi.mock('../src/ui/analysis.js', () => ({ createAnalysisRunner: () => ({ start, notifyChange: mockNotifyChange, stop }) }))` で runner をスタブ。
  - `packages/cli/test/rule-failure-isolation.test.ts:13-25` — `vi.mock('@svelte-vitals/core/internal', importOriginal)` で `allRules` のうち `seo/title-presence` の `check` を throw する版に差し替える。build 経路のテストはこのモック手法をそのまま使う。

- 設計上の注意(実装判断の根拠として固定):
  - `AnalyzeFn` の戻り値に `warnings?: string[]` を**追加**し、runner は `onWarnings?(warnings: string[])` を**新設**して流す。`onResults` の引数は変えない(厳密 assert のテストを守る)。
  - runner は前回流した警告集合と同一なら**再送しない**(debounce された再解析は保存のたびに走るので、同じ 3 行が毎回 `console.warn` に出るのは騒音)。集合比較は `warnings.join('\n')` の文字列比較で足りる。
  - `plugin.ts` 側は `onWarnings` を `warn()` に `svelte-vitals: ` 接頭辞付きで流す(build 経路の `:242` と同じ形)。
  - dashboard の HTML に警告を描画するのは本計画の対象外(`AppSnapshot` の型変更と app-shell の描画が要り、M になる)。
  - リポジトリ規約: コードコメントは英語、非自明な WHY のみ。

## Commands you will need

| Purpose    | Command                                                    | Expected on success |
| ---------- | ---------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                             | exit 0              |
| Build      | `pnpm build`                                               | exit 0              |
| Vite tests | `pnpm build && pnpm --filter @svelte-vitals/vite run test` | all pass            |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint`   | 全て exit 0         |

vite のテストは `svelte-vitals` と `@svelte-vitals/core` の built dist を import するので、テスト前に `pnpm build`。

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/vite/src/ui/analysis.ts`(`AnalyzeFn` の戻り値型、`onWarnings`、重複抑制)
- `packages/vite/src/plugin.ts`(`onWarnings` の配線。063 が変えた箇所の周辺だが、runner 生成部だけ)
- `packages/vite/test/ui-analysis.test.ts`(テスト追加)
- `packages/vite/test/analyze.test.ts`(build 経路のクラッシュ報告テスト追加)
- `packages/vite/test/ui-plugin.test.ts`(`onWarnings` の配線テスト追加、任意)
- `.changeset/`(新規 changeset 1 件、`@svelte-vitals/vite` の patch)

**Out of scope**(触らない):

- `packages/cli/src/index.ts` — `warnings` は既に返している。
- `packages/vite/src/analyze.ts`(build 経路)— 既に警告を返している。テストを足すだけ。
- `packages/vite/src/ui/snapshot.ts` / `store.ts` / `packages/core/src/reporter/app-shell.ts` — dashboard HTML への描画は別計画。
- `packages/vite/src/hooks/handle.ts` — per-request の経路は `SVELTE_VITALS_DEBUG` ゲートで警告する設計(計画 068 の対象)。

## Git workflow

- Branch: `advisor/067-vite-surface-analysis-warnings`(063 のマージ後に `origin/main` から。063 が未マージなら 063 のブランチを base にスタックし、README にその旨を書く)
- Conventional commits、例: `fix(vite): surface analyzeProject warnings from the dev dashboard runner and pin crashed-rule reporting on the build path`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: build 経路のクラッシュ報告テストを書く(現状で green のはず)

`packages/vite/test/analyze.test.ts` は `analyze` を直接呼ぶ。`rule-failure-isolation.test.ts` と同じ `vi.mock('@svelte-vitals/core/internal', …)` を**このファイルの先頭で**行うと他の全ケースに影響するので、新しいファイル `packages/vite/test/analyze-rule-failure.test.ts` を作る。

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THROWN = 'synthetic rule failure (test)\nsecond line must not be printed';

vi.mock('@svelte-vitals/core/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@svelte-vitals/core/internal')>();
  const allRules = actual.allRules.map((rule) =>
    rule.id === 'seo/title-presence'
      ? {
          ...rule,
          check: async () => {
            throw new Error(THROWN);
          }
        }
      : rule
  );
  return { ...actual, allRules };
});

const { analyze } = await import('../src/analyze.js');

describe('vite build path reports a crashed rule', () => {
  let cwd: string;
  let pages: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-rule-failure-'));
    pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), '<html lang="en"><head><title>Home</title></head><body></body></html>');
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('names the rule and only the first line of its message in warnings', async () => {
    const r = await analyze(pages, cwd, { report: false });
    expect(r.warnings).toContain('rule seo/title-presence failed and was skipped: synthetic rule failure (test)');
    expect(r.warnings.some((w) => w.includes('second line'))).toBe(false);
  });
});
```

`analyze` が `@svelte-vitals/core/internal` の `allRules` を top-level import で束縛しているかを確認する(`packages/vite/src/analyze.ts:1-20`)。`runAnalysis` に渡す `rules` が `selectRules(allRules, config)` 由来ならこのモックが効く。効かない(警告が出ない)場合は、`svelte-vitals` 側の再エクスポートを経由している可能性があるので STOP。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test -- analyze-rule-failure` → pass(現状の挙動を固定)。fail するならそれ自体が発見なので STOP して報告。

### Step 2: runner の失敗するテストを書く(TDD red)

`packages/vite/test/ui-analysis.test.ts` の `describe('createAnalysisRunner')` に追加する。

```ts
it('forwards analyzeProject warnings through onWarnings', async () => {
  const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [], warnings: ['rule x failed and was skipped: boom'] }));
  const onWarnings = vi.fn();
  const runner = createAnalysisRunner({ root: '/proj', analyze, onResults: vi.fn(), onError: vi.fn(), onWarnings });
  runner.start();
  await vi.waitFor(() => expect(onWarnings).toHaveBeenCalledWith(['rule x failed and was skipped: boom']));
});

it('does not repeat an identical warning set on the next run, and sends a changed set', async () => {
  let call = 0;
  const analyze = vi.fn<AnalyzeFn>(async () => ({
    results: [],
    warnings: ++call <= 2 ? ['same'] : ['same', 'new']
  }));
  const onWarnings = vi.fn();
  const runner = createAnalysisRunner({
    root: '/proj',
    analyze,
    onResults: vi.fn(),
    onError: vi.fn(),
    onWarnings,
    debounceMs: 10
  });
  runner.start();
  await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  runner.notifyChange('/proj/src/a.svelte');
  await vi.advanceTimersByTimeAsync(20);
  await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
  runner.notifyChange('/proj/src/b.svelte');
  await vi.advanceTimersByTimeAsync(20);
  await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(3));
  expect(onWarnings.mock.calls).toEqual([[['same']], [['same', 'new']]]);
});

it('still calls onResults with one argument when the analyzer returns no failedRuleIds', async () => {
  // Guards the existing exact-args assertions above against the widened return type.
  const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [], warnings: [] }));
  const onResults = vi.fn();
  const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError: vi.fn() });
  runner.start();
  await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(1));
  expect(onResults.mock.calls[0]).toEqual([[]]);
});
```

このファイルは `vi.useFakeTimers()` を `beforeEach` で使う。`debounceMs` と `advanceTimersByTimeAsync` の組み合わせは同ファイルの既存の debounce ケースに合わせる(既存ケースを読んで同じ待ち方にする)。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test -- ui-analysis` → 1 つ目と 2 つ目が **fail**(型エラーまたは `onWarnings` 未呼び出し)、3 つ目は pass。`pnpm typecheck` は `warnings` が `AnalyzeFn` の戻り値型にないため**失敗する**のが期待値。

### Step 3: runner に `onWarnings` と重複抑制を実装する

`packages/vite/src/ui/analysis.ts`:

1. `AnalyzeFn` の戻り値を `Promise<{ results: Result[]; failedRuleIds?: string[]; warnings?: string[] }>` に広げる。
2. `AnalysisRunnerOptions` に追加する。

   ```ts
   /** `analyzeProject`'s human-readable warnings (empty selections, unknown directive ids, skipped files, crashed rules). Called only when the set differs from the previous run's — a debounced re-run per save would otherwise repeat the same lines. */
   onWarnings?(warnings: string[]): void;
   ```

3. `createAnalysisRunner` に `let lastWarningsKey: string | undefined;` を持たせ、`runOnce` の `onResults` 呼び出しの直後に流す。

   ```ts
   const warnings = result.warnings ?? [];
   const key = warnings.join('\n');
   if (warnings.length > 0 && key !== lastWarningsKey) opts.onWarnings?.(warnings);
   lastWarningsKey = key;
   ```

   `runOnce` の分割代入は `const result = await analyze({...}); const { results, failedRuleIds } = result;` の形に直す。

**Verify**: `pnpm build && pnpm typecheck && pnpm --filter @svelte-vitals/vite run test -- ui-analysis` → all pass。

### Step 4: plugin で `onWarnings` を `warn()` に配線する

`packages/vite/src/plugin.ts` の `createAnalysisRunner({...})` に追加する。

```ts
// Same sink and prefix as the build path (closeBundle) so the two never read differently.
onWarnings: (warnings) => {
  for (const w of warnings) warn(`svelte-vitals: ${w}`);
},
```

任意で `packages/vite/test/ui-plugin.test.ts` に「`createAnalysisRunner` に `onWarnings` が渡される」ことを確認するケースを足す(同ファイルのモックは runner のオプションを捨てているので、モックファクトリで受け取ったオプションを `vi.hoisted` の変数に保存する形に拡張する)。省略可。

**Verify**: `pnpm build && pnpm typecheck && pnpm --filter @svelte-vitals/vite run test` → all pass。手動確認(任意): `examples/kitchen-sink` で `pnpm dev` を起動し、`svelte-vitals.config.js` に `overrides: [{ files: 'src/nope/**', rules: { seo: 'off' } }]` を足して保存すると、ターミナルに `svelte-vitals: overrides[0].files 'src/nope/**' matched no files` 相当の行が 1 回だけ出ること。

### Step 5: changeset を書き、最終検証

`.changeset/` に新規ファイル(例 `vite-surface-warnings.md`)。

```md
---
'@svelte-vitals/vite': patch
---

The dev dashboard's whole-project runner now forwards `analyzeProject`'s warnings (an `overrides` glob that matched nothing, an unknown inline-directive id, a file that could not be read or parsed, a rule that crashed and was skipped) to the terminal, the same way `vite build` already does. An unchanged warning set is not repeated on the next re-analysis. The build path's crashed-rule warning is now pinned by a test.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。

## Test plan

- 新規: build 経路のクラッシュ報告(1 ケース、現状 green)、runner の `onWarnings` 転送 / 重複抑制 / `onResults` 引数不変(3 ケース)。
- 既存: `ui-analysis.test.ts` の厳密引数 assert、`ui-plugin.test.ts`、`plugin-error.test.ts` が無変更で通ること。
- 判別性: Step 3 を revert すると Step 2 の 2 ケースが赤に戻る。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `grep -n "onWarnings" packages/vite/src/ui/analysis.ts packages/vite/src/plugin.ts` がそれぞれ 1 行以上ヒット
- [ ] `packages/vite/test/analyze-rule-failure.test.ts` が存在し pass
- [ ] `plans/README.md` の 067 行を更新済み(260903-BUG-03 と 260903-TEST-04 の両方を閉じる)

## Maintenance notes

- 警告を dashboard HTML に描画したくなったら、`onWarnings` の配列を store に載せて `AppSnapshot` に `warnings` を足すのが最短(app-shell の描画と `sanitizeReport` 相当のエスケープが要る)。
- `analyzeProject` の `warnings` に新しい種類を足すと、CLI・build・dashboard の 3 経路に自動で出る。出したくない種類があるなら `analyzeProject` 側で分けること。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない(063 未マージなら 063 適用後の `plugin.ts` と照合する)。
- Step 1 のテストが fail する(build 経路がクラッシュを報告していない)。
- Step 2 の `onResults` 引数不変ケースが Step 3 の後で fail する。
- `analyze.ts` の `allRules` が `@svelte-vitals/core/internal` 以外から来ていてモックが効かない。
