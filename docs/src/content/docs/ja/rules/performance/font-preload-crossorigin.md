---
title: performance/font-preload-crossorigin · フォント preload に crossorigin がない
description: crossorigin を指定しないと、preload したフォントは使われません。
---

**重大度:** warning

## チェック内容

すべての `<link rel="preload" as="font">` には `crossorigin` 属性が必要です。`crossorigin` のないフォント preload を検出します。

## なぜ重要か

`crossorigin` のないフォント preload は実際の（CORS）フォントリクエストと一致しないため、preload したファイルは使われず、フォントが二重にダウンロードされます。

## 修正方法

フォントの preload に `crossorigin` を追加します。

```html
<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin />
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/font-preload-crossorigin': 'off'
  }
};
```
