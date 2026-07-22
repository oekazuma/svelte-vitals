---
title: correctness/effect-as-onmount · onMount 代わりの $effect
description: reactive 値を読まない $effect には onMount を使います。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

空でない本体が reactive 値を一切読まない `$effect` / `$effect.pre` を検出します。`$state`、`$derived`、`$props` の参照、store 購読、裸の関数呼び出し（`foo()`）のいずれもないものです。そのような effect はマウント後に一度だけ実行され、再実行されません。コンポーネントの instance スクリプトを静的（CLI）解析します。

## なぜ重要か

何にも反応しない `$effect` は実質 `onMount` です。`$effect` を使うとその意図が曖昧になり、リアクティビティの仕組みを誤用します。`onMount` なら「マウント時に一度だけ実行する」ことを直接表現できます。

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
