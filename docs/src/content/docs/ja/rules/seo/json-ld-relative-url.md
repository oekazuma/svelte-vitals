---
title: seo/json-ld-relative-url · JSON-LD の相対 URL
description: JSON-LD の URL は絶対 URL で書きます。
---

**重大度:** warning

## チェック内容

JSON-LD の既知の URL キー（`url`、`image`、`logo`、`sameAs`、`contentUrl`、`thumbnailUrl`）に相対 URL が入っている場合に検出します。URI スキーム（`https:`、`data:`、`mailto:` など）を持つ値とプロトコル相対（`//host/…`）は絶対 URL とみなし、`/logo.png` のようなスキームなしのパスだけを検出します。

`@id` は検査しません。`@id` はノードの識別子であり、同一 `@graph` 内のノードを相互参照する相対フラグメント（例: `#organization`）としてよく使われます。これは正当なパターンであって、壊れた URL ではないためです。

## なぜ重要か

検索エンジンは構造化データに絶対 URL を要求します。相対 URL は確実には解決できません。

## 修正方法

```json
"image": "https://example.com/logo.png"
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-relative-url': 'off'
  }
};
```
