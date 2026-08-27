---
title: performance/lcp-image · LCP 画像の遅延読み込み
description: LCP になりそうな最初の画像は、遅延読み込みにしないでください。
---

**重大度:** warning

## チェック内容

ルートのマークアップで最初に現れる `<img>` に `loading="lazy"` が付いている場合に検出します。静的解析では、文書順で最初の画像を Largest Contentful Paint（LCP）画像とみなします。

## なぜ重要か

LCP（ファーストビュー）の画像を遅延読み込みすると、最大コンテンツの描画が遅れ、Core Web Vitals を損ないます。静的解析では最初の画像が LCP 候補の最も確かな手がかりなので、即時読み込みにしておくべきです。

## 修正方法

LCP となる最初の画像から `loading="lazy"` を外し、あわせて `fetchpriority="high"` の指定も検討してください。

```svelte
<img src="/hero.jpg" width="1200" height="630" fetchpriority="high" alt="…" />
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、ルート自身のテンプレート、つまりページとレイアウトチェーンにある `<img>` を読みます。子コンポーネントが描画する `<img>` は見えません。`loading="lazy"` はリテラルの属性だけで判定し、動的な `loading={…}` やスプレッド（`{...rest}`）は決して検出しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される本文のすべての `<img>` を読みます。ビルドが対象にするのはプリレンダリングされたルートだけで、その検出は HTML ファイルに紐づきソース行を持たないため、インラインの `svelte-vitals-disable-next-line` が届くのはソース解析の検出だけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/lcp-image': 'off'
  }
};
```
