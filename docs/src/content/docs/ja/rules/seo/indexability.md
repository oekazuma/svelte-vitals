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

このルートをインデックスさせたい場合は robots メタから `noindex` を外します：

```svelte
<svelte:head>
  <meta name="robots" content="index, follow" />
</svelte:head>
```

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/indexability': 'off'
  }
};
```
