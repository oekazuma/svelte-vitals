# Plan 021: dev ダッシュボードに whole-project 静的解析を統合する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b6cf6b..HEAD -- packages/vite/src packages/core/src/reporter/html.ts packages/vite/package.json`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1(メンテナー判断: ヘビーユーザーの主戦場は UI モード)
- **Effort**: L
- **Risk**: MED(store の合成ロジックと watcher の再解析が新規。既存のライブ経路・build プラグインは不変)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8b6cf6b`, 2026-07-08

## Why this matters

live dashboard(`svelteVitals({ ui: true })`)は現在「訪問済みルートのみ・SEO `<head>` ルールのみ・
訪問済みスナップショットの Health」という 2026-06-23 設計の v1 境界のまま。CLI の
whole-project 解析(`analyzeProject`)を dev server に統合し、**`vite dev` 起動直後から
全ルート・全カテゴリ・本物のプロジェクト Health** を表示、ソース変更で自動再解析、
訪問したルートはライブ(実レンダリング)結果で精緻化する。設計は Accepted 済み —
内容は本計画の Appendix A が正(Step 1 でリポジトリに作成)。**設計書と本計画が
食い違ったら Appendix A に従い、その旨を報告すること。**

決定済みの要件(メンテナー承認):

1. **起動時に非同期で1回解析**(dev server 起動をブロックしない)+ **ソース変更で
   デバウンス(500ms)自動再解析** → SSE 更新。解析中の変更は1回に合流。
2. **ライブがルート単位で静的を上書き**: ライブ payload に含まれる rule id の静的結果を
   そのルートについて置換。component 系(location のみ)・site 系(route なし)・
   未訪問ルートは静的を保持。
3. **バッジ**: ルート見出しに `measured`(ライブ)/`static` を表示。core の
   `buildHtmlDocument` にオプショナル引数で実装(省略時はバイト単位で従来と同一)。
4. **依存方向**: `@svelte-vitals/vite` → `svelte-vitals`(workspace)。MCP と同じ前例。
   ui プラグイン内の **dynamic import** に限定し、build モードでは一切ロードしない。

## Current state

- **store**: `packages/vite/src/ui/store.ts`(全 33 行)— `FindingsStore` は
  `set(route, results)` / `snapshot()`(flatten)/ `subscribe(fn)` のみ。
  `byRoute: Map<string, Result[]>` の単層(=現在の「ライブレイヤー」):

```ts
export function createStore(): FindingsStore {
  const byRoute = new Map<string, Result[]>();
  const subs = new Set<() => void>();
  return {
    set(route, results) {
      byRoute.set(
        route,
        results.map((r) => (r.route ? r : { ...r, route }))
      );
      for (const fn of subs) fn();
    },
    snapshot() {
      return [...byRoute.values()].flat();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
```

- **serve.ts**: `renderDashboard(results, config, meta)` が
  `buildHtmlDocument(buildJsonReport(results, config, meta), meta)` を呼び、`</body>` の
  直前に SSE ライブスクリプトを注入(serve.ts:23-26)。
- **middleware.ts**: `installUiMiddleware(server, config, version)` が **store を内部生成**
  している(実ファイルを読んで確認すること)。本計画で「store を外部(plugin.ts)で生成して
  渡す」形に変える — analysis runner が `setStatic` を呼べるようにするため。
- **plugin.ts の ui プラグイン**(plugin.ts:80-98): `configureServer` で
  `SVELTE_VITals_UI=1` 環境変数の設定/解除と `installUiMiddleware(server, config, readPackageVersion())`
  のみ。`server.watcher` は未使用。
- **handle.ts**: ページ訪問時に rendered `<head>` を解析して `/ingest` へ POST(ライブ経路)。
  **不変** — payload には passing/failing 両方の Result が入る(= payload の rule id 集合が
  「ライブが評価した集合」。実コードで `analyzeAndWarn` が結果を間引いていないことを確認し、
  間引いていたら STOP)。
- **core renderer**: `packages/core/src/reporter/html.ts` — `buildHtmlDocument(report, meta)`
  (html.ts:288 付近)が唯一の入口で、ルート節は `renderRoutes(report)`(html.ts:131)が描画。
  **core 純粋性の鉄則**(packages/core/CLAUDE.md): `node:` import・I/O 禁止 — 引数追加は可。
- **依存**: `packages/vite/package.json` の dependencies は
  `@svelte-vitals/core` / `esm-env` / `node-html-parser` / `tinyglobby`。
  `svelte-vitals` は未依存。CLI 側から `analyzeProject` が export 済み
  (`packages/cli/src/index.ts` — MCP が同じ import をしている前例)。
- **vite のテスト**: `packages/vite/test/` に ui-store / ui-serve / ui-middleware /
  ui-plugin / ui-ingest のテストあり(流儀はそこに合わせる)。SvelteKit fixture プロジェクトが
  vite テストに存在するかは要確認 — 無ければ `packages/vite/test/fixtures/` に
  `packages/cli/test/fixtures/basic-project` 相当の最小構成を新設する。

## Commands you will need

| Purpose   | Command                                                                      | Expected on success |
| --------- | ---------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter "./packages/**" install`                                      | exit 0              |
| Build     | `pnpm --filter "./packages/**" build`                                        | exit 0              |
| Typecheck | `pnpm typecheck`                                                             | exit 0              |
| Tests     | `pnpm test`(root — core/cli/vite/mcp)                                        | all pass            |
| Lint      | `pnpm lint`                                                                  | exit 0              |
| Changeset | 手書き(@svelte-vitals/vite: minor + @svelte-vitals/core: minor、1ファイル可) | ファイル生成        |

## Scope

**In scope**:

- `docs/superpowers/specs/2026-07-08-dev-dashboard-whole-project-design.md`(新規 — Appendix A)
- `packages/vite/package.json`(`"svelte-vitals": "workspace:*"` 追加)+ `pnpm-lock.yaml`
- `packages/vite/src/ui/store.ts`、`serve.ts`、`middleware.ts`、`packages/vite/src/ui/analysis.ts`(新規)
- `packages/vite/src/plugin.ts`(ui プラグインの配線)
- `packages/core/src/reporter/html.ts`(`routeBadges` オプション)
- `packages/vite/test/`(新規: analysis runner / store 合成、既存 ui-* テストの追随、fixture 新設可)
- `packages/core/test/`(html renderer の badge テスト + 無指定時の同一性テスト)
- `docs/src/content/docs/guides/dev-overlay.md` + `ja/guides/dev-overlay.md`
- `.changeset/`

**Out of scope**:

- build プラグイン(`closeBundle` の prerendered 解析)— 一切触らない。
- `packages/cli` / `packages/mcp` のコード。
- production 配信・認証、dark mode 等の既存 deferral。
- worker/スレッド分離(v1 は in-process。遅い実例が出てから)。

## Git workflow

- Branch: `advisor/021-dev-dashboard-whole-project`
- Conventional commits、スライス毎に分割推奨、例:
  `feat(core): optional route provenance badges in the html report` /
  `feat(vite): run whole-project analysis in the dev dashboard`
- PR 本文は英語。push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 設計書をリポジトリに作成

`docs/superpowers/specs/2026-07-08-dev-dashboard-whole-project-design.md` を
**Appendix A の内容そのまま**で作成。

**Verify**: `test -f docs/superpowers/specs/2026-07-08-dev-dashboard-whole-project-design.md` → exit 0

### Step 2: core — `buildHtmlDocument` に `routeBadges` オプション

- シグネチャ: `buildHtmlDocument(report: JsonReport, meta: { version: string }, opts?: { routeBadges?: Record<string, 'measured' | 'static'> }): string`
- `renderRoutes`(html.ts:131)に opts を伝播し、ルート見出しにバッジ span を追加
  (例: `<span class="badge badge-measured">measured</span>`。既存の STYLE 定数に
  最小のバッジ CSS を追加 — 既存のスタイルトークンに合わせる)。
- ルート名は必ず `escapeHtml` 済みの文脈で扱う(既存の流儀を確認して従う)。
- `formatHtmlReport`(CLI 経路)は opts を渡さない — 変更しない。

**Verify**: `pnpm --filter @svelte-vitals/core test` → pass。テストには
「opts 省略時の出力が従来とバイト同一」(変更前の出力をテスト内で opts なし呼び出しと
比較 — 実装的には `buildHtmlDocument(r, m)` と `buildHtmlDocument(r, m, {})` の一致で代替可)
と「badge が該当ルート見出しにだけ出る」を含める。

### Step 3: store — 静的レイヤーと合成

`FindingsStore` を拡張:

```ts
export interface FindingsStore {
  set(route: string, results: Result[]): void; // ライブ(既存)
  setStatic(results: Result[]): void; // 静的レイヤー全置換(新規)
  snapshot(): Result[]; // 合成済み(意味が変わる)
  badges(): Record<string, 'measured' | 'static'>; // ルート見出し用(新規)
  subscribe(fn: () => void): () => void;
}
```

合成ロジック(`snapshot()`、純関数として切り出してユニットテスト可能に):

1. 静的レイヤーをルート別(`r.route` あり)/ルート無し(site・component)に分ける。
2. ライブレイヤーにあるルート R について: R のライブ payload に含まれる rule id 集合を
   作り、静的側の R の結果からその id を除去 → ライブ結果と連結。
3. ライブに無いルート・ルート無し結果は静的のまま。ライブのみのルート(静的に無い —
   通常起きないが)はライブをそのまま。
4. `badges()`: 静的レイヤーに存在する各ルート + ライブの各ルートについて
   `ライブあり → 'measured'` / `静的のみ → 'static'`。静的レイヤーが空(解析失敗・未完)の
   場合はライブのみ=全ルート `'measured'`。
5. `setStatic` / `set` とも subscribers に通知(SSE 発火は既存機構に乗る)。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → 合成ユニットテスト
(静的のみ / ライブ置換 / component・site 保持 / 未訪問ルート保持 / badges)を含め pass

### Step 4: analysis runner(新規 `packages/vite/src/ui/analysis.ts`)

```ts
export interface AnalysisRunnerOptions {
  root: string;
  /** analyzeProject 互換(テスト注入用)。省略時は dynamic import('svelte-vitals')。 */
  analyze?: (opts: { cwd: string /* …plugin オプションのサブセット */ }) => Promise<{ results: Result[] }>;
  onResults(results: Result[]): void;
  onError(err: unknown): void;
  debounceMs?: number; // default 500
}
export function createAnalysisRunner(opts: AnalysisRunnerOptions): {
  start(): void; // 起動時解析(非同期、待たない)
  notifyChange(file: string): void; // デバウンス→再解析
  stop(): void; // タイマー破棄、以降 no-op
};
```

- dynamic import: `const { analyzeProject } = await import('svelte-vitals');` を
  実行時(初回解析時)に1回だけ行い、キャッシュする。**トップレベル import にしない**
  (build モードのユーザーにロードさせない — 設計決定4)。
- plugin オプション(`treatDynamicAs` / `metaComponents` / `rules` / `failOn`)を
  `analyzeProject` に引き渡す(config ファイルとの per-field 優先は `analyzeProject` の
  既存挙動に任せる)。
- 合流: 解析実行中に `notifyChange` が来たら pending フラグを立て、完了後に1回だけ
  追加実行。失敗時は `onError`(呼び出し側で console.warn)し、前回結果は触らない。
- `stop()` 後はタイマー・pending とも無効化。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → runner ユニットテスト
(fake timers: N連打→1回 / 実行中の変更→完了後1回 / 失敗→onError / stop 後 no-op)を含め pass

### Step 5: plugin.ts / middleware.ts / serve.ts の配線

- `middleware.ts`: `installUiMiddleware(server, config, version, store)` のように
  store を**引数で受ける**形に変更(内部生成をやめる)。`GET /` の描画は
  `renderDashboard(store.snapshot(), config, { version }, store.badges())` に。
- `serve.ts`: `renderDashboard(results, config, meta, badges?)` →
  `buildHtmlDocument(buildJsonReport(...), meta, { routeBadges: badges })`。
- `plugin.ts` の ui プラグイン `configureServer`:
  1. `const store = createStore();` を生成して middleware に渡す。
  2. `createAnalysisRunner({ root: server.config.root, onResults: (r) => store.setStatic(r), onError: (e) => console.warn('[svelte-vitals] dev analysis failed:', e), … })` を作り `runner.start()`。
  3. `server.watcher.on('all', (event, file) => { if (isRelevant(file, root)) runner.notifyChange(file); })`。
     `isRelevant`: root 相対で `src/`・`static/` 配下、または basename が
     `svelte.config.{js,ts}` / `svelte-vitals.config.{mjs,js,ts}`。
     `node_modules` / `.svelte-kit` / `build` / `dist` を含む path は除外。
     ヘルパーとして export しユニットテストする。
  4. `server.httpServer?.once('close', …)` の既存クリーンアップに `runner.stop()` を追加。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck` → exit 0

### Step 6: 統合テスト + fixture

- vite テストに SvelteKit fixture が無ければ `packages/vite/test/fixtures/basic-project/`
  を新設(`svelte.config.js` + `src/routes/+page.svelte`(title 欠落)+
  `src/routes/about/+page.svelte` の 2 ルート程度)。
- 統合テスト: 実 `analyzeProject` を fixture に対して呼ぶ形で
  (runner 経由 or 直接)`store.setStatic` → `snapshot()` に **未訪問ルート含む全ルート**と
  複数カテゴリの結果が載ること、`set(route, live)` 後に該当ルートだけ置換され
  `badges()` が `measured` になることを固定。
- 既存 ui-middleware / ui-plugin / ui-serve テストを新シグネチャに追随。

**Verify**: `pnpm test` → all pass(root 全パッケージ)

### Step 7: docs + changeset

- `docs/src/content/docs/guides/dev-overlay.md`(+ja)の Live UI 節を更新:
  起動時から全ルート・全カテゴリ表示になったこと、自動再解析、`measured`/`static` バッジ、
  失敗時はライブのみモードに退避すること。「訪問したページのみ」等の旧記述を削除。
- changeset: `@svelte-vitals/vite` minor + `@svelte-vitals/core` minor(手書き、英語)。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0

## Test plan

Step 2/3/4/6 の通り。パターン元: `packages/vite/test/ui-*.test.ts`(構成)、
`packages/core/test/`(renderer)。合成ロジックと runner は純関数+注入で網羅する。

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] 統合テスト: 未訪問ルートが snapshot に載る / ライブ置換 / badges、が固定されている
- [ ] `routeBadges` 省略時の core renderer 出力が従来と同一(テストで固定)
- [ ] `svelte-vitals` の import が **dynamic import のみ**(`grep -rn "from 'svelte-vitals'" packages/vite/src` が 0 件)
- [ ] docs(en/ja)+ changeset(vite/core minor)が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)

## STOP conditions

- handle.ts の ingest payload が passing 結果を含まない(合成の前提が崩れる — 設計見直し要)。
- `installUiMiddleware` の store 外部化が SSE/クリーンアップ機構の大幅な作り直しを要求する。
- fixture への実 `analyzeProject` が vite テスト環境で動かない(依存解決等)。
- core renderer の badge 追加が既存テスト(スナップショット等)を大量に壊す。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- 解析は in-process(数秒)。大規模プロジェクトでの jank 報告が来たら worker 化を検討
  (spec の Non-goals に明記済み)。
- 差分再解析(変更ファイルのみ)は意図的に見送り — フル再解析が遅くなった実例が出てから。
- `isRelevant` の監視対象は SvelteKit のデフォルト構成前提。routes ディレクトリの
  カスタマイズ対応要望が来たらここが追随点。
- ライブ置換の粒度は「payload の rule id 集合」。handle 側の評価ルール集合を変えると
  置換範囲も変わる — handle.ts を触る際はこの結合を意識。

## Appendix A: 設計書全文(Step 1 でこの内容のファイルを作成する)

````markdown
# Dev dashboard: whole-project analysis integration

**Date:** 2026-07-08
**Status:** Accepted (maintainer-approved in session; implementation plan: `plans/021-dev-dashboard-whole-project.md`)
**Packages:** `@svelte-vitals/vite` (main), `@svelte-vitals/core` (renderer option only), `svelte-vitals` (no code change; becomes a dependency of the vite package)

## Goal

The live dashboard (`svelteVitals({ ui: true })`, served at `/__svelte-vitals/`)
currently shows only what you have physically visited, covers only SEO
`<head>` rules, and computes Health over visited routes — the deliberate v1
boundaries of the 2026-06-23 live-UI design. Integrate the CLI's whole-project
static analysis (`analyzeProject`) into the dev server so the dashboard shows
**all routes and all categories with a real project Health from the moment
`vite dev` starts**, refreshed automatically as source files change, and
refined per-route by live (rendered) results as you browse.

Maintainer context (2026-07-08): heavy users are expected to live in UI mode,
so the dashboard is the primary surface to invest in — this closes the three
big v1 boundaries at once (no upfront route list, SEO-only coverage,
visited-routes-only Health).

## Decisions (maintainer-approved)

1. **Analysis timing: at startup + auto re-analysis.** `configureServer` kicks
   off one whole-project analysis asynchronously (never blocking dev-server
   startup); `server.watcher` triggers a debounced (~500 ms) re-analysis on
   relevant file changes; every completed analysis updates the store and fans
   out over the existing SSE channel. Changes arriving mid-analysis coalesce
   into a single follow-up run.
2. **Merge rule: live overrides static, per route.** The store gains a
   _static layer_ (whole-project results) alongside the existing _live layer_
   (ingested rendered-page results). Snapshot composition per route: where a
   live result set exists, static results whose rule id appears in the live
   payload are replaced by the live ones — the handle reports passing as well
   as failing results, so the rule ids present in the payload ARE the evaluated
   set (a rendered page is closer to the truth, especially for dynamic
   values); everything else — component-scoped findings (CORRECT/ARCH),
   site-wide findings (robots/sitemap), and unvisited routes — keeps the
   static result.
3. **Provenance badges.** Route headings show whether a route's findings are
   `measured` (live) or `static`. Implemented as an optional argument on
   core's `buildHtmlDocument` (`opts?: { routeBadges?: Record<string,
'measured' | 'static'> }`) — core stays a pure string function and the CLI
   `--reporter html` path is untouched (argument omitted). No string
   post-processing hacks in `serve.ts`.
4. **Dependency direction: `@svelte-vitals/vite` depends on `svelte-vitals`.**
   This mirrors the existing precedent — `@svelte-vitals/mcp` already imports
   `analyzeProject` from the CLI package, and the function's own JSDoc declares
   it a shared entry point. The import lives inside the dev-only ui plugin as a
   **dynamic import**, so build-mode usage loads none of it. The CLI-only
   heavyweights (clack, mri, magicast) are not on `analyzeProject`'s import
   path; the cost is install size only. No dependency cycle (the CLI never
   imports the vite package).

   _Rejected:_ extracting an `@svelte-vitals/analyzer` package (cleanest graph
   but large churn for the same two consumers — YAGNI until a third consumer
   or a real weight problem appears); moving providers into core (conflicts
   with core's no-I/O purity rule).

## Components

- **Store (packages/vite/src/ui/store.ts)** — extended with a static layer:
  `setStatic(results)` replaces the whole static layer; existing
  `set(route, results)` remains the live layer. `snapshot()` returns the
  composed view per the merge rule and `badges()` exposes per-route provenance
  for the badge map. Composition logic is pure and unit-testable.
- **Analysis runner (new, packages/vite/src/ui/analysis.ts)** — owns the
  dynamic import of `svelte-vitals`, the startup run, the debounce/coalesce
  logic, and error containment. Interface shaped for tests (injectable
  `analyze` function and timers).
- **Watcher wiring (packages/vite/src/plugin.ts)** — `server.watcher.on('all', …)`
  filtered to `src/**`, `static/**`, `svelte.config.*`,
  `svelte-vitals.config.*`; ignores `node_modules`, `.svelte-kit`, `build`,
  `dist`. Registered only when `ui: true`.
- **Renderer (packages/core/src/reporter/html.ts)** — optional `routeBadges`
  rendering on route headings. Purely additive; no behavior change without the
  option.
- **serve.ts** — passes the badge map from the store snapshot into
  `buildHtmlDocument`.

## Data flow

```
vite dev 起動
  └─ ui plugin configureServer
       ├─ installUiMiddleware (既存)
       └─ analysis runner: dynamic import → analyzeProject(root) ──┐
発生イベント                                                        │
  ├─ ソース変更 → watcher → debounce 500ms → analyzeProject ────────┤
  └─ ページ訪問 → handle → POST /ingest → store.set(route, live) ──┤
                                                                    ▼
                                  store: static layer + live layer → SSE 'update'
                                                                    ▼
                     GET / → snapshot() 合成 + routeBadges → buildHtmlDocument
```

## Error handling

- Startup or re-analysis failure (not a SvelteKit root, internal error):
  `console.warn` once per failure and keep the previous static layer (or none —
  the dashboard then behaves like today's live-only mode). The dev server and
  the middleware never break.
- The analysis runs in the dev-server process; `analyzeProject` is pure
  in-process work (fs reads + parsing), a few seconds at most — no worker
  process in v1. If real projects report jank, moving it off-thread is a
  follow-up, not a v1 requirement.

## Non-goals

- Production serving, auth, multi-client coordination (unchanged deferral).
- Dark mode / syntax highlighting / route sort toggle (unchanged deferral).
- Changes to the build-mode plugin (`closeBundle` analysis of prerendered HTML).
- A public watch-mode API on `analyzeProject`.
- Per-file incremental re-analysis (full re-run is seconds; incremental is a
  follow-up if it ever isn't).

## Test plan

- **Store composition (unit, pure):** static only / live overrides matching
  rule ids on a visited route / component + site findings preserved /
  unvisited routes keep static / provenance map correctness.
- **Analysis runner (unit, fake timers, injected analyze fn):** startup run,
  debounce coalescing (N rapid changes → 1 run; change mid-run → exactly one
  follow-up), failure keeps previous layer + warns.
- **Plugin integration:** against a fixture SvelteKit project, `ui: true`
  `configureServer` populates the snapshot with all routes/categories without
  any page visit; SSE `update` fires after analysis completes.
- **Renderer:** `routeBadges` renders on route headings; omitted option
  produces byte-identical output to today.
````
