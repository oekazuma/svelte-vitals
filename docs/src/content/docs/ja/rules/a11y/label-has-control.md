---
title: a11y/label-has-control · <label> has no associated control
description: label をフィールドと関連付けるには for 属性かラップされたコントロールが必要です。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

関連付けられたコントロールを持たない `<label>` を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

次のいずれかが存在すれば関連付けありとみなし、検出しません。

- `for` 属性 — リテラルまたは式（値は静的にはわからなくても、属性が存在すること自体で十分とみなします）。
- ラップされたラベル付け可能な子孫: `input`（リテラルな `type` が `hidden` の場合を除く）、`select`、`textarea`、`button`、`meter`、`output`、`progress`。

関連付けが見つからない場合でも、内容が静的に判断できない label は検出しません — `{式}` の子、コンポーネントの子、`{@render …}`、`{@html …}` です。このルールは「関連付けがないと証明できる」ものだけを検出し、動的な内容を推測することはありません。

```svelte
<label>Name</label>
```

## なぜ重要か

関連付けられたコントロールを持たない `<label>` は、支援技術からはフォームラベルではなくただのテキストとして扱われます — スクリーンリーダーは label とそれが指すフィールドの関係を読み上げられません。晴眼ユーザーも label が見た目で約束しているクリックでのフォーカス移動を失いますが、この問題は見た目のレビューでは気づきにくいものです。

## 修正方法

`for` にコントロールの `id` を指定するか、コントロールを `<label>` でラップします:

```svelte
<label for="name">Name</label>
<input id="name" />

<label>Name <input /></label>
```

## 無効化

このルールからは見えない別の方法（コントロール側の `aria-labelledby` など）で関連付けている場合は、`<!-- svelte-vitals-disable-next-line a11y/label-has-control -->` で個別の要素を抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/label-has-control': 'off'
  }
};
```
