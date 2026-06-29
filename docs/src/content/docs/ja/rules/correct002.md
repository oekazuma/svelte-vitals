---
title: CORRECT002 · 状態の導出に effect を使用
description: 状態を代入するだけの $effect は $derived に置き換えるべきです。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

本体が `$state` への代入のみの `$effect` を検出します。コンポーネントのインスタンススクリプトを静的(CLI)解析します。

## なぜ重要か

`$effect` で状態を同期する(React の useEffect の習慣)とレンダリング後に実行され、余計なレンダリングパスやループを招きます。`$derived` は同じ依存関係を宣言的に表し、同期的に更新されます。

## 修正方法

```svelte
<script>
  let count = $state(0);
  // $effect(() => { double = count * 2; }); の代わりに
  let double = $derived(count * 2);
</script>
```
