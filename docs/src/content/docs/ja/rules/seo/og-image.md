---
title: seo/og-image · Open Graph 画像
description: <meta property="og:image"> タグはどのルートにも必要です。
---

**重大度:** warning

## チェック内容

すべてのルートに `<meta property="og:image">` タグが必要です（直接指定でも、レイアウトチェーン経由の継承でも構いません）。Open Graph 画像のメタタグがない、または空のルートを検出します。

## なぜ重要か

`og:image` は、ページがソーシャルプラットフォームでシェアされたときに表示されるプレビュー用サムネイルです。ないとリンクは画像なしで表示され、クリック数が減ります。

## 修正方法

`<meta property="og:image">` を追加するか、メタコンポーネントの `openGraph.images` を設定します：

```svelte
<svelte:head>
  <meta property="og:image" content="https://example.com/og.png" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/og-image': 'off'
  }
};
```
