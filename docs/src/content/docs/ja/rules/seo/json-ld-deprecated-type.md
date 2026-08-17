---
title: seo/json-ld-deprecated-type · 非推奨の構造化データ型
description: 一部のスキーマ型は、Google のリッチリザルトが廃止または制限されました。
---

**重大度:** info

## チェック内容

Google がリッチリザルトの表示を廃止または制限した `@type`（`HowTo`、`FAQPage`、`ClaimReview` など）を JSON-LD 内で検出します。

## なぜ重要か

これらの型はもうリッチリザルトを安定して生成しません。マークアップを残しても、SERP 上の見返りがないままページサイズだけが増えます。

## 修正方法

その型が現在もリッチリザルトの対象かどうかを Google のドキュメントで確認し、対象外なら削除するか別の型に置き換えてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-deprecated-type': 'off'
  }
};
```
