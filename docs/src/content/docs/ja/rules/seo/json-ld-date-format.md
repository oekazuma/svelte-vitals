---
title: seo/json-ld-date-format · JSON-LD の日付形式
description: JSON-LD の日付プロパティは ISO-8601 形式で書きます。
---

**重大度:** info

## チェック内容

既知の日付キー（`datePublished`、`dateModified`、`startDate` など）の値が ISO-8601 形式でない場合に検出します。schema.org が許容する精度の縮約は有効として扱い、年のみ（`2026`）、年月（`2026-06`）、完全な日付、日時のいずれも通ります。

## なぜ重要か

schema.org の日付プロパティは ISO-8601 形式を前提としています。それ以外の形式は、検索エンジンに無視されるか誤って解釈されるおそれがあります。

## 修正方法

```json
"datePublished": "2026-06-26"
```
