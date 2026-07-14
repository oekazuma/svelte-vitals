# Plan 034: dev dashboard の再解析で変更していないファイルの再パースを避ける

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/cli/src/index.ts packages/cli/src/providers/source/routes.ts packages/cli/src/providers/source/resolve.ts packages/vite/src/ui/analysis.ts packages/vite/src/plugin.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED(パスの正規化がずれるとキャッシュ無効化が効かず「保存しても
  ダッシュボードに反映されない」という静かな不具合になりうる — Step 4 のテストで
  必ず実測すること)
- **Depends on**: Plan 031(watcher→再解析の結線テストがあると、このプランの変更
  後もその配線が壊れていないことを既存テストで確認しやすい。ただし独立に実施可能)
- **Category**: perf
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

Vite dev dashboard は `svelteVitals({ ui: true })` を使うと、`vite dev` 中の関連ソース
ファイル変更のたびに **プロジェクト全体を再解析**する。`packages/vite/src/ui/analysis.ts`
の `notifyChange(file: string)` は `file` 引数を受け取るが、実装(`notifyChange()`)は
その値を一切使わず、常に `runOnce()`(= 無条件のフル `analyzeProject` 呼び出し)を
デバウンス後に実行するだけ。加えて、CLI 側の `collectRoutes`
(`packages/cli/src/providers/source/routes.ts:189-196`)はルート/レイアウトの読込+
パース結果をキャッシュする `ParseCache`(`Map<string, Promise<ParsedFile>>`)を持って
いるが、これは `collectRoutes` の呼び出しごとに `new Map()` で作り直される「1回の
解析内でのみ有効な」キャッシュ — デバウンスされた再解析のたびに空から作り直される
ため、変更していないファイルも毎回ディスクから読み直され再パースされる。

200ルートあるプロジェクトで無関係なコンポーネントを1つ保存するだけで、保存のたびに
プロジェクト全体のルート/レイアウトファイルが re-glob + re-read + re-parse される —
「ライブ」ダッシュボードが謳う軽快さと矛盾する。

## Design

`ParseCache` は「ファイルパスをキーにした読込+パース結果の Promise キャッシュ」なので、
**そのファイルの内容が変わっていなければ再利用してよい**。これを2つの変更で実現する:

1. `collectRoutes`(および呼び出し元の `analyzeProject`)が、外部から渡された
   永続 `ParseCache` を使えるようにする(渡されなければ従来どおり新規作成 — 既存の
   CLI/MCP/Action の呼び出しは無変更で動く)。
2. Vite の dev dashboard(`packages/vite/src/ui/analysis.ts`)が dev サーバーの
   セッションを通じて**1つの `ParseCache` インスタンスを保持し続け**、
   `notifyChange(file)` が呼ばれるたびに、変更されたファイル**そのものだけ**の
   キャッシュエントリを削除してから再解析を走らせる。

これにより、変更されていないファイルは引き続きキャッシュから即座に返り、変更された
ファイルだけが再読込+再パースされる。ルート解決(`resolveRoute`)自体は毎回全ルート
に対して実行される(どのルートが影響を受けるかを個別に判定するような、より複雑で
リスクの高い最適化はこのプランのスコープ外 — Plan 036 の設計スパイクに譲る)ため、
「レイアウト変更が子ルートに波及しない」という正しさの懸念は生じない: 各ルートの
解決は常にそのルートの layout chain を辿って `resolveFileTags` を呼び直すので、
変更されたレイアウトファイルは(キャッシュが無効化されているため)新しい内容で
読み直され、それを含むすべてのルートに正しく反映される。**節約されるのは「変わって
いないファイルの無駄な読込+パース」だけであり、ルール判定や合成ロジックは一切変えない**。

## Current state

- **`ParseCache` 型** — `packages/cli/src/providers/source/resolve.ts:16`:

```ts
export type ParseCache = Map<string, Promise<ParsedFile>>;
```

キーは「project-root-relative path」(JSDoc: "keyed by project-root-relative path
(as normalized by chainFiles / resolveComponentPath)")。実際の値は
`packages/cli/src/runtime/node.ts:24-26` の `glob(pattern, cwd) { return
tinyglob(pattern, { cwd, dot: false }); }` が返す形式 — `tinyglobby` は OS に関わらず
**POSIX 形式(`/` 区切り)の cwd 相対パス**を返す(例: `src/routes/+page.svelte`)。

- **`collectRoutes`** — `packages/cli/src/providers/source/routes.ts:189-201`
  (既に全文読了済み):

```ts
export async function collectRoutes(
  rt: Runtime,
  cwd: string,
  config: Config = defaultConfig
): Promise<{ heads: ResolvedHead[]; images: ResolvedImages[]; headings: ResolvedHeadings[] }> {
  const [pages, layouts] = await Promise.all([enumerateRoutePages(rt, cwd), collectLayouts(rt, cwd)]);
  const cache: ParseCache = new Map();
  const facts = await Promise.all(pages.map((page) => resolveRoute(rt, cwd, page, config, layouts, cache)));
  return {
    heads: facts.map((f) => f.head),
    images: facts.map((f) => f.images),
    headings: facts.map((f) => f.headings)
  };
}
```

- **`analyzeProject`** — `packages/cli/src/index.ts:139-206`(`AnalyzeOptions` と
  実装、既に全文読了済み)。`collectRoutes(rt, cwd, config)` の呼び出しは172-207行目
  の中、192行目。
- **`AnalysisRunner`** — `packages/vite/src/ui/analysis.ts`(全文、既に読了済み)。
  `notifyChange(file: string)` の実装(95-104行目)は `file` を無視する:

```ts
    notifyChange() {
      if (stopped) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (stopped) return;
        if (running) pending = true;
        else void runOnce();
      }, debounceMs);
    },
```

`AnalyzeFn` 型(4-10行目)と、production 実装が `svelte-vitals` を dynamic import
する `getAnalyze()`(56-62行目):

```ts
export type AnalyzeFn = (opts: {
  cwd: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
}) => Promise<{ results: Result[] }>;
...
  async function getAnalyze(): Promise<AnalyzeFn> {
    if (cachedAnalyze) return cachedAnalyze;
    const mod = await import('svelte-vitals');
    const fn: AnalyzeFn = (o) => mod.analyzeProject(o);
    cachedAnalyze = fn;
    return fn;
  }
```

- **`plugin.ts` の呼び出し元**(既に読了済み) — `runner.notifyChange(file)` は
  `server.watcher.on('all', (_event, file) => { if (isRelevant(file, uiRoot))
runner.notifyChange(file); })` から、Vite の watcher が渡す**絶対パス**で呼ばれる。
  `uiRoot`(= `options.cwd ?? server.config.root`)がプロジェクトルート。

## Commands you will need

| Purpose   | Command                                                                                                                          | Expected on success |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Tests     | `pnpm --filter @svelte-vitals/core test --filter svelte-vitals test --filter @svelte-vitals/vite test`(または各パッケージ個別に) | all pass            |
| Typecheck | `pnpm typecheck`                                                                                                                 | exit 0              |
| Build     | `pnpm build`                                                                                                                     | exit 0              |
| Lint      | `pnpm lint`                                                                                                                      | exit 0              |

## Scope

**In scope**:

- `packages/cli/src/providers/source/routes.ts`(`collectRoutes` が外部キャッシュを
  受け取れるようにする)
- `packages/cli/src/index.ts`(`AnalyzeOptions` に `parseCache` を追加、`ParseCache`
  型を re-export、`collectRoutes` 呼び出しにキャッシュを渡す)
- `packages/cli/src/providers/source/resolve.ts`(`ParseCache` 型は変更不要 —
  export 済みであることを確認するのみ)
- `packages/vite/src/ui/analysis.ts`(`AnalyzeFn`/`AnalysisRunner` にキャッシュ管理
  を追加)
- `packages/vite/src/plugin.ts`(必要なら `uiRoot` を使ったファイルパス正規化を
  `analysis.ts` に渡す配線を追加)
- 上記に対応するテストファイル

**Out of scope**:

- ルート単位で「どのルートが変更ファイルの影響を受けるか」を判定して、影響のない
  ルートのルール再実行そのものをスキップする最適化(Plan 036 の設計スパイクの領域 —
  正しさのリスクが本プランより大きいため分離)。
- `packages/vite/src/analyze.ts`(build-mode の prerendered HTML 解析)— dev
  dashboard とは別の解析パスであり、このプランのスコープ外。
- `analyzeProject` を呼ぶ CLI の `run()`・MCP・Action 側の変更 — `parseCache` は
  optional なので、これらは何も変更せず今までどおり動く。

## Git workflow

- Branch: `advisor/034-dev-dashboard-persistent-parse-cache`
- コミット: 論理的に分けてよい(例: `feat(cli): let collectRoutes/analyzeProject reuse an external parse cache` /
  `perf(vite): keep the dev dashboard's parse cache across re-analyses`)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `collectRoutes` が外部キャッシュを受け取れるようにする

`packages/cli/src/providers/source/routes.ts` の `collectRoutes` のシグネチャに
第4引数(optional)を追加する:

```ts
export async function collectRoutes(
  rt: Runtime,
  cwd: string,
  config: Config = defaultConfig,
  cache: ParseCache = new Map()
): Promise<{ heads: ResolvedHead[]; images: ResolvedImages[]; headings: ResolvedHeadings[] }> {
  const [pages, layouts] = await Promise.all([enumerateRoutePages(rt, cwd), collectLayouts(rt, cwd)]);
  const facts = await Promise.all(pages.map((page) => resolveRoute(rt, cwd, page, config, layouts, cache)));
  return {
    heads: facts.map((f) => f.head),
    images: facts.map((f) => f.images),
    headings: facts.map((f) => f.headings)
  };
}
```

(ローカル変数 `const cache: ParseCache = new Map();` を削除し、デフォルト引数に
置き換えるだけ — 呼び出し元がキャッシュを渡さなければ従来と全く同じ挙動。)

`collectRoutes` の他の呼び出し元(`packages/cli/src/index.ts` 以外に存在するか
`grep -rn "collectRoutes(" packages/cli/src` で確認すること — もしあれば同様に
無変更で動くことを確認する)。

**Verify**: `pnpm --filter svelte-vitals typecheck` → exit 0。

### Step 2: `analyzeProject` が `parseCache` オプションを受け取り、`ParseCache` 型を公開する

`packages/cli/src/index.ts` の `AnalyzeOptions`(139-151行目)に追加:

```ts
export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  route?: string;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
  weights?: Partial<Record<Category, number>>;
  categories?: Category[];
  /**
   * Reuse this parse cache across multiple `analyzeProject` calls instead of
   * starting fresh each time — the vite dev dashboard passes a long-lived cache
   * and invalidates only the changed file's entry between re-analyses, so
   * unchanged routes/layouts/components are never re-read or re-parsed.
   * Callers that don't need cross-call reuse (the CLI's `run()`, MCP, the
   * Action — each analyzes once per process) can omit this; a fresh cache is
   * created automatically.
   */
  parseCache?: ParseCache;
}
```

`analyzeProject` 実装内の `collectRoutes` 呼び出し(192行目)を更新:

```ts
const collected = await collectRoutes(rt, cwd, config, opts.parseCache);
```

ファイル冒頭の import に `ParseCache` 型を追加(`collectRoutes` と同じ
`./providers/source/routes.js` から、または `ParseCache` の定義元
`./providers/source/resolve.js` から — 実際にどちらから re-export されているか
確認して整合させる)。ファイル末尾(523行目以降、他の re-export の並び)に
`ParseCache` 型を公開する一行を追加する:

```ts
export type { ParseCache } from './providers/source/resolve.js';
```

**Verify**: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals test`
→ exit 0 / all pass(既存の `analyzeProject`/`collectRoutes` 関連テストが無変更で
green であることを確認 — このステップは完全に後方互換の追加のはず)。

### Step 3: vite dev dashboard がキャッシュを保持し、変更ファイルだけ無効化する

`packages/vite/src/ui/analysis.ts` を変更する。`AnalyzeFn` の型に `parseCache` を
追加し(vite パッケージは `@svelte-vitals/core` から型を import しているため、
`ParseCache` 型を新たに import する必要がある — `svelte-vitals` パッケージから
`import type { ParseCache } from 'svelte-vitals';` のように、Step 2 で公開した型を
使う):

```ts
import type { ParseCache } from 'svelte-vitals';

export type AnalyzeFn = (opts: {
  cwd: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  parseCache?: ParseCache;
}) => Promise<{ results: Result[] }>;
```

`createAnalysisRunner` 内で、ランナーの生存期間を通じて1つの `ParseCache` を保持する:

```ts
export function createAnalysisRunner(opts: AnalysisRunnerOptions): AnalysisRunner {
  const debounceMs = opts.debounceMs ?? 500;
  let cachedAnalyze: AnalyzeFn | undefined = opts.analyze;
  const parseCache: ParseCache = new Map();
  let stopped = false;
  ...
```

`runOnce` の `analyze(...)` 呼び出しに `parseCache` を渡す:

```ts
const { results } = await analyze({
  cwd: opts.root,
  treatDynamicAs: opts.treatDynamicAs,
  metaComponents: opts.metaComponents,
  rules: opts.rules,
  failOn: opts.failOn,
  parseCache
});
```

`getAnalyze()`(production 実装、`svelte-vitals` を dynamic import する箇所)は
`(o) => mod.analyzeProject(o)` のまま変更不要 — `o` に含まれる `parseCache` は
そのまま `analyzeProject` に渡る。

`notifyChange(file: string)` を、渡された絶対パスをプロジェクト相対の POSIX パスに
正規化してから、そのキーだけを `parseCache` から削除するように変更する:

```ts
import { relative, sep } from 'node:path';
...
    notifyChange(file: string) {
      if (stopped) return;
      const rel = relative(opts.root, file).split(sep).join('/');
      parseCache.delete(rel);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (stopped) return;
        if (running) pending = true;
        else void runOnce();
      }, debounceMs);
    },
```

**重要な正規化の注意**: `ParseCache` のキーは `tinyglobby` が返す cwd 相対 POSIX
パス(例: `src/routes/+page.svelte`、先頭に `./` は付かない)。`node:path` の
`relative(opts.root, file)` は OS のパス区切り文字を使う(macOS/Linux では既に `/`
だが、Windows では `\` になる)ため、`.split(sep).join('/')` で POSIX 形式に正規化
する必要がある。この正規化が実際のキャッシュキーと一致することを、Step 4 の
テストで**実際にキャッシュヒット/ミスを観測して**確認すること — 一致しない場合、
このプランの効果はゼロになる(かつ気づかれにくい)ため、必ず実測すること。

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck` → exit 0(この時点ではまだ
テストを書いていないので実効果は未確認)。

### Step 4: 効果を実測するテストを書く

`packages/vite/test/ui/analysis.test.ts`(既存ファイルがあれば追記、なければ新規
作成 — `packages/vite/test/` の既存ファイル一覧を確認して命名規則を合わせる)に、
以下を検証するテストを追加する:

1. `opts.analyze` にモックの `AnalyzeFn` を注入し(`AnalysisRunnerOptions.analyze`
   は既にテスト用に注入可能な設計 — JSDoc 参照)、呼び出しごとに渡された
   `parseCache`(の参照)を記録する。`start()` → `notifyChange(fileA)` →
   デバウンス待ち、という流れで2回 `analyze` が呼ばれたとき、**両方の呼び出しに
   同一の `parseCache` インスタンス(オブジェクト参照)が渡されること**を
   `toBe`(参照同一性)でアサートする — これが「キャッシュが使い回されている」
   ことの直接証拠。
2. `parseCache` に事前に(テストが)ダミーのエントリ(`cache.set('src/routes/+page.svelte',
Promise.resolve(...))` 相当 — モックの `AnalyzeFn` が受け取った `parseCache`
   引数に対して行う)を入れておき、`notifyChange(absolutePathToThatFile)` を
   呼んだ後、そのキーが削除されていること、かつ**無関係な別のキーは残っている**
   ことをアサートする。
3. 実際のパス正規化(`relative` + POSIX 変換)が実プロジェクト構造でも動くことを、
   `packages/cli` の実 `analyzeProject`/`collectRoutes` を使った統合的なテスト
   (一時ディレクトリに複数ルートを持つ SvelteKit プロジェクトを作り、
   `createAnalysisRunner` を実際の `analyze: (o) => cliAnalyzeProject(o)` で
   `start()` → 1ファイルだけ変更して `notifyChange()` → 2回目の解析後、
   注入した `Runtime`(または `readFile` の呼び出し回数を数えるラッパー)経由で
   「変更していないファイルは2回目に読み直されていない」ことを確認する)で1本
   書く。これがこのプランの核心的な回帰テストであり、正規化のミスマッチがあれば
   ここで確実に失敗する。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → all pass、新規テストが
すべて green(特に3番目の統合テストが、変更していないファイルの読込回数が
2回目でゼロであることを実測できていること)。

### Step 5: 全体検証 + changeset

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て
exit 0 / all pass。

changeset を追加: `@svelte-vitals/vite`(patch または minor — 内部最適化だが
`AnalyzeFn` 型のシグネチャに `parseCache` が増える公開的な変更もあるため、
判断に迷ったら該当パッケージの CHANGELOG.md の類似変更の扱いに合わせる)、
`svelte-vitals`(patch — `AnalyzeOptions.parseCache` の追加、`ParseCache` 型の
公開エクスポート)。

## Test plan

- 新規: `createAnalysisRunner` が複数回の解析呼び出しに同一の `parseCache` インスタ
  ンスを渡し続けることの単体テスト。
- 新規: `notifyChange` が変更されたファイルのキャッシュキーだけを削除し、無関係な
  キーは残すことの単体テスト。
- 新規: 実プロジェクト構造を使った統合テストで、変更していないファイルの読込回数が
  2回目の解析でゼロであることを実測する回帰テスト(このプランの核心的な証拠)。
- 既存: `packages/vite/test/ui-plugin.test.ts`、`packages/cli/test` の
  `collectRoutes`/`analyzeProject` 関連テストが変更後も green。
- 検証: `pnpm --filter @svelte-vitals/vite test` と
  `pnpm --filter svelte-vitals test` → 両方 all pass。

## Done criteria

- [ ] `collectRoutes` が optional な外部 `ParseCache` を受け取れる(渡さない場合の
      挙動は無変更)
- [ ] `analyzeProject` の `AnalyzeOptions` に `parseCache` が追加され、`ParseCache`
      型が `svelte-vitals` パッケージから公開されている
- [ ] `createAnalysisRunner` が長生きする `ParseCache` を保持し、`notifyChange` が
      変更されたファイルのキーだけを削除する
- [ ] 統合テストで「変更していないファイルは2回目の解析で読み直されない」ことが
      実測されている
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0 / all pass
- [ ] changeset が存在する
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- Step 4 の統合テストで、正規化した相対パスが実際の `ParseCache` のキー形式と
  一致せず、無効化が効かない(= 変更したファイルも古い内容のまま返り続ける)ことが
  判明した場合、パスの正規化ロジックを見直し、それでも一致しなければ STOP して
  報告する(この場合、静かに「効果がないが害もない」状態でマージするのではなく、
  正しく直すか計画を練り直す判断が必要)。
- Windows 環境でのパス区切り文字の扱いについて、CI のテスト環境(Linux)だけでは
  検証できない懸念がある場合、その旨を Maintenance notes に明記する(このリポジトリ
  の CI は ubuntu-latest のみで実行されるため、Windows 固有の不具合が CI で検出
  されない可能性がある)。
- 検証コマンドが修正1回を挟んで2回失敗した場合。

## Maintenance notes

- 将来「変更ファイルの影響を受けないルートはルール再実行自体をスキップする」という
  より踏み込んだ最適化を検討する場合(Plan 036 と関連)、このプランが導入した
  `parseCache` の仕組みの上に構築できる — レイアウトチェーンの依存関係は
  `chainFiles` が既に計算しているため、「どのルートがどのファイルに依存するか」の
  逆引きマップを作れば実現できる。
- `parseCache` を無限に保持し続けると、長時間の `vite dev` セッションでファイルが
  削除/リネームされた場合に古いエントリが残り続ける(メモリリークにはならないが、
  無意味なエントリが蓄積する)。実用上問題になるまでは対応不要だが、気になる場合は
  `runner.stop()` 時にキャッシュもクリアする、または定期的な GC を検討する。
