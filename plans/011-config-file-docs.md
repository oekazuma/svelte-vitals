# Plan 011: config ファイルの docs 対応 — 設定ガイド新設(en/ja)+ vite の docs-only 配線 + health-report 文言の是正

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `node packages/cli/dist/bin.js --help 2>/dev/null | grep -i weights`(要 `pnpm build`)
> ヒットしない = Plan 010 が未マージ → STOP(このプランは出荷済みの挙動を
> ドキュメント化する — 実装より先に書いてはならない)。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(docs のみ)
- **Depends on**: plans/010-config-file-implementation.md(マージ済みであること)
- **Category**: docs
- **Planned at**: commit `75ee5f1`, 2026-07-07
- **注意**: このプランは 010 のマージ後に**必ず drift check を再実行**し、実装が
  計画どおり出荷されたか(フラグ書式・探索順・エラーメッセージ)を `--help` と
  実挙動で確認してから書くこと。

## Why this matters

設計書(`docs/superpowers/specs/2026-07-05-config-file-design.md`、Accepted)の
「plan B」。docs サイトには現在 config ファイルのページが無く、health-report
ガイドは「configurable weights」と謳いながら設定手段を示していない(監査所見
DOCS-01 — メンテナーは「実装出荷時に文言を直す」と決定済み。それが今)。また
vite プラグインへの config ファイル対応は「docs-only」で行うとメンテナーが決定
した(設計書の Decisions §2): vite ユーザーは `vite.config.ts` 内で config
ファイルを import してプラグインオプションに広げる — その方法をドキュメント
するのがこのプランの vite 対応のすべてである。

## Current state

- docs サイト: Astro Starlight、`docs/src/content/docs/guides/`(en)と
  `docs/src/content/docs/ja/guides/`(ja)。**en/ja は必ず同時更新**
  (AGENTS.md の hard rule)。サイドバーは `docs/astro.config.mjs:21-27` で
  `autogenerate: { directory: 'guides' }` — 新ページはファイルを置くだけで載る
  (順序は frontmatter の `sidebar.order` — 既存ページの frontmatter を確認して
  流儀に合わせる)。
- 既存ガイド: `choosing-a-package.md`, `cli.md`, `dev-overlay.md`,
  `getting-started.md`, `health-report.md`, `mcp.md`, `plugin-mode.md`,
  `reporters.md`(ja 側に同名の対訳)。
- 是正対象の文言: `docs/src/content/docs/guides/health-report.md:29` —
  "Health averages the category scores using configurable weights."(ja 同旨)
  — 現在は設定手段が書かれていない。
- 実装(010 出荷後)の仕様の正: 設計書 + 実際の `--help` 出力。要点:
  - `svelte-vitals.config.{mjs,js,ts}` を解析対象ディレクトリのみから探索
    (上方探索なし)、優先順 `.mjs` > `.js` > `.ts`。
  - `.ts` は Node **22.18+ / 23.6+** で無フラグ動作(無フラグ化は 23.6.0、
    22.18.0 に LTS バックポート)。フロア(>=22.13.0)〜22.17.x では
    `--experimental-strip-types` が必要(CLI が「Node を 22.18+ に上げる /
    フラグを付ける / .mjs に改名」の順で案内エラーを出す)。
  - 優先順位: CLI フラグ > config ファイル > デフォルト(フィールド単位)。
    `--rules`/`--ignore` 指定時はファイルの `rules` を丸ごと置換。
  - `defineConfig` は `svelte-vitals` から import(`@svelte-vitals/core` からも
    可だが、ユーザーが実際にインストールするパッケージ名で案内する)。
  - `--weights seo=2,performance=1`(未指定カテゴリは重み 1)。
- MCP ガイド(`mcp.md`)には analyze ツールの引数一覧がある可能性 — `weights`
  引数を足したなら追記対象(実物を読んで確認)。

## Commands you will need

| Purpose    | Command                    | Expected on success  |
| ---------- | -------------------------- | -------------------- |
| Install    | `pnpm install`             | exit 0               |
| docs check | `pnpm --filter docs check` | 0 errors, 0 warnings |
| docs build | `pnpm --filter docs build` | exit 0               |
| Lint       | `pnpm lint`                | exit 0               |

## Scope

**In scope** (the only files you should modify/create):

- `docs/src/content/docs/guides/configuration.md`(新規)+
  `docs/src/content/docs/ja/guides/configuration.md`(新規、対訳)
- `docs/src/content/docs/guides/health-report.md` + ja(weights の設定方法への
  リンク/例の追記、"configurable" の文言を実手段つきに)
- `docs/src/content/docs/guides/cli.md` + ja(`--weights` と config ファイルの
  記載 — 実ファイルを読んで該当節を判断)
- `docs/src/content/docs/guides/plugin-mode.md` + ja(vite での config ファイル
  再利用: `vite.config.ts` 内 import パターン)
- `docs/src/content/docs/guides/mcp.md` + ja(`weights` 引数 — 実装されていれば)
- `README.md`(Usage 節に config ファイルの1〜3行の言及 — 任意だが推奨)

**Out of scope**:

- パッケージコード(`packages/**`)— 一切触らない。
- changeset — docs のみのため不要(AGENTS.md)。
- `docs/superpowers/specs/**` — 設計書の Status 更新は Plan 010 側の仕事。

## Git workflow

- Branch: `advisor/011-config-file-docs`
- コミット例: `docs: document svelte-vitals.config and --weights (en/ja)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: 実装の実挙動を確認する

`pnpm build` 後、使い捨てディレクトリ(スクラッチ)に最小 SvelteKit 形状 +
`svelte-vitals.config.mjs` を作り、`node packages/cli/dist/bin.js <dir>` で:

- config ファイルが読まれること(例: `failOn` を変えて exit code が変わる)
- `--weights seo=2` が通ること・不正値でエラーになること
- `--help` の記載

を確認し、ドキュメントに書く内容と実挙動のズレをゼロにする。

**Verify**: 上記の手動確認結果をメモ(REPORT の NOTES に含める)

### Step 2: `configuration.md`(en)を書く

構成(既存ガイドのトーン・見出しスタイルに合わせる):

1. What the config file is / where it lives(探索ルール、`.mjs`/`.js`/`.ts`)
2. Example(`defineConfig` を `svelte-vitals` から import する形をリード例に)
3. Available options(`treatDynamicAs` / `metaComponents` / `rules` / `failOn`
   / `weights` — 各1〜2行 + 型)
4. Precedence(フラグ > ファイル > デフォルト、`--rules` の丸ごと置換の注意)
5. TypeScript configs(Node 22.18+/23.6+ 無フラグ / 22.13〜22.17 は Node 更新
   or フラグ or `.mjs` — フロア >=22.13.0 の文脈で)
6. Using the config file with the Vite plugin(`vite.config.ts` 内で
   `import config from './svelte-vitals.config.js'` してプラグインオプションに
   スプレッド — これが vite の公式対応方法)

**Verify**: `pnpm --filter docs check` → 0 errors

### Step 3: ja 対訳 + 既存ページの追記(en/ja 同時)

- `ja/guides/configuration.md`: Step 2 の対訳(構成・位置を en と揃える)。
- `health-report.md` en/ja: weights の説明箇所に「config ファイルの `weights`
  または `--weights` で設定する」旨と configuration.md へのリンク・短い例。
- `cli.md` en/ja: `--weights` 行 + config ファイルへの言及。
- `plugin-mode.md` en/ja: config 再利用の短い節(configuration.md §6 への
  リンクでも可 — 重複を作りすぎない)。
- `mcp.md` en/ja: `weights` 引数(実装済みの場合のみ)。
- `README.md`: Usage 節に config ファイルの存在と1例。

**Verify**: `pnpm --filter docs check && pnpm --filter docs build` → pass /
exit 0、`pnpm lint` → exit 0

## Test plan

docs のみのため自動テストは `docs check` / `docs build` / `lint`。
内容の正しさは Step 1 の実挙動確認で担保する。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls docs/src/content/docs/guides/configuration.md docs/src/content/docs/ja/guides/configuration.md` → 両方存在
- [ ] `grep -rn "weights" docs/src/content/docs/guides/health-report.md docs/src/content/docs/ja/guides/health-report.md` → 設定手段(config ファイル or --weights)への言及がある
- [ ] `pnpm --filter docs check` 0 errors && `pnpm --filter docs build` exit 0
- [ ] `pnpm lint` exit 0
- [ ] `git status` で `packages/` 配下に変更なし
- [ ] en の変更ページすべてに ja の対応変更がある(ファイル単位で対応)
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- Drift check 失敗(Plan 010 未マージ / `--weights` が `--help` に無い)。
- Step 1 の実挙動が設計書・このプランの記述と食い違う(実装バグの可能性 —
  ドキュメントで挙動を「上書き」せず報告)。
- 既存ガイドの構成が大きく変わっていて追記位置の判断がつかない場合。

## Maintenance notes

- 今後 `Config` にフィールドが増えたら configuration.md(en/ja)の
  Available options 表に追随が必要。
- Node フロアが 22.18+ に上がったら、configuration.md の TypeScript 節の
  注意書きを削除できる(設計書 Decisions §1 の「自己解決」条件 —
  型ストリッピング無フラグ化は 22.18.0 に LTS バックポート済み)。
