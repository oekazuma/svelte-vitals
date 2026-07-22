---
title: 'security/javascript-url · javascript: URL'
description: '属性に javascript: URL を使わないでください。'
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

要素の属性（`href` / `src` / `action` / `formaction`）で、リテラル値が `javascript:` で始まるものを検出します。動的な値は検査しません。

## なぜ重要か

`javascript:` URL は、クリックなどで有効化された瞬間に任意のスクリプトを実行します。XSS や安全でない遷移の入り口になるうえ、厳格な Content-Security-Policy の下では動作もしません。

## 修正方法

イベントハンドラや実際の URL を使います。

```svelte
<!-- <a href="javascript:doThing()"> の代わりに -->
<button type="button" onclick={doThing}>実行</button>
```
