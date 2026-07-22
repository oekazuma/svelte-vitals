---
title: performance/render-blocking-script · レンダリングをブロックするスクリプト
description: head 内の <script src> は解析をブロックすべきではありません。
---

**重大度:** warning

## チェック内容

`<head>` 内の `<script src>` で `defer`、`async`、`type="module"` のいずれも持たないものを検出します。`src/app.html` に書かれたもの（レンダリング解析で検出）でも、`<svelte:head>` に書かれたもの（静的解析で検出）でも対象です。`<script>` がない head は検査しません。

## なぜ重要か

同期的な `<head>` 内の `<script src>` は、ダウンロードと実行が終わるまで HTML の解析をブロックし、初回描画を遅らせます。`defer`、`async`、`type="module"` でブロックを回避できます。SvelteKit 自身のスクリプトは既に module/defer 済みで、本ルールは手動で追加されたブロッキングスクリプトを検出します。

## 修正方法

`defer`（または `type="module"`）/ `async` を付けます。

```html
<!-- src/app.html -->
<script src="/analytics.js" defer></script>
```
