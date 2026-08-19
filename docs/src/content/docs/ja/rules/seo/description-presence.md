---
title: seo/description-presence · ディスクリプションの存在
description: すべてのルートに <meta name="description"> が必要です。
---

**重大度:** warning

## チェック内容

すべてのルートには、直接指定またはレイアウトチェーンからの継承で `<meta name="description">` タグが必要です。ディスクリプションのメタタグがない、または空のルートを検出します。

## なぜ重要か

メタディスクリプションは、検索エンジンがタイトルの下に表示するスニペットです。設定していないと検索エンジンがページ本文から自動生成しますが、質の低いスニペットになりがちです。

2026-08-09 の重大度レビュー以前は `critical` でした。`critical` は現在、デプロイをブロックすべき事象(クラッシュ、セキュリティの漏えい)、または SEO では検索エンジンが常に必要とする唯一のシグナル(`seo/title-presence`)に限定しています。ディスクリプションは事情が異なります。Google は提供されたディスクリプションを検索結果のスニペットに使うのは「場合による」と明言しており、それ以外はページ本文から自動生成します。つまりディスクリプションの欠如は実害のある問題ではあっても、デプロイを止めるべきものではありません。そのため `seo/og-image` や `seo/canonical-url` と同じ `warning` としています。

## 修正方法

`<svelte:head>` 内に `<meta name="description">` を追加するか、メタコンポーネントのディスクリプションを設定します：

```svelte
<svelte:head>
  <meta name="description" content="A concise page summary." />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/description-presence': 'off'
  }
};
```
