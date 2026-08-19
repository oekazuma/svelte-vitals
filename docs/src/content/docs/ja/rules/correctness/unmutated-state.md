---
title: correctness/unmutated-state · 変更されない $state
description: 一度も変更しない $state は、const（または $state.raw）で十分です。
---

**重大度:** info · **カテゴリ:** correctness

## チェック内容

コンポーネント内のどこでも書き込まれず、外部にも渡らない `let x = $state(...)` を検出します。再代入も、変更（`x.a = …`、`x.push()`）も、バインド（`bind:value={x}`）も、関数やコンポーネントへの受け渡しもないものです。

`use:`／`transition:`／`animate:` ディレクティブに渡した state も検出しません。受け取った側が参照を保持し、静的解析には見えない形で変更しうるためです。

## なぜ重要か

変更されない `$state` は、使わないリアクティビティ（deep proxy と依存追跡）のコストを払っています。`const` の方が明確で軽量です。値をまるごと差し替えるだけ（プロパティは変更しない）なら `$state.raw` が適します。

## 修正方法

```svelte
<script>
  // let title = $state('Dashboard'); の代わりに
  const title = 'Dashboard';

  // まるごと差し替えるが deep mutate しないなら $state.raw:
  let data = $state.raw(initial);
  data = nextValue;
</script>
```

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/unmutated-state -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/unmutated-state': 'off'
  }
};
```
