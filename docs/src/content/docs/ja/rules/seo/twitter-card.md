---
title: seo/twitter-card · Twitter Card
description: X/Twitter でのシェアをリッチ表示にするため、twitter:card を宣言すべきです。
---

**重大度:** info

## チェック内容

すべてのルートは `<meta name="twitter:card">` を持つべきです（直接指定でも継承でも構いません）。欠けているルートを検出します。

## なぜ重要か

twitter:card は、ページが X/Twitter で共有されたときの表示形式を決めます。ない場合は簡素なリンク表示になります（カードのタイトルや画像には Open Graph タグがフォールバックとして使われます）。

## 修正方法

```svelte
<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```
