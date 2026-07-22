---
title: security/raw-html · 生 HTML のレンダリング
description: '値をサニタイズしてください。{@html} はエスケープされない HTML を描画します。'
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

コンポーネント内のすべての `{@html …}` を検出します（CLI による `src/**/*.svelte` の静的解析）。

## なぜ重要か

`{@html}` は値をエスケープせずに HTML として描画します。値にユーザー入力が混ざり得るのにサニタイズされていなければ、クロスサイトスクリプティング（XSS）の経路になります。静的解析ではサニタイズの有無を証明できないため、すべての使用箇所をレビュー対象として提示します。

## 修正方法

描画前にサニタイズするか、テキスト/マークアップとして描画します。

```svelte
<script>
  import DOMPurify from 'dompurify';
  let { html } = $props();
</script>

{@html DOMPurify.sanitize(html)}
```
