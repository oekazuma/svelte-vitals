---
title: performance/image-loading-hint · 画像の読み込みヒント
description: <img> には loading 属性を明示します。
---

**重大度:** info

## チェック内容

すべての `<img>` 要素には `loading` 属性の明示が必要です。`loading` 属性のない画像を検出します。

## なぜ重要か

`loading` 属性があると、ブラウザは画面外の画像の読み込みを後回しにできます。なければすべての画像が即座に読み込まれ、より重要なコンテンツの読み込みが遅れることがあります。静的解析ではどの画像が LCP かを判断できないため、本ルールはあくまで助言です。

## 修正方法

画面外の `<img>` 要素に `loading="lazy"` を追加します（LCP やヒーロー画像は即時読み込みのままにします）：

```svelte
<img src="/thumb.jpg" width="320" height="240" loading="lazy" alt="…" />
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/image-loading-hint': 'off'
  }
};
```
