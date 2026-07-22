---
title: correctness/stale-prop-derivation · Stale prop derivation
description: '$derived を使わずに prop から計算した値は一度しか評価されず、UI は親の変更を静かに追跡しなくなります。'
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

検出は意図的に保守的で、次のすべてを満たすときだけ flag します。初期化子が prop を eager な位置で参照している（関数・アロー・getter の中の参照はリアクティブなままなので数えません）、関数呼び出し・`new`・`await` を含まない（`$state(initial)` キャプチャ、`$derived`、サービス構築は構造的に対象外）、束縛が再代入も受け渡しもされない、そして実際にテンプレートで描画される（イベントハンドラー内でしか使われない束縛は数えません）。

## 重要な理由

Svelte のガイダンスは「props は変わるものとして扱え」です。素の形は初期化時に一度だけ評価されるため、初回マウントでは正しく描画され、その後は親の変更を静かに追跡しなくなります。コンパイラも svelte-check も警告しないため、レビューをすり抜けて本番で発覚しがちな stale-UI バグです。

## 修正方法

```svelte
<script>
  let { type } = $props();

  let color = $derived(type === 'danger' ? 'red' : 'green');
</script>
```

関数本体が必要な計算には `$derived.by(() => ...)` を使ってください。一度きりのスナップショットが本当に欲しい場合（非制御コンポーネントの初期値）は、`let value = $state(initialValue)` が公式パターンで、これは検出対象になりません。

## 制限事項

call-free 制限により、メソッドによる派生（`type.toUpperCase()`、`items.filter(...)`）は v1 では検出されません。精度優先の意図的なトレードオフで、将来のバージョンで純粋な組み込みメソッドの allow-list を検討します。また、親がその prop を実際に変えるかどうかは静的には分かりませんが、変えない場合でも `$derived` はコストゼロで、変更に対して正しいコードになります。`correctness/unmutated-state` との関係にも注意してください。prop から計算された書き込みのない `$state` の正しい修正は `const` ではなく `$derived` です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/stale-prop-derivation': 'off'
  }
};
```
