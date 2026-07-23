---
title: correctness/stale-prop-derivation · Stale prop derivation
description: '$derived を使わずに prop から計算した値は一度しか評価されず、UI は気づかないうちに親の変更に追従しなくなります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`$props()` の prop から `$derived` なしで計算され、テンプレートで描画されるトップレベルの `const`/`let` を検出します:

```svelte
<script>
  let { type } = $props();

  // 検出対象 — 初回レンダリングの値で固定される
  let color = type === 'danger' ? 'red' : 'green';
</script>

<p class={color}>...</p>
```

検出は意図的に保守的にしてあり、次の条件をすべて満たすときだけ対象になります。初期化子が eager な位置で prop を参照していること（関数、アロー関数、getter の中の参照はリアクティブなままなので数えません）。初期化子が関数呼び出し、`new`、`await` を含まないこと（このため `$state(initial)` によるキャプチャ、`$derived`、サービスの構築は構造的に対象外です）。束縛が再代入も受け渡しもされないこと。そして実際にテンプレートで描画されていること（イベントハンドラーの中でしか使われない束縛は数えません）。

## なぜ重要か

Svelte のガイダンスは、props を変わるものとして扱うよう求めています。`$derived` を使わない素の代入は初期化時に一度だけ評価されるため、初回マウントでは正しく描画されますが、その後は親の変更に追従しなくなります。コンパイラも svelte-check も警告しないため、レビューをすり抜けて本番で発覚しがちな stale-UI バグです。

## 修正方法

```svelte
<script>
  let { type } = $props();

  let color = $derived(type === 'danger' ? 'red' : 'green');
</script>
```

関数本体が必要な計算には `$derived.by(() => ...)` を使ってください。一度きりのスナップショットが本当に必要な場合（非制御コンポーネントの初期値など）は、`let value = $state(initialValue)` が公式パターンで、これは検出対象になりません。

### legacy mode（`export let`）

同じバグは legacy mode のコンポーネントにも存在し、修正方法だけが異なります。Svelte は 1 つのファイル内で `export let` と `$props()` を混在できないため、このルールは両方の prop 記法を認識し、メッセージを出し分けます:

```svelte
<script>
  export let type;

  // 検出対象 — 初回レンダリングの値で固定される
  let color = type === 'danger' ? 'red' : 'green';
</script>
```

```svelte
<script>
  export let type;

  $: color = type === 'danger' ? 'red' : 'green';
</script>
```

代入の前に `$:`（リアクティブ文）を付けることが、legacy mode における `$derived` の等価物です — `type` が変わるたびに再実行されるようになり、初期化時の一度きりの評価ではなくなります。

## 制限事項

関数呼び出しを含む式を対象外とする制限のため、メソッドを使った派生（`type.toUpperCase()`、`items.filter(...)`）は v1 では検出されません。これは精度を優先した意図的なトレードオフで、将来のバージョンで純粋な組み込みメソッドが allow-list に加わる可能性があります。また、親がその prop を実際に変えるかどうかは静的には分かりません。ただ、変えない場合でも `$derived` のコストはゼロで、変更が起きても正しく動くコードになります。`correctness/unmutated-state` との関係にも注意してください。prop から計算され、一度も書き込まれない `$state` の正しい修正は、`const` ではなく `$derived` です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/stale-prop-derivation': 'off'
  }
};
```
