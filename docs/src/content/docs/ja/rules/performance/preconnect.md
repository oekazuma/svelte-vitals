---
title: performance/preconnect · サードパーティオリジンへの preconnect
description: ページが使うサードパーティのオリジンには、あらかじめ preconnect しておきましょう。
---

**重大度:** info

## チェック内容

よく知られたサードパーティオリジン（現状は Google Fonts: `fonts.googleapis.com`、`fonts.gstatic.com`）のリソースを、そのオリジンへの `<link rel="preconnect">`（または `dns-prefetch`）なしで参照している場合に検出します。該当オリジンを参照しないルートは検査しません。

## なぜ重要か

サードパーティオリジンへの接続（DNS + TCP + TLS）はコストが高く、`preconnect`/`dns-prefetch` ヒントで早期に開始すればリソースの到着が早まります。

## 修正方法

サードパーティオリジンへの preconnect ヒントを追加します。

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

## 設定

| オプション | 型               | デフォルト                                  |
| ---------- | ---------------- | ------------------------------------------- |
| `origins`  | ホスト名のリスト | `fonts.googleapis.com`、`fonts.gstatic.com` |

設定したオリジンは組み込みリストを**置き換えるのではなく追加**します。独自のオリジンを追加した後も
Google Fonts のオリジンは引き続きチェックされ、以降の svelte-vitals リリースで組み込みリストが
拡張されればその恩恵も受けられます。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preconnect': { options: { origins: ['cdn.example.com'] } }
  }
};
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/preconnect': 'off'
  }
};
```
