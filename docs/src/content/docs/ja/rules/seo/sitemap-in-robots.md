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

`static/robots.txt` に `Sitemap:` 行を追加します。

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## モードによる違い

ありません。`static/robots.txt` を読むだけで、`--route` 実行も含め、どこで実行しても同じです。`+server` エンドポイントから配信する `robots.txt` はどちらでも検査しません。ダッシュボードのライブ層はサイト全体のルールを再評価しないため、静的ベースラインの結果がそのまま残ります。

## 無効化

意図したとおりであれば、ルールを無効化してください。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/sitemap-in-robots': 'off'
  }
};
```
