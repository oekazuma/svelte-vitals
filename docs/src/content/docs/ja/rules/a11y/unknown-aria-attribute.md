---
title: a11y/unknown-aria-attribute · Unknown ARIA attribute
description: aria-* 属性には、タイポではない実在の WAI-ARIA 属性名を指定します。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`aria-*` 属性の名前が WAI-ARIA 仕様で定義されていない場合を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

チェックするのは属性の _名前_ のみで、値は対象外です（実在する属性の不正な値は `a11y/invalid-aria-value` が扱います）。そのため、名前が未知であればリテラル値でも動的な式でも同じように検出されます。

- `aria-lable="x"` — 検出される。名前のスペルミス。
- `aria-lable={x}` — 検出される。同じスペルミスで、値が動的。

検出しないもの:

- 仕様で定義された属性: `aria-label="x"`。
- 値が動的な、仕様で定義された属性: `aria-hidden={isHidden}`。

## なぜ重要か

支援技術は WAI-ARIA 仕様が定義する固定の `aria-*` 属性しか認識しません。未知の名前 — たいていは `aria-label` を `aria-lable` と書くようなタイポ — はブラウザやスクリーンリーダーがエラーとして報告できるものではなく、単に無視されます。意図した読み上げは行われないまま、見た目には何の異常もありません。

## 修正方法

正しいスペルの、仕様で定義された属性を使います:

```svelte
<button aria-label="Close">×</button>
```

## 無効化

意図的に非標準な属性を使う場合は、`<!-- svelte-vitals-disable-next-line a11y/unknown-aria-attribute -->` で個別の要素を抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/unknown-aria-attribute': 'off'
  }
};
```
