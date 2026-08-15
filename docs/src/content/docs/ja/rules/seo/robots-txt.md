---
title: seo/robots-txt · robots.txt
description: プロジェクトに robots.txt を用意しましょう。
---

**重大度:** warning

## チェック内容

プロジェクトには `robots.txt` を用意すべきです。`static/robots.txt` として、または `src/routes/robots.txt/+server` エンドポイントを通じて提供します。

## なぜ重要か

`robots.txt` は、クローラーが取得してよいパスを伝え、サイトマップの場所を示します。ない場合、クロールの挙動は各クローラーのデフォルト任せになります。

## 修正方法

`static/robots.txt` を追加するか、`src/routes/robots.txt/+server` エンドポイントを作成します：

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## 無効化

意図したとおりであれば、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'seo/robots-txt': 'off'
  }
};
```
