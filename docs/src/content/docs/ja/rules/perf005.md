---
title: PERF005 · LCP 画像の遅延読み込み
description: 最初の(LCP と推定される)画像は遅延読み込みすべきではありません。
---

**重大度:** warning

## チェック内容

ルートのマークアップで最初の `<img>` が `loading="lazy"` を持つ場合に検出します。静的解析では、文書順で最初の画像を Largest Contentful Paint 画像と近似します。本ルールは静的（CLI）解析でのみ動作します。

## なぜ重要か

LCP（ファーストビュー）の画像を遅延読み込みすると最大描画が遅れ、Core Web Vitals を損ないます。最初の画像は LCP 候補の最良の静的な近似なので、即時読み込みすべきです。

## 修正方法

最初/LCP の画像から `loading="lazy"` を外し、`fetchpriority="high"` も検討します。

```svelte
<img src="/hero.jpg" width="1200" height="630" fetchpriority="high" alt="…" />
```
