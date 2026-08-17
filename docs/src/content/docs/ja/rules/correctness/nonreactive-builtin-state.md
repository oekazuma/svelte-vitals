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

検出条件はあえて絞り込んであります。

- 対象は型ごとの変更操作のみ（`map.set`、`set.add`、`date.setHours`、`params.append`、`url.href = …`、`url.searchParams.set(…)` など）。読み取りメソッドには反応しません。
- 変更後に新しいインスタンスを再代入するコード（`tags = new Set(tags)`）は正しく動くため対象外。ただし `tags = tags` は Svelte 5 では何も起こさないため対象のままです。
- スクリプトのトップレベルでの変更は初回描画前に一度実行されるだけなので対象外です。

## なぜ重要か

`$state` がプロキシ化するのは素のオブジェクトと配列だけです。組み込みインスタンスでもデータ操作自体は動きます（`set` も `add` も成功します）が、変更はリアクティビティに伝わりません。effect は再実行されず、derived は再計算されず、テンプレートは古い内容のままです。

初回の描画は正しいため、気づかないうちに UI が更新されなくなります。コンパイラも svelte-check も警告しません。Svelte が `svelte/reactivity` を提供しているのは、まさにこのためです。

## 修正方法

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = new SvelteSet();
</script>
```

`SvelteMap`・`SvelteSet`・`SvelteDate`・`SvelteURL`・`SvelteURLSearchParams` は API がまったく同じなので、そのまま置き換えられます。素の組み込みクラスを使い続けたい場合は、変更のたびに新しいインスタンスを再代入する書き方（`tags = new Set(tags)`）でも正しく動きます。このルールはそのパターンを認識するので、検出されません。

## 制限事項

追えないもの・対象外:

- コンポーネントの外で起きる変更（ヘルパーやストア、子コンポーネントに渡した先での変更）。実際に見つけた変更だけを根拠にするため、渡すだけの使い方は検出されません。
- 組み込みクラスと同名のローカルクラス（`class Map { … }`）は誤検出しますが、グローバルの組み込み名を覆い隠すコードはそれ自体が混乱のもとです。
- runes モジュール（`.svelte.ts`）とクラスフィールドの `$state`（このバージョンでは対象外）。

## 無効化

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
