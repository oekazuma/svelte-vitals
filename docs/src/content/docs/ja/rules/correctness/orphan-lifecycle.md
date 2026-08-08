---
title: correctness/orphan-lifecycle · コンポーネント初期化外での lifecycle 呼び出し
description: onMount や getContext などをコンポーネント初期化の外で呼ぶと、ランタイムで lifecycle_outside_component エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

Svelte の lifecycle / context 関数（`onMount`、`onDestroy`、`beforeUpdate`、`afterUpdate`、`createEventDispatcher`、`getContext`、`setContext`、`hasContext`、`getAllContexts`。`svelte` からの value import が対象で、エイリアスと namespace import も追跡します）のうち、コンポーネント初期化の外での実行が確定している呼び出しを検出します:

- `.svelte.ts`/`.svelte.js` runes モジュールや `.svelte` の `<script module>` ブロックの**モジュールスコープ**
- **モジュールスコープでインスタンス化されるクラスの constructor** 内（同一ファイル）
- SvelteKit の **`load` 関数、form action、エンドポイント/フック handler、`init` フック内、またはそれらのファイルのトップレベル**（典型は `load` 内での `getContext`）

検出対象外:

- 通常の関数内の呼び出し（コンポーネントが初期化中に呼べば合法）。
- `createContext()`。モジュールスコープでの作成が新 context API の公式パターンです。
- context を要求しない svelte export（`mount`、`tick` など）、他モジュールからの同名 import、ファクトリ関数/IIFE/クロスファイルクラス、`svelte/legacy` の `createBubbler`。

load/handler/`init` の本体の**内側で定義された関数**は、そこで実行されるものとして扱い検出します。意図的にそのクロージャを返してコンポーネント側の初期化中に呼ばせる場合は `svelte-vitals-disable-next-line correctness/orphan-lifecycle` で抑制してください。

## なぜ重要か

これらの関数はアクティブなコンポーネントコンテキストを必要とします。`getContext`/`setContext`/`hasContext`/`getAllContexts` は、ない状態で呼ぶとあらゆる環境でランタイムに `lifecycle_outside_component` エラーになります。コンパイラはどのパターンも警告なしでコンパイルするため、コードパスが実行されて初めて顕在化します（`load` 内なら、そのルートへの全アクセスが 500 に）。

`onMount`/`beforeUpdate`/`afterUpdate`/`createEventDispatcher` はブラウザでは同じエラーを throw します。しかしサーバーでしか実行されない Kit モジュール（`+page.server.ts`、`+server.ts`、`hooks.server.ts`）ではブラウザに到達すること自体がないため、呼び出しは何もしない no-op になります — クラッシュせず、何も起きません。`onDestroy` だけはそこでも例外で、自前のコンポーネントコンテキストガードを持たないため、呼び出せば依然としてクラッシュしますが、`lifecycle_outside_component` ではなく素の `TypeError` になります（`load`/handler 内なら、そのルートへの全リクエストで 500 になる点は変わりません）。`+page.ts`/`+layout.ts` の universal モジュールやコンポーネント内のコードでは、同じコードがブラウザでも実行されるため、9つすべてが `lifecycle_outside_component` を throw します。

## 修正方法

```ts
// +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component(load はコンポーネント初期化ではない)

  return { user: await (await fetch('/api/user')).json() }; // ✅ 代わりにデータを返す
}
```

呼び出しをコンポーネント初期化へ移します:

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ コンポーネント初期化中(合法)
</script>
```

共有モジュールでは、モジュールスコープで lifecycle を呼ぶ代わりに、コンポーネントが初期化時に呼ぶ setup 関数として公開してください。
