---
title: Agent Skills
description: Claude Code、Cursor、Codex に svelte-vitals のルールを教え、プロジェクト全体の改善監査を実行させるスラッシュコマンドのスキル。
sidebar:
  order: 2
---

svelte-vitals は2つの Agent Skills を提供します。どちらも **Claude Code**、**Cursor**、**Codex** で同じように動くポータブルな `SKILL.md` ファイルです。3つのツールがいずれも同じフロントマター形式の規約を解釈するため、1つのファイルがそのまま使い回せます。スキルはプロジェクトの現在のルールセットから一度生成され、各ツールの規約どおりの場所に書き出されます。インストールは [`svelte-vitals install`](/ja/guides/install) で行います。

```bash
npx svelte-vitals@latest install --client claude-skill,claude-skill-improve --yes
```

## `/svelte-vitals`

編集のたびに使うスキルです。ルールカタログ全体（各ルールの id、タイトル、severity、rationale をカテゴリごとにまとめたもの）を埋め込んでいるため、エージェントはコードを書く前からルールを把握しており、書き終えたら回帰チェックとして `svelte-vitals --diff`／`--staged` を実行すべきことも知っています。

書き出される場所：

- `.claude/skills/svelte-vitals/SKILL.md`（Claude Code）
- `.agents/skills/svelte-vitals/SKILL.md`（Codex）
- `.cursor/skills/svelte-vitals/SKILL.md`（Cursor）

3ファイルともバイト単位で同一です。

## `/improve-svelte`

読み取り専用の、プロジェクト全体を対象とした監査スキルです。「この SvelteKit アプリをレビューして」という依頼を、根拠に基づく優先順位付きのプランへと変えます。プロジェクト全体をスキャンし、ルール定義上の severity ではなく実際のユーザーや検索エンジンへの影響度で指摘に優先順位を付けます（たとえばホームページの canonical URL 欠落は、誰も見ないページの同じ指摘より優先されます）。選んだ指摘は1件ずつ、`plans/` 配下（`plans/` が別用途で既にある場合は `advisor-plans/` 配下）の自己完結型の実装プランとして書き出します。別のエージェント（より安価なモデルでも）や人間が、文脈を再構築せずにそのまま着手できる精度です。

修正の提案はすべて svelte-vitals 自身のルールカタログ（`/svelte-vitals` が埋め込むのと同じもの）に由来します。その場の思いつきではなく、ネットワークアクセスも必要ありません。ソース自体は一切編集しないため、いつ実行しても安全です。`/svelte-vitals` が編集のたびに回す回帰チェックだとすれば、`/improve-svelte` は「優先順位付きのロードマップが欲しい」ときに定期的に回すパスです。push 前、リファクタ前、SEO やパフォーマンスの集中改善の前に実行するとよいでしょう。

書き出される場所：

- `.claude/skills/improve-svelte/SKILL.md`（Claude Code）
- `.agents/skills/improve-svelte/SKILL.md`（Codex）
- `.cursor/skills/improve-svelte/SKILL.md`（Cursor）

## スキルを最新に保つ

ルールはリリースごとに変わります。アップグレード後は、最初にどのスキルを入れたか覚えていなくても、インストール済みのスキルファイルをまとめて再生成できます：

```bash
npx svelte-vitals@latest install --refresh
```

詳しくは [`--refresh`](/ja/guides/install#--refresh) を参照してください。

## Agent Skills と Cursor rules の違い

`cursor-rules`（`.cursor/rules/svelte-vitals.mdc`）は Cursor 専用の別の仕組みです。常時適用されるプロジェクトルールファイルであり、スラッシュコマンドのスキルではありません。上記2つのスキルと合わせてどう生成されるかは [`--client`](/ja/guides/install#--client-ids) を参照してください。
