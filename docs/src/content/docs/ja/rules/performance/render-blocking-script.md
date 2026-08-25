---
title: performance/render-blocking-script · レンダリングをブロックするスクリプト
description: head の <script src> で HTML の解析を止めないようにしましょう。
---

**重大度:** warning

## チェック内容

`<head>` 内の `<script src>` のうち、クラシックスクリプトとして実行され（`type` が未指定・空、または JavaScript の MIME タイプ）、かつ `defer`・`async` のいずれも指定していないものを検出します。`src/app.html` に書かれたもの（レンダリング解析で検出）でも、`<svelte:head>` に書かれたもの（ソース解析で検出）でも対象です。`<script>` がない head は検査しません。

検出しないもの: `type="module"`、および `type="importmap"`、`type="speculationrules"`、`type="text/partytown"` のようなサードパーティランタイムなど、クラシックスクリプトとして実行されない type。

## なぜ重要か

同期的な `<head>` 内の `<script src>` は、ダウンロードと実行が終わるまで HTML の解析をブロックし、初回描画を遅らせます。`defer`、`async`、`type="module"` でブロックを回避できます。SvelteKit 自身のスクリプトには既に module や defer が付いているため、本ルールが検出するのは手動で追加されたブロッキングスクリプトです。

## 修正方法

`defer`（または `type="module"`）か `async` を付けます。

```html src/app.html
<script src="/analytics.js" defer></script>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/render-blocking-script': 'off'
  }
};
```
