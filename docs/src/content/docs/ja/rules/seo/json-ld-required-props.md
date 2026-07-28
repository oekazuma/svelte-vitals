---
title: seo/json-ld-required-props · JSON-LD の必須プロパティ
description: 認識できる @type には、リッチリザルトに必要なプロパティを揃えましょう。
---

**重大度:** warning

## チェック内容

既知の `@type`（Article、Product、BreadcrumbList、Organization、WebSite、Event、Recipe、Person、VideoObject、LocalBusiness）について、Google が必須とするプロパティがそろっているかを確認します。未知の型やカスタム型は検出しません。

## なぜ重要か

既知の `@type` に必須プロパティが欠けていると、対応するリッチリザルトの対象外になります。

## 修正方法

不足しているプロパティを追加します。例えば `Product` には `name` と `offers` が必要です：

```json
{ "@context": "https://schema.org", "@type": "Product", "name": "…", "offers": { "@type": "Offer", "price": "…" } }
```
