---
title: performance/lcp-image · LCP 画像の遅延読み込み
description: LCP になりそうな最初の画像は、遅延読み込みにしないでください。
---

**重大度:** warning

## チェック内容

ルートのマークアップで最初に現れる `<img>` に `loading="lazy"` が付いている場合に検出します。静的解析では、文書順で最初の画像を Largest Contentful Paint（LCP）画像とみなします。本ルールは静的（CLI）解析でのみ動作します。

## なぜ重要か

LCP（ファーストビュー）の画像を遅延読み込みすると、最大コンテンツの描画が遅れ、Core Web Vitals を損ないます。静的解析では最初の画像が LCP 候補の最も確かな手がかりなので、即時読み込みにしておくべきです。

## 修正方法

LCP となる最初の画像から `loading="lazy"` を外し、あわせて `fetchpriority="high"` の指定も検討してください。

```svelte
<img src="/hero.jpg" width="1200" height="630" fetchpriority="high" alt="…" />
```
