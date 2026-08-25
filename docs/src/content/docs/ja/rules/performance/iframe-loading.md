---
title: performance/iframe-loading · iframe の loading 属性
description: 画面外の iframe はサードパーティのドキュメント全体 — スクリプト、フォント、メディア — を先読みし、画面外の画像より高くつくのが普通です。loading="lazy" で遅延できます。
---

**重大度:** info · **カテゴリ:** performance

`performance/image-loading-hint` と同じく `info` です: ファーストビュー内の iframe は eager で正当であり、静的解析にはロード時に iframe がどこにあるか分からないため、このルールは助言に留まります。

## チェック内容

`loading` 属性を持たない `<iframe>` 要素を検出します:

```svelte
<iframe src="https://www.youtube.com/embed/…" title="Video"></iframe>
```

検出しないもの:

- 値が何であれリテラルの `loading` 属性 — `loading="lazy"` でも `loading="eager"` でも、作者が選択したものです。
- 式による `loading={expr}` — 描画される値は静的に判定できません。
- スプレッド属性 — `loading` を供給しうるためです。

## なぜ重要か

`loading` 属性のない iframe は eager にロードされます。画面外の iframe（埋め込み動画プレーヤー、地図、広告枠）は通常サードパーティのドキュメント一式 — スクリプト、フォント、メディア — をロードするため、eager にロードするコストは画像より大きくなるのが普通です。`<iframe>` の `loading="lazy"` は何年も前からすべてのエバーグリーンブラウザでサポートされており、ビューポートが近づくまでロードを遅延します。

画像と違って iframe が LCP 要素になることはまれで、遅延ロードが Core Web Vitals を悪化させることはほぼありません。

## 修正方法

ロード時に画面外にありうる iframe には `loading="lazy"` を追加します:

```svelte
<iframe src="https://www.youtube.com/embed/…" title="Video" loading="lazy"></iframe>
```

ファーストビュー内の iframe は eager のままにします — 明示的な `loading="eager"` は選択を記録し、このルールも黙らせます。

## 制限事項

対象になるのはコンポーネントソース内のネイティブな `<iframe>` 要素だけです。`<svelte:element this="iframe">` による動的タグ、`{@html}` で注入される iframe、`src/app.html` にある iframe は静的解析の範囲外のため検出されません。

意図的に不可視な iframe — `hidden`、ゼロサイズ、サイレントリニューの認証フレーム、トラッキングビーコン — も検出されますが、そこでは `loading="lazy"` は誤った修正です: フレームの存在理由であるリクエスト自体を遅延させかねません。そうした iframe には明示的な `loading="eager"` を付けるか、行を抑制してください。

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

常にファーストビュー内にある iframe には、抑制より明示的な `loading="eager"` を推奨します。それ以外は `<!-- svelte-vitals-disable-next-line performance/iframe-loading -->` で個別の要素を黙らせるか、ルールを無効化します:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/iframe-loading': 'off'
  }
};
```
