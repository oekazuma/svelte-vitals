---
title: seo/json-ld-deprecated-type · 非推奨の構造化データ型
description: 一部のスキーマ型は Google のリッチリザルトを生成しなくなりました。
---

**重大度:** info

## チェック内容

Google のリッチリザルトが廃止または制限された JSON-LD の `@type`（`HowTo`、`FAQPage`、`ClaimReview` など）を検出します。

## なぜ重要か

これらの型はリッチリザルトを安定して生成しないため、SERP 上の利点なしにページ重量だけ増やします。

## 修正方法

Google のドキュメントで現在のリッチリザルト状況を確認し、リッチリザルトを得られないなら削除または置換してください。
