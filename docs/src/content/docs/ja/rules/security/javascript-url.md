---
title: 'security/javascript-url · javascript: URL'
description: '属性に javascript: URL を使わないでください。'
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

要素の属性（`href` / `src` / `action` / `formaction`）で、リテラル値が `javascript:` で始まるものを検出します。動的な値は検査しません。

## なぜ重要か

`javascript:` URL は、厳格な Content-Security-Policy の下では動作せず、本来なら実際のページ遷移になるはずの操作を、有効化された瞬間のインラインスクリプト実行にすり替えてしまいます —— `<button>` にイベントハンドラを付ける方法を使ってください(同じ形は典型的な XSS の入り口にもなりますが、この検出はリテラル値のみを対象とするため、検出されるものはすべて注入されたものではなく作者自身が書いた URL です)。

## 修正方法

イベントハンドラや実際の URL を使います。

```svelte
<!-- <a href="javascript:doThing()"> の代わりに -->
<button type="button" onclick={doThing}>実行</button>
```

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line security/javascript-url -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'security/javascript-url': 'off'
  }
};
```
