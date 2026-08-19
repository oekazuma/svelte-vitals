---
title: performance/image-dimensions · 画像のサイズ指定
description: <img> には width と height を明示します。
---

**重大度:** warning

## チェック内容

すべての `<img>` 要素には `width` と `height` 属性の明示が必要です。どちらかが欠けている画像を検出します。

## なぜ重要か

width と height を明示していない `<img>` は、読み込み中にレイアウトシフト（CLS）を引き起こすことがあり、Core Web Vitals と表示の安定性を損ないます(CSS の `aspect-ratio` など、別の方法で領域を確保している場合を除く)。

## 修正方法

`<img>` に `width` と `height` 属性を追加します：

```svelte
<img src="/hero.jpg" width="1200" height="630" alt="…" />
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、ルート自身のテンプレート — ページとレイアウトチェーン — にある `<img>` を読みます。子コンポーネントが描画する `<img>` は見えません。属性は値にかかわらず書かれていれば「あり」と数え、スプレッド（`{...rest}`）はすべての属性を「あり」と数えます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される本文のすべての `<img>` を読みます。ビルドが対象にするのはプリレンダリングされたルートだけで、その検出はHTML ファイルに紐づきソース行を持たないため、インラインの `svelte-vitals-disable-next-line` が届くのはソース解析の検出だけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/image-dimensions': 'off'
  }
};
```
