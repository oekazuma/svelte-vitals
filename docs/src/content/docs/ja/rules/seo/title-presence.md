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

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/title-presence': 'off'
  }
};
```
