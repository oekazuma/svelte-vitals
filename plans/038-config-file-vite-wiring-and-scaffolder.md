# Plan 038: config file を vite プラグインに配線し、`install` にスキャフォルダーを追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. This plan has two independent parts (Part A:
> scaffolder, Part B: vite wiring) — you may implement them in either order,
> but STOP between parts and confirm each part's verification passes before
> starting the next. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/cli/src/config-file.ts packages/cli/src/install/index.ts packages/cli/src/install/vite-targets.ts packages/vite/src/plugin.ts packages/vite/src/analyze.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW(Part A: 新規ファイルのスキャフォルダー追加、既存機能への影響なし)
  / MED(Part B: vite の実効設定解決順序を変える — 既に config ファイルと plugin
  オプションの両方を設定済みのユーザーの挙動が変わりうる)
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`svelte-vitals.config.{mjs,js,ts}` は CLI(`run()`)と MCP の `analyze` ツールには
配線済み(`packages/cli/src/config-file.ts` の `loadConfigFile`、
`packages/cli/src/index.ts:176` の `analyzeProject` 内での呼び出し)。しかし2つの
点で機能が中途半端:

1. **スキャフォルダーがない**: `loadConfigFile` 自身のエラーメッセージ(162行目
   付近)がユーザーに「`export default defineConfig({...})` を手で書け」と指示する
   だけ。`install` ウィザードは `vite-plugin`/`vite-hooks`/`claude-skill`/
   `cursor-rules` という4種の対象を既に自動生成しているのに、config file だけは
   この体験から外れている。
2. **vite プラグインが config file を一切読まない**: `packages/vite/src/plugin.ts`
   (build-mode)と `packages/vite/src/analyze.ts`(prerendered 解析)はどちらも
   `defineConfig({...options...})` を直接呼ぶだけで、`loadConfigFile` を import
   すらしていない(`grep -rn "loadConfigFile" packages/vite/src` は0件)。
   `packages/vite/src/plugin.ts` の `CONFIG_BASENAMES` は dev dashboard の
   再解析トリガーとして `svelte-vitals.config.*` を含めている(ファイルを保存する
   と再スキャンする素振りを見せる)のに、**その中身は一切読まれず無視される** —
   ユーザーが config file に `weights` を設定して CLI ではそれが反映されるのに、
   同じプロジェクトの vite dev dashboard/build ゲートでは黙って無視される、という
   矛盾した体験になっている。

## Current state

- **`loadConfigFile`** — `packages/cli/src/config-file.ts`(冒頭60行を既に読了
  済み)。`CONFIG_FILENAMES = ['svelte-vitals.config.mjs', 'svelte-vitals.config.js',
  'svelte-vitals.config.ts']`(16行目)、`cwd` 直下のみ探索(上方探索なし)。戻り値
  `LoadedConfigFile { config: Partial<Config>; warnings: string[] }`。
- **`analyzeProject` での使用パターン**(参考にすべき精度の高い前例) —
  `packages/cli/src/index.ts:172-187`:

```ts
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();

  const loaded = await loadConfigFile(cwd);
  const file = loaded?.config;
  const warnings = loaded?.warnings ?? [];

  const weights = opts.weights ?? file?.weights;
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? file?.metaComponents ?? [],
    rules: opts.rules ?? file?.rules ?? {},
    failOn: opts.failOn ?? file?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {})
  });
  ...
```

**優先順位のルール(既に確立済み・このプランはこれを踏襲する)**: 「明示的な
オプション > config file の値 > 組み込みデフォルト」— `analyzeProject` の docblock
(161-171行目)にも明記: "Config precedence is per field: an explicit option here
wins, otherwise the config file's value is used, otherwise the built-in default
(design doc 2026-07-05-config-file-design.md §3)."

- **vite の build-mode plugin** — `packages/vite/src/plugin.ts:73-85`
  (`closeBundle` 内、既に全文読了済み)は `options`(`SvelteVitalsOptions`、
  plugin 呼び出し時の引数)から `analyze(resolved, root, options)` を呼ぶ。
- **vite の解析本体** — `packages/vite/src/analyze.ts:34-44`(全文読了済み):

```ts
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions
): Promise<AnalyzeResult> {
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? [],
    rules: options.rules ?? {},
    failOn: options.failOn ?? 'critical'
  });
  ...
```

- **vite の dev dashboard(UI プラグイン)** — `packages/vite/src/plugin.ts:120-125`
  (`configureServer` 内)も同様に `defineConfig({ ...options... })` を直接呼ぶ。
- **`CONFIG_BASENAMES`** — `packages/vite/src/plugin.ts:13-19`(既に読了済み)。
  `svelte-vitals.config.{mjs,js,ts}` が既に「再解析トリガー」の一覧に入っている
  (= 保存すると再スキャンする素振りは既にある)。
- **install ウィザードの対象一覧** — `packages/cli/src/install/vite-targets.ts`
  (全文読了済み、`vite-plugin`/`vite-hooks` の2つ)、`agent-targets.ts`
  (`claude-skill`/`cursor-rules`)。`packages/cli/src/install/index.ts`
  (1-160行目、既に読了済み)の `planForAgentTarget`(103-109行目)が
  「完全に再生成されるコンテンツ、`--force` で上書き可」という、config file
  スキャフォルダーに最も近いパターン。

## Scope

**In scope**:

- **Part A(スキャフォルダー)**: `install` に config file を生成する新しい対象
  を追加する。
- **Part B(vite 配線)**: `packages/vite/src/plugin.ts`・`packages/vite/src/analyze.ts`
  が `loadConfigFile` を呼び、既存の「明示的オプション > config file > デフォルト」
  の優先順位を踏襲する。

**Out of scope**:

- `loadConfigFile` 自体のロジック変更(上方ディレクトリ探索の追加など — 設計
  ドキュメントが明示的にスコープ外としている)。
- CLI 側の `analyzeProject`/`run()` の変更(既に配線済み、無変更)。
- MCP 側(既に配線済み、無変更)。

## Commands you will need

| Purpose   | Command                                                                  | Expected on success |
| --------- | --------------------------------------------------------------------------- | -------------------- |
| Build     | `pnpm --filter svelte-vitals --filter @svelte-vitals/vite build`         | exit 0                |
| Typecheck | 同2パッケージ `typecheck`                                                | exit 0                |
| Tests     | 同2パッケージ `test`                                                     | all pass              |
| Lint      | `pnpm lint`                                                                | exit 0                |

## Git workflow

- Branch: `advisor/038-config-file-vite-wiring-and-scaffolder`
- コミット: Part A / Part B を別コミットにする(`feat(cli): scaffold svelte-vitals.config via install` /
  `feat(vite): read svelte-vitals.config.* in the plugin and build-mode analyze`)。
- push / PR 作成はオペレーターの指示があるまで行わない。

---

## Part A: `install` に config file スキャフォルダーを追加する

### Step A1: 生成するテンプレート内容を決める

`docs/src/content/docs/guides/configuration.md`(既存 — Step 2 で参照)を読み、
`Config` 型(`packages/core/src/index.ts` から re-export される型定義、
`treatDynamicAs`/`metaComponents`/`rules`/`failOn`/`weights`)を確認した上で、
コメントアウトされたサンプルフィールドを持つ `svelte-vitals.config.mjs` の
テンプレート文字列を生成する関数を書く(`packages/cli/src/install/skill-content.ts`
に既にある `buildSkillMarkdown`/`buildCursorRules` と同じファイルに
`buildConfigFileTemplate()` として追加するか、新規ファイル
`packages/cli/src/install/config-content.ts` を作る — 既存の `skill-content.ts`
の責務(agent 向けコンテンツ生成)とは性質が異なるため、新規ファイルを推奨)。

生成する内容の例(全フィールドをコメントアウトしたサンプル):

```js
// svelte-vitals config file — https://oekazuma.github.io/svelte-vitals/guides/configuration/
export default {
  // treatDynamicAs: 'pass', // 'pass' | 'warn' | 'fail' — how {data.title}-style dynamic values are scored
  // metaComponents: ['Seo'], // component names that resolve SEO tags into <head>
  // rules: {}, // e.g. { SEO001: 'off' } to disable a rule
  // failOn: 'critical', // 'critical' | 'warning' | 'info'
  // weights: {} // e.g. { seo: 2 } — per-category weight for the combined Health score
};
```

(`defineConfig` ヘルパーを使うかどうかは、CLI 側の実際の使用例
(`docs/src/content/docs/guides/configuration.md` の既存サンプル)に合わせる —
ドキュメントを読んで既存の推奨パターンと一致させること。)

### Step A2: 新しい対象 ID を定義する

`packages/cli/src/install/vite-targets.ts` や `agent-targets.ts` と同じパターンで
`config-targets.ts`(新規)を作る:

```ts
export type ConfigTargetId = 'config-file';

export interface ConfigTarget {
  id: ConfigTargetId;
  label: string;
  hint: string;
  relPath: string;
}

export const CONFIG_TARGETS: ConfigTarget[] = [
  {
    id: 'config-file',
    label: 'Config file',
    hint: 'Scaffolds svelte-vitals.config.mjs with every option commented out',
    relPath: 'svelte-vitals.config.mjs'
  }
];

export function configTargetById(id: string): ConfigTarget | undefined {
  return CONFIG_TARGETS.find((t) => t.id === id);
}

export function isConfigTargetId(id: string): id is ConfigTargetId {
  return CONFIG_TARGETS.some((t) => t.id === id);
}
```

(`.mjs` を選ぶ理由: `loadConfigFile` の候補優先順位の先頭が `.mjs`
— `packages/cli/src/config-file.ts:16` の `CONFIG_FILENAMES` 配列の並び順を
確認し、それに合わせる。)

### Step A3: `install/index.ts` に配線する

`TargetId` 型に `ConfigTargetId` を追加し、`planForAgentTarget` と同じ形の
`planForConfigTarget` を追加する(完全再生成、`--force` で上書き可):

```ts
function planForConfigTarget(target: ConfigTarget, io: InstallIO, force: boolean): PlanRow {
  const path = join(io.cwd, target.relPath);
  const existing = io.readFile(path);
  const content = buildConfigFileTemplate();
  const status: WriteStatus = existing === undefined ? 'created' : force ? 'updated' : 'exists';
  return { id: target.id, label: target.label, path, status, content };
}
```

`runInstall`(またはメインの実行フロー — 実際の関数名は `index.ts` を最後まで
読んで確認する)の中で、`viteIds`/`agentIds` と同じパターンで `configIds` を
フィルタし、選択されていれば `planForConfigTarget` を呼ぶ処理を追加する。
`--client` のヘルプテキスト(`packages/cli/src/install/cli.ts` の
`INSTALL_HELP`)に `config-file` を追記する。対話式ウィザードの選択肢一覧
(`SelectableOption` を組み立てている箇所)にも `CONFIG_TARGETS` を追加する。

**Verify**: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals build`
→ exit 0。

### Step A4: テストを追加する

`packages/cli/test/install/` の既存テスト(`agent-targets` 関連のテストファイルを
参考にする)と同じパターンで、`config-file` ターゲットの `created`/`exists`/
`--force` での `updated` の3状態を検証するテストを追加する。

**Verify**: `pnpm --filter svelte-vitals test` → all pass、新規ケース green。

---

## Part B: vite プラグイン/analyze に `loadConfigFile` を配線する

### Step B1: `packages/vite/src/analyze.ts` に配線する

`analyze` 関数内の `defineConfig({...})` の前に `loadConfigFile(cwd)` を呼び、
CLI の `analyzeProject` と全く同じ優先順位(明示的な `options.*` > config file の
値 > デフォルト)を適用する:

```ts
import { loadConfigFile } from 'svelte-vitals';
...
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions
): Promise<AnalyzeResult> {
  const loaded = await loadConfigFile(cwd);
  const file = loaded?.config;
  const weights = options.weights ?? file?.weights;
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? file?.metaComponents ?? [],
    rules: options.rules ?? file?.rules ?? {},
    failOn: options.failOn ?? file?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {})
  });
  ...
```

`loadConfigFile` は `svelte-vitals`(CLI パッケージ)からの公開エクスポート
(`packages/cli/src/index.ts:525` の `export { loadConfigFile } from
'./config-file.js';` — 既に確認済み)。`packages/vite` は既に `svelte-vitals` を
peer/optional な形で参照しているか(`packages/vite/src/ui/analysis.ts` が
`await import('svelte-vitals')` している前例がある)を確認し、同じ dynamic
import のパターンを使うべきか、それとも静的 import でよいかを判断する
(build-mode の `analyze.ts` は既に `@svelte-vitals/core` を静的 import して
いるため、`svelte-vitals` も静的 import で問題ないはず — ただし `packages/vite`
の `package.json` の `dependencies` に `svelte-vitals` が入っているか確認し、
入っていなければ追加すること)。

`loaded?.warnings`(config file の不正なフィールドに対する警告)をどう扱うかも
決める — CLI は `warnings` を呼び出し元に返している(`AnalyzeResult.warnings`)。
build-mode の `AnalyzeResult` 型(`packages/vite/src/analyze.ts:22-31`)にも
`warnings: string[]` を追加し、`plugin.ts` の `closeBundle` でそれを
`console.warn` するか判断する(CLI がどう表示しているか
`packages/cli/src/index.ts` の `run()` 内の warnings 処理を確認して揃える)。

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck` → exit 0。

### Step B2: 既存テストへの影響を確認する

`packages/vite/test/plugin-error.test.ts`(既に読了済み — `analyze` をモックする
既存テスト)や、build-mode の他のテストが `cwd` に `svelte-vitals.config.*` を
持たない前提で動いているか確認する。`loadConfigFile` は config file が存在
しなければ `undefined`(または空の `config`)を返すはずなので、既存のテスト用
一時ディレクトリには影響しないはずだが、念のため実行して確認する。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → all pass(既存ケース、
新規ケース追加前の時点で)。

### Step B3: dev dashboard 側(`plugin.ts` の `configureServer`)にも同じ配線をする

`packages/vite/src/plugin.ts` の `configureServer` 内の `defineConfig({...})`
(120-125行目)にも、Step B1 と同じ優先順位ロジックを適用する。
`packages/vite/src/ui/analysis.ts` の `createAnalysisRunner` が呼ぶ
`analyzeProject`(dynamic import 経由、`svelte-vitals` パッケージの本体)は
**既にそれ自身の内部で `loadConfigFile` を呼んでいる**(`analyzeProject` の
実装、既に確認済み)ため、dev dashboard の whole-project 解析パスは実は**既に
config file を読んでいる可能性が高い** — この点を実装前に必ず確認すること
(`configureServer` 内で `defineConfig({...options...})` を呼んでいるのは
`installUiMiddleware` に渡す `config`(表示/フィルタリング用の設定オブジェクト)
であり、`runner`(実際の解析)が使う設定とは**別の経路**かもしれない — 2つの
`config` オブジェクトが実際に同じものを指しているか、独立した2つの解決になって
いるかを、`packages/vite/src/plugin.ts` の `configureServer` 全文と
`installUiMiddleware` の `config` パラメータの使われ方を読んで確認し、もし
「whole-project 解析(`runner`)は既に config file を読んでいるが、UI 側の
`config`(フィルタ用)は読んでいない」という食い違いがあれば、UI 側の
`config` にも同じ配線をする)。

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck && test` → exit 0 / all pass。

### Step B4: テストを追加する

`packages/vite/test/` に、`svelte-vitals.config.mjs` を一時ディレクトリに置いた
状態で `analyze()`(build-mode)を呼び、config file の `rules`/`weights` が
実際に反映されることを確認する統合テストを追加する。CLI 側の
`packages/cli/test/fixtures/config-file-project`(MCP のテストが再利用している
ことを Plan 033 の調査で確認済み)を同様に再利用できないか検討する。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → all pass、新規ケース green。

### Step B5: docs を更新する

`docs/src/content/docs/guides/configuration.md` + ja に、「vite プラグインも
config file を読む」旨を追記する(現状「CLI と MCP が読む」とだけ書かれている
可能性が高い — 実際の記載を確認して更新する)。

---

## 全体検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て
exit 0 / all pass。changeset を2つ追加(`svelte-vitals`: minor — config file
スキャフォルダー追加、`@svelte-vitals/vite`: minor — config file を読むように
なったという振る舞いの変更)。

## Test plan

- Part A: `config-file` ターゲットの `created`/`exists`/`--force updated` の3状態。
- Part B: build-mode `analyze()` が config file の `rules`/`weights` を反映する
  こと、dev dashboard の UI 側 `config` も同様であること(Step B3 の調査結果次第)。
- 既存の `packages/vite/test`・`packages/cli/test` の全ケースが green のまま。

## Done criteria

- [ ] `install --client config-file` が `svelte-vitals.config.mjs` を生成する
- [ ] `packages/vite/src/analyze.ts` が `loadConfigFile` を呼び、CLI と同じ優先
      順位を適用している
- [ ] dev dashboard の UI 側 `config` が whole-project 解析と同じ config file
      解決を共有している(Step B3 の調査結果に基づき、必要なら配線)
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0 / all pass
- [ ] docs(en/ja)が更新されている
- [ ] changeset が2つ存在する
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- Step B3 の調査で、dev dashboard の `runner`(whole-project 解析)と UI の
  `config`(フィルタ用)が実は同じ設定解決を共有する単一の経路であることが判明
  した場合(= 追加配線が不要と分かった場合)、Part B のこの部分は「既に対応済み」
  として Done criteria から除外し、その根拠を Maintenance notes に記録する —
  無理に二重配線を作らない。
- config file の `.ts` 拡張子ロード(Node のネイティブ TS サポート、design doc
  2026-07-05 の "best-effort" 扱い)が vite の実行コンテキスト(esbuild/Vite の
  トランスパイル環境)で CLI と異なる挙動をする可能性がある場合、その差異を
  実際に確認してから進める — 予想と異なれば STOP して報告する。

## Maintenance notes

- Part A と Part B は独立に価値があるため、レビュー時に別々にマージすることも
  検討できる(1つの PR にまとめる場合はコミットを分けておくと分割レビューしやすい)。
- 今後 `Config` 型に新しいフィールドが追加された場合、Step A1 のテンプレート
  ジェネレーターにもコメントアウトされたサンプル行を追加することを忘れないこと。
