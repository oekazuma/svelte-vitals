---
title: architecture/component-size · コンポーネントサイズ
description: 大きくなりすぎたコンポーネントは分割しましょう。
---

**重大度:** info · **カテゴリ:** architecture

## チェック内容

200 行を超える `.svelte` コンポーネントを検出します（CLI による `src/**/*.svelte` の静的解析）。

閾値は `architecture/prop-count` と同じ、実在する Svelte 5 のコードベース調査に基づきます。実測した 90・95 パーセンタイルのどちらよりも意図的に緩く設定してあります。行数はプロップの多さに比べると弱いシグナルで、テーブルやフォーム、生成されたマークアップは正当に長くなるためです。

## なぜ重要か

巨大なコンポーネントは読みづらく、テストも再利用もしにくいうえ、複数の責務を切り出すべきサインであることが多いです。AI が生成したコードによく見られる形です。

## 修正方法

小さく役割を絞った子コンポーネント（ロジックは再利用可能な `.svelte.ts` モジュール）に切り出します。

## 設定

| オプション | 型      | デフォルト |
| ---------- | ------- | ---------: |
| `max`      | integer |        200 |

```js svelte-vitals.config.js
export default {
  rules: { 'architecture/component-size': { options: { max: 300 } } }
};
```

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line architecture/component-size -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/component-size': 'off'
  }
};
```
