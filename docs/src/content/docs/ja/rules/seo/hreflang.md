---
title: seo/hreflang · hreflang の妥当性
description: hreflang の alternate には有効なコードを使いましょう。x-default はセレクター・リダイレクトページで推奨されます。
---

**重大度:** warning

## チェック内容

`<link rel="alternate" hreflang="…">` の alternate を検証します。本ルールはオプトインで、hreflang alternate のないページは検出しません。alternate が存在する場合、次を検出します。

- 不正な `hreflang` 値(`x-default` でも、`en`、`en-US`、`zh-Hant`、`es-419` のような言語(-スクリプト)(-地域)形式のコードでもないもの)
- alternate が 2 つ以上あるのに `x-default` が宣言されていない場合

## なぜ重要か

hreflang コードが不正だと国際ターゲティングが機能せず、検索エンジンが誤った言語版を表示したり、アノテーション自体を無視したりします。

一方、`x-default` の欠如は性質が異なります。[Google 自身のガイダンス](https://developers.google.com/search/docs/specialty/international/localized-versions)は「特に言語・国選択ページや自動リダイレクトするホームページでは、一致する言語がなかったユーザー向けのフォールバックページの追加を検討してください」と述べており、これは特定の形のページに向けた推奨であって、多言語サイト全般に対する欠陥ではありません。言語セレクターも自動リダイレクトも持たず、固定の言語 alternate 一覧だけを提示するページには、フォールバック先が必要な「一致しない言語のユーザー」自体が存在しないため、そこで `x-default` を省略するのは見落としではなく妥当な選択です。

## 修正方法

```svelte
<svelte:head>
  <link rel="alternate" hreflang="en" href="https://example.com/en/" />
  <link rel="alternate" hreflang="de" href="https://example.com/de/" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/" />
</svelte:head>
```

## 制限事項

検証対象は BCP-47 の実用的なサブセット(言語・任意のスクリプト・任意の地域)のみで、文法全体はカバーしません。BCP-47 のバリアントや拡張(例: `de-DE-1996`、`en-US-u-hc-h12`)は有効な hreflang 値ですが、本ルールでは認識されず不正な値として検出されます。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'seo/hreflang': 'off'
  }
};
```
