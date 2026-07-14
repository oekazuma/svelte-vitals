# Plan 035: dashboard の SSE staleness guard を実行して検証するテストを追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/vite/src/ui/dashboard-script.ts packages/vite/test/ui-dashboard.test.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW(テスト追加のみ。プロダクションコードは変更しない — jsdom という
  新しい devDependency の追加を伴うが、`packages/vite` のみのテスト依存であり
  実行時の配布物には影響しない)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`packages/vite/src/ui/dashboard-script.ts` は、Vite dev dashboard が配信する
**手書きのバニラ JS クライアントスクリプト**(バンドラーなし、フレームワークなし —
ファイル冒頭のコメントに明記された意図的な設計)。この中の `fetchSnapshot()`
(435行目)は SSE(`EventSource`)の `update`/`open` イベントで再フェッチした
`/data.json` のレスポンスに対して、`sequence` フィールドで新しいものだけを採用する
ガードを持つ:

```js
function fetchSnapshot() {
  fetch('/__svelte-vitals/data.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (state.snapshot && data.sequence <= state.snapshot.sequence) return;
      state.snapshot = data;
      renderAll();
    })
    .catch(function () {});
}
```

これは「複数回の再解析がほぼ同時に走ったとき、古いレスポンスが後から届いて新しい
状態を上書きしてしまう」という競合状態を防ぐための唯一の防御線。ところが
`packages/vite/test/ui-dashboard.test.ts` の既存テストは `renderDashboardShell`
(サーバー側で HTML 文字列を組み立てる関数)が**このスクリプト文字列を埋め込んで
いること**を確認するだけで、スクリプト自体を一度も実行していない。つまり、この
ガードの条件式が壊れても(例えば `<=` を `<` に変えてしまう、`data.sequence` の
参照先を間違える、等)、既存テストは一切検知できない。

## Design

`DASHBOARD_SCRIPT` はハンドオーサーの単一 IIFE 文字列であり、この設計自体は変更
しない(バンドラーなし、という意図的な選択を尊重する)。かわりに、**jsdom 環境で
このスクリプト文字列を実際に評価・実行し**、`document`/`fetch`/`EventSource`/
`localStorage` をテスト側で用意した上で、`fetchSnapshot` の staleness ガードが
実際に機能することを検証する。これは「ロジックを別ファイルに抽出してテストする」
方式ではなく「本物のスクリプトをブラウザに近い環境で動かして観測する」方式であり、
ハンドオーサー・ノーバンドルという設計意図と衝突しない。

`packages/vite` には現状 jsdom(または同等の DOM 実装)への依存がない。このプランで
新規に devDependency として追加する(`pnpm-workspace.yaml` の `catalog:` に追加し、
`packages/vite/package.json` はそこから参照する — リポジトリの hard rule)。

## Current state

- `packages/vite/src/ui/dashboard-script.ts`(該当箇所は上記引用の通り、
  433-439行目)。スクリプト全体は約465行の1つの IIFE 文字列。
- **DOM 依存箇所**(`grep -n "getElementById|mount("` で確認済み): スクリプトは
  以下の要素の存在を前提にする:
  - `document.getElementById('svelte-vitals-data')`(442行目、`boot()` が
    初期スナップショットの JSON を読み取る `<script type="application/json">`
    相当の要素)
  - `mount('dv-topbar', ...)`(170行目)、`mount('dv-sidebar', ...)`(270行目)、
    `mount('dv-detail', ...)`(408/414/417行目)— それぞれ `document.getElementById(id)`
    の存在を前提に `clear()`+`appendChild()` する(41行目の `mount` 定義)。
  - `document.documentElement.setAttribute('data-theme', ...)`(134行目、
    `applyTheme()`)。
  - `localStorage.getItem/setItem('svelte-vitals-theme', ...)`(137行目付近)。
  - `location.hash`(427-430行目、`restoreSelectionFromHash`)。
  - `window.addEventListener('hashchange', ...)`(449行目)。
- **`boot()` の全体像**(441-461行目、既に読了済み): `raw.textContent` から
  `JSON.parse` して初期スナップショットを読み込み、`applyTheme()` →
  `renderSidebar()` → `restoreSelectionFromHash()` → `renderAll()` の順に呼び、
  最後に `EventSource` が存在すれば `/__svelte-vitals/events` に接続して
  `open`/`update`/`error` イベントをそれぞれ処理する。
- **実際に埋め込まれる際のマークアップ** — `packages/vite/src/ui/dashboard.ts`
  (`renderDashboardShell` — 既存テスト `ui-dashboard.test.ts` が対象にしている
  関数)を読み、`svelte-vitals-data`/`dv-topbar`/`dv-sidebar`/`dv-detail` の各
  要素が実際にどんな tag/属性で生成されているかを確認し、テストのフィクスチャは
  それに近い形にする(完全one致でなくてよいが、`id` と `textContent` に
  JSON が入る形は一致させる必要がある)。
- **`packages/vite/test/ui-dashboard.test.ts` の先頭**(既に読了済み、
  `baseSnapshot: DashboardSnapshot` のフィクスチャ定義がある — 新テストでも
  この型・値を再利用できる)。

## Commands you will need

| Purpose   | Command                                       | Expected on success |
| --------- | --------------------------------------------- | ------------------- |
| Install   | `pnpm install`(jsdom 追加後)                  | exit 0              |
| Tests     | `pnpm --filter @svelte-vitals/vite test`      | all pass            |
| Typecheck | `pnpm --filter @svelte-vitals/vite typecheck` | exit 0              |
| Lint      | `pnpm lint`                                   | exit 0              |

## Scope

**In scope**:

- `pnpm-workspace.yaml`(`catalog:` に `jsdom` を追加)
- `packages/vite/package.json`(devDependencies に `jsdom: catalog:` を追加)
- `packages/vite/test/dashboard-script-staleness.test.ts`(新規作成)

**Out of scope**:

- `packages/vite/src/ui/dashboard-script.ts` のプロダクションコード変更(このプラン
  はテストのみ)。
- ダッシュボードスクリプト全体の網羅的なレンダリングテスト(サイドバーの検索/
  ソート、ルート詳細表示などの UI ロジック全体)— このプランは staleness ガード
  1点にスコープを絞る。
- `packages/core/src/reporter/html.ts` の `SCRIPT` 定数(静的レポートの HTML —
  無関係な別のスクリプト)。

## Git workflow

- Branch: `advisor/035-dashboard-sse-staleness-guard-test`
- コミット: `test(vite): execute the dashboard client script to verify its SSE staleness guard`
  (英語、1コミットでよい)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `jsdom` を catalog 経由の devDependency として追加する

`pnpm-workspace.yaml` の `catalog:` ブロックにアルファベット順で追加(既存の並びに
倣う):

```yaml
jsdom: ^27.0.0
```

(実際の最新安定版バージョンを確認して埋めること — 推測でバージョン番号を固定しない。
`npm view jsdom version` 相当の方法で確認できない場合、`package.json` の他の
devDependency と同程度に新しいメジャーを選ぶ。)

`packages/vite/package.json` の `devDependencies` に追加:

```json
    "jsdom": "catalog:",
```

**Verify**: `pnpm install` → exit 0。

### Step 2: 対象ファイル全体を読み、DOM フィクスチャの要件を確定する

`packages/vite/src/ui/dashboard-script.ts` を最初から最後まで読み(この計画書の
「Current state」に挙げた箇所以外にも `getElementById`/DOM API 呼び出しがないか
再確認する)、`packages/vite/src/ui/dashboard.ts` を読んで実際に生成される
HTML の要素 ID と `svelte-vitals-data` 要素の中身の形を確認する。これにより、
テストで用意すべき最小限の DOM フィクスチャ(`svelte-vitals-data`・`dv-topbar`・
`dv-sidebar`・`dv-detail` の4要素、それぞれ適切なタグで)を確定させる。

### Step 3: テストファイルを新規作成する

`packages/vite/test/dashboard-script-staleness.test.ts` を作成する。ファイル冒頭に
jsdom 環境を指定する vitest のマジックコメントを置く:

```ts
// @vitest-environment jsdom
```

テストの骨格:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DASHBOARD_SCRIPT } from '../src/ui/dashboard-script.js';

function snapshotJson(sequence: number, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    sequence,
    report: { version: '1', score: 80, weights: { seo: 1 }, categories: {}, summary: {}, routes: [], siteIssues: [] },
    badges: {},
    analyzing: false,
    ...overrides
  });
}

describe('dashboard client script — SSE staleness guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <script type="application/json" id="svelte-vitals-data">${snapshotJson(1)}</script>
      <div id="dv-topbar"></div>
      <div id="dv-sidebar"></div>
      <div id="dv-detail"></div>
    `;
    // jsdom has no EventSource — stub it so `boot()`'s `typeof EventSource !== 'undefined'`
    // check is false and the script never tries to open a real connection; this test
    // drives fetchSnapshot()'s staleness guard directly via fetch responses instead.
    // (If a later test needs to exercise the `open`/`update` handlers themselves, add a
    // minimal EventSource stub class at that point — not needed for this guard.)
    // @ts-expect-error jsdom has no EventSource
    delete window.EventSource;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('discards an out-of-order response with a lower or equal sequence', async () => {
    // eslint-disable-next-line no-eval -- executing the hand-authored client script under test, by design (see plan)
    (0, eval)(DASHBOARD_SCRIPT); // runs boot() immediately, reads the seeded snapshot (sequence: 1)

    // Simulate a fetchSnapshot() call that resolves with an OLDER/EQUAL sequence than
    // what's already rendered (state.snapshot.sequence === 1 from the seeded element).
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(1))) });
    // The script has no exported handle to call fetchSnapshot() directly (IIFE, no
    // globals leaked) — trigger it the same way production code does: dispatch a
    // fake 'update'-shaped call is not possible without EventSource, so instead
    // assert indirectly via the DOM: a stale response must not change rendered output.
    // ... (see STOP conditions: if this indirection proves impossible, escalate)
  });
});
```

**この骨格には未解決の設計課題がある — 執筆者(あなた)が Step 4 で解決すること**:
`DASHBOARD_SCRIPT` の IIFE はグローバルに何も公開しない(`fetchSnapshot`/`state`
はすべてクロージャの中)。そのため、テストから直接 `fetchSnapshot()` を呼んだり
`state.snapshot.sequence` を読んだりすることができない。呼び出しの引き金は
`EventSource` の `open`/`update` イベントしかない(`boot()` 内、455-459行目)。
したがって、このテストは **`EventSource` を削除するのではなく、テスト用の
フェイク `EventSource` クラスを `window.EventSource` に設定してから** スクリプト
を評価し、フェイクのインスタンスに対して手動で `open`/`update` イベントを
dispatch することで `fetchSnapshot()` を間接的に駆動する必要がある。上記の骨格
コードの `delete window.EventSource` は誤り — Step 4 で正しい形に直すこと。

### Step 4: フェイク `EventSource` で `fetchSnapshot` を駆動し、staleness を検証する

`window.EventSource` に、`new` されると `boot()` からインスタンスを受け取れる
フェイクを設定する:

```ts
  let esInstances: FakeEventSource[] = [];
  class FakeEventSource {
    listeners: Record<string, Array<() => void>> = {};
    constructor(public url: string) {
      esInstances.push(this);
    }
    addEventListener(type: string, cb: () => void) {
      (this.listeners[type] ??= []).push(cb);
    }
    dispatch(type: string) {
      (this.listeners[type] ?? []).forEach((cb) => cb());
    }
  }

  beforeEach(() => {
    ...
    esInstances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    ...
  });
```

テスト本体:

```ts
it('discards an out-of-order response with a lower or equal sequence', async () => {
  // fetchSnapshot() is called once on 'open' (boot()'s open handler) — resolve it
  // with sequence 5 so state.snapshot.sequence becomes 5.
  fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(5))) });

  (0, eval)(DASHBOARD_SCRIPT);
  esInstances[0]!.dispatch('open');
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  // Now simulate a SECOND 'update' event whose fetch resolves with an OLDER
  // sequence (4) than what's already rendered (5) — the guard must discard it.
  fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve(JSON.parse(snapshotJson(4, { analyzing: true }))) });
  esInstances[0]!.dispatch('update');
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  // Assert the stale response was NOT applied: the topbar (rendered from
  // state.snapshot) must still reflect analyzing: false, not the stale true.
  // (Exact assertion depends on what renderTopbar() actually reflects for
  // `analyzing` — read renderTopbar()'s implementation in Step 2 and assert on
  // whatever DOM output distinguishes sequence-5 state from sequence-4 state.)
  expect(document.getElementById('dv-topbar')!.innerHTML).not.toContain(/* sequence-4-specific marker */);
});

it('applies a newer response and updates the rendered state', async () => {
  // Mirror of the above: resolve 'open' with sequence 5, then 'update' with
  // sequence 6, and assert the NEW content IS reflected — proves the guard
  // isn't simply discarding everything.
});
```

具体的な DOM アサーション(コメントの `/* sequence-4-specific marker */` の部分)
は、`renderTopbar`/`renderOverview` の実装を Step 2 で読んだ内容に基づいて、
`analyzing` フラグや `score`/`sequence` に紐づく実際の描画差分(例: analyzing
中は特定の class や文言が topbar に出る、スコア数値がテキストとして表示される、
等)を使って具体化すること。単に「呼ばれた回数」ではなく「**古い方の内容が
DOM に反映されていないこと**」を直接見るのが、このテストの核心的な価値。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → 新規2ケースが green。

### Step 5: 全体検証

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck && pnpm lint` → 両方
exit 0(`eval` の使用について ESLint が `no-eval` を既定で禁止している場合、
該当行に `// eslint-disable-next-line no-eval` を付ける — 上記コード例に既に
含めてある。lint 設定が別のルール名/コメント形式を要求する場合はそれに従う)。

## Test plan

- 新規: 古い(または同じ)`sequence` を持つ SSE 駆動のレスポンスが state を
  上書きしないことを、実際にスクリプトを実行して確認するテスト。
- 新規: 新しい `sequence` を持つレスポンスは正しく適用されることを確認するテスト
  (ガードが「常に何もしない」壊れ方をしていないことの反証)。
- 検証: `pnpm --filter @svelte-vitals/vite test` → all pass、新規2ケース以上を
  含む。

## Done criteria

- [ ] `jsdom` が `pnpm-workspace.yaml` の catalog 経由で `packages/vite` に
      devDependency として追加されている
- [ ] `packages/vite/test/dashboard-script-staleness.test.ts` が新規作成され、
      `DASHBOARD_SCRIPT` を実際に実行して staleness ガードを検証している
- [ ] 「古いレスポンスは反映されない」「新しいレスポンスは反映される」の両方が
      テストされている
- [ ] `pnpm --filter @svelte-vitals/vite test` が all pass
- [ ] `pnpm --filter @svelte-vitals/vite typecheck && pnpm lint` が exit 0
- [ ] `packages/vite/src/ui/dashboard-script.ts` に変更がない(`git diff` で確認)
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `eval`(または `new Function`)でスクリプトを実行する方式が、vitest の jsdom
  環境と噛み合わずに動かない(例: `document`/`window` がグローバルスコープに
  正しく見えない)ことが判明した場合、`happy-dom` への切り替えを検討し、それでも
  解決しなければ STOP して報告する。
- `renderTopbar`/`renderOverview` の実装が、`analyzing`/`sequence` の違いを判別
  できるような具体的な DOM 出力の差を持たない(= どちらのレスポンスが反映されたか
  を DOM から見分けられない)ことが判明した場合、別の観測可能な差分(例:
  `state.snapshot` 相当の値を window に一時的に漏らすデバッグフックを**テスト
  ビルドでだけ**追加する、等)を検討する前に、まず STOP して報告する
  (プロダクションコードへの変更が必要になる可能性があるため)。
- 検証コマンドが修正1回を挟んで2回失敗した場合。

## Maintenance notes

- 今後 `dashboard-script.ts` の `fetchSnapshot`/`boot` を変更する場合、このテスト
  が最初に red になるはず — レビュアーはその変化が意図したものかを確認すること。
- `eval` によるスクリプト実行というテスト手法は、`DASHBOARD_SCRIPT` が今後
  「バンドラーなしの手書き文字列」という設計から離れた場合(例: 実際に TS
  モジュールとしてコンパイルされる形に変わった場合)には不要になる — その時点で
  このテストをより直接的な import ベースのテストに書き換えることを検討する。
