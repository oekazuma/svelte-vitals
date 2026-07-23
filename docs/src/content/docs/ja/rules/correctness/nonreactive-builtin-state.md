---
title: correctness/nonreactive-builtin-state · Non-reactive built-in in $state
description: '$state に入れた素の Map・Set・Date・URL はプロキシされず、変更がリアクティビティに届きません。UI は静かに更新を止めます。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

素の組み込みクラス（`Map`・`Set`・`Date`・`URL`・`URLSearchParams`）で初期化されたトップレベルの `$state` 束縛のうち、そのインスタンスへの変更が関数内またはテンプレートのハンドラー内で観測されたものを検出します:

```svelte
<script>
  let tags = $state(new Set());

  function toggle(tag) {
    tags.add(tag); // 検出対象 — この変更は追跡されない
  }
</script>

{#each [...tags] as tag}<span>{tag}</span>{/each}
```

検出は意図的に保守的です。型ごとの変更操作だけを数え（`map.set`、`set.add`、`date.setHours`、`params.append`、`url.href = …`、`url.searchParams.set(…)` など）、読み取りメソッドは数えません。変更のあとに再代入している運用（`tags = new Set(tags)`）は正しく動くため検出しませんが、素の自己代入 `tags = tags` は Svelte 5 では no-op なので免除になりません。スクリプトのトップレベルでの変更は初回描画前に一度実行されるだけなので、これも検出しません。

## なぜ重要か

`$state` の深いプロキシが対象にするのは素のオブジェクトと配列だけです。素の組み込みインスタンスはデータとしては動き続けます（`set` も `add` も成功します）が、リアクティビティには何も届きません。effect は再実行されず、derived は再計算されず、テンプレートは古い内容を表示し続けます。コンポーネントは初回だけ正しく描画され、本番で静かに更新を止めます。コンパイラも svelte-check も警告しません。Svelte が `svelte/reactivity` を提供しているのは、まさにこのためです。

## 修正方法

```svelte
<script>
  import { SvelteSet } from 'svelte/reactivity';

  let tags = $state(new SvelteSet());
</script>
```

`SvelteMap`・`SvelteSet`・`SvelteDate`・`SvelteURL`・`SvelteURLSearchParams` は API 互換のドロップイン置換です。素の組み込みのまま、変更のたびに新しいインスタンスを再代入する運用（`tags = new Set(tags)`）でも動きます。このルールはそのパターンを認識して検出しません。

## 制限事項

コンポーネントの外で起きる変更（ヘルパーやストア、子コンポーネントに渡した先での変更）は静的解析の射程外です。このルールは観測できた変更だけを数えるため、渡すだけの使い方は検出されません。組み込みクラス名をシャドーするローカルクラス（`class Map { … }`）があると誤帰属しますが、グローバルの組み込み名のシャドーはそれ自体が問題です。runes モジュール（`.svelte.ts`）とクラスフィールドの `$state` はこのバージョンでは対象外です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/nonreactive-builtin-state': 'off'
  }
};
```
