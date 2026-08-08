---
title: correctness/effect-as-onmount · onMount 代わりの $effect
description: reactive 値を読まない $effect は、イベントハンドラ、{@attach}、onMount のいずれかで書くべきです。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

本体が空ではないのに、このチェックから見える reactive 値を一切読まない `$effect` / `$effect.pre` を検出します。`$state`、`$derived`、`$props`、import されたバインディング、`new` で初期化されたローカル変数、store 購読のいずれもなく、裸の関数呼び出し（`foo()`）もないものです。そのような effect はマウント後に一度だけ実行され、このチェックが追跡できる範囲では再実行されません。コンポーネントのインスタンススクリプトを静的（CLI）解析します。

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

ユーザー操作への応答として実行しているなら、`$effect` よりイベントハンドラを優先してください。外部ライブラリ（チャートやツールチップなど）と要素を同期しているなら、[`{@attach ...}`](https://svelte.dev/docs/svelte/@attach) を優先してください — `$effect` や `onMount` より現在推奨されている DOM/ライブラリ同期の方法です。

## 既知の制限: 素の関数呼び出しの戻り値経由のリアクティビティ

このチェックは、rune の宣言（`$state`/`$derived`/`$props`）、import されたバインディング、`new …()` で初期化されたローカル変数など、たどれる名前を経由した reactive 読み取りを認識します — これはクラスの `$state` フィールド、`SvelteMap`/`SvelteSet`、import された runes モジュールの状態オブジェクト、`svelte/reactivity/window` をカバーします。素の関数の戻り値（`const c = createCounter()`）経由でしか到達できない reactive な値には、たどれる名前がないため、そのように書かれた本物の reactive な effect でも検出されてしまうことがあります。該当する場合は、動作しているコードを `onMount` に移すのではなく、
[`svelte-vitals-disable-next-line`](/ja/guides/cli#特定の指摘だけをインラインで抑制する) コメントで抑制してください。
