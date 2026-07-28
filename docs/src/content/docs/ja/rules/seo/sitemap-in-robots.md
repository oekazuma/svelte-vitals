---
title: seo/sitemap-in-robots · robots.txt の sitemap 参照
description: robots.txt から sitemap の場所をクローラーに伝えましょう。
---

**重大度:** info

## チェック内容

robots.txt と sitemap の両方が存在する場合、静的ファイルの `static/robots.txt` には `Sitemap:` 行があるべきです（`+server` の robots エンドポイントは静的解析では検査しません）。

## なぜ重要か

robots.txt に `Sitemap:` 行があると、クローラーが sitemap を見つけやすくなります。ない場合は、手動での送信に頼ることになります。

## 修正方法

`static/robots.txt` に `Sitemap:` 行を追加します：

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
