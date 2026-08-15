---
title: correctness/server-browser-global · サーバー実行モジュールコードでの browser global
description: モジュールスコープや load・ハンドラで window や document、localStorage を参照すると、SSR が ReferenceError で落ちます。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

**必ずサーバーで実行されるコード**での browser 専用 global（`window`、`document`、`localStorage`、`sessionStorage`、`navigator`、`location`、`history`、`screen`、`matchMedia`、`requestAnimationFrame`、`cancelAnimationFrame`、`IntersectionObserver`、`ResizeObserver`、`MutationObserver`、`alert`、`confirm`、`prompt`）の読み取りを検出します:

- `.svelte.ts`/`.svelte.js` runes モジュールや `.svelte` の `<script module>` ブロックの**モジュールスコープ**（サーバーで import された瞬間にクラッシュ）
- **SvelteKit のルート/フックファイル**：トップレベル、`load`/action/エンドポイント handler 本体、`init` フック（import 時またはリクエストごとにクラッシュ）

検出対象外:

- `$app/environment` の `browser`（エイリアス込み）や `typeof window !== 'undefined'` でガードされたコード（early-return ガードを含む）。
- `onMount`/`$effect`/通常の関数内。モジュール評価時には実行されません。
- 裸の `typeof window`（throw しない）。
- 自分で import/宣言した名前（`const document = …`）。
- handler 内にネストしたクロージャ（典型的にはクライアント側コールバック）。
- 自身が `ssr = false` を export するファイル。

## なぜ重要か

これらの global は Node に存在しません。モジュールスコープの `window` 参照はファイルがサーバーで import された瞬間に、`load` 内なら SSR リクエストのたびにクラッシュします。`ReferenceError: window is not defined` という、コンパイラが一切警告しない本番 500 です。

## 修正方法

```ts +page.ts
export function load() {
  const stored = localStorage.getItem('filters'); // ❌ サーバーで ReferenceError

  return {};
}
```

ブラウザアクセスをクライアント側、`onMount` の中へ移します — `onMount` はサーバーでは実行されません:

```svelte +page.svelte
<script>
  import { onMount } from 'svelte';

  let stored = $state(null);
  onMount(() => {
    stored = localStorage.getItem('filters'); // ✅ onMount はサーバーでは実行されない
  });
</script>
```

または明示的にガードします:

```ts
import { browser } from '$app/environment';

const stored = browser ? localStorage.getItem('filters') : null; // ✅
```

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/server-browser-global -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/server-browser-global': 'off'
  }
};
```
