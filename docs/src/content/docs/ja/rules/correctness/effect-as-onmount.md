---
title: correctness/effect-as-onmount · onMount 代わりの $effect
description: reactive 値を読まない $effect は、イベントハンドラ、{@attach}、onMount のいずれかで書くべきです。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

本体が空ではないのに、このチェックから見える reactive 値を一切読まない `$effect` / `$effect.pre` を検出します。`$state`、`$derived`、`$props`、import されたバインディング、`new …()` を初期化子として宣言されたローカル変数、store 購読のいずれもなく、裸の関数呼び出し（`foo()`）もないものです。そのような effect はマウント後に一度だけ実行され、このチェックが追跡できる範囲では再実行されません。

## なぜ重要か

何にも反応しない `$effect` は、多くの場合イベントハンドラ、`{@attach}`、`onMount` の代わりとして遠回りなだけです。`$effect` で書くとその意図が読み取りにくくなるうえ、リアクティビティの仕組みの誤用でもあります。

## 修正方法

```svelte
<script>
  import { onMount } from 'svelte';
  // $effect(() => { element.focus(); }); の代わりに
  onMount(() => {
    element.focus();
  });
</script>
```

ユーザー操作への応答として実行しているなら、`$effect` よりイベントハンドラを優先してください。外部ライブラリ（チャートやツールチップなど）と要素を同期しているなら、[`{@attach ...}`](https://svelte.dev/docs/svelte/@attach)（5.29 以降）を優先してください — `$effect` や `onMount` より現在推奨されている DOM/ライブラリ同期の方法です。

## 既知の制限

このチェックは、rune の宣言（`$state`/`$derived`/`$props`）、import されたバインディング、`new …()` を初期化子として宣言されたローカル変数（`const x = new Foo()`）など、たどれる名前を経由した reactive 読み取りを認識します — これはクラスの `$state` フィールド、`SvelteMap`/`SvelteSet`、import された runes モジュールの状態オブジェクト、`svelte/reactivity/window` をカバーします。以下の2つの形はたどれる名前がないため、そのように書かれた本物の reactive な effect でも検出されてしまうことがあります:

- 素の関数の戻り値（`const c = createCounter()`）経由でしか到達できない reactive な値。
- 宣言時ではなく宣言後に `new …()` を代入したローカル変数（`let m; m = new SvelteMap();`）— 初期化子として宣言された形のみ認識されます。

名前の照合は字句スコープではなく識別子のテキストで行われます —— これは rune 名に対してこのルールが元々使っている粒度と同じです。そのため、import または `new` で宣言された名前をシャドーするコールバックローカルな binding（例えば同じ名前を再利用するパラメータ）も reactive として扱われます。これは指摘を見逃す方向にしか働かず、誤って検出することはありません。

該当する場合は、動作しているコードを `onMount` に移すのではなく、
[`svelte-vitals-disable-next-line`](/ja/guides/cli#特定の指摘だけをインラインで抑制する) コメントで抑制してください。

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/effect-as-onmount -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/effect-as-onmount': 'off'
  }
};
```
