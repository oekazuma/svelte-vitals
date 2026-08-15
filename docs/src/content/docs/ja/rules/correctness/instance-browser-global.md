---
title: correctness/instance-browser-global · コンポーネント初期化中の browser global
description: インスタンススクリプトは SSR 時にサーバーでも実行されるため、トップレベルで window や document を参照するとレンダリングが落ちます。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

**コンポーネントの `<script>` トップレベル**での browser 専用 global（[correctness/server-browser-global](/ja/rules/correctness/server-browser-global) と同じリスト）の読み取りを検出します。このコードはコンポーネントの SSR レンダリングのたびにサーバーで実行されます。ガードの扱いも同じです: `$app/environment` の `browser`、`typeof` チェック（early-return ガードを含む）、`onMount`/`$effect` 本体、自前の binding、シャドーされたローカルは検出されません。

## なぜ重要か

コンポーネント冒頭の `const width = window.innerWidth;` はブラウザ上とクライアント専用の開発フローでは動きますが、最初の SSR レンダリングで `ReferenceError: window is not defined` になります。

これが critical ではなく **warning** なのは、親の `{#if browser}` の内側でのみレンダリングされる（またはクライアントで動的 import される）コンポーネントは、そもそもサーバーで実行されることがなく、それ自体は正当な作りだからです。ただし、そのことはコンポーネントファイル単体からは証明できません。該当する場合は対象行の直前に `// svelte-vitals-disable-next-line correctness/instance-browser-global` を書いてください。

`$props()` の分割代入デフォルト値としてのみ使われる browser global（`let { width = window.innerWidth } = $props()`）も検出されません。デフォルト値は prop が渡されなかった場合にのみ評価され、その評価は SSR 時にも起こり得ますが、スキャナーは分割代入のデフォルト値を走査しません。ガードによる除外ではなく、静かな見逃し（conservative miss）です。

## 修正方法

```svelte
<script>
  const width = window.innerWidth; // ❌ SSR がクラッシュ
</script>
```

`window` のプロパティなら、[`svelte/reactivity/window`](https://svelte.dev/docs/svelte/svelte-reactivity-window)（5.11.0 以降）が現在推奨される形です — ガード不要で、サーバーでは `undefined`、クライアントではリアクティブになります:

```svelte
<script>
  import { innerWidth } from 'svelte/reactivity/window';
</script>

<p>{innerWidth.current}</p>
```

`svelte/reactivity/window` がカバーしない場合は、`onMount` の中で読んでください — `onMount` はサーバーでは実行されません:

```svelte
<script>
  import { onMount } from 'svelte';

  let width2 = $state(0);
  onMount(() => {
    width2 = window.innerWidth; // ✅ onMount はサーバーでは実行されない
  });
</script>
```

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/instance-browser-global -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/instance-browser-global': 'off'
  }
};
```
