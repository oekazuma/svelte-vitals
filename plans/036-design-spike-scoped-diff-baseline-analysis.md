# Plan 036: 設計スパイク — `--diff`/`--staged`/`--baseline` のフルプロジェクト解析を回避する

> **Executor instructions**: This is a **design/spike plan**, not a build-everything
> plan. The deliverable is a design doc under `docs/superpowers/specs/` (following
> this repo's existing convention) that answers the open questions below — not a
> shipped code change. Follow the steps, produce the design doc, and STOP for
> maintainer review before implementing anything beyond the prototype described in
> Step 3. If anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/cli/src/index.ts packages/cli/src/baseline.ts packages/cli/src/changed-files.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: M(設計スパイクとしての工数。フル実装は別プランに切り出す)
- **Risk**: MED(一部ルールはプロジェクト全体のコンテキストを正当に必要とするため、
  ナイーブな「変更ファイルだけ解析する」実装は正しさを壊しうる — このプランの目的は
  その境界を明確にすること)
- **Depends on**: none(Plan 034 のパースキャッシュが実装されていると、このプランの
  プロトタイプで再利用できる可能性がある — 独立に実施可能)
- **Category**: perf / direction
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`--diff`/`--staged`/`--baseline` は「PR ゲートが本当に気にする変更だけを見る」ための
スコープ絞り込み機能だが、実装は**常にプロジェクト全体を解析してから**結果を絞り込む
(`packages/cli/src/index.ts:172-207` の `analyzeProject` は変更ファイルの情報を一切
受け取らず、常に全ルート・全コンポーネントを対象に全ルールを実行する。
`packages/cli/src/index.ts:235-288` の `applyScope` はその**後**に
`filterToChangedFiles`/`filterToNewFindings` で結果を絞り込むだけ)。`--baseline` は
さらに `checkoutBaseline`(`packages/cli/src/baseline.ts`)で git worktree を切って
**2回目のフル解析**まで行う。

大規模な SvelteKit アプリで1ファイルだけ変更した pre-commit フックや PR ゲートが、
「スコープ絞り込み」という機能の趣旨に反して毎回フルコストを払う。

一方で、一部のルールは**正しく動作するために全ルート/全コンポーネントのコンテキスト
を必要とする**(例: `packages/core/src/rules/seo/seo028-029-uniqueness.ts` の
重複タイトル/ディスクリプション検出は、他の全ルートとの比較が本質)。この境界を
無視して「変更ファイルだけ解析する」実装をすると、変更されていないルートとの重複が
検出できなくなるという**サイレントな不正確さ**を生む。だからこのプランは「実装」で
はなく「設計スパイク」— 安全に高速化できる部分とできない部分を明確に線引きしてから、
実装プランを別途起票する。

## Current state

- **`analyzeProject`** — `packages/cli/src/index.ts:172-207`(既に全文読了済み)。
  `route` オプションによる絞り込み(191-195行目)は存在するが、これは「ユーザーが
  明示的に指定したグロブでルートを絞る」機能であり、`--diff`/`--staged`/`--baseline`
  の変更ファイル検出とは連動していない。
- **`applyScope`** — 同ファイル209-288行目(既に全文読了済み)。`getChangedFiles`/
  `filterToChangedFiles`(`packages/cli/src/changed-files.ts`)と
  `checkoutBaseline`/`filterToNewFindings`(`packages/cli/src/baseline.ts`)を
  `analyzeProject` の**結果に対して事後的に**適用する。
- **重複検出ルール** — `packages/core/src/rules/seo/seo028-029-uniqueness.ts`
  (ファイル名から推測 — 実装の詳細をこのスパイクの Step 1 で読むこと)。
  `ctx`(`RuleContext`)にプロジェクト全体の `heads`(`ResolvedHead[]`)が渡される
  前提で、全ルートを横断してタイトル/ディスクリプションの重複を判定していると
  想定される。
- **`ParseCache`** — Plan 034 で導入(または導入予定)の、ファイル単位の読込+パース
  結果キャッシュ。これは「ファイルを読み直さない」レベルの最適化であり、本プランが
  扱う「ルールをどのルートに対して実行するか」というより高いレベルの最適化とは
  別の層にある — 両者は併用可能。

## Commands you will need

このプランは実装ではなく調査/設計が主だが、プロトタイプ(Step 3)を書く場合は
以下を使う:

| Purpose   | Command                                 | Expected on success |
| --------- | --------------------------------------- | ------------------- |
| Tests     | `pnpm --filter svelte-vitals test`      | all pass            |
| Typecheck | `pnpm --filter svelte-vitals typecheck` | exit 0              |

## Scope

**In scope**:

- 調査: どのルールが「全ルート/全プロジェクトのコンテキスト」を正当に必要とするか
  の棚卸し。
- 調査: `--diff`/`--staged`/`--baseline` それぞれについて、「変更ファイルの
  layout chain に含まれるルートだけを解析する」という絞り込みが安全に導入できるか。
- 設計ドキュメントの作成: `docs/superpowers/specs/<date>-scoped-diff-analysis-design.md`
  (このリポジトリの既存の設計ドキュメント群と同じ形式 — 例えば
  `docs/superpowers/specs/2026-07-08-dev-dashboard-whole-project-design.md` を
  参考にする)。
- (オプション、Step 3)技術的に成立するかを確認するための小さなプロトタイプ/
  スパイクコード。**マージを前提としない使い捨てコード** — 動くことを確認したら
  設計ドキュメントに知見を反映し、プロトタイプ自体は破棄するか別ブランチに残す。

**Out of scope**:

- 本番採用する実装そのもの(このスパイクの結論を踏まえて、別の実装プランとして
  改めて起票する)。
- `--baseline` の git worktree 機構自体の変更(このプランは「何を解析するか」の
  スコープ絞り込みが主眼であり、worktree の作り方は変更しない)。

## Git workflow

- Branch: `advisor/036-design-spike-scoped-diff-baseline-analysis`
- コミット: 設計ドキュメントの追加(`docs: add design spike for scoped diff/baseline analysis`)。
  プロトタイプコードを書いた場合、それは別コミットにし、最終的にマージしない
  (ドラフト PR の説明に「プロトタイプは参考実装であり別プランで正式に実装する」
  旨を明記)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 全ルール(49個)を「ルート単位で独立に判定できるか」で分類する

`packages/core/src/rules/index.ts` の `allRules` を一覧し、各ルールの `check`
関数が `ctx`(`RuleContext`)のうちプロジェクト全体のコレクション
(`ctx.heads`/`ctx.components`/`ctx.project` など)をどう使っているかを読む。
分類は2つ:

- **ルート/ファイル独立**: そのルート(またはそのコンポーネントファイル)の情報
  だけで判定が完結する(例: `SEO001` の `<title>` 有無)。
- **プロジェクト横断**: 他のルート/ファイルとの比較や集計が必要(例:
  `SEO028`/`SEO029` の重複検出、`ARCH` 系のプロジェクト全体のファイル数/構造に
  依存するルールがあれば)。

この分類結果を設計ドキュメントの表として残す(ルールID・分類・根拠の3列)。

### Step 2: レイアウトチェーンによる「影響を受けるルート」の算出方法を検討する

`chainFiles`(`packages/cli/src/providers/source/resolve.ts` — 既に部分的に読了、
`resolveRoute` が使っている)は、あるページに対してそのレイアウトチェーン
(祖先レイアウト全て)を返す。これの**逆引き**(あるファイルが変更されたとき、
それを layout chain に含むページ = 影響を受けるルート、を求める関数)を実装する
ための設計を検討する:

- 全ルートの `chainFiles` 結果を一度計算してファイル→ルートの逆引きマップを作る
  コストは、結局「全ルートを列挙する」処理を要するため、「フル解析を避ける」という
  目的とどこまで両立するか(列挙自体は軽いが、各ルートの `resolveFileTags` の
  ような重い処理まで避けられるかを見極める)。
- 変更ファイルがコンポーネント(ルート/レイアウトではなく `$lib` 配下など)の場合、
  どのルートがそれを import しているかを静的に追跡するのは、レイアウトチェーンの
  比ではないコストがかかる可能性がある(import グラフの構築が必要)— この場合、
  「安全側に倒してプロジェクト全体を解析する」フォールバックが必要かどうかを
  検討する。

### Step 3(オプション): 小さなプロトタイプで技術的成立性を確認する

Step 1 で「ルート/ファイル独立」に分類したルールだけを対象に、変更ファイルの
layout chain に含まれるルートのみを解析する簡易プロトタイプを、既存のテスト
フィクスチャ(`packages/cli/test/fixtures/`)の1つを使って書いてみる。目的は
「本当に結果が変わらないか」を実測することであり、本番コードへの統合は行わない。

### Step 4: 設計ドキュメントを書く

`docs/superpowers/specs/<today>-scoped-diff-analysis-design.md` を作成し、以下を
含める:

- Step 1 の分類結果(全ルール表)。
- Step 2 の検討結果と、推奨するアプローチ(例: 「ルート/レイアウトファイルの変更は
  layout chain 逆引きで安全に絞れるが、コンポーネント変更やプロジェクト横断ルール
  が絡む場合は全体解析にフォールバックする」といった具体的な設計)。
- 未決事項(Open questions)を明示し、メンテナーが判断すべき点をリストアップする
  (例: 「フォールバックの閾値をどう決めるか」「`--baseline` の2回目の解析にも
  同じ絞り込みを適用するか」)。
- 見積もり: 本実装に必要な効果(どの程度のプロジェクト規模でどれくらいの時間短縮
  が見込めるか、Step 3 のプロトタイプがあれば実測値)と工数(粗い見積もりでよい)。

## Test plan

このプランはスパイクであり、本番コードへの変更を伴わない場合はテスト追加も不要。
Step 3 でプロトタイプを書いた場合、それが既存のテストスイートを壊さないことだけを
確認する(`pnpm --filter svelte-vitals test`)— プロトタイプ用の新規テストを本気で
書き込む必要はない(使い捨てである旨をコードコメントに明記する)。

## Done criteria

- [ ] 全49ルールの「ルート/ファイル独立」 vs 「プロジェクト横断」分類が完了している
- [ ] レイアウトチェーン逆引きのアプローチと、その限界(コンポーネント変更時の
      フォールバック)が設計ドキュメントに明記されている
- [ ] `docs/superpowers/specs/` に設計ドキュメントが追加されている
- [ ] 未決事項がメンテナー向けに明示されている
- [ ] (Step 3 を実施した場合)プロトタイプが既存テストスイートを壊していない
- [ ] `plans/README.md` の該当行を更新済み(ステータスは「設計完了、実装は別プラン
      待ち」であることを明記)

## STOP conditions

- ルールの分類作業中に、「ルート/ファイル独立」と「プロジェクト横断」の境界が
  ルールの実装から明確に読み取れない(ドキュメントコメントもテストも手がかりに
  ならない)ケースに複数遭遇した場合、無理に推測で分類せず、それらのルールIDを
  「要確認」として設計ドキュメントに残し、報告する。
- Step 3 のプロトタイプで、レイアウトチェーン逆引きが「変更されていないはずの
  ルートの所見が変わってしまう」という不正確さを生むケースが見つかった場合、
  そのケースを詳しく記録して報告する(これは実装を諦める理由にはならず、むしろ
  このスパイクが見つけるべき最も重要な知見)。

## Maintenance notes

- このプランの成果物(設計ドキュメント)は、メンテナーが実装するかどうかを判断
  するための材料。承認された場合、別の実装プラン(番号は次の advisor セッションで
  採番)として改めて起票すること — このプラン自体を「実装済み」として閉じない。
- Plan 034(dev dashboard の永続パースキャッシュ)と本プランは異なる層の最適化
  であり、両方を実装する場合は互いに干渉しないことを確認する(パースキャッシュは
  「ファイルを読み直さない」、本プランは「どのルートを解析対象にするか」)。
