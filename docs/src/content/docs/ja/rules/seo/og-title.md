---
title: seo/og-title · Open Graph タイトル
description: <meta property="og:title"> タグはどのルートにも必要です。
---

**重大度:** warning

## チェック内容

すべてのルートに `<meta property="og:title">` タグが必要です（直接指定でも、レイアウトチェーン経由の継承でも構いません）。Open Graph タイトルのメタタグがない、または空のルートを検出します。

## なぜ重要か

`og:title` は、ページがソーシャルプラットフォームでシェアされたときに表示される見出しを決めます。ドキュメントの `<title>` とは別に指定できます。

## 修正方法

`<meta property="og:title">` を追加するか、メタコンポーネントの `openGraph.title` を設定します。

```svelte
<svelte:head>
  <meta property="og:title" content="Page title" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-title': 'off'
  }
};
```
