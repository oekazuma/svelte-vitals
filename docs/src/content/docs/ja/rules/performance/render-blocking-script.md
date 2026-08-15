---
title: performance/render-blocking-script · レンダリングをブロックするスクリプト
description: head の <script src> で HTML の解析を止めないようにしましょう。
---

**重大度:** warning

## チェック内容

`<head>` 内の `<script src>` のうち、クラシックスクリプトとして実行され（`type` が未指定・空、または JavaScript の MIME タイプ）、かつ `defer`・`async` のいずれも指定していないものを検出します。`src/app.html` に書かれたもの（レンダリング解析で検出）でも、`<svelte:head>` に書かれたもの（静的解析で検出）でも対象です。`<script>` がない head は検査しません。

検出しないもの: `type="module"`、および `type="importmap"`、`type="speculationrules"`、`type="text/partytown"` のようなサードパーティランタイムなど、クラシックスクリプトとして実行されない type。

## なぜ重要か

同期的な `<head>` 内の `<script src>` は、ダウンロードと実行が終わるまで HTML の解析をブロックし、初回描画を遅らせます。`defer`、`async`、`type="module"` でブロックを回避できます。SvelteKit 自身のスクリプトには既に module や defer が付いているため、本ルールが検出するのは手動で追加されたブロッキングスクリプトです。

## 修正方法

`defer`（または `type="module"`）か `async` を付けます。

```html
<!-- src/app.html -->
<script src="/analytics.js" defer></script>
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'performance/render-blocking-script': 'off'
  }
};
```
