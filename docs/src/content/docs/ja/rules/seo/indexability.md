---
title: seo/indexability · インデックス可否
description: ルートが誤って noindex になっていないか確認します。
---

**重大度:** info

## チェック内容

ルートの `<meta name="robots">` が静的に `noindex`（または `none`）に解決される場合に提示し、インデックスからの除外が意図したものか確認できるようにします。動的に設定された robots 値は検出しません。

## なぜ重要か

noindex はページを検索結果から除外します。公開ルートに誤って noindex を付けると、気づかないうちにそのページがインデックスから消えます。SEO のミスとしては最も被害の大きい部類です。

## 修正方法

このルートをインデックスさせたい場合は robots メタから `noindex` を外します。

```svelte
<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。判定するのは**リテラル**な値だけで、動的な値は検査しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルです。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/indexability': 'off'
  }
};
```
