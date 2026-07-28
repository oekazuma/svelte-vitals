---
title: correctness/effect-as-onmount · onMount 代わりの $effect
description: リアクティブな値を読まない $effect は、onMount で十分です。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

本体が空ではないのに reactive 値を一切読まない `$effect` / `$effect.pre` を検出します。`$state`、`$derived`、`$props` の参照、store 購読、裸の関数呼び出し（`foo()`）のいずれもないものです。そのような effect はマウント後に一度だけ実行され、再実行されません。コンポーネントのインスタンススクリプトを静的（CLI）解析します。

## なぜ重要か

何にも反応しない `$effect` は実質 `onMount` です。`$effect` で書くとその意図が読み取りにくくなるうえ、リアクティビティの仕組みの誤用でもあります。`onMount` なら「マウント時に一度だけ実行する」という意図をそのまま表現できます。

## 修正方法

```svelte
<script>
  import { onMount } from 'svelte';
  // $effect(() => { element.focus(); }); の代わりに
  onMount(() => {
    element.focus();
  });
</script>
```
