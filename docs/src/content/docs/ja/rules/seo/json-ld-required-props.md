---
title: seo/json-ld-required-props · JSON-LD の必須プロパティ
description: 認識できる @type には、リッチリザルトに必要なプロパティを揃えましょう。
---

**重大度:** warning

## チェック内容

既知の `@type`（Product、BreadcrumbList、WebSite、Event、Recipe、VideoObject、LocalBusiness）について、Google が必須とするプロパティがそろっているかを確認します。未知の型やカスタム型は検出しません。Google の構造化データドキュメントが必須プロパティを一つも挙げていない型（Article、BlogPosting、NewsArticle、Organization）も同様に検出しません。また Person も検出対象外です。Google が文書化している唯一の要件は `ProfilePage.mainEntity` に対するものであり、この関係性はノード単位のこのチェックでは追跡していません。

## なぜ重要か

既知の `@type` に必須プロパティが欠けていると、対応するリッチリザルトの対象外になります。

## 修正方法

不足しているプロパティを追加します。例えば `Product` には `name` に加えて、`review`・`aggregateRating`・`offers` のいずれか一つが必要です：

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "…",
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "89" }
}
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/json-ld-required-props': 'off'
  }
};
```
