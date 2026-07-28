---
title: seo/title-presence · タイトルの存在
description: どのルートでも <title> が空にならないようにしましょう。
---

**重大度:** critical

## チェック内容

すべてのルートは空でない `<title>` を解決する必要があります（直接指定でも、レイアウトチェーンを通じた継承でも構いません）。動的タイトル（`<title>{data.title}</title>`）は SvelteKit の正しいパターンなので合格します。検出するのは、本当に欠落しているタイトルと空のタイトルだけです。

## なぜ重要か

一意で空でない `<title>` は、最も強力なオンページ SEO シグナルであり、検索結果やブラウザのタブに表示されるテキストです。

## 修正方法

`<svelte:head>` 内に `<title>` を追加します（動的タイトルでも問題ありません）。メタコンポーネントで設定することもできます：

```svelte
<svelte:head>
  <title>{data.title}</title>
</svelte:head>
```
