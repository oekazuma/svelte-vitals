---
title: seo/viewport · ビューポート
description: レスポンシブ表示のための viewport メタタグを宣言しましょう。
---

**重大度:** warning

## チェック内容

すべてのルートには `<meta name="viewport">` を含めるべきです（通常は `app.html` で一度だけ設定します）。ないルートを検出します。

## なぜ重要か

viewport メタタグがないと、モバイルブラウザはページを固定幅約 980px のレイアウトビューポートで描画してから縮小表示するため、テキストや操作要素が小さくなりすぎてピンチズームなしでは読んだりタップしたりできなくなります。

## 修正方法

通常は `src/app.html` に viewport メタタグを追加します。

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

## モードによる違い

**レンダリング解析のみ**（Vite プラグインのビルド、ダッシュボードで訪問したルート）。このタグは `src/app.html` にあり、ソース解析（CLI、ダッシュボードの静的ベースライン）はそれを解決しないため、ソース解析ではこのルールは何も報告しません。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/viewport': 'off'
  }
};
```
