---
title: a11y/require-datetime · Missing datetime attribute
description: time 要素のテキストは機械可読であるか、datetime 属性で機械可読な値を補う必要があります。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`datetime` 属性を持たない `<time>` 要素について、そのリテラルなテキスト内容自体が機械可読でない場合を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

テキストが次のいずれかの HTML の日時形式に一致すれば機械可読とみなします: 年/月/日（`2026-08-14`）、時刻（`14:30`）、日時（`2026-08-14T14:30`）、年なしの日付（`08-14`）、期間（`P3D`）。

検出しないもの:

- 何らかの形（リテラルでも式でも）の `datetime` 属性: `<time datetime="2026-08-14">Aug 14</time>`
- すでに機械可読なリテラルテキスト: `<time>2026-08-14</time>`
- 純粋なテキストではない内容 — `{式}`、コンポーネント、ブロックなど（描画結果のテキストが静的にはわからないため）: `<time>{d}</time>`

```svelte
<time>last Tuesday</time>
```

## なぜ重要か

`datetime` 属性を持たない `<time>` は、テキスト内容だけが唯一の機械可読な値になります。「先週の火曜日」のようなテキストは、支援技術やブラウザ、検索エンジンが実際の日付として解釈できません。目の見えるユーザーには自明な意味が、それ以外には失われてしまいます。

## 修正方法

機械可読な値を持つ `datetime` 属性を追加します:

```svelte
<time datetime="2026-08-14">last Tuesday</time>
```

## 無効化

テキストが意図的に機械可読でない場合は、`<!-- svelte-vitals-disable-next-line a11y/require-datetime -->` で個別の要素を抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/require-datetime': 'off'
  }
};
```
