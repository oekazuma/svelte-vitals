---
title: seo/description-length · 説明文の長さ
description: meta description は 70〜160 文字に収めましょう。
---

**重大度:** info

## チェック内容

内容が 70 文字未満または 160 文字を超える静的な `<meta name="description">` を検出します。長さは、空白のトリムと圧縮を行ってから書記素クラスタ単位で数えます（絵文字は 1 文字扱い）。動的な説明文は検査しません。

## なぜ重要か

説明文が短すぎると検索スニペットを活かしきれず、長すぎると検索エンジンに切り詰められて行動喚起が途切れます。

## 修正方法

```svelte
<svelte:head>
  <meta
    name="description"
    content="このページでは、SvelteKit で構築したサイトの SEO を強化し、検索結果での表示やクリック率を改善するための具体的な手順をわかりやすく解説します。"
  />
</svelte:head>
```

## 設定

| オプション | 型      | デフォルト |
| ---------- | ------- | ---------: |
| `min`      | integer |         70 |
| `max`      | integer |        160 |

```js svelte-vitals.config.js
export default {
  rules: { 'seo/description-length': { options: { min: 50, max: 155 } } }
};
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、ソースに記述したリテラルな内容（または `svelte-meta-tags`/`svelte-seo` の静的な `description` プロップ）を計測します。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される内容を計測します。ビルドが対象にするのはプリレンダリングされたルートだけです。ダッシュボードのライブ層はフック自身のオプションで動くため、設定ファイルに書いた `min`/`max` が効くのは静的ベースラインだけです。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/description-length': 'off'
  }
};
```
