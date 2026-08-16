---
title: a11y/interactive-nesting · Interactive element nested in an interactive element
description: インタラクティブな要素を、別のインタラクティブな要素の内側に置いてはいけません。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

インタラクティブな要素（`<button>`、`<input>`、リテラルなインタラクティブ `role` など）が、別のインタラクティブなコンテナの内側にネストされている場合を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

このルールが「コンテナ」として監視するのは、次の 3 種類の要素だけです。

- `<a href="…">` — `href` のない `<a>` はコンテナとみなしません。
- `<button>`。
- 子孫をユーザーエージェントが一切公開しないリテラルなロールを持つ要素 — `button`、`link`、`checkbox`、`radio`、`switch`、`tab`、`menuitemcheckbox`、`menuitemradio`、`option`、`slider`、`scrollbar`。自前のコントロールを含むのが正しいロールはコンテナ**ではありません**: `role="gridcell"` がボタンを含むのは grid パターンの標準形ですし、ARIA 1.1 の `role="combobox"` は自身の `<input>` を囲む形です。

これらのコンテナが開いている間にインタラクティブな要素が現れると検出されます。例:

```svelte
<a href="/x">
  <button>Go</button>
</a>
```

検出しないもの:

- `tabindex="-1"` を持つ子孫 — タブ順から外れており、キーボードフォーカスを奪い合いません。
- `href` のない `<a>` の子孫 — `href` を持たない `<a>` はそれ自体インタラクティブではありません。
- コンポーネントをまたいだネスト（例: `<a href>` の内側にレンダリングされる子コンポーネントの中の `<button>`） — このルールは 1 つのコンポーネント自身のテンプレートしか見ないため、この変種は既知の非対応事項です。

## なぜ重要か

キーボードや支援技術のユーザーは、DOM 上の位置ではなくコントロール単位で操作します。あるコントロールが別のコントロールの内側にネストされていると、キーボードから到達できなくなる（外側の要素がクリックや `Enter` を先に消費してしまい、内側の要素には決して順番が回ってこない）か、スクリーンリーダーに誤ってアナウンスされます。しかもどちらが勝つかはブラウザによって挙動が割れます。これは HTML のコンテンツモデルにも反しています — インタラクティブなコンテンツカテゴリは、他のインタラクティブなコンテンツを含むことを許されていません。

## 修正方法

各インタラクティブなコントロールが、互いに子孫ではなく兄弟になるようマークアップを組み直します:

```svelte
<div>
  <a href="/x">Go to x</a>
  <button>Extra action</button>
</div>
```

## 無効化

ネストが意図的で、別の方法（`pointer-events` と合成フォーカストラップなど）で対処済みの場合は、`<!-- svelte-vitals-disable-next-line a11y/interactive-nesting -->` で個別の要素を抑制するか、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/interactive-nesting': 'off'
  }
};
```
