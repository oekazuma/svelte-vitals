---
title: a11y/deprecated-attr · 非推奨の HTML 属性
description: HTML spec データがその要素で非推奨と記す属性は、標準ではなくレガシー互換によって挙動が決まっています。
---

**重大度:** info · **カテゴリ:** a11y

`warning` ではなく `info` としています。属性はいまも動くかもしれないためです。検出しているのは、標準がもはやその意味を定義しておらず、CSS または現行の属性による代替が存在することです。

## チェック内容

HTML spec データが**その要素で**非推奨（または obsolete）と記す属性 — `iframe[frameborder]`、`td[width]`、`body[bgcolor]`、`hr[size]`、`style[type]` — をコンポーネントのソースから検出します。CLI と Vite プラグインの両方が対象です。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

非推奨かどうかは要素ごとに決まります。`width` は `<td>` では非推奨で `<img>` では現行なので、前者だけが報告されます。複数の非推奨属性を持つ要素は、それらを列挙した **1 件** の検出になり、開始タグの行に紐づきます — タグが何行にまたがっていても、要素の直上の `disable-next-line` ディレクティブ 1 つで抑制できます。

検出しないもの:

- `a11y/deprecated-element` が報告する要素の非推奨属性（`<font color>`、`<marquee behavior>`）— 要素ごとに検出は 1 件です。`a11y/deprecated-element` を無効化・インライン抑制していても同じで、このルールは廃止要素を名前で読み飛ばします。
- `<svg>` の内側、および `<svelte:options namespace="svg" />` を宣言したコンポーネント内。`<foreignObject>` 配下は HTML に戻ります。
- グローバル属性グループ（`xml:lang`、`xlink:href`、`onwebkit*`）— 参照するのは要素自身の属性表だけなので、SVG スプライトの `<use xlink:href="#icon">` は決して報告されません。
- `nonStandard` や `experimental` としてだけ記された属性。`deprecated` と `nonStandard` の両方が付いたもの（`hr[size]`）は報告されます。
- コンポーネント自身の `<style>` ブロック。これはコンポーネントのスタイルシートであって要素ではありません。`<svelte:head>` 内の `<style type="text/css">` は要素なので報告されます。

```svelte
<iframe src="/embed" frameborder="0" title="Map"></iframe>
<td width="120">…</td>
```

**対象範囲はデータセットに従います。** ベンダリングした HTML spec データ（`@markuplint/html-spec`）の `deprecated`/`obsolete` 列であり、WHATWG の obsolete features 節ではなく MDN のステータスを追跡しています。これは両方向に効きます。MDN が非推奨と記す属性は標準の扱いが異なっても報告され（`a[attributionsrc]`）、MDN が記載していない WHATWG の obsolete 属性 — `p[align]`、`td[nowrap]`、`html[manifest]` — は報告されません。

## なぜ重要か

非推奨属性の挙動は、標準ではなく既存ページのためにブラウザが維持している動作によって決まります。それぞれに — 多くは CSS、ときに現行の属性という — 挙動が定義された代替があります。

## 修正方法

見た目は CSS に移すか、非推奨属性を置き換えた属性を使います:

```svelte
<iframe src="/embed" title="Map" style="border: 0"></iframe>
<td style="width: 120px">…</td>
```

## 無効化

個別の要素を抑制するには `<!-- svelte-vitals-disable-next-line a11y/deprecated-attr -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-attr': 'off'
  }
};
```
