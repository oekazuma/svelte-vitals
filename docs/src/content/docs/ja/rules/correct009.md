---
title: CORRECT009 · コンポーネント初期化中の browser global
description: コンポーネントの instance script は SSR 時にサーバーで実行されます。トップレベルの window/document 参照はレンダリングをクラッシュさせます。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

**コンポーネントの `<script>` トップレベル**での browser 専用 global([CORRECT008](/svelte-vitals/ja/rules/correct008) と同じリスト)の読み取りを検出します。このコードはコンポーネントの SSR レンダリングのたびにサーバーで実行されます。ガードの扱いも同じです: `$app/environment` の `browser`、`typeof` チェック(early-return ガードを含む)、`onMount`/`$effect` 本体、自前の binding、シャドーされたローカルは検出されません。

## なぜ重要か

コンポーネント冒頭の `const width = window.innerWidth;` はブラウザ上とクライアント専用の開発フローでは動きますが、最初の SSR レンダリングで `ReferenceError: window is not defined` になります。

これが critical ではなく **warning** なのは、親の `{#if browser}` の内側でのみレンダリングされる(またはクライアントで動的 import される)コンポーネントは正当にサーバーで実行されないためです。これはコンポーネントファイル単体からは証明できません。該当する場合は対象行の直前に `// svelte-vitals-disable-next-line CORRECT009` を書いてください。

`$props()` の分割代入デフォルト値としてのみ使われる browser global(`let { width = window.innerWidth } = $props()`)も検出されません。デフォルト値は prop が渡されなかった場合にのみ評価され、それは SSR 時も含まれますが、スキャナーは分割代入のデフォルト値を走査しません。これはガードではなく、静かな見逃し(conservative miss)です。

## 修正方法

```svelte
<script>
  const width = window.innerWidth; // ❌ SSR がクラッシュ

  let width2 = $state(0);
  $effect(() => {
    width2 = window.innerWidth; // ✅ クライアント専用
  });
</script>
```
