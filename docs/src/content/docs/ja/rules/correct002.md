---
title: CORRECT002 · 状態の導出に effect を使用
description: 状態を代入するだけの $effect は $derived に置き換えるべきです。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

本体が `$state` への代入のみの `$effect` を検出します。コンポーネントのインスタンススクリプトを静的（CLI）解析します。

## なぜ重要か

`$effect` で状態を同期する（React の useEffect の習慣）とレンダリング後に実行され、余計なレンダリングパスやループを招きます。`$derived` は同じ依存関係を宣言的に表し、同期的に更新されます。

## 修正方法

```svelte
<script>
  let count = $state(0);
  // $effect(() => { double = count * 2; }); の代わりに
  let double = $derived(count * 2);
</script>
```

## 既知の制限: mount フラグ / hydration ガードとしての effect

このチェックは「effect の本体が `$state` への代入だけか」という構造的な判定であり、意味的な判定ではありません。そのため、本来の「導出すべき値を effect に書いてしまう」アンチパターンと、SSR/プリレンダー時と hydration 後の不一致を防ぐための「mount signal」イディオムを区別できません。

```svelte
<script>
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });
  // SSR/プリレンダー時とクライアントの最初のレンダリングでは false のままである必要があります。
  // そうしないと hydration 不一致が起きます。$derived(canVibrate()) は hydration 中に
  // 即座に評価されてしまい、この $effect が防ごうとしているまさにそのちらつきを再発させます。
  const showVibrationToggle = $derived(mounted && canVibrate());
</script>
```

`$derived` は hydration 中も含めて即座に評価されますが、`$effect` は mount の1ティック後に実行されます。それこそがこのパターンの狙いです。この形を `$derived` に置き換えるのは単なるスタイルの好みではなく、`$effect` が防ごうとしていたバグを再発させてしまいます。検出された箇所がこのパターンである場合は「修正」せず、代わりに [`svelte-vitals-disable-next-line`](/svelte-vitals/ja/guides/cli/#特定の指摘だけをインラインで抑制する) コメントで抑制してください。
