---
title: correctness/autoplay-muted · muted なしの自動再生ビデオ
description: ブラウザは音声付きの自動再生をブロックし、ブロックされてもエラーになりません — muted のない <video autoplay> は実際の訪問者の前で静かに再生されないままです。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

リテラルの `autoplay` 属性を持ちながら `muted` 属性を持たない `<video>` 要素を検出します:

```svelte
<video autoplay src="/hero.mp4"></video>
```

`autoplay` は HTML のブール属性で、存在すること自体が自動再生を意味します。そのためリテラル値なら何であっても対象になります（`autoplay="false"` でも自動再生されます）。式による `autoplay={expr}` は静的に判定できないため検出しません。`muted` はどの形でも合格です: 素の `muted`、`muted={expr}`（式が true になりうる）、`bind:muted`、そして `muted` を供給しうるスプレッド属性。

## なぜ重要か

Chrome と Safari は音声付きの自動再生をブロックします。`autoplay` が効くのは、ビデオがミュートされているか、サイトが自動再生の許可を獲得している場合だけです。ブロックされた自動再生は throw しません — ビデオがただ再生されないだけです。

このため欠陥は開発中には見えません。ページを操作した後はそのセッションで自動再生が許可されることが多く、作者にはビデオが再生されて見えるため、そのまま出荷してしまいます。実際の訪問者に届くのは静止したポスターフレームです。マークアップは正しく見え、コンパイルも通り、静かに何もしない — まさに静的解析が対象とする欠陥のクラスです。

## 修正方法

`muted` を追加します。あわせて `playsinline` も付けるのが通例で、iOS が再生を拒否したり全画面にしたりせずインラインで再生するようになります:

```svelte
<video autoplay muted playsinline src="/hero.mp4"></video>
```

本当に音声が必要なビデオなら、`autoplay` をやめてユーザー操作から再生を開始してください。

## 制限事項

対象になるのはリテラルの `autoplay` を持つネイティブの `<video>` 要素だけです。`<svelte:element this="video">` による動的タグや式による `autoplay` は静的解析の範囲外のため検出されません。

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/autoplay-muted': 'off'
  }
};
```
