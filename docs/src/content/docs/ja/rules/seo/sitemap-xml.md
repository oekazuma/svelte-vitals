---
title: seo/sitemap-xml · sitemap.xml
description: プロジェクトは sitemap.xml ファイルを提供する必要があります。
---

**重大度:** warning

## チェック内容

プロジェクトには `sitemap.xml` が必要です。`static/sitemap.xml` として、または `src/routes/sitemap.xml/+server` エンドポイントを通じて提供します。

## なぜ重要か

`sitemap.xml` はサイトの URL を列挙し、特に内部リンクが少ないページを検索エンジンが発見し、優先順位付けできるようにします。

## 修正方法

`static/sitemap.xml` を追加するか、`src/routes/sitemap.xml/+server` エンドポイントを作成します：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>
```
