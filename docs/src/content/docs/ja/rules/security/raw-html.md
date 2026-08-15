---
title: security/raw-html · 生 HTML のレンダリング
description: '{@html} は HTML をエスケープせずに描画します。値は必ずサニタイズしてください。'
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

<!-- svelte-vitals-disable-next-line security/raw-html -->
{@html DOMPurify.sanitize(html)}
```

サニタイズしても `{@html}` はソースに残るため、この検出は設計上ずっと発火し続けます。ルールの不具合ではなく、検出を消せる「修正」は存在しません。呼び出しをレビューし、値がサニタイズ済みであることを確認したら、上記のように inline directive で抑制してください（`{@html}` の直前の行に置く必要があります）。

汎用の HTML サニタイザーも、HTML ではないペイロードには不向きなツールです。よくある例が JSON-LD です。Svelte はマークアップ内の `<script>` タグの中にある `{...}` 式を評価せず、そのままリテラルテキストとして出力するため、動的な JSON-LD ブロックは `{@html}` で挿入する必要があります——そして HTML 用のサニタイザーは、そこでは見当違いの検査しかできません。この挿入を安全にするのは script 安全なシリアライズです。`<` を `\u003c` にエスケープし（例: `JSON.stringify(data).replace(/</g, '\\u003c')`）、文字列値に含まれる `</script>` がタグを途中で閉じて以降がマークアップとして解釈されないようにします。データを「信頼できる」とレビューするだけでは不十分です——正当なデータにも `</script>` は含まれ得ます。値がこの形でシリアライズされている（または完全にリテラルでレビュー済みの JSON である）ことを確認できたら、HTML サニタイザーを通すのではなく、この検出を抑制してください。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line security/raw-html -->` を置きます。ルールごと無効化するには:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'security/raw-html': 'off'
  }
};
```
