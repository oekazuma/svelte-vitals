# Plan 008: 設計スパイク — `svelte-vitals.config.{ts,js}` 対応の設計書とローダー試作

> **Executor instructions**: これは**設計スパイク**であり、機能を出荷する計画ではない。成果物は設計ドキュメント1本と使い捨てレベルの試作コード(テスト付き)。手順どおりに進め、STOP conditions に該当したら止めて報告すること。完了時に `plans/README.md` のステータス行を更新する。
>
> **Drift check (run first)**: `git log --oneline 1f6f233..HEAD -- packages/cli/src/resolve-args.ts packages/core/src/types.ts packages/core/src/config-apply.ts`
> 対象ファイルに変更があれば「Current state」の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: M(スパイクとして。実装本体は別計画になる)
- **Risk**: LOW(出荷物なし)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

config ファイル対応は、このリポジトリ自身の設計ドキュメントが **1.0 必須**と明記しているのに未着手の機能である(`docs/superpowers/specs/2026-06-23-health-report-design.md:101` — "Config-file support + `--weights` CLI flag (roadmap item C — 1.0-required)")。データモデル側は完成済み: `Config` 型・`defineConfig`(「Identity helper for config files (design §6)」とコメント済み)・`selectRules`/`applyRuleSeverities`(`packages/core/src/config-apply.ts`)はすべて実装・公開済みで、**ファイルを探して読む部分だけが存在しない**。現状は CLI フラグ・vite プラグインオプション・MCP ツール引数がそれぞれ独立しており、チームの設定を1箇所に置く手段がない。さらに docs は「設定可能な重み」を謳っているが設定手段がない(`docs/src/content/docs/guides/health-report.md:29`、ja 同様)— この documentation gap もこの機能で閉じる。

## Current state

- `packages/core/src/types.ts:80-102` — `Config` 型(`treatDynamicAs` / `metaComponents` / `rules` / `failOn` / `weights?`)と `defineConfig`(defaults へのシャローマージ)。
- `packages/core/src/config-apply.ts` — `selectRules(allRules, config)` と `applyRuleSeverities(results, config)` が実装済み。
- 3つのエントリポイントの現在の設定の受け取り方:
  - CLI: `packages/cli/src/resolve-args.ts` が mri argv → `RunOptions` に正規化し、`packages/cli/src/index.ts:126-131` の `analyzeProject` が `defineConfig({...opts})` で `Config` を作る。
  - vite: `packages/vite/src/hooks/options.ts`(`SvelteVitalsHookOptions` = `metaComponents` / `rules`)と `packages/vite/src/plugin.ts` のプラグインオプション。
  - MCP: `packages/mcp/src/tools/analyze.ts` が `analyzeProject` を呼ぶ(CLI パッケージの export 経由)。
- `weights` は `Config` に存在し `computeHealth`(`packages/core/src/scoring/score.ts`)が消費するが、どのエントリポイントからも設定できない。
- リポジトリの設計ドキュメント慣習: `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md`。直近の例 `2026-07-05-vite-component-rules-design.md` の構成(背景 → 設計 → 境界 → テスト計画 → out of scope)に倣う。
- 依存追加の制約: ルートの依存は pnpm catalog 経由。core は「No node: imports, no I/O」原則(`packages/core/src/index.ts:1-2`)なので**ローダーは core に置けない** — CLI(または新設の共有場所)に置く。

## Commands you will need

| Purpose | Command                            | Expected on success |
| ------- | ---------------------------------- | ------------------- |
| Install | `pnpm install`                     | exit 0              |
| Tests   | `pnpm --filter svelte-vitals test` | all pass            |
| Lint    | `pnpm lint`                        | exit 0              |

## Scope

**In scope**:

- `docs/superpowers/specs/2026-07-05-config-file-design.md`(新規 — 主成果物)
- `packages/cli/src/config-file.ts` + `packages/cli/test/config-file.test.ts`(試作 — 破棄可能な品質でよいが、テストは通すこと)
- `packages/cli/test/fixtures/` の試作用フィクスチャ

**Out of scope**(スパイクでは**やらない**):

- CLI / vite / MCP への実配線(`resolve-args.ts` / `bin.ts` / plugin / MCP tool の変更)
- `--weights` フラグの実装
- docs サイト(`docs/src/content/docs/`)の変更 — health-report ガイドの文言修正は実装が出荷されるときに行う
- 新規依存の追加(下記 Step 2 の調査で必要と判断された場合は設計書に記載するに留める)

## Git workflow

- Branch: `advisor/008-config-file-design-spike`
- コミット例: `docs: design config-file support (roadmap item C)` / `feat(cli): prototype config-file loader (spike)`
- changeset 不要(出荷物なし)。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: 決定事項を列挙し、コードベースから答えを引く

設計書の骨子として、以下の設計判断それぞれに「推奨 + 根拠 + 代替案」を書く:

1. **ファイル名と探索**: `svelte-vitals.config.ts` / `.js` / `.mjs` を解析対象ディレクトリ(`cwd`)から探す。上方探索(親ディレクトリへの遡り)はするか? 推奨: しない(SvelteKit プロジェクト単位が解析単位であり、`vite.config` も同じ流儀)。
2. **ローダー機構**: `.ts` を Node で読む方法。候補: (a) `jiti`(依存追加、堅牢)、(b) native `import()` + Node 24 の型ストリッピング(依存ゼロだが Node バージョン依存 — Plan 005 のフロア決定と相互作用)、(c) `.ts` は非対応にして `.js`/`.mjs` のみ(依存ゼロ、DX 劣る)。それぞれ vite プラグイン(vite 環境では vite 自身が ts を読める)と MCP での再利用性も比較すること。
3. **優先順位**: CLI フラグ > config ファイル > デフォルト、で確定してよいか。`rules`(--rules/--ignore)とファイルの `rules` のマージは「フラグ側が全置換」か「キー単位マージ」か。推奨: フラグ指定時は該当フィールドのみ上書き(シャロー)。
4. **バリデーション**: 不正な config(未知のルール ID、weights の負値等)の扱い。CLI の既存流儀(`resolve-args.ts` の warnings=続行 / errors=exit 2)に合わせる。既存の `findUnknownRuleIds`(`packages/cli/src/rules-config.ts`)を再利用。
5. **共有方法**: ローダーを CLI に置いて vite / MCP が CLI パッケージから import するか(MCP は既に `svelte-vitals` に依存)、`@svelte-vitals/config` 新パッケージか。推奨: CLI に置き `svelte-vitals` から export(新パッケージは過剰)。
6. **`--weights` フラグ**: config ファイル対応と同時に出荷するか。health-report 設計書(§ Future)は同時を想定 — 設計書にフラグの書式(`--weights seo=2,performance=1`)を含める。

**Verify**: 設計書ドラフトに 6 項目すべての「推奨 + 根拠」が存在する

### Step 2: ローダーを試作して機構の実現可能性を確認

`packages/cli/src/config-file.ts` に最小の `loadConfigFile(cwd: string): Promise<Partial<Config> | undefined>` を実装(Step 1-2 で推奨した機構で)。フィクスチャ(`svelte-vitals.config.mjs` を持つ最小プロジェクト)+ テスト 3 ケース:

- config ファイルが無い → `undefined`
- valid な config → 読めた `Partial<Config>` が返る
- `defineConfig` を import して使う config ファイル(dogfooding 形)→ 同上

`.ts` ローディングを試す場合はテストを1つ追加し、動かなければ「動かなかった事実と理由」を設計書に記録(それ自体がスパイクの成果)。

**Verify**: `pnpm --filter svelte-vitals test -- config-file` → pass

### Step 3: 設計書を完成させる

`docs/superpowers/specs/2026-07-05-config-file-design.md` に、Step 1 の決定事項、Step 2 の実測結果、3エントリポイントの配線方針(どのファイルのどの関数に何行程度の変更か)、テスト計画、out of scope(baseline ファイル等 — 監査所見 DIR-03 は別機能)、および**残る未決事項**(メンテナー判断が要る点)を明記。既存 spec(`2026-07-05-vite-component-rules-design.md`)の見出し構成に合わせる。

**Verify**: `pnpm lint` → exit 0

## Test plan

Step 2 の 3〜4 ケースのみ(スパイク品質)。実装本体のテスト計画は設計書の中に書く。

## Done criteria

- [ ] `docs/superpowers/specs/2026-07-05-config-file-design.md` が存在し、Step 1 の 6 決定事項すべてに推奨案がある
- [ ] `packages/cli/test/config-file.test.ts` が pass(`pnpm --filter svelte-vitals test` exit 0)
- [ ] `pnpm lint` exit 0
- [ ] 実配線ファイル(`resolve-args.ts` / `bin.ts` / vite plugin / MCP)は無変更(`git status`)
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

- Step 1-2 の全ローダー候補が「依存追加なしでは `.ts` config を読めない」となり、かつ catalog への依存追加の是非がスパイクの範囲を超えると感じた場合 — 比較表を添えて報告(依存追加はメンテナー判断)。
- `docs/superpowers/specs/` に config ファイルの設計書が既に存在する場合(先行作業との衝突)。

## Maintenance notes

- この設計書が承認されたら、実装は「ローダー出荷 + CLI 配線」「vite/MCP 配線 + docs 更新(health-report の『設定可能な重み』文言の整合含む)」の2計画に分けるのが自然。
- 監査所見 DOCS-01(health-report ガイドの未実装機能の記載)は、実装出荷まで docs の文言を弱める暫定修正も選択肢 — メンテナーに委ねる。
