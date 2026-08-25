---
title: a11y/deprecated-element · 廃止された HTML 要素
description: HTML 標準の obsolete features に挙げられた要素は非適合であり、適合する代替要素があります。
---

**重大度:** info · **カテゴリ:** a11y

`warning` ではなく `info` としています。要素はいまも描画され、ブラウザは動作を維持し続けるためです。失われるのは保証です — 支援技術に対する意味論は未定義であり、それぞれに標準が意味を定義した代替要素があります。

## チェック内容

HTML 標準の obsolete features 節に挙げられた要素 — `<center>`、`<font>`、`<strike>`、`<big>`、`<tt>`、`<frame>`、`<applet>` など — をコンポーネントのソースから検出します。

検出しないもの:

- `<svg>` の内側、および `<svelte:options namespace="svg" />` を宣言したコンポーネント内のすべて。このチェックは HTML 要素だけが対象です。`<foreignObject>` 配下は HTML に戻るのでチェックされます。
- 適合する代替要素: `<strike>` に対する `<s>`、`<big>` に対する `<span>` + CSS の `font-size`（`<b>`/`<strong>` は意味が変わります）、`<tt>` に対する `<code>`/`<kbd>`/`<samp>`。

```svelte
<strike>old price</strike>
<font color="red">styled with markup</font>
```

`<marquee>` と `<blink>` はこのルール**と** Svelte コンパイラ（`a11y_distracting_elements`）の両方が報告します。この重複は意図的です。コンパイラはビルドログに流すだけでスコアも gate も抑制もしないため、`<font>` は数えて `<marquee>` は数えないスコアは 廃止要素 2 つを見落とすことになります。両者の判定が食い違うことはありません — どちらも「その要素を除去せよ」です。

廃止要素は 1 件の検出になります。その要素の非推奨属性（`<font color>`）は `a11y/deprecated-attr` によって二重に報告されません — このルールを無効にしたりインラインで抑制したりしても同じです。属性ルールは、このルールの結果を見るのではなく、要素名で廃止要素を読み飛ばします。

要素の一覧はベンダリングした HTML spec データ（`@markuplint/html-spec`）の `obsolete` 列で、WHATWG の obsolete features 節と過不足なく一致します。なお `<rb>`/`<rtc>` は WHATWG では obsolete ですが、W3C HTML 5.x では残っており、日本語のルビ記法で見かけることがあります。

## なぜ重要か

廃止要素は非適合です。ブラウザは既存ページを壊さないよう描画を続けますが、標準は意味を定義していないため、支援技術が何を読み上げるか — また将来のブラウザが何を描画するか — にページは依存できません。それぞれに、意味論が定義された代替があります。

## 修正方法

適合する代替要素に置き換え、見た目は CSS に移します。

```svelte
<s>old price</s>
<span class="alert">styled with CSS</span>
```

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別の要素を抑制するには `<!-- svelte-vitals-disable-next-line a11y/deprecated-element -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-element': 'off'
  }
};
```
