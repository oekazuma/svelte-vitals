---
title: Agent Skills
description: Claude Code、Cursor、Codex に svelte-vitals 導入時の設定ファイルを導出させ、プロジェクト全体の改善監査を実行させ、ルールそのものを教えるスラッシュコマンドのスキル。
sidebar:
  order: 2
---

svelte-vitals は Agent Skills を提供します。いずれも Claude Code、Cursor、Codex で同じように動くポータブルな `SKILL.md` ファイルです。3つのツールがいずれも同じフロントマター形式の規約を解釈するため、1つのファイルがそのまま使い回せます。スキルは [skills.sh](https://www.skills.sh/) に掲載されており、`skills` CLI でインストールします。

```bash
npx skills add oekazuma/svelte-vitals
```

CLI がどのエージェント向けにインストールするかを尋ね、各ツールの規約どおりの場所（`.claude/skills/`、`.agents/skills/` など）にスキルを書き出します。プロンプトをスキップするには、次のように設定します。

```bash
npx skills add oekazuma/svelte-vitals -a claude-code -a cursor -a codex -y
```

スキルはリポジトリのルールレジストリから生成されるため、インストールされる内容は常に `main` の最新ルールセットと一致します。

## `/setup-svelte-vitals`

svelte-vitals を導入するときに最初に使うスキルです。空の雛形を置くのではなく、そのプロジェクト向けの `svelte-vitals.config` を導出します。

いくつかのルールは初期状態では何も検査しません。オプションがすべて空でデフォルト定義されており、プロジェクトが値を埋めるまで検査対象がゼロのままだからです。`svelte-vitals install --client config-file` が書き出すのは全項目をコメントアウトした雛形、つまり答えではなく記入用紙です。このスキルはその記入用紙を、プロジェクトが既に持っている根拠から埋めます。既存の markuplint や eslint-plugin-check-file の設定、SvelteKit のアダプターと prerender の指定、`metaComponents` に入れるべきローカルの `<head>` コンポーネント、そして隣接する設定からは答えが出ない場合は、プロジェクト自身のディレクトリ名の分布を実際に数えて判断します。

計測せずに書き込むことはありません。候補となる設定はいったんプロジェクト外のスクラッチファイルに書き、[`--config <path>`](/ja/guides/configuration) でスコアを取ります。そのうえで各ルールを、まとめて一度に尋ねるのではなく件数ごとに「採用する」「見送る」「採用して既存分は抑制する」のいずれかに振り分けます。書き換えるのは設定だけで、ソースには手を触れません。既存の設定ファイルを上書きすることもなく、差分を提示するにとどめます。このスキルの担当外（Vite プラグイン、フック、CI ワークフロー）は [`svelte-vitals install`](/ja/guides/install) に引き渡します。

svelte-vitals を導入するときに一度、そして以前から入れてはいるものの初期状態のルールを設定しないままのプロジェクトでもう一度、実行するとよいでしょう。

## `/improve-svelte`

読み取り専用の、プロジェクト全体を対象とした監査スキルです。「この SvelteKit アプリをレビューして」という依頼を、根拠に基づく優先順位付きのプランへと変えます。プロジェクト全体をスキャンし、ルール定義上の severity ではなく実際のユーザーや検索エンジンへの影響度で指摘に優先順位を付けます（たとえばホームページの canonical URL 欠落は、誰も見ないページの同じ指摘より優先されます）。選んだ指摘は1件ずつ、`plans/` 配下（`plans/` が別用途で既にある場合は `advisor-plans/` 配下）の自己完結型の実装プランとして書き出します。別のエージェント（より安価なモデルでも）や人間が、文脈を再構築せずにそのまま着手できる精度です。

修正の提案はすべて svelte-vitals 自身のルールカタログ（`/svelte-vitals` が埋め込むのと同じもの）に由来します。その場の思いつきではなく、ネットワークアクセスも必要ありません。ソース自体は一切編集しないため、いつ実行しても安全です。`/svelte-vitals` が編集のたびに回す回帰チェックだとすれば、`/improve-svelte` は「優先順位付きのロードマップが欲しい」ときに定期的に回すパスです。push 前、リファクタ前、SEO やパフォーマンスの集中改善の前に実行するとよいでしょう。

## `/svelte-vitals`

編集のたびに使うスキルです。ルールカタログ全体（各ルールの id、タイトル、severity、rationale をカテゴリごとにまとめたもの）を埋め込んでいるため、エージェントはコードを書く前からルールを把握しており、書き終えたら回帰チェックとして `svelte-vitals --diff`／`--staged` を実行すべきことも知っています。

## スキルを最新に保つ

ルールはリリースごとに変わります。同じ CLI で最新のコピーを取得できます。

```bash
npx skills update
```

## Agent Skills と Cursor rules の違い

`cursor-rules`（`.cursor/rules/svelte-vitals.mdc`）は Cursor 専用の別の仕組みです。対象 glob（Svelte コンポーネントとルート）に一致するファイルへ Cursor が自動で適用するプロジェクトルールファイルであり、スラッシュコマンドのスキルではありません。`skills add` ではなく [`svelte-vitals install`](/ja/guides/install#--client-ids) が生成します。
