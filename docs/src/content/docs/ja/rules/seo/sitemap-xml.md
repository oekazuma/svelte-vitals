---
title: seo/sitemap-xml · sitemap.xml
description: プロジェクトは sitemap.xml ファイルを提供する必要があります。
---

**重大度:** warning

## チェック内容

プロジェクトには `sitemap.xml` が必要です。`static/sitemap.xml` として、または `src/routes/sitemap.xml/+server` エンドポイントを通じて提供します。

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
