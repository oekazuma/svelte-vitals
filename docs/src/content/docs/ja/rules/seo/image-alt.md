---
title: seo/image-alt · 画像の alt テキスト
description: <img> には alt 属性を付けます。
---

**重大度:** warning

## チェック内容

`alt` 属性のない `<img>` を検出します。明示的な空の `alt=""` は、純粋な装飾画像を示す正当なシグナルなので合格とします。スプレッド（`{...rest}`）は `alt` を渡している可能性があるため検出しません。

## なぜ重要か

`alt` 属性のない `<img>` は、画像検索からも支援技術からも見えません。説明的な `alt` は画像 SEO のシグナルであり、アクセシビリティも向上させます。

## 修正方法

```svelte
<img src="/photo.jpg" width="800" height="600" alt="公園でフリスビーをキャッチするゴールデンレトリバー" />

<!-- 純粋な装飾画像の場合: -->
<img src="/divider.svg" alt="" />
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/image-alt': 'off'
  }
};
```
