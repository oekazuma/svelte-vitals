---
title: seo/json-ld-placeholder · JSON-LD のプレースホルダ
description: JSON-LD にプレースホルダのまま残っている値がないか確認します。
---

**重大度:** info

## チェック内容

JSON-LD の値に残っている明らかなプレースホルダや定型文（`lorem ipsum`、`Your Company Name` など）を検出します。

## なぜ重要か

プレースホルダが残っていると、誤った内容の構造化データがそのまま検索エンジンに渡ります。

## 修正方法

プレースホルダをそのページの実際の値に置き換えてください。

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-placeholder': 'off'
  }
};
```
