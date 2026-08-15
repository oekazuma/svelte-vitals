---
title: a11y/accessible-name · Interactive element has no accessible name
description: ボタン・リンク・画像ボタンには、アクセシブルネームを算出できる手がかりが必要です。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`<button>`、`<a href="…">`、`<input type="image">` のうち、アクセシブルネームを算出できないものを検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

次のいずれかが存在すれば名前の手がかりとみなし、検出しません。

- 空白以外のテキストを含む子孫、例: `<button>Save</button>`。
- `aria-label`、`aria-labelledby`、`title` 属性 — リテラルで空でない値、または式（レンダリング結果は静的にはわからなくても、属性が存在すること自体で十分とみなします）。
- 非空のリテラル `alt` を持つ子孫 `<img>`。
- `<input type="image">` 自身の非空のリテラル `alt`。

名前の手がかりが見つからない場合でも、内容が静的に判断できない要素は検出しません — `{式}` の子、コンポーネントの子、`{@render …}`、`{@html …}`、あるいは要素自身へのスプレッド属性です。このルールは「名前がないと証明できる」ものだけを検出し、動的な内容を推測することはありません。

```svelte
<button></button>
<a href="/x"><img src="i.png" /></a>
```

## なぜ重要か

支援技術はインタラクティブなコントロールをアクセシブルネームで読み上げます。名前がないと、スクリーンリーダーは「ボタン」「リンク」といった素のロールにフォールバックし、ページ上の他の無名コントロールと区別がつかなくなります。アイコンだけに頼っている晴眼ユーザーにはこのギャップが見えないため、問題は見た目のレビューでは見つかりません。

## 修正方法

要素に可視テキスト、ラベル付け用の属性、あるいはアイコン画像への `alt` を与えます:

```svelte
<button aria-label="Save">💾</button>
<a href="/x"><img src="i.png" alt="Home" /></a>
<input type="image" src="search.png" alt="Search" />
```

## 無効化

このルールからは見えない別の方法（ラップしている label 要素など）で名前を与えている場合は、`<!-- svelte-vitals-disable-next-line a11y/accessible-name -->` で個別の要素を抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/accessible-name': 'off'
  }
};
```
