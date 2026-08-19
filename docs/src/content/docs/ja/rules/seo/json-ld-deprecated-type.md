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

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-deprecated-type': 'off'
  }
};
```
