---
title: correctness/orphan-effect · 孤立した $effect
description: コンポーネント初期化の外で作られた $effect はランタイムで effect_orphan エラーになります。
---

**重大度:** critical · **カテゴリ:** correctness

## チェック内容

コンポーネント初期化の外で実行されることが確定している `$effect` / `$effect.pre` 呼び出しを検出します。これらはランタイムで Svelte の `effect_orphan` エラーを投げます:

- `.svelte.ts` / `.svelte.js` の runes モジュール、または `.svelte` の `<script module>` ブロックの**トップレベルの effect**。モジュールの import 時に実行され、どのコンポーネントの初期化コンテキストにも属しません。
- 同一ファイル内で宣言されたクラスの**モジュールスコープでの `new`** で、そのクラスの constructor が裸の `$effect`（`$effect.root` で包まれていないもの）を作るもの。共有状態マネージャのパターンです。検出位置は `new` の行になります。

検出対象外: 関数内（ファクトリ関数や IIFE を含む）、`$effect.root(...)` コールバック内、クラスフィールド初期化子や static ブロック内、名前のないクラス式（`const Store = class { … }`）内の effect。コンポーネント内でのみインスタンス化されるクラスと、他ファイルから import されたクラスも対象外です。

検出は関数境界を越えないため、ネストした関数をモジュール評価と取り違えることはありません。その代わりクロスファイルやファクトリ経由のケースは検出できません。なお、実行時に真にならないガードで囲まれた effect は依然として報告されます。ガードは静的に評価できないためです。

トップレベルの `if` や constructor 引数によるチェック（`constructor(persist) { if (persist) $effect(...) }`）でガードされた effect も、そのガードが実行時に真にならない場合でも検出されます。ガードは静的に評価できないためです。意図的なガードであれば `svelte-vitals-disable-next-line correctness/orphan-effect` で抑制してください。

## なぜ重要か

コンパイラはこれらをすべて警告なしで通し、失敗はランタイムでのみ起こります。サーバー側コンパイラは `$effect`/`$effect.pre` 呼び出しを丸ごと削除する（何も出力しない）ため、サーバーサイドレンダリングはエラーなく完了します — サーバーの 500 エラーにはなりません。クラッシュはクライアント側で、モジュールがブラウザで評価されるタイミング（典型的にはハイドレーション時）に起こります。サーバーレンダリングは成功したのに、その直後にクライアント JS が実行された瞬間に壊れる、という形です。開発中は特定のルートでしか import されない場合など気づかないことがあります。

リアクティブな effect は、コンポーネントの初期化中か明示的な `$effect.root` スコープ内でしか作れません。

## 修正方法

```ts
// store.svelte.ts
class QuizStateManager {
  bookmarks = $state<string[]>([]);
  constructor() {
    // ❌ ランタイムで effect_orphan(モジュールスコープにコンポーネントコンテキストはない)
    $effect(() => {
      saveToStorage(this.bookmarks);
    });
  }
}
export const quizState = new QuizStateManager();
```

`$effect.root` でスタンドアロンのリアクティブスコープを作るか（effect がアプリ全体と同じ寿命でよいならそのままで構いません。そうでなければ、返り値のクリーンアップ関数を確実に呼んでください）:

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

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/orphan-effect -->` を置きます。ルールごと無効化するには:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/orphan-effect': 'off'
  }
};
```
