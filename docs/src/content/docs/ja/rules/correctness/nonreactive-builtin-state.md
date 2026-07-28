---
title: correctness/nonreactive-builtin-state · Non-reactive built-in in $state
description: $state に入れた素の Map・Set・Date・URL・URLSearchParams はプロキシされないため、中身を変えても検知されず、気づかないうちに UI が更新されなくなります。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

素の組み込みクラス（`Map`・`Set`・`Date`・`URL`・`URLSearchParams`）をそのまま `$state` に入れたトップレベルの変数のうち、関数内またはテンプレートのハンドラー内でそのインスタンスに変更を加えているものを検出します:

```svelte
<script>
  let tags = $state(new Set());

  function toggle(tag) {
    tags.add(tag); // 検出対象 — この変更は追跡されない
  }
</script>

{#each [...tags] as tag}<span>{tag}</span>{/each}
```

検出条件はあえて絞り込んであります。対象になるのは型ごとの変更操作だけで（`map.set`、`set.add`、`date.setHours`、`params.append`、`url.href = …`、`url.searchParams.set(…)` など）、読み取りメソッドには反応しません。変更後に新しいインスタンスを再代入するコード（`tags = new Set(tags)`）は正しく動くため検出しません。ただし `tags = tags` のような単純な自己代入は、Svelte 5 では何も起こさないため検出対象のままです。スクリプトのトップレベルで行う変更も、初回描画の前に一度実行されるだけなので検出しません。

## なぜ重要か

`$state` がプロキシ化するのは素のオブジェクトと配列だけです。素の組み込みインスタンスでもデータ操作そのものは問題なく動きます（`set` も `add` も成功します）が、その変更はリアクティビティに一切伝わりません。effect は再実行されず、derived は再計算されず、テンプレートには古い内容が表示されたままになります。初回の描画は正しく行われるため、本番環境で気づかないうちに UI が更新されなくなるのです。コンパイラも svelte-check も警告してくれません。Svelte が `svelte/reactivity` を提供しているのは、まさにこのためです。

## 修正方法

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = $state(new SvelteSet());
</script>
```

`SvelteMap`・`SvelteSet`・`SvelteDate`・`SvelteURL`・`SvelteURLSearchParams` は API がまったく同じなので、そのまま置き換えられます。素の組み込みクラスを使い続けたい場合は、変更のたびに新しいインスタンスを再代入する書き方（`tags = new Set(tags)`）でも正しく動きます。このルールはそのパターンを認識するので、検出されません。

## 制限事項

コンポーネントの外で起きる変更（ヘルパーやストア、子コンポーネントに渡した先での変更）までは静的解析では追えません。このルールは実際に見つけた変更だけを根拠にするため、インスタンスを渡すだけの使い方は検出されません。組み込みクラスと同じ名前のローカルクラス（`class Map { … }`）を定義していると誤って検出することがありますが、グローバルの組み込みクラス名を覆い隠すコードはそれ自体が混乱のもとです。runes モジュール（`.svelte.ts`）とクラスフィールドの `$state` は、このバージョンでは対象外です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
