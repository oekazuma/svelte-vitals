---
title: CORRECT006 · 孤立した $effect
description: コンポーネント初期化の外で作られた $effect はランタイムで effect_orphan エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

コンポーネント初期化の外で実行されることが確定している `$effect` / `$effect.pre` 呼び出しを検出します — これらはランタイムで Svelte の `effect_orphan` エラーを投げます:

- `.svelte.ts` / `.svelte.js` の runes モジュール、または `.svelte` の `<script module>` ブロックの**トップレベルの effect** — モジュールの import 時に実行され、どのコンポーネントの初期化コンテキストにも属しません。
- constructor で裸の `$effect`(`$effect.root` で包まれていないもの)を作るクラス(同一ファイル内で宣言)の**モジュールスコープでの `new`** — 共有状態マネージャのパターンです。検出位置は `new` の行になります。

検出対象外: 関数内の effect(ファクトリ関数・IIFE を含む)、`$effect.root(...)` コールバック内の effect、コンポーネント内でのみインスタンス化されるクラス、他ファイルから import されたクラス、クラスフィールド初期化子や static ブロック内の effect、名前のないクラス式(`const Store = class { … }`)内の effect。検出は関数境界を決して越えないため、構造上誤検出はありません — その代わりクロスファイルやファクトリ経由のケースは検出できません。

トップレベルの `if` や、コンストラクタ引数によるチェック(`constructor(persist) { if (persist) $effect(...) }`)で条件付きにガードされた effect は、そのガードが実行時に決して真にならない場合でも検出されます — ガードは静的に評価できないためです。ガードが意図的なものであれば、インラインの抑制コメント(`svelte-vitals-disable-next-line CORRECT006`)を使ってください。

## 重要な理由

Svelte コンパイラはこれらのパターンをすべて警告なしでコンパイルします — 失敗はランタイムでのみ起こります。開発中は気づかないことがあり(そのモジュールが特定のルートでしか import されない場合など)、本番ではクラッシュとして顕在化します — 典型的にはそのモジュールを import するすべてのページで 500 エラーになります。リアクティブな effect はコンポーネントの初期化中、または明示的な `$effect.root` スコープ内でしか作れません。

## 修正方法

```ts
// store.svelte.ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  constructor() {
    // ❌ ランタイムで effect_orphan — モジュールスコープにコンポーネントコンテキストはない
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

`$effect.root` でスタンドアロンのリアクティブスコープを作るか(アプリ全体と同じ寿命ならそのままで可、そうでなければ返り値のクリーンアップ関数を確実に呼ぶこと):

```ts
constructor() {
  $effect.root(() => {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  });
}
```

または effect のセットアップをコンポーネント初期化時に行うよう構造を変えます:

```ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  startPersisting() {
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

```svelte
<!-- +layout.svelte -->
<script>
  import { quizState } from '$lib/store.svelte.js';
  quizState.startPersisting();
</script>
```
