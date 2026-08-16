---
title: a11y/doctype · doctype がない
description: src/app.html の先頭は <!doctype html> で始めましょう。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`src/app.html` が `<!doctype html>` で始まっているか（その前にコメントがあっても構いません）。プロジェクトスコープ: `src/app.html` を一度読んで判定します。

## なぜ重要か

doctype がないとブラウザは互換モード（quirks mode）でレンダリングし、標準モードとは異なるレイアウト規則・ボックスモデル規則が適用されます。そのため、スタイルシートが想定していた見た目とは違うレイアウトになることがあります。

## モードによる違い

CLI のみです。Vite プラグインはプリレンダリングされた HTML を解析し `src/app.html` を読まないため、プラグインモードでは何も報告しません — プラグインが見ている出力にも doctype の欠落は現れているにもかかわらず、です。

## 修正方法

`src/app.html` の先頭行に `<!doctype html>` を追加します：

```html
<!doctype html>
```

## 無効化

既存の検出を suppressions ファイルに記録する（`npx svelte-vitals --update-suppressions`）か、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
