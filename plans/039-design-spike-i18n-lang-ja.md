# Plan 039: 設計スパイク — `lang: 'ja'` i18n(CLI / Action / vite dashboard)

> **Executor instructions**: This is a **design spike**, not a build plan. GitHub
> issue #165(オープン、メンテナー自身が調査済み)がこの設計スパイクの出発点 —
> issue 自体が "investigation-only... a bigger lift than the option name implies"
> と明記している。このプランの deliverable は `docs/superpowers/specs/` 配下の
> 設計ドキュメント(Accepted 前段階、メンテナーレビュー待ち)であり、実装(rule
> copy の翻訳や `lang` オプションの配線)はこのプランのスコープ外。If anything in
> "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**: `gh issue view 165` を実行し、issue の内容(特に
> "What's affected" セクションのファイル数・行数)が下記「Current state」の引用と
> 一致するか確認する。差分があれば実際の issue の記述を優先し、下記の古い数値は
> 参考情報として扱う。

## Status

- **Priority**: P3
- **Effort**: L(設計スパイクとしての工数。翻訳作業・実装は別プランのスコープ)
- **Risk**: MED(`packages/core` は意図的に薄く保たれている設計原則があり、
  i18n のためのカタログ機構をどこに置くかが core の純粋性に影響しうる)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`svelte-vitals` のランタイム出力(rule のタイトル/メッセージ/推奨文、reporter の
見出し、CLI のヘルプ/プロンプト文言、vite dev dashboard の UI 文言)はすべて
ハードコードされた英語であり、i18n の仕組みが一切ない。一方でこのプロジェクトの
docs サイトは既に en/ja 両方をネイティブに提供しており(Starlight の `ja` ロケール)、
同じユーザー層に対してツール自体の出力だけが英語限定という非対称がある。
メンテナー自身が issue #165 でこれを調査済みで、オープンな実プロダクト課題として
存在する(架空の提案ではない)。

## Current state(issue #165 からの引用 — 2026-07-13 時点)

> There is currently **no i18n infrastructure anywhere in the codebase** — no
> message catalog, no `t()`-style helper, nothing. Every user-facing string is a
> hardcoded English literal.
>
> - **`packages/core/src/rules/`**(32 files, ~2265 lines)— 最大の作業量。各ルールが
>   `title`/`message`/`recommendation`/`rationale`/`fix.description` を個別にハード
>   コード。概算: `message:` 約44件、`recommendation:` 約64件、fix `description:`
>   約28件、文字列プロパティ総数217件。
> - **`packages/core/src/reporter/`**(7 files, 879 lines)— reporter ごとに見出し/
>   ラベルがハードコード:`console.ts`(約10文字列)、`html.ts`(最大・333行・30+
>   文字列、`lang="en"` 含む)、`markdown.ts`(約10)、`agent.ts`(数段落の説明文)。
>   `github.ts`/`sarif.ts` はプロトコル語彙(SARIF レベル・GitHub アノテーション
>   レベル)であり、そもそも翻訳すべきでない可能性が高い。
> - **`packages/cli/src/`** — ヘルプテキスト(`bin.ts` の `Usage:`、`install/cli.ts`
>   の `INSTALL_HELP`、`ci/cli.ts` の `CI_HELP`)、`@clack/prompts` のプロンプト
>   文言、散在する約15件の `console.error`/thrown `Error` メッセージ。
> - **`packages/vite/src/ui/dashboard-script.ts`**(434行)— 約20件の UI 文言
>   (aria-label・placeholder・ソートオプション・見出し・空状態)+ 動的カウント
>   文字列(`"N critical"` 等)。`dashboard.ts` は `<html lang="en">` をハードコード。
> - **`packages/action/src/`** — 自前の文字列はほぼなく(全118行)、PR コメント/
>   サマリー本文は完全に core の `formatMarkdownReport`/`formatGithubReport` に
>   委譲している — **core の reporter が `lang` を受け付けるようになれば、
>   Action はほぼ無償で日本語出力を手に入れる**。
> - **Out of scope**(issue 自身が明記): `packages/mcp`(エージェント向け構造化
>   JSON がほとんどで human-facing UI テキストではないため)、SARIF/GitHub
>   Actions のアノテーションレベル語彙(プロトコル用語)、docs サイト(既に
>   Starlight で別途ローカライズ済み)。

issue は「core は意図的に薄く/純粋に保たれている設計方針であり、翻訳済み rule
copy をどこに置くか(ルールファイル内 vs 別カタログ)の設計判断が先」「Action は
core の reporter 設計にそのまま乗るので、core/CLI/vite を CLI ファーストではなく
一体で設計すべき」「vite dashboard はバンドラーなしの手書きクライアントスクリプト
なので、core のカタログ機構とは別の小さなラベルマップが要る」と述べている。

## Commands you will need

このプランは調査/設計が主。関連ファイルを読むための grep 程度:

| Purpose                                      | Command                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| ルール文字列の再カウント(issue の数値を検証) | `grep -rc "message:\|recommendation:\|description:" packages/core/src/rules/*.ts` |
| reporter の文字列棚卸し                      | `packages/core/src/reporter/*.ts` を読む                                          |

## Scope

**In scope**:

- issue #165 の調査結果を検証し、最新のコード状態と照合する。
- カタログ機構の設計判断: 翻訳済み文字列をどこに置くか(ルールファイルへの
  インライン `{ en, ja }` オブジェクト vs 中央集約されたカタログファイル
  vs 外部ライブラリ)。
- `core`/`cli`/`vite` 間で `lang` オプションをどう伝播させるかの API 設計
  (`analyzeProject`/`AnalyzeOptions` への `lang` 追加が既存の優先順位ルール
  ―「明示的オプション > config file > デフォルト」―とどう整合するか)。
- 翻訳の網羅性(33番目のルールが追加されたとき、翻訳が漏れていたら何が起きる
  べきか — ビルド時エラーか、実行時に英語へフォールバックか)の方針決定。
- 設計ドキュメントの作成: `docs/superpowers/specs/<date>-i18n-lang-ja-design.md`。

**Out of scope**:

- 実際の翻訳作業(32ファイル・217文字列の日本語訳)。
- `lang` オプションの実装・配線。
- `packages/mcp`(issue 自身が明示的にスコープ外としている)。
- SARIF/GitHub Actions のプロトコル語彙の翻訳。
- docs サイト自体(既に別途ローカライズ済み)。

## Git workflow

- Branch: `advisor/039-design-spike-i18n-lang-ja`
- コミット: 設計ドキュメントの追加のみ(`docs: design spike for lang:'ja' i18n (issue #165)`)。
- push / PR 作成はオペレーターの指示があるまで行わない。issue #165 へのコメントは
  行わない(オペレーターの判断に委ねる — このプランは docs 追加のみ)。

## Steps

### Step 1: issue #165 の調査結果を最新コードで検証する

`gh issue view 165` で全文を再確認し、`packages/core/src/rules/`・
`packages/core/src/reporter/`・`packages/cli/src/`・`packages/vite/src/ui/`
それぞれについて、issue が挙げたファイル数・行数・文字列数が現在のコードベース
とおおむね一致するか(2026-07-13 以降の変更で増減している可能性がある)を grep
で確認し、乖離があれば設計ドキュメントにその旨(数値は目安であり実装時に再計測
が必要)を記録する。

### Step 2: カタログ機構の設計判断を行う

3つの選択肢を比較検討し、設計ドキュメントに表(選択肢・core purity への影響・
実装コスト・翻訳漏れの検知しやすさ)としてまとめる:

- **A. ルールファイルへのインライン多言語オブジェクト**: 各ルールの
  `title`/`message` 等を `{ en: '...', ja: '...' }` のような形に変える。
  メリット: 翻訳が該当ルールの定義のすぐそばにあり見つけやすい。デメリット:
  32ファイル全てに手を入れる必要があり、`componentRule`/`headTagRule` 等の
  ルールビルダー関数のシグネチャ変更を伴う可能性がある(既存の型を壊す)。
- **B. 中央集約カタログファイル**(例: `packages/core/src/i18n/ja.ts` に
  ルールIDをキーにした翻訳マップ): メリット: ルール定義自体は変更不要
  (後方互換)、翻訳漏れを一覧で確認しやすい。デメリット: ルールIDと翻訳の
  対応がルール定義から離れた場所にあり、新規ルール追加時に2箇所を同期する
  必要がある(`AGENTS.md` の「ルール追加は4箇所」がさらに増える)。
- **C. 外部 i18n ライブラリの導入**: `packages/core` の「軽量・依存最小」という
  設計原則(`AGENTS.md`)と衝突する可能性が高く、issue 自身も implicitly
  否定的なニュアンス — 比較のためだけに軽く触れ、却下する場合はその理由を明記。

**推奨案を1つ選び、理由を明記する**(メンテナーが別の判断をしてもよいが、
執筆者としての推奨を示すこと — 手がかりとして、`AGENTS.md` の
「ルール追加は4箇所に登録」という既存の負担モデルと比較して、選択肢Bが
本質的に同じ性質の「複数箇所同期」の負担を1箇所増やすだけなのに対し、選択肢A
はルールビルダー関数(`componentRule`/`headTagRule`等)のシグネチャという
型レベルの破壊的変更を伴う点を比較材料にする)。

### Step 3: `lang` オプションの伝播経路を設計する

- `AnalyzeOptions`(`packages/cli/src/index.ts`)に `lang?: 'en' | 'ja'` を追加
  する場合の、config file(`svelte-vitals.config.*`)経由の指定との優先順位
  (既存の「明示的オプション > config file > デフォルト」パターンに従うことを
  推奨する)。
- `runRules`(`packages/core/src/rule.ts` or 該当箇所)が `lang` をどう受け取り、
  各ルールの `check` 関数にどう渡すか — `RuleContext` に `lang` を追加するのが
  自然かを検討する。
- `formatMarkdownReport`/`formatGithubReport`/`formatConsoleReport`/
  `formatHtmlReport`(reporter 群)への `lang` の伝播 — `Action` がこれらを
  そのまま呼んでいる(`packages/action/src/index.ts`)ため、Action 側は
  `core.getInput('lang')` を追加して素通しするだけで済むはず、という issue の
  指摘を検証する。
- `packages/vite/src/ui/dashboard-script.ts` は手書きのハンドオーサー文字列
  (`DASHBOARD_SCRIPT` — Plan 035 で扱った同じファイル)であり、core のカタログ
  機構を再利用できない。小さなラベルマップをこのスクリプト内に直接持たせる
  設計(例: `var LABELS = { en: {...}, ja: {...} }`)を検討し、`lang` をどう
  このスクリプトに渡すか(サーバー側でスクリプト文字列に埋め込む/クエリ
  パラメータ/dashboard.ts が生成する HTML の data 属性経由、等)を提案する。

### Step 4: 翻訳網羅性の方針を決める

新しいルールが追加されたとき、日本語訳が用意されていない場合にどうすべきかの
方針を決める(候補: ビルド時に全ルールの `ja` エントリの存在をチェックする
テスト/lint を追加し、欠落があればビルドを失敗させる — これが最も安全だが、
新規ルール追加のハードルが上がる。あるいは、欠落時は英語にフォールバックし、
警告だけ出す — ハードルは低いが `ja` モードで英語が混在する体験になる)。
推奨案を1つ選び、理由を明記する。

### Step 5: 設計ドキュメントを書く

`docs/superpowers/specs/<today>-i18n-lang-ja-design.md` を作成し、issue #165 の
内容を踏まえつつ、Step 1〜4 の検討結果(カタログ機構の選択、`lang` の伝播設計、
翻訳網羅性の方針、影響を受けるファイルの一覧、見積もり工数)をまとめる。
「Status: Proposed」(メンテナーレビュー待ち、まだ Accepted ではない)として
明記する。

## Test plan

このプランは設計ドキュメントの作成であり、コード変更もテストも伴わない。

## Done criteria

- [ ] issue #165 の調査結果が最新コードと照合され、乖離があれば記録されている
- [ ] カタログ機構(インライン vs 中央集約 vs 外部ライブラリ)の比較と推奨案が
      明記されている
- [ ] `lang` オプションの `core`/`cli`/`action`/`vite dashboard` 間の伝播設計が
      具体的に記述されている
- [ ] 翻訳網羅性(ビルド時チェック vs フォールバック)の方針が決まっている
- [ ] `docs/superpowers/specs/<date>-i18n-lang-ja-design.md` が作成されている
      (Status: Proposed)
- [ ] `plans/README.md` の該当行を更新済み(ステータスは「設計完了、メンテナー
      レビュー待ち」)

## STOP conditions

- カタログ機構の設計判断が、`packages/core` の「軽量・依存最小・純粋」という
  設計原則(`AGENTS.md`/`packages/core/CLAUDE.md`)と明確に矛盾する結論にしか
  至らない場合、無理に妥協案を出さず、その矛盾自体を設計ドキュメントに明記し、
  メンテナーの判断を仰ぐ。
- issue #165 の記述と実際のコードの間に大きな乖離(例: 想定より遥かに文字列数が
  増えている)が見つかった場合、見積もり工数を issue の記載のまま使わず、実測
  ベースで更新する。

## Maintenance notes

- このプランの成果物は設計ドキュメントのみ。承認された場合、実装は「core の
  カタログ機構 + 32ルールの翻訳」「CLI/Action の `lang` 配線」「vite dashboard
  のラベルマップ」という複数の実装プランに分割して起票することを推奨する
  (L 工数の単一プランにまとめると、レビューもテストも巨大になりすぎる)。
- `packages/mcp` は明示的にスコープ外だが、将来 human-facing な出力
  (例: `explain_rule` ツールの説明文)を追加する場合、この設計の対象に含める
  かどうかを再検討する必要がある。
