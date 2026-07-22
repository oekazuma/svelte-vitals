---
title: seo/description-presence · ディスクリプションの存在
description: すべてのルートは <meta name="description"> を含む必要があります。
---

**重大度:** critical

## チェック内容

すべてのルートは `<meta name="description">` タグを含む必要があります（直接指定またはレイアウトチェーンを通じた継承）。欠落または空のディスクリプションメタタグは指摘されます。

## なぜ重要か

メタディスクリプションは検索エンジンがタイトルの下に表示するスニペットです。ない場合、検索エンジンはページテキストから自動生成しますが、多くの場合、品質が低くなります。

## 修正方法

`<svelte:head>` 内に `<meta name="description">` を追加するか、メタコンポーネントのディスクリプションを設定します：

```svelte
<svelte:head>
  <meta name="description" content="A concise page summary." />
</svelte:head>
```
