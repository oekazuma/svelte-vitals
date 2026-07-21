---
title: seo/robots-txt · robots.txt
description: プロジェクトは robots.txt ファイルを提供する必要があります。
---

**重大度:** warning

## チェック内容

プロジェクトには `robots.txt` が必要です。`static/robots.txt` として、または `src/routes/robots.txt/+server` エンドポイントを通じて提供します。

## なぜ重要か

`robots.txt` はクロールロボットがフェッチできるパスを伝え、サイトマップを指し示します。ない場合、クロール動作はデフォルトに委ねられます。

## 修正方法

`static/robots.txt` を追加するか、`src/routes/robots.txt/+server` エンドポイントを作成します：

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
