---
title: seo/viewport · ビューポート
description: レスポンシブ表示のための viewport メタタグを宣言しましょう。
---

**重大度:** warning

## チェック内容

すべてのルートには `<meta name="viewport">` が必要です（通常は `app.html` で一度だけ設定します）。ないルートを検出します。viewport タグは通常 `app.html` にあり、静的（CLI）モードは `app.html` を解決しないため、このルールはプラグイン／レンダリングモードでのみ評価します。

## なぜ重要か

viewport メタタグがないとページはモバイル対応にならず、Google のモバイルファーストインデックスで不利になります。

## 修正方法

通常は `src/app.html` に viewport メタタグを追加します：

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
