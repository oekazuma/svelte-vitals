---
title: performance/image-dimensions · 画像のサイズ指定
description: すべての <img> に width と height 属性を明示すべきです。
---

**重大度:** warning

## チェック内容

すべての `<img>` 要素には `width` と `height` 属性の明示が必要です。どちらかが欠けている画像を検出します。

## なぜ重要か

width と height を明示していない `<img>` は、読み込み中にレイアウトシフト（CLS）を引き起こし、Core Web Vitals と表示の安定性を損ないます。

## 修正方法

`<img>` に `width` と `height` 属性を追加します：

```svelte
<img src="/hero.jpg" width="1200" height="630" alt="…" />
```
