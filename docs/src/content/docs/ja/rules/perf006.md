---
title: PERF006 · レスポンシブ画像
description: 大きな画像は srcset を提供すべきです。
---

**重大度:** info

## チェック内容

`srcset` 属性のない `<img>` を検出します。本ルールは静的(CLI)解析でのみ動作します。

## なぜ重要か

`srcset` のない `<img>` はすべてのデバイスに固定サイズの画像を配信し、小さい画面では帯域を無駄にします。静的解析では意図した表示サイズを測れないため、助言的(advisory)です。

## 修正方法

ブラウザが適切なサイズを選べるよう `srcset`(と `sizes`)を追加します。

```svelte
<img
  src="/hero.jpg"
  srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="100vw"
  width="1600"
  height="900"
  alt="…"
/>
```
