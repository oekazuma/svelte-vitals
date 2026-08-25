---
title: seo/title-length · タイトルの長さ
description: <title> は 30〜60 文字に収めましょう。
---

**重大度:** info

## チェック内容

表示テキストが 30 文字未満、または 60 文字を超える静的な `<title>` を検出します。カウントの前に空白をトリムし、連続する空白は 1 つにまとめます。長さは書記素クラスタ単位で数えます（絵文字は 1 文字扱い）。動的なタイトルは検査しません。

## なぜ重要か

タイトルが短すぎると最も強力なオンページ SEO シグナルを無駄にし、長すぎると検索結果で切り詰められて見出しの末尾が隠れます。

## 修正方法

```svelte
<svelte:head>
  <title>検索結果で目を引く、簡潔でわかりやすいページタイトルの付け方ガイド</title>
</svelte:head>
```

## 設定

| オプション | 型      | デフォルト |
| ---------- | ------- | ---------: |
| `min`      | integer |         30 |
| `max`      | integer |         60 |

```js svelte-vitals.config.js
export default {
  rules: { 'seo/title-length': { options: { min: 20, max: 40 } } }
};
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、ソースに記述したリテラルテキスト（または `svelte-meta-tags`/`svelte-seo` の静的な `title` プロップ）を計測します。`titleTemplate` は最終的なタイトルがレンダリング時にしか定まらないため計測しません。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷されるテキストを計測します。ビルドが対象にするのはプリレンダリングされたルートだけです。ダッシュボードのライブ層はフック自身のオプションで動くため、設定ファイルに書いた `min`/`max` が効くのは静的ベースラインだけです。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/title-length': 'off'
  }
};
```
