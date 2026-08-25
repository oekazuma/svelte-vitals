---
title: seo/duplicate-description · 説明文の重複
description: meta description はルートごとに違う内容にしましょう。
---

**重大度:** warning

## チェック内容

静的な `<meta name="description">` の内容が（トリムと空白圧縮の後で）同一のルートが 2 つ以上あると検出します。動的な説明文や存在しない説明文は検査しません。

## なぜ重要か

meta description が重複していると、ページごとの要約を検索エンジンに伝えられません。その結果、検索エンジンに無視されたり書き換えられたりします。

## 修正方法

```svelte
<svelte:head>
  <meta name="description" content="このルート固有の説明文。" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。`--route` で絞ると比較対象もマッチしたルートに絞られ、ビルドではプリレンダリングされたルート同士を比較します。ダッシュボードのライブ層はこのルールを静的ベースラインに任せます — 1 ページの `<head>` には比較相手が無いためです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/duplicate-description': 'off'
  }
};
```
