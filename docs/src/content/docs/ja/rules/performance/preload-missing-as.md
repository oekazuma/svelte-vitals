---
title: performance/preload-missing-as · preload に as がない
description: <link rel="preload"> には as 属性を指定します。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload">` には、リソース種別を示す `as` 属性（`style`、`script`、`font`、`image` など）が必要です。`as` のない preload を検出します。

## なぜ重要か

`as` 属性のない `<link rel="preload">` はブラウザに無視される（または二重にフェッチされる）ため、preload が無駄になります。

## 修正方法

リソース種別に合った `as` 属性を追加します：

```html
<link rel="preload" href="/app.css" as="style" />
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preload-missing-as': 'off'
  }
};
```
