---
title: a11y/doctype · doctype がない
description: src/app.html の先頭は <!doctype html> で始めましょう。
---

**重大度:** info · **カテゴリ:** a11y

`warning` ではなく `info` としています。このルールの前提のうちアクセシビリティに関する部分には出典がないためです。互換モード（quirks mode）はレイアウトの差として文書化されており、マークアップの妥当性チェックを正当化していた WCAG の達成基準は廃止・削除されています。レイアウトに関する主張は成立するのでルール自体は残し、重みだけを残った根拠に合わせています。

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

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/doctype': 'off'
  }
};
```
