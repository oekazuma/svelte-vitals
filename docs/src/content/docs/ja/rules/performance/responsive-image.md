---
title: performance/responsive-image · レスポンシブ画像
description: 大きな画像には srcset を用意しましょう。
---

**重大度:** info

## チェック内容

`srcset` 属性のない `<img>` を検出します。

## なぜ重要か

`srcset` のない `<img>` は、どのデバイスにも同じ固定サイズの画像を配信するため、小さい画面では帯域が無駄になります。静的解析では意図した表示サイズを測れないため、本ルールはあくまで助言です。

## 修正方法

ブラウザが適切なサイズを選べるよう `srcset`（と `sizes`）を追加します。

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

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'performance/responsive-image': 'off'
  }
};
```
