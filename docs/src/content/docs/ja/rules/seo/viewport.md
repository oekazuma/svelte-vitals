---
title: seo/viewport · ビューポート
description: レスポンシブ表示のための viewport メタタグを宣言しましょう。
---

**重大度:** warning

## チェック内容

すべてのルートには `<meta name="viewport">` を含めるべきです（通常は `app.html` で一度だけ設定します）。ないルートを検出します。viewport タグは通常 `app.html` にあり、静的（CLI）モードは `app.html` を解決しないため、このルールはプラグイン／レンダリングモードでのみ評価します。

## なぜ重要か

viewport メタタグがないと、モバイルブラウザはページを固定幅約 980px のレイアウトビューポートで描画してから縮小表示するため、テキストや操作要素が小さくなりすぎてピンチズームなしでは読んだりタップしたりできなくなります。

## 修正方法

通常は `src/app.html` に viewport メタタグを追加します：

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
