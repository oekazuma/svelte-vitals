---
title: correctness/effect-as-derived · 状態の導出に effect を使用
description: 状態を代入するだけの $effect は $derived に置き換えましょう。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

コンポーネントのインスタンススクリプトで、本体が `$state` への代入のみの `$effect` を検出します。

## なぜ重要か

`$effect` で状態を同期する書き方（React の useEffect の習慣の持ち込み）は、レンダリング後に実行されるため、余計なレンダリングパスやループを招きます。`$derived` は同じ依存関係を宣言的に表します — 個別の effect 実行をスケジュールするのではなく、次に読み取られたタイミングで遅延評価されます。

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

`$derived` は hydration 中も含めて次に読まれたタイミングで再計算されますが、`$effect` はコンポーネントが DOM にマウントされた後にのみ実行されます。それがこのパターンの狙いです。この形を `$derived` に置き換えるのは `$effect` が防いでいたバグの再発なので、「修正」せず [`svelte-vitals-disable-next-line`](/ja/guides/cli#特定の指摘だけをインラインで抑制する) コメントで抑制してください。

## 既知の制限: browser global の捕捉

同じ構造的な死角は、[correctness/server-browser-global](/ja/rules/correctness/server-browser-global) と
[correctness/instance-browser-global](/ja/rules/correctness/instance-browser-global) が示している修正例
—— browser 専用の global を読んで `$state` に代入する `$effect` —— も検出してしまいます。

```svelte
<script>
  let stored = $state(null);
  $effect(() => {
    stored = localStorage.getItem('filters'); // ここで検出されるが「修正」してはいけない
  });
</script>
```

`$derived` は、その derived な値が何かに読まれた時点で初めて式を評価します —— ただ、この値は元々読まれる
ため（典型的にはテンプレートから）に存在し、テンプレートからの読み取りは SSR 中にも起こります。これを
`$derived(localStorage.getItem('filters'))` に置き換えると、サーバーサイドレンダリング中に誰かがそれを
読んだ瞬間、この2つのルールが防ごうとしている `ReferenceError: localStorage is not defined` を再発させます。
`localStorage`/`window` などは、まさに `$derived` が安全に読めない値です —— クライアント限定だと保証できる
読み取りが存在しないからです。`onMount`、あるいは `window` のプロパティなら
[`svelte/reactivity/window`](https://svelte.dev/docs/svelte/svelte-reactivity-window) を使ってください
（修正方法はこの2つのルールのドキュメントを参照）。`$derived` に切り替えるのではなく、この指摘は抑制してください。

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/effect-as-derived -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/effect-as-derived': 'off'
  }
};
```
