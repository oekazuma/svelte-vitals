# Plan 063: config ファイルの `import()` をキャッシュバストし、dev dashboard が編集後の config を読むようにする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/cli/src/config-file.ts packages/cli/src/index.ts packages/vite/src/plugin.ts packages/vite/src/ui/middleware.ts packages/vite/src/ui/analysis.ts packages/cli/test/config-file.test.ts packages/vite/test/ui-plugin-config-file.test.ts packages/vite/test/ui-middleware.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category    | Planned at                                                                 |
| -------- | ------ | ---- | ---------- | ----------- | -------------------------------------------------------------------------- |
| P1       | S      | MED  | none       | correctness | commit `13aa7ad0` (= `origin/main` `d3828d9e` の 3 コミット前)、2026-09-03 |

この計画は `origin/main`(`d3828d9e`)を起点に書いている。監査時のローカル HEAD `13aa7ad0` は 3 コミット遅れているが、本計画が触るファイルはその 3 コミットで変わっていない(`packages/vite/src/ui/middleware.ts` だけは #640 で変わったので、抜粋は `origin/main` 版から取っている)。ブランチは `origin/main` から切ること。

## Why this matters

`svelte-vitals.config.{js,ts}` は `packages/cli/src/config-file.ts` の `loadFrom` が **素の `import()`** で読む。Node の ESM ローダーはモジュールキャッシュを URL でキーにするので、同じプロセス内で同じファイルを 2 回 `import()` すると、2 回目は**最初に評価したモジュールオブジェクト**が返る。ファイルが書き換わっていても再評価されない。

CLI は 1 プロセス 1 解析なので無害。壊れるのは長寿命プロセスである **vite dev の dashboard** で、ここでは次の順に事が進む。

1. `packages/vite/src/plugin.ts` の watcher は `svelte-vitals.config.*` の変更を「再解析トリガー」として登録している(`CONFIG_BASENAMES` に `CONFIG_FILENAMES` を展開、`isRelevant` が真を返す)。設計書 `docs/superpowers/specs/2026-07-08-dev-dashboard-whole-project-design.md` 73-74 行もそれを明記している。
2. トリガーされた `createAnalysisRunner` は `analyzeProject({ cwd, … })` を呼び、`analyzeProject` は毎回 `loadConfigFile(cwd)` を呼ぶ(`packages/cli/src/index.ts:292-297`)。
3. しかし `loadFrom` の `import()` はキャッシュ済みモジュールを返すので、**再解析は初回ロード時の config で走る**。スピナーは回り、findings は描き直されるが、`rules: { 'seo/title-presence': 'off' }` を足しても消えない。警告も「再起動が必要」というヒントも出ない。

さらに別レイヤーとして、dashboard の採点・描画に使う `config` は `configureServer` で一度だけ `resolveConfig` され(`plugin.ts:275-290`)、`installUiMiddleware(server, config, …)` に**値で**渡される。runner 側の config を直しても、`weights` や `overrides` を編集した結果は `/data.json` の Health に反映されない。

Vite の dev サーバー再起動(vite.config 変更時など)は同一 Node プロセス内で行われ、ESM モジュールキャッシュは消えない。直るのは `vite dev` プロセスを止めて起動し直したときだけである。

実測(2026-09-03、Node 24.18.1 と vitest 4.1.11 の両方): `writeFileSync(f, 'export default 1')` → `import(url)` → `writeFileSync(f, 'export default 2')` → `import(url)` は **1, 1** を返し、`import(url + '?v=2')` は **2** を返す。つまり URL にクエリを付けることで再評価でき、かつ vitest の in-process テストでもこの挙動は再現する(下の Step 2 の red が成立する根拠)。

## Current state

- `packages/cli/src/config-file.ts:286-290`(`loadFrom`、抜粋):

  ```ts
  /** Import one known-present config file and validate it. Shared by discovery and `--config`. */
  async function loadFrom(path: string): Promise<LoadedConfigFile> {
    let mod: { default?: unknown };
    try {
      mod = (await import(pathToFileURL(path).href)) as { default?: unknown };
    } catch (err) {
  ```

  同ファイルの import 行(1-10 行付近)には `existsSync` を含む `node:fs` の import と `pathToFileURL` の `node:url` の import がある。`node:crypto` はまだ import していない。

- `packages/cli/src/index.ts:288-298`(`analyzeProject` の冒頭): `opts.loadedConfig` が無ければ `opts.configPath` または `loadConfigFile(cwd)` を毎回呼ぶ。ここは変更しない。

- `packages/vite/src/plugin.ts:30-42`(watcher の対象): `CONFIG_BASENAMES` に `...CONFIG_FILENAMES` を展開。`isRelevant(file, root)`(`plugin.ts:54-61`)は `CONFIG_BASENAMES.has(basename(file))` で真を返す。

- `packages/vite/src/plugin.ts:268-333`(`configureServer`、抜粋):

  ```ts
  async configureServer(server: ViteDevServer) {
    process.env.SVELTE_VITALS_UI = '1';
    const uiRoot = options.cwd ?? server.config.root;

    // This `config` drives the dashboard's rendering/scoring (installUiMiddleware →
    // buildSnapshot → buildJsonReport) — the whole-project `runner` below gets its
    // config-file values independently, since it calls analyzeProject (which loads
    // the config file itself).
    let config: Config;
    let warnings: string[];
    try {
      ({ config, warnings } = await resolveConfig(uiRoot, options));
    } catch (err) {
      warn(`svelte-vitals: config file invalid — dashboard using plugin options/defaults: ${…}`);
      config = mergeConfig(options, undefined);
      warnings = [];
    }
    for (const w of warnings) warn(`svelte-vitals: ${w}`);
    const store = createStore();
    let staticFailedRuleIds: string[] = [];
    const runner = createAnalysisRunner({ root: uiRoot, …, onResults: (results, failedRuleIds) => { store.setStatic(results); staticFailedRuleIds = failedRuleIds ?? []; }, … });
    runner.start();
    server.watcher?.on('all', (_event, file) => {
      if (isRelevant(file, uiRoot)) runner.notifyChange(file);
    });
    server.httpServer?.once('close', () => { delete process.env.SVELTE_VITALS_UI; runner.stop(); });

    installUiMiddleware(server, config, readPackageVersion(), store, readCoreVersion(), () => staticFailedRuleIds);
  ```

  `staticFailedRuleIds` は「リクエストごとに読む getter」として渡している(コメントに理由あり)。`config` は値で渡している。

- `packages/vite/src/ui/middleware.ts`(**`origin/main` 版**、62-70 行と 168 / 181 行):

  ```ts
  export function installUiMiddleware(
    server: ViteDevServer,
    config: Config,
    version: string,
    store: FindingsStore,
    coreVersion?: string,
    /** Reads the whole-project runner's current crashed-rule ids; called per request … */
    getStaticFailedRuleIds?: () => string[] | undefined
  ): void {
  ```

  `config` の使用箇所は 2 つだけ: `/data.json` の `buildSnapshot(store, config, …)`(168 行)と、dashboard HTML の `renderAppShell(buildSnapshot(store, config, …))`(181 行)。

- `packages/vite/src/analyze.ts:65-72`(`resolveConfig`): `loadConfigFile(cwd)` → `mergeConfig(options, loaded?.config)`。再解決に再利用できる。

- 既存テスト:
  - `packages/cli/test/config-file.test.ts` — `fixture(name)` で `test/fixtures/config-file-*` を読む形式。`loadConfigFile` / `loadConfigFromPath` を直接呼ぶ。
  - `packages/vite/test/ui-plugin-config-file.test.ts` — `startUiServer(cwd, extraOptions)` が一時ディレクトリに `svelte-vitals.config.js` を置いて `configureServer` を呼び、`/ingest` で seo finding を 1 件流し込んでから `GET /data.json` の `report.weights.seo` を読む。`server.watcher.on` はダミー(`(_event, _cb) => {}`)。
  - `packages/vite/test/ui-middleware.test.ts` — `installUiMiddleware` を直接呼ぶ。`config` を値で渡している。

- 設計上の注意(実装判断の根拠として固定):
  - キャッシュキーは**ファイル内容のハッシュ**にする。mtime は同一秒内の連続編集を取りこぼし(FS によっては 1〜2 秒粒度)、単調カウンタは変更のない再解析(src の保存ごとに走る)のたびにモジュールを 1 つずつ漏らす。内容ハッシュなら「変わっていなければ同じ URL → キャッシュヒット、変わっていれば新 URL → 再評価」になり、リークは実際の編集回数に比例するだけで済む。config ファイルは数 KB なので読み取りコストは無視できる。
  - config ファイルが `import` する**別のローカルモジュール**(共有の rules 定義など)はこの計画では再評価されない。既知の制限として docs に書く(Step 5)。
  - `installUiMiddleware` のシグネチャは `config: Config | (() => Config)` に**広げる**(getter を受け付ける)。既存の値渡しテストはそのまま通る。
  - dashboard の config 再解決で `resolveConfig` が throw したら(config に typo)、`configureServer` 起動時と同じく `warn` して**直前の config を維持**する。dev は落とさない。
  - `SvelteKit handle`(`packages/vite/src/hooks/handle.ts`)が受け取る `config` はプラグインオプションだけから作られ、config ファイルを読まないので本計画の対象外。
  - リポジトリ規約: コードコメントは英語、非自明な WHY のみ。

## Commands you will need

| Purpose    | Command                                                    | Expected on success |
| ---------- | ---------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                             | exit 0              |
| Build      | `pnpm build`                                               | exit 0              |
| CLI tests  | `pnpm build && pnpm --filter svelte-vitals run test`       | all pass            |
| Vite tests | `pnpm build && pnpm --filter @svelte-vitals/vite run test` | all pass            |
| Docs gate  | `pnpm --filter docs run translate:check`                   | exit 0              |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint`   | 全て exit 0         |

cli / vite パッケージのテストは `@svelte-vitals/core`(と vite は `svelte-vitals`)の**ビルド済み dist** を import するため、テスト前に必ず `pnpm build` を通すこと。

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/cli/src/config-file.ts`(`loadFrom` のキャッシュバスト)
- `packages/cli/test/config-file.test.ts`(テスト追加)
- `packages/vite/src/ui/middleware.ts`(`config` 引数を getter 対応に)
- `packages/vite/src/plugin.ts`(config ファイル変更時に dashboard config を再解決)
- `packages/vite/test/ui-plugin-config-file.test.ts`(テスト追加)
- `docs/src/content/docs/guides/(vite)/dev-dashboard.mdx` と `docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx`(Notes に 1 文)
- `docs/blume.translations.json`(`translate:stamp` が更新する。手で編集しない)
- `.changeset/`(新規 changeset 1 件、`svelte-vitals` と `@svelte-vitals/vite` の patch)

**Out of scope**(触らない):

- `packages/cli/src/index.ts` — `analyzeProject` の config 読み込み順序は変えない。
- `packages/vite/src/ui/analysis.ts` — runner は `analyzeProject` を呼ぶだけで、キャッシュバストはローダー側で効く。
- `packages/vite/src/hooks/handle.ts` — 上記のとおり config ファイルを読まない。
- `packages/vite/src/analyze.ts`(build モード)— 1 プロセス 1 解析。
- config が import する別モジュールの再評価(既知の制限として文書化のみ)。
- `packages/vite/test/ui-middleware.test.ts` — 変更不要(値渡しのまま通る)。通らなくなったら STOP。

## Git workflow

- Branch: `advisor/063-config-file-import-cache`(`origin/main` から)
- Conventional commits、例: `fix(cli,vite): re-evaluate an edited svelte-vitals.config on dev re-analysis instead of serving the ESM cache`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: ローダー側の失敗するテストを先に書く(TDD red)

`packages/cli/test/config-file.test.ts` に新しい `describe('loadConfigFile re-reads an edited file', …)` を追加する。既存の fixture 方式ではなく一時ディレクトリを使う(ファイルを書き換えるため):

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

it('returns the new contents after the file is rewritten in the same process', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-config-reload-'));
  try {
    const file = join(dir, 'svelte-vitals.config.js');
    writeFileSync(file, "export default { failOn: 'warning' };\n");
    expect((await loadConfigFile(dir))?.config.failOn).toBe('warning');
    writeFileSync(file, "export default { failOn: 'critical' };\n");
    expect((await loadConfigFile(dir))?.config.failOn).toBe('critical');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('does not re-evaluate an unchanged file (same contents → same module instance)', async () => {
  // Pin the cache key: an identical file must resolve to the identical URL, so the run-per-save
  // dev loop does not leak one module instance per re-analysis.
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-config-reload-'));
  try {
    const file = join(dir, 'svelte-vitals.config.js');
    writeFileSync(file, 'export default { metaComponents: [] };\n');
    const a = await loadConfigFile(dir);
    const b = await loadConfigFile(dir);
    expect(a).toEqual(b);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

2 つ目のケースは「同一内容ならキャッシュヒット」を直接は観測できない(モジュールの同一性は `loadFrom` の外に出ない)。**このケースは緑のまま**でよく、目的は挙動の固定である。同一性を確かめたければ Step 3 で `loadFrom` に渡す URL をログする一時デバッグを入れ、終わったら消す。

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test -- config-file` → 1 つ目のケースが **fail**(2 回目の `failOn` が `'warning'` のまま)。2 つ目は pass。

### Step 2: `loadFrom` に内容ハッシュのクエリを付ける

`packages/cli/src/config-file.ts`:

1. import に `createHash` を追加: `import { createHash } from 'node:crypto';`。`node:fs` の import に `readFileSync` を追加。
2. `loadFrom` の `import()` 行を置き換える:

   ```ts
   // Node's ESM loader caches modules by URL for the life of the process, so a long-lived
   // host (the vite dev dashboard re-analyzes on every save) would keep serving the config as
   // it was first loaded. A content hash in the query re-evaluates only when the file actually
   // changed; an unchanged file keeps hitting the cache instead of leaking a module per run.
   // Modules the config itself imports are still cached — that is a documented limitation.
   const digest = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 16);
   mod = (await import(`${pathToFileURL(path).href}?v=${digest}`)) as { default?: unknown };
   ```

   `readFileSync` が throw した場合(読めない)は従来 `import()` が投げていたのと同じ catch に入る。catch 内の `err instanceof SyntaxError` 分岐は変えない。

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test -- config-file` → all pass(Step 1 のケースが green に転じる)。続けて `pnpm --filter svelte-vitals run test` 全体と `pnpm smoke`(floor-smoke の `.ts` config ケースは `.ts` に `?v=` を付けても Node のネイティブ型ストリップが効くことの確認になる)→ all pass。

### Step 3: dashboard 側の失敗するテストを書く(TDD red)

`packages/vite/test/ui-plugin-config-file.test.ts` の `startUiServer` を、watcher コールバックを捕まえられるように拡張する。既存の呼び出しを壊さないよう、戻り値に `fireWatcher(file)` を**追加**する。

```ts
let watcherCb: ((event: string, file: string) => void) | undefined;
const server = {
  config: { root: cwd },
  watcher: { on: (_event: string, cb: (...args: unknown[]) => void) => { watcherCb = cb as typeof watcherCb; } },
  middlewares: { use: (_path: string, fn: MiddlewareHandler) => (handler = fn) }
} as ViteDevServer;
…
return { call, fireWatcher: (file: string) => watcherCb?.('change', file) };
```

このテストファイルは `createAnalysisRunner` をモックしていない(実 runner が `analyzeProject` を一時ディレクトリに対して走らせる)。既存ケースがそれで通っているので、そのままでよい。

新ケースを追加:

```ts
it('re-resolves the dashboard config when svelte-vitals.config.* changes on the watcher', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
  try {
    const configPath = join(cwd, 'svelte-vitals.config.js');
    await writeFile(configPath, 'export default { weights: { seo: 5 } };\n');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { call, fireWatcher } = await startUiServer(cwd);
      await writeFile(configPath, 'export default { weights: { seo: 2 } };\n');
      fireWatcher(configPath);
      // The re-resolve is async; poll /data.json until the new weight lands.
      await vi.waitFor(() => {
        const { res, body } = fakeRes();
        call(req('GET', '/data.json'), res);
        expect(JSON.parse(body()).report.weights.seo).toBe(2);
      });
    } finally {
      warnSpy.mockRestore();
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

it('keeps the previous dashboard config when the edited file fails validation', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-ui-config-'));
  try {
    const configPath = join(cwd, 'svelte-vitals.config.js');
    await writeFile(configPath, 'export default { weights: { seo: 5 } };\n');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { call, fireWatcher } = await startUiServer(cwd);
      await writeFile(configPath, "export default { rules: { 'no/such-rule': 'off' } };\n");
      fireWatcher(configPath);
      await vi.waitFor(() => {
        expect(warnSpy.mock.calls.some((args) => String(args[0]).includes('config file invalid'))).toBe(true);
      });
      const { res, body } = fakeRes();
      call(req('GET', '/data.json'), res);
      expect(JSON.parse(body()).report.weights.seo).toBe(5);
    } finally {
      warnSpy.mockRestore();
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
```

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test -- ui-plugin-config-file` → 1 つ目が **fail**(`seo` が 5 のまま、`waitFor` タイムアウト)、2 つ目は現状の挙動と一致するので pass するはずだが、`warn` が呼ばれないので **fail** する(現状は再解決自体をしない)。両方 fail が期待値。

### Step 4: middleware を getter 対応にし、plugin で config を再解決する

1. `packages/vite/src/ui/middleware.ts`(origin/main 版):

   - シグネチャを `config: Config | (() => Config)` に変える。JSDoc に「関数を渡すとリクエストごとに読む(config ファイルの編集を反映するため)」と 1 行。
   - 関数冒頭に `const currentConfig = (): Config => (typeof config === 'function' ? config() : config);` を置き、168 行と 181 行の `buildSnapshot(store, config, …)` を `buildSnapshot(store, currentConfig(), …)` に変える。

2. `packages/vite/src/plugin.ts` の `configureServer`:

   - `let config: Config;` はそのまま。config 解決の try/catch を関数に括り出す(起動時と watcher 時で共有):

     ```ts
     // Shared by startup and the watcher: an invalid config must never take the dev server
     // down, so a failed re-resolve keeps whatever config the dashboard was already using.
     const applyConfig = async (): Promise<void> => {
       try {
         const resolved = await resolveConfig(uiRoot, options);
         config = resolved.config;
         for (const w of resolved.warnings) warn(`svelte-vitals: ${w}`);
       } catch (err) {
         warn(
           `svelte-vitals: config file invalid — dashboard using ${config ? 'the previous config' : 'plugin options/defaults'}: ${err instanceof Error ? err.message : String(err)}`
         );
         config ??= mergeConfig(options, undefined);
       }
     };
     await applyConfig();
     ```

     既存の警告文 `config file invalid — dashboard using plugin options/defaults` を含むテスト(`plugin-config-error.test.ts` / `ui-plugin-config-file.test.ts` の "logs a non-fatal config-file warning")が文字列一致で見ている場合があるので、起動時のメッセージは**従来どおり** `plugin options/defaults` を含める(上の三項がそれを保証する)。

   - watcher の登録を変える:

     ```ts
     server.watcher?.on('all', (_event, file) => {
       if (!isRelevant(file, uiRoot)) return;
       // The runner re-loads the config file itself (analyzeProject → loadConfigFile); the
       // dashboard's scoring config is resolved here, so it has to follow the same edit.
       if (CONFIG_FILENAMES.includes(basename(file))) void applyConfig();
       runner.notifyChange(file);
     });
     ```

     `CONFIG_FILENAMES` は既に `plugin.ts` が import している(`CONFIG_BASENAMES` の構築に使用)。`basename` も import 済み。

   - `installUiMiddleware(server, () => config, …)` と getter で渡す。

**Verify**: `pnpm build && pnpm typecheck && pnpm --filter @svelte-vitals/vite run test` → all pass(Step 3 の 2 ケース含む)。`ui-middleware.test.ts` は無変更で pass すること。

### Step 5: docs(en/ja)に既知の制限を 1 文追加し、台帳に stamp する

`docs/src/content/docs/guides/(vite)/dev-dashboard.mdx` の "Notes" 箇条書き(既存の loopback の項の近く)に追加:

> - Editing `svelte-vitals.config.{js,ts}` re-analyzes with the new config, dashboard scoring included. Modules the config file itself imports are not re-evaluated until `vite dev` restarts.

ja 版 `docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx` の同じ位置には次の 1 文を入れる。

> - `svelte-vitals.config.{js,ts}` を編集すると、新しい設定で再解析され、ダッシュボードの採点にも反映されます。設定ファイル自身が import している別モジュールは `vite dev` を再起動するまで再評価されません。

その後 `pnpm --filter docs run translate:stamp "docs/src/content/docs/guides/(vite)/dev-dashboard.mdx"` を実行し、`docs/blume.translations.json` の差分が 1 エントリだけであることを `git diff --stat docs/blume.translations.json` で確認する。

**Verify**: `pnpm --filter docs run translate:check` → exit 0。`pnpm lint`(textlint 含む)→ exit 0。

### Step 6: changeset を書き、最終検証

`.changeset/` に新規ファイル(名前は任意の kebab-case、例 `config-file-reload.md`):

```md
---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Re-evaluate `svelte-vitals.config.{js,ts}` when it changes instead of serving Node's ESM module cache. In `vite dev` the dashboard re-analysis now runs with the edited config, and the dashboard's own scoring config (weights, overrides) follows the edit too; an edit that fails validation is warned about and the previous config is kept. Modules the config file imports are still cached until the dev server process restarts.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。`pnpm smoke` → exit 0。

## Test plan

- 新規(cli): `config-file.test.ts` の再読込ケース、同一内容ケース。
- 新規(vite): `ui-plugin-config-file.test.ts` の watcher 経由の再解決ケース、無効 config で前回 config 維持ケース。
- 既存: `ui-middleware.test.ts`(値渡し)、`plugin-config-error.test.ts`、`floor-smoke` の `.ts` config ケースが無変更で通ること。
- 判別性: Step 2 と Step 4 の変更をそれぞれ `git stash` で外すと、対応する新ケースだけが赤になることを一度確認する(レビューで問われる)。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `pnpm smoke` が exit 0
- [ ] `pnpm --filter docs run translate:check` が exit 0
- [ ] `grep -n "?v=" packages/cli/src/config-file.ts` が 1 行ヒット
- [ ] `grep -n "() => config" packages/vite/src/plugin.ts` が 1 行ヒット
- [ ] changeset が `svelte-vitals` と `@svelte-vitals/vite` の両方を patch で含む
- [ ] `plans/README.md` の 063 行を更新済み

## Maintenance notes

- 将来 config ローダーを別の仕組み(bundler 経由、`jiti` など)に置き換える場合、キャッシュキーの契約(「内容が同じなら同じ、違えば違う」)を保存すること。`config-file.test.ts` の再読込ケースがそれを守る。
- `installUiMiddleware` の `config` に関数を渡すのは plugin.ts だけ。値渡しの呼び出しを増やしても壊れないが、config を差し替えたい新しい呼び出し側は getter を渡す。
- `applyConfig` が起動時と watcher 時で同じ関数になったので、警告文を変えるときは両方のテストの文字列一致を見る。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない。
- Step 1 の再読込ケースが**修正前から green** になる(vitest のモジュールキャッシュ挙動が変わった)。その場合は計画の前提が崩れているので報告する。
- Step 2 の後で `pnpm smoke` の `.ts` config ケースが落ちる(`?v=` 付き `file:` URL で型ストリップが効かない Node がある)。
- `ui-middleware.test.ts` が Step 4 の後で落ちる(シグネチャ拡張が後方互換でなくなっている)。
- `resolveConfig` が `plugin.ts` から到達できない(`analyze.ts` の export が変わった)。
