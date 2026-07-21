---
title: seo/json-ld-placeholder · JSON-LD のプレースホルダ
description: JSON-LD に未置換のプレースホルダを残すべきではありません。
---

**重大度:** info

## チェック内容

JSON-LD の値に残った明らかなプレースホルダ/定型文（`lorem ipsum`、`Your Company Name` など）を検出します。

## なぜ重要か

残ったプレースホルダは、誤った構造化データを検索エンジンに送ります。

## 修正方法

プレースホルダをそのページの実際の値に置き換えてください。
