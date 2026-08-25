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

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/json-ld-date-format': 'off'
  }
};
```
