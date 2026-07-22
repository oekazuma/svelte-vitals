---
title: performance/preconnect · サードパーティオリジンへの preconnect
description: ページが利用するサードパーティオリジンに preconnect します。
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
