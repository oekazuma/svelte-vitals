---
title: seo/twitter-card · Twitter Card
description: X/Twitter で大きなカード表示にするため、twitter:card を宣言しましょう。
---

**重大度:** info

## チェック内容

すべてのルートは `<meta name="twitter:card">` を持つべきです（直接指定でも継承でも構いません）。欠けている、または空のルートを検出します。

## なぜ重要か

twitter:card は、ページが X/Twitter で共有されたときの表示形式を決めます。ない場合は簡素なリンク表示になります（カードのタイトルや画像には Open Graph タグがフォールバックとして使われます）。

## 修正方法

```svelte
<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/twitter-card': 'off'
  }
};
```
