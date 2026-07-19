---
title: Agent Skills
description: Claude Code、Cursor、Codex に svelte-vitals のルールを教え、プロジェクト全体の改善監査を実行させるスラッシュコマンドのスキル。
sidebar:
  order: 6.5
---

svelte-vitals は、**Claude Code**、**Cursor**、**Codex** で同一に動作する可搬性のある `SKILL.md` ファイルとして、2つの Agent Skills を提供します。3つのツールはいずれも同じフロントマター形式の規約を読むためです。どちらもプロジェクトの現在のルールセットから一度だけ生成され、各ツールの慣例的な場所に書き出されます。インストールは [`svelte-vitals install`](/svelte-vitals/ja/guides/install/) で行います。

```bash
npx svelte-vitals@latest install --client claude-skill,claude-skill-improve --yes
```

## `/svelte-vitals`

毎回の編集に寄り添うスキルです。ルールカタログ全体（各ルールの id、タイトル、severity、rationale をカテゴリごとにまとめたもの）を埋め込んでいるため、エージェントはコードを書く前からルールを把握しており、書き終えたら `svelte-vitals --diff`／`--staged` を回帰チェックとして実行すべきことも知っています。

書き出される場所：

- `.claude/skills/svelte-vitals/SKILL.md`（Claude Code）
- `.agents/skills/svelte-vitals/SKILL.md`（Codex）
- `.cursor/skills/svelte-vitals/SKILL.md`（Cursor）

3ファイルともバイト単位で同一です。

## `/improve-svelte`

読み取り専用の、プロジェクト全体を対象とした監査スキルです。「この SvelteKit アプリをレビューして」という依頼を、根拠に基づく優先順位付きのプランへと変えます。プロジェクト全体をスキャンし、ルールの生の severity ではなく実際のユーザーや検索エンジンへの影響度で指摘に優先順位を付け（たとえばホームページの canonical URL 欠落は、誰も見ないページの同じ指摘より優先されます）、選ばれた指摘を1件ずつ `plans/` 配下の自己完結型の実装プランとして書き出します。別のエージェント（より安価なモデルでも）や人間が、文脈を再構築せずにそのまま着手できる精度です。

各修正内容は svelte-vitals 自身のルールカタログ（`/svelte-vitals` が埋め込むのと同じもの）由来なので、その場ででっち上げたものではなく、ネットワーク取得も不要です。ソース自体は一切編集しないため、いつ実行しても安全です。`/svelte-vitals` が毎回の編集ごとの回帰チェックであるのに対し、`/improve-svelte` は push 前やリファクタ前、SEOやパフォーマンス強化の際などに使う「優先順位付きロードマップが欲しい」ときのための、定期的なパスです。

書き出される場所：

- `.claude/skills/improve-svelte/SKILL.md`（Claude Code）
- `.agents/skills/improve-svelte/SKILL.md`（Codex）
- `.cursor/skills/improve-svelte/SKILL.md`（Cursor）

## スキルを最新に保つ

ルールはリリースごとに変わります。最初にどのスキルをインストールしたか覚えていなくても、アップグレード後にインストール済みのスキルファイルを再生成できます：

```bash
npx svelte-vitals@latest install --refresh
```

詳しくは [`--refresh`](/svelte-vitals/ja/guides/install/#--refresh) を参照してください。

## Agent Skills と Cursor rules の違い

`cursor-rules`（`.cursor/rules/svelte-vitals.mdc`）は Cursor 専用の別の仕組みです。常時適用されるプロジェクトルールファイルであり、スラッシュコマンドのスキルではありません。上記2つのスキルと合わせてどう生成されるかは [`--client`](/svelte-vitals/ja/guides/install/#--client-ids) を参照してください。
