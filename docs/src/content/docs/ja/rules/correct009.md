---
title: CORRECT009 · コンポーネント初期化中の browser global
description: コンポーネントの instance script は SSR 時にサーバーで実行されます — トップレベルの window/document 参照はレンダリングをクラッシュさせます。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

**コンポーネントの `<script>` トップレベル**での browser 専用 global([CORRECT008](/svelte-vitals/rules/correct008) と同じリスト)の読み取りを検出します — このコードはコンポーネントの SSR レンダリングのたびにサーバーで実行されます。ガードの扱いも同じです: `$app/environment` の `browser`、`typeof` チェック、`onMount`/`$effect` 本体、自前の binding、シャドーされたローカルは検出されません。

## 重要な理由

コンポーネント冒頭の `const width = window.innerWidth;` はブラウザ上とクライアント専用の開発フローでは動きますが、最初の SSR レンダリングで `ReferenceError: window is not defined` になります。

これが critical ではなく **warning** なのは、親の `{#if browser}` の内側でのみレンダリングされる(またはクライアントで動的 import される)コンポーネントは正当にサーバーで実行されないためです — これはコンポーネントファイル単体からは証明できません。該当する場合は対象行の直前に `// svelte-vitals-disable-next-line CORRECT009` を書いてください。

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
