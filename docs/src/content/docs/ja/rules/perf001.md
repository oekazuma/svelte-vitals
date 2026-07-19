---
title: PERF001 · 画像のサイズ指定
description: すべての <img> は明示的な width と height 属性を持つ必要があります。
---

**重大度:** warning

## チェック内容

すべての `<img>` 要素は明示的な `width` と `height` 属性を持つ必要があります。いずれかの属性が欠落している画像は指摘されます。

## なぜ重要か

明示的な width と height のない `<img>` は、読み込み中にレイアウトシフト（CLS）を引き起こし、Core Web Vitals とビジュアルの安定性を損ないます。

## 修正方法

`<img>` に明示的な `width` と `height` 属性を追加します：

```svelte
<img src="/hero.jpg" width="1200" height="630" alt="…" />
```
