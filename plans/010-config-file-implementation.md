# Plan 010: config ファイル対応の本実装 — ローダー出荷 + CLI/MCP 配線 + `--weights`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `test -f packages/cli/src/config-file.ts && grep -n "Accepted" docs/superpowers/specs/2026-07-05-config-file-design.md && git diff --stat 75ee5f1..HEAD -- packages/cli/src/index.ts packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/mcp/src/tools/analyze.ts`
> 1つ目・2つ目が失敗 = Plan 008(PR #127)が未マージ → STOP。3つ目に差分があれば
> "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED(3エントリポイントの設定合成が変わる — テストで抑える)
- **Depends on**: plans/008-config-file-design-spike.md(PR #127 マージ済みであること — ローダー試作 `packages/cli/src/config-file.ts` と Accepted 済み設計書が main に存在)
- **Category**: feature
- **Planned at**: commit `75ee5f1`, 2026-07-07

## Why this matters

`svelte-vitals.config.{mjs,js,ts}` 対応は 1.0 必須のロードマップ項目 C。設計は
`docs/superpowers/specs/2026-07-05-config-file-design.md` で **Accepted 済み**
(2026-07-07、メンテナー承認)— この計画はその設計の「plan A」に相当する:
ローダーの本出荷、CLI と MCP への配線、`--weights` フラグ。設計書が唯一の正で、
本計画と食い違ったら設計書に従い、その旨を報告すること。vite 対応と docs サイト
更新は Plan 011(plan B)で行う — この計画では触らない。

## Current state

- **ローダー試作**: `packages/cli/src/config-file.ts` — `loadConfigFile(cwd)` が
  `svelte-vitals.config.{mjs,js,ts}` を cwd のみから探し native `import()` で読む。
  spike テスト5件(`packages/cli/test/config-file.test.ts`)あり。**出荷前に直す点**:
  1. 冒頭の `SPIKE PROTOTYPE — not wired ...` コメントを実態に合わせて書き換える。
  2. throw する Error メッセージが `svelte-vitals: ` で始まっている — `run()`
     (index.ts:193)と MCP(analyze.ts:71)は catch 時に自分でも
     `svelte-vitals: ` を前置するため**二重プレフィックスになる**。ローダー側の
     プレフィックスを削る(テストの期待値も追随)。
- **CLI の設定合成**: `packages/cli/src/index.ts:123-131` — `analyzeProject` が
  唯一の合成点(CLI の `run()` と MCP の両方がここを通る):

```ts
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? [],
    rules: opts.rules ?? {},
    failOn: opts.failOn ?? 'critical'
  });
```

- `AnalyzeResult` は `{ results, config, version }`(index.ts:112-116)。
  `AnalyzeOptions`(index.ts:102-110)にも `RunOptions`(index.ts:33-63)にも
  `weights` は無い。
- **argv 正規化**: `packages/cli/src/resolve-args.ts` — 純関数(I/O なし)、
  warnings(継続)/ errors(exit 2)の2層。98行目
  `rules: buildRulesConfig(allow, ignore)` はフラグ未指定時に `{}` を返す —
  **`{}` のままだと config ファイルの `rules` を上書きしてしまう**ので
  `undefined` への正規化が必要(設計書 §3)。
- **bin.ts**: mri の `string` 配列(47-62行)に `weights` が無い。`HELP`(8-36行)
  にも `--weights` と config ファイルの記載が無い。
- **MCP**: `packages/mcp/src/tools/analyze.ts` — zod スキーマ(15-34行)で
  `path/metaComponents/route/treatDynamicAs/rules/ignore/failOn` を受け、
  `analyzeProject` を呼ぶ。エラーは `textError()`(isError)。`weights` は無い。
- **weights の消費側**: `packages/core/src/scoring/score.ts:110-127` —
  カテゴリ毎 `?? 1`、負値/非有限は `RangeError`、present カテゴリ全部 0 も
  `RangeError`。`Category` は
  `'seo' | 'performance' | 'correctness' | 'security' | 'architecture'`
  (`packages/core/src/types.ts:72`)。`Config.weights?: Partial<Record<Category, number>>`
  (types.ts:89)。
- **`defineConfig` の注意**(設計書 §3 の実装サブトルティ): config ファイルが
  `defineConfig({...})` で書かれていると **defaults 充填済みの full Config** が
  返る。したがってマージは常に「フラグに指定があればフラグ、なければファイルの値」
  であり、「ファイルの値がデフォルトと違うときだけ採用」にしてはならない。
  また `defineConfig` に `undefined` 値のフィールドを渡すとシャローマージで
  デフォルトを潰す可能性がある — 実装前に `packages/core/src/types.ts` の
  `defineConfig` 実体を確認し、既存コードと同じ「`?? デフォルト` をインラインで
  書く」流儀を守る(`weights` のような optional フィールドは
  `...(w !== undefined ? { weights: w } : {})` の条件スプレッドにする —
  `RunOptions` 構築の `diffBase` の前例が resolve-args.ts:99 にある)。
- **バリデーション部品**: `packages/cli/src/rules-config.ts` —
  `findUnknownRuleIds` / `knownRuleIds`(再利用する)。

## Commands you will need

| Purpose   | Command          | Expected on success |
| --------- | ---------------- | ------------------- |
| Install   | `pnpm install`   | exit 0              |
| Build     | `pnpm build`     | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Tests     | `pnpm test`      | all pass            |
| Lint      | `pnpm lint`      | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/cli/src/config-file.ts`(ローダー出荷品質化 + バリデーション追加)
- `packages/cli/src/index.ts`(analyzeProject の合成 + exports)
- `packages/cli/src/resolve-args.ts`(`--weights` パース + 空 rules 正規化)
- `packages/cli/src/bin.ts`(mri string 配列 + HELP)
- `packages/mcp/src/tools/analyze.ts`(`weights` 引数)
- `packages/cli/test/config-file.test.ts` / `resolve-args.test.ts` /
  `analyze-project.test.ts`(あれば追記、なければ新設)/ `run.test.ts` 系の追記
- `packages/mcp/test/` の該当テスト追記
- `packages/cli/test/fixtures/` に必要なフィクスチャ追加
- `.changeset/<slug>.md`(新規)

**Out of scope**:

- `packages/vite/**` — vite は docs-only 対応(設計書の決定2)。Plan 011。
- `docs/src/content/docs/**` — docs サイト更新は Plan 011。
- `packages/core/**` — core は無変更(`defineConfig` の再エクスポートは CLI 側で行う)。
- config のライブリロード / baseline ファイル — 設計書の out of scope。
- `Config` に出力系オプション(reporter 等)を足すこと — 設計書の out of scope。

## Git workflow

- Branch: `advisor/010-config-file-implementation`
- コミット例: `feat(cli): load svelte-vitals.config.{mjs,js,ts} and add --weights`
- changeset: `svelte-vitals` **minor** + `@svelte-vitals/mcp` **minor**(新機能)。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: ローダーを出荷品質にする

`config-file.ts`:

1. SPIKE コメントを削除し、設計書参照付きの通常の doc コメントへ。
2. Error メッセージから `svelte-vitals: ` プレフィックスを外す(呼び出し側が付ける)。
3. `validateConfigFile(file, path)` 相当の検証を追加(設計書 §4 に厳密に従う):
   - **throw(→ exit 2 / isError)**: `rules` に未知のルール ID
     (`findUnknownRuleIds` を再利用、`--rules` のエラーと同じメッセージ形式で
     `Known rule ids: ...` を含める); `weights` に未知カテゴリキー・負値・
     非有限値(`Category` の5値と突き合わせ)。
   - **warning(継続、メッセージを返す)**: `treatDynamicAs` / `failOn` の
     不正な enum 値(そのフィールドを無視して undefined 扱いに); 未知の
     トップレベルキー(前方互換)。
   - 戻り値は `{ config: Partial<Config>, warnings: string[] }` のような形に
     して呼び出し側が warnings を出力できるようにする(命名は既存流儀に合わせて可)。

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/config-file.test.ts` → pass(期待値更新込み)

### Step 2: `--weights` パースと空 rules 正規化(resolve-args.ts)

1. `--weights seo=2,performance=1` をパース: カンマ区切り `category=number`。
   カテゴリは大文字小文字を区別せず受け、小文字に正規化。未知カテゴリ・
   非数値・負値は **errors**(exit 2)— メッセージは `--rules` の未知 ID
   エラーの形式に倣う。結果型は `Partial<Record<Category, number>>`。
2. `rules: buildRulesConfig(allow, ignore)` の結果が `{}`(フラグ未指定)なら
   `undefined` にする(1行: `Object.keys(r).length > 0 ? r : undefined` 等)。
3. `RunOptions` / `AnalyzeOptions` に `weights?: Partial<Record<Category, number>>`
   を追加(index.ts 側)。

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/resolve-args.test.ts` → pass(新ケース含む)

### Step 3: analyzeProject に配線(index.ts)

1. `const file = await loadConfigFile(cwd)`(検証込み)。warnings は
   `AnalyzeResult` に `warnings: string[]` として追加して返す(フィールド追加は
   後方互換)。`run()` は `analysis.warnings` を `errorLog` で印字。
2. 合成をフィールド単位に変更(フラグ > ファイル > デフォルト):

```ts
const config = defineConfig({
  treatDynamicAs: opts.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
  metaComponents: opts.metaComponents ?? file?.metaComponents ?? [],
  rules: opts.rules ?? file?.rules ?? {},
  failOn: opts.failOn ?? file?.failOn ?? 'critical',
  ...(weights !== undefined ? { weights } : {}) // weights = opts.weights ?? file?.weights
});
```

ローダーの throw は `run()` の既存 catch(→ exit 2)と MCP の catch
(→ isError)にそのまま乗る — 新しいエラークラスは不要。3. `packages/cli/src/index.ts` 末尾の re-export に `loadConfigFile` と
`defineConfig` を追加(`defineConfig` は core から import 済み —
ユーザーの config ファイルが `import { defineConfig } from 'svelte-vitals'`
と書けるようにする。設計書 §5)。

**Verify**: `pnpm --filter svelte-vitals test` → 既存テスト pass

### Step 4: bin.ts(mri + HELP)

1. mri の `string` 配列に `'weights'` を追加。
2. HELP に追加(既存行の書式に合わせる):
   - `--weights <pairs>` 行(例: `seo=2,performance=1`; unlisted categories default to 1)
   - Options の後ろか Usage 付近に config ファイルの1〜2行の説明
     (`Config file: svelte-vitals.config.{mjs,js,ts} in the analyzed directory; flags override it.`)

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/bin` 相当があれば pass、なければ `node packages/cli/dist/bin.js --help` に `--weights` が出ること(要 build)

### Step 5: MCP に `weights` 引数を追加

`analyze.ts` の zod スキーマに追加(既存 describe の文体に合わせる):

```ts
weights: z.record(z.enum(['seo', 'performance', 'correctness', 'security', 'architecture']), z.number())
  .optional()
  .describe('Per-category weights for the combined Health score, e.g. {"seo": 2}. Unlisted categories default to 1.');
```

`handleAnalyze` で `weights: args.weights` を `analyzeProject` に渡す。
負値等は analyzeProject 側の検証で throw → 既存 catch が isError にする。
zod v3/v4 の `z.record` のキー型サポートはプロジェクトの zod バージョンで
確認し、動かなければ `z.object({ seo: z.number().optional(), ... })` に落とす。

**Verify**: `pnpm --filter @svelte-vitals/mcp test` → pass

### Step 6: テスト

設計書のテスト計画に従う:

- `resolve-args`: `--weights` の valid / 未知カテゴリ / 負値 / 非数値 /
  大文字入力の正規化; フラグ未指定時に `options.rules === undefined`。
- `analyzeProject` の優先順位マトリクス(フィクスチャの config ファイル利用):
  フラグ > ファイル、ファイル > デフォルト、フィールド独立性
  (例: `--fail-on` だけ渡してもファイルの `metaComponents` が生きる)。
  返る `config` でアサート。
- ファイルに未知ルール ID → reject(メッセージに `Known rule ids` を含む)。
- ファイルの `weights` が `computeHealth` に到達すること(`config.weights` で確認)。
- e2e(既存の run 系テストの流儀で): config ファイル入りフィクスチャで
  findings が変わること; 壊れた config ファイルで exit 2 とローダーのメッセージ。
- MCP: config ファイル入りプロジェクトの解析がファイルを反映する1件 +
  `weights` 引数が効く1件。
- `.ts` ローダーの Node 分岐は既存 spike テストが CI マトリクスで担保 — 追加不要。
- **重要な注意(spike の発見)**: vitest はプロセス内の dynamic `import()` を
  自前のモジュールランナーで変換するため、**vitest 内から `loadConfigFile` を
  呼ぶテストでは `.ts` が Node バージョンに関係なく常に読めてしまう**。
  ネイティブ Node の挙動(floor でのエラー経路)を検査するテストは必ず
  子プロセス(`execFileSync(process.execPath, ...)`)経由で書くこと —
  spike テストの `.ts` ケースがその手本(設計書の Measured 節参照)。

**Verify**: `pnpm test` → all pass

### Step 7: 全体検証 + changeset

changeset(`.changeset/<slug>.md`):

```md
---
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Load `svelte-vitals.config.{mjs,js,ts}` from the analyzed directory (flags > config file > defaults, per field) and add `--weights` (e.g. `--weights seo=2,performance=1`) plus a `weights` argument on the MCP analyze tool. `.ts` configs work unflagged on Node 22.18+/23.6+; on older Node the CLI explains the upgrade / `--experimental-strip-types` / rename-to-`.mjs` options.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → すべて exit 0 / all pass

## Test plan

Step 6 参照。等価性の回帰: config ファイルを持たないプロジェクトでは挙動が
一切変わらないこと(既存テスト群が無変更で通ることが証明)。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` すべて exit 0
- [ ] `node packages/cli/dist/bin.js --help` の出力に `--weights` と config ファイルの記載がある
- [ ] `grep -n "loadConfigFile\|defineConfig" packages/cli/src/index.ts` → 両方 export されている
- [ ] `grep -rn "svelte-vitals: svelte-vitals:" packages/` → 0件(二重プレフィックスなし)
- [ ] `packages/vite/` と `docs/src/content/docs/` は無変更(`git status`)
- [ ] changeset が存在し `svelte-vitals` / `@svelte-vitals/mcp` とも minor
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- Drift check の 1〜2 が失敗(Plan 008 / PR #127 未マージ)。
- `defineConfig` の実体が「`undefined` 値でデフォルトを潰す」挙動で、かつ
  条件スプレッドで回避できない構造だった場合(core の変更はスコープ外 —
  回避策を添えて報告)。
- MCP の zod バージョンで `weights` のスキーマ表現が Step 5 のどちらの形でも
  組めない場合。
- 既存テストが落ち、原因が「config ファイルなしでの挙動変化」と思われる場合
  (後方互換が壊れている — 報告)。

## Maintenance notes

- 設計書(`2026-07-05-config-file-design.md`)が唯一の正。本計画実施後、
  設計書の Status を `Accepted` → `Shipped (plan A — CLI/MCP)` 等に更新して
  よい(1行)。
- `Config` 型にフィールドを足す将来の変更は、ローダーのバリデーション
  (未知キー warning のリスト)と `analyzeProject` の合成、`--weights` 型の
  3箇所に追随が必要。
- ESM `import()` キャッシュにより、同一プロセスで同じ config パスを2回読むと
  2回目は初回の内容が返る(CLI の単発実行では無害)。MCP サーバーは
  長寿命なので、将来「config 変更が反映されない」報告が来たらここが原因
  (設計書 §2 の実装ノート参照)。
