---
title: CORRECT007 · コンポーネント初期化外での lifecycle 呼び出し
description: onMount や getContext などをコンポーネント初期化の外で呼ぶと、ランタイムで lifecycle_outside_component エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

Svelte の lifecycle / context 関数(`onMount`、`onDestroy`、`beforeUpdate`、`afterUpdate`、`createEventDispatcher`、`getContext`、`setContext`、`hasContext`、`getAllContexts` — `svelte` からの value import が対象で、エイリアスと namespace import も追跡)の、コンポーネント初期化外での実行が確定している呼び出しを検出します:

- `.svelte.ts`/`.svelte.js` runes モジュールや `.svelte` の `<script module>` ブロックの**モジュールスコープ**
- **モジュールスコープでインスタンス化されるクラスの constructor** 内(同一ファイル)
- SvelteKit の **`load` 関数・form action・エンドポイント/フック handler・`init` フック内、またはそれらのファイルのトップレベル** — 典型は `load` 内での `getContext`

検出対象外: 通常の関数内の呼び出し(コンポーネントが初期化中に呼べば合法)、`createContext()`(モジュールスコープでの作成が新 context API の公式パターン)、context を要求しない svelte export(`mount`、`tick` など)、他モジュールからの同名 import、ファクトリ関数/IIFE/クロスファイルクラス、`svelte/legacy` の `createBubbler`。load/handler/`init` の本体の**内側で定義された関数**もそこで実行されるものとして扱われ、フラグを継承します — そのようなクロージャを意図的に返してコンポーネント側の初期化中に呼び出させる場合は、インラインで抑制してください(`svelte-vitals-disable-next-line CORRECT007`)。

## 重要な理由

これらの関数はアクティブなコンポーネントコンテキストを必要とします。ない状態で呼ぶとランタイムで `lifecycle_outside_component` エラーになります — コンパイラはどのパターンも警告なしでコンパイルするため、コードパスが実行されて初めて顕在化し、典型的には本番クラッシュになります(`load` 内なら、そのルートへの全アクセスが 500 に)。

## 修正方法

```ts
// +page.ts
import { getContext } from 'svelte';

export async function load({ fetch }) {
  const user = getContext('user'); // ❌ lifecycle_outside_component — load はコンポーネント初期化ではない

  return { user: await (await fetch('/api/user')).json() }; // ✅ 代わりにデータを返す
}
```

呼び出しをコンポーネント初期化へ移します:

```svelte
<!-- +page.svelte -->
<script>
  import { setContext } from 'svelte';

  let { data } = $props();
  setContext('user', () => data.user); // ✅ コンポーネント初期化中 — 合法
</script>
```

共有モジュールでは、モジュールスコープで lifecycle を呼ぶ代わりに、コンポーネントが初期化時に呼ぶ setup 関数として公開してください。
