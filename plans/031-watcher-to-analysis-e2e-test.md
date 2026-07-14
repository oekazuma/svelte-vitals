# Plan 031: watcher → 再解析の結線を end-to-end でテストする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/vite/src/plugin.ts packages/vite/test/ui-plugin.test.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(テスト追加のみ)
- **Depends on**: none(Plan 034 と同じファイル `packages/vite/src/ui/analysis.ts`
  周辺を扱うため、Plan 034 を先に実施する場合はこのプランのテストが Plan 034 の変更
  後の `notifyChange` シグネチャに合わせて自然と検証できる形になる — ただし本プラン
  単体でも現状の実装に対して意味のあるテストとして成立するため、実行順序は必須では
  ない)
- **Category**: tests
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

Vite プラグインは `configureServer` の中で `server.watcher?.on('all', (_event, file)
=> { if (isRelevant(file, uiRoot)) runner.notifyChange(file); })` という形で、
ファイル変更 → ライブダッシュボードの再解析という結線を作っている。この2つの部品
(`isRelevant`・`runner.notifyChange`)はそれぞれ単体テストがあるが、**それらを繋ぐ
このコールバック自体**を実際に呼び出して検証しているテストは存在しない。

`packages/vite/test/ui-plugin.test.ts` の既存テスト「configureServer registers a
watcher listener for source-change re-analysis」は `watcher.on` が `'all'` という
イベント名で呼ばれたことしか確認しておらず、渡されたコールバック自体を実行していない。
つまり、コールバックの中身(`isRelevant` の呼び出し引数の順序、`runner` への配線)に
リグレッションが入っても、このテストは red にならない — ライブ再解析が実質的に
死んでいても気づける仕組みがない。

## Current state

`packages/vite/src/plugin.ts:118-146`(`configureServer` の該当部分):

```ts
    configureServer(server: ViteDevServer) {
      process.env.SVELTE_VITALS_UI = '1';
      const config = defineConfig({ ... });
      const store = createStore();
      const uiRoot = options.cwd ?? server.config.root;

      const runner = createAnalysisRunner({
        root: uiRoot,
        treatDynamicAs: options.treatDynamicAs,
        metaComponents: options.metaComponents,
        rules: options.rules,
        failOn: options.failOn,
        onResults: (results) => store.setStatic(results),
        onError: (err) => console.warn('[svelte-vitals] dev analysis failed:', err),
        onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
      });
      runner.start();
      server.watcher?.on('all', (_event, file) => {
        if (isRelevant(file, uiRoot)) runner.notifyChange(file);
      });
      ...
```

`createAnalysisRunner` は `packages/vite/src/ui/analysis.ts` からの import で、
`configureServer` の中でクロージャとして生成されるため、**外部から `runner` を
直接差し替える口(依存性注入の口)が現状ない** — テストで `notifyChange` が呼ばれた
ことを確認するには工夫が要る。

`packages/vite/test/ui-plugin.test.ts:45-57`(既存の該当テスト、全文):

```ts
  it('configureServer registers a watcher listener for source-change re-analysis', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    const watcherEvents: string[] = [];
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: { on: (event: string) => watcherEvents.push(event) },
      middlewares: { use: () => {} }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);
    expect(watcherEvents).toContain('all');
  });
```

このテストのモック `server.watcher.on` はイベント名を配列に push するだけで、渡され
たコールバック関数自体を保持していない。

- `isRelevant`(`packages/vite/src/plugin.ts:29-36`)は export 済みで、既にそれ単体の
  テストが `ui-plugin.test.ts` 内の別の describe ブロック(このファイルの他の部分、
  今回読んでいない範囲にある可能性がある — 実装前に確認すること)にあるかもしれない。
  存在すれば重複させず、なければこのプランで軽く触れてよい(メインは結線のテスト)。
- `createAnalysisRunner`(`packages/vite/src/ui/analysis.ts`)は `AnalyzeFn` を
  `opts.analyze` として注入可能(テスト用に設計済み、`analysis.ts:20-25` の JSDoc
  参照)。ただし `configureServer` はこの `analyze` オプションを渡していない
  (`createAnalysisRunner({ root: uiRoot, ..., onResults, onError, onStatusChange })`
  — `analyze` フィールドなし)。テストで実際の解析を走らせたくない場合、この点を
  踏まえて何を検証するか設計する(下記 Step 2 参照)。

## Commands you will need

| Purpose   | Command                                       | Expected on success |
| --------- | ----------------------------------------------- | -------------------- |
| Tests     | `pnpm --filter @svelte-vitals/vite test`      | all pass              |
| Typecheck | `pnpm --filter @svelte-vitals/vite typecheck` | exit 0                |
| Lint      | `pnpm lint`                                     | exit 0                |

## Scope

**In scope**:

- `packages/vite/test/ui-plugin.test.ts`(既存テストの拡張、または新規 `it` ブロック
  の追加)

**Out of scope**:

- `packages/vite/src/plugin.ts`・`packages/vite/src/ui/analysis.ts` のプロダクション
  コード変更(このプランはテストのみ。ただし後述 STOP 条件を参照 — テストを書く上で
  「呼び出しを観測するための最小限のフック」が本当に必要だと判明した場合は例外的に
  検討してよいが、まずはテスト側の工夫で解決を試みること)。

## Git workflow

- Branch: `advisor/031-watcher-to-analysis-e2e-test`
- コミット: `test(vite): exercise the watcher callback that triggers dev-dashboard re-analysis`
  (英語、1コミット)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: watcher コールバックを捕捉する

既存テストのモック `server.watcher.on` を、イベント名だけでなくコールバック関数自体
も保持するように変更する(または新しい `it` ブロックでこれを行う):

```ts
  it('the watcher callback triggers re-analysis for a relevant file and skips an irrelevant one', () => {
    const plugins = svelteVitals({ ui: true }) as Plugin[];
    const ui = plugins.find((p) => p.name === 'svelte-vitals:ui')!;
    let watcherCallback: ((event: string, file: string) => void) | undefined;
    const server = {
      config: { root: '/tmp/does-not-exist-svelte-vitals-ui-plugin-test' },
      watcher: {
        on: (_event: string, cb: (event: string, file: string) => void) => {
          watcherCallback = cb;
        }
      },
      middlewares: { use: () => {} }
    } as unknown as ViteDevServer;
    const hook = typeof ui.configureServer === 'function' ? ui.configureServer : ui.configureServer!.handler;
    (hook as (s: ViteDevServer) => void).call({}, server);
    expect(watcherCallback).toBeDefined();
    // ... 続きは Step 2
  });
```

### Step 2: `runner.notifyChange` が呼ばれた/呼ばれないことを観測する

`configureServer` は `runner`(`createAnalysisRunner` の戻り値)をクロージャの中に
閉じ込めており、外部から差し替えたりスパイを仕込んだりする口がない。これを解決する
2つのアプローチのうち、**まずアプローチ A を試すこと**:

**アプローチ A(推奨・プロダクションコード変更なし)**: `createAnalysisRunner` を
`vi.mock('../src/ui/analysis.js', ...)` でモックし、モックした
`createAnalysisRunner` が返すオブジェクトの `notifyChange` を `vi.fn()` にして、
それが呼ばれる/呼ばれないことを直接アサートする。`packages/vite/test/plugin-error.test.ts`
の「`vi.mock` を対象モジュールの import より前に書く」パターンをそのまま踏襲する:

```ts
const mockNotifyChange = vi.fn();
vi.mock('../src/ui/analysis.js', () => ({
  createAnalysisRunner: () => ({
    start: vi.fn(),
    notifyChange: mockNotifyChange,
    stop: vi.fn()
  })
}));

import { svelteVitals } from '../src/index.js';
// ... isRelevant も必要なら '../src/plugin.js' から import
```

このモックを使い、Step 1 で捕捉した `watcherCallback` を実際に呼び出す:

```ts
    watcherCallback!('change', '/tmp/does-not-exist-svelte-vitals-ui-plugin-test/src/routes/+page.svelte');
    expect(mockNotifyChange).toHaveBeenCalledWith(
      '/tmp/does-not-exist-svelte-vitals-ui-plugin-test/src/routes/+page.svelte'
    );

    mockNotifyChange.mockClear();
    watcherCallback!('change', '/tmp/does-not-exist-svelte-vitals-ui-plugin-test/node_modules/foo/index.js');
    expect(mockNotifyChange).not.toHaveBeenCalled();
```

(2つ目のケースは `node_modules` 配下なので `isRelevant` が false を返すはずのパス —
`packages/vite/src/plugin.ts:33` の `IGNORED_SEGMENTS` チェックに一致する。)

この `vi.mock` はファイル冒頭(トップレベル)に置く必要があるため、既存の
`ui-plugin.test.ts` の他のテスト(`createAnalysisRunner` の実装に依存しない
テスト、例えば printUrls 関連)に影響しないか確認すること — 影響する場合は
このテストケースを新しい別ファイル(例: `ui-plugin-watcher.test.ts`)に切り出す
判断をしてよい(1ファイル内で `vi.mock` はモジュール全体に効くため)。

**アプローチ B(A が技術的に無理だった場合のみ)**: `svelteVitals` に非公開の
テスト用フックを足す(例: `configureServer` が生成した `runner` を
`server.__svelteVitalsRunner` のような形でテスト時だけ公開する)。これは
プロダクションコードの変更を伴うため、まず A を試し、A で書けないことが判明した
場合にのみ検討し、その判断理由を Maintenance notes に残すこと。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → 新規テストが green、既存の
`ui-plugin.test.ts` の他のテストも引き続き green。

### Step 3: 全体検証

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck && pnpm lint` → 両方 exit 0。

## Test plan

- 新規: watcher コールバックが `isRelevant` を通して「関連ファイルなら
  `notifyChange` を呼ぶ・無関係なファイルなら呼ばない」ことを実行時に確認するテスト
  (`ui-plugin.test.ts` または切り出した新ファイル)。
- 既存の `ui-plugin.test.ts` の全テストが変更後も green であること。
- 検証: `pnpm --filter @svelte-vitals/vite test` → all pass。

## Done criteria

- [ ] watcher コールバックを実際に呼び出し、関連ファイル/無関係ファイルそれぞれで
      `notifyChange` の呼び出し有無を検証するテストが存在する
- [ ] `pnpm --filter @svelte-vitals/vite test` が all pass
- [ ] `pnpm --filter @svelte-vitals/vite typecheck` が exit 0
- [ ] `pnpm lint` が exit 0
- [ ] プロダクションコード(`plugin.ts`/`analysis.ts`)に変更がない、またはアプローチ
      B を採った場合はその理由が Maintenance notes に記録されている
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- アプローチ A(`vi.mock('../src/ui/analysis.js', ...)`)が `svelteVitals` の他の
  内部利用箇所(`plugin.ts` 以外からも `createAnalysisRunner` が import されている
  等)と衝突してテストが書けないことが判明した場合、アプローチ B に進む前に一度
  状況を整理して報告する。
- 検証コマンドが修正1回を挟んで2回失敗した場合。

## Maintenance notes

- 今後 `configureServer` の watcher 配線を変更する場合(例: イベント名を `'all'`
  以外にする、`isRelevant` の判定基準を変える)は、このテストが最初に red になる
  はず — レビュアーはその変化が意図したものかを確認すること。
- Plan 034(dev dashboard の部分再解析)を実施する場合、`notifyChange` のシグネチャ
  や挙動が変わる可能性があるため、このプランのテストがその変更後も意味を保つか
  (`notifyChange` が呼ばれること自体の検証は変わらず有効なはず)を確認すること。
