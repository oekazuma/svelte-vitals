---
title: seo/sitemap-xml · sitemap.xml
description: プロジェクトに sitemap.xml を用意しましょう。
---

**重大度:** warning

## チェック内容

プロジェクトには `sitemap.xml` を用意すべきです。`static/sitemap.xml` として、または `src/routes/sitemap.xml/+server` エンドポイントを通じて提供します。

## なぜ重要か

`sitemap.xml` はサイトの URL を列挙し、検索エンジンによる発見と優先順位付けを助けます。内部リンクの少ないページには特に効果があります。

## 修正方法

`static/sitemap.xml` を追加するか、`src/routes/sitemap.xml/+server` エンドポイントを作成します：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>
```

## 無効化

意図したとおりであれば、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/sitemap-xml': 'off'
  }
};
```
