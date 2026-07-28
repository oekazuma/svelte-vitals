---
title: seo/json-ld-validity · JSON-LD の妥当性
description: ページの JSON-LD は、@context と @type を備えた妥当な JSON である必要があります。
---

**重大度:** warning

## チェック内容

静的な `<script type="application/ld+json">` それぞれについて、内容が JSON としてパースでき、`@context` と `@type` の両方を含むことを確認します。無効または不完全な JSON-LD を検出します。動的に組み立てる JSON-LD は、静的モードでは検査しません。

## なぜ重要か

パースできない、あるいは `@context` や `@type` を欠く JSON-LD を、検索エンジンは黙って無視します。その構造化データは何の役にも立ちません。

## 修正方法

```svelte
<svelte:head>
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "…" }
  </script>
</svelte:head>
```
