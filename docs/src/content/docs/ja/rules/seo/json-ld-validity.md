---
title: seo/json-ld-validity · JSON-LD の妥当性
description: ページの JSON-LD は、@context と @type を備えた妥当な JSON である必要があります。
---

**重大度:** warning

## チェック内容

静的な `<script type="application/ld+json">` それぞれについて、内容が JSON としてパースでき、`@context` と `@type` の両方を含むことを確認します。無効または不完全な JSON-LD を検出します。動的に組み立てる JSON-LD は、静的モードでは検査しません。

## 未知の型

ドキュメントの `@context` が schema.org を指している場合、そのドキュメント内のすべての裸の `@type` 名 — ルートだけでなく、ネストしたエンティティ(`author`、`publisher`、`offers` など)や `@graph` メンバー内のものも含む — が schema.org の語彙と照合されます。完全一致・大文字小文字を区別した schema.org の型名でない場合、次のような検出結果になります: `Unknown @type 'article' — not a schema.org type. Did you mean 'Article'?`。この「Did you mean」の提案は、語彙内に大文字小文字違いの一致がある場合にのみ表示されます — 文字の欠落や余分な文字(`Artcle`)は大文字小文字の違いではないため、提案は表示されません。

IRI 形式(`https://schema.org/Article`)やプレフィックス形式(`schema:Article`)の `@type` は妥当な JSON-LD であり、このチェックの対象外です — 裸の名前のみが検査されます。

`@context` が schema.org 以外を指している場合(schema.org 以外のメンバーを含む配列、object 形式の context、あるいは別の語彙 URL)、そのドキュメントはこのチェックから完全に除外されます。用語の再マッピングによって、このルールが認識していない名前が正当なものになりうるためです。メンバーがすべて schema.org URL の配列は引き続き検証対象です。context の照合自体は大文字小文字を区別します(`https://schema.org`・`http://schema.org`、末尾スラッシュの有無は任意)— 変則的な大文字表記の URL は誤検知側ではなく除外側に倒れます。

この語彙は [schema-dts](https://github.com/google/schema-dts) から生成されており、この依存パッケージが更新されるたびに更新されます。

## なぜ重要か

パースできない、`@context` や `@type` を欠く、あるいは実在しない schema.org の型を宣言している JSON-LD を、検索エンジンは黙って無視します。その構造化データは何の役にも立ちません。

## 修正方法

```svelte
<svelte:head>
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "…" }
  </script>
</svelte:head>
```
