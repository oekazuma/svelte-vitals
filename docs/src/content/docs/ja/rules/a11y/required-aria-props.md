---
title: a11y/required-aria-props · Missing required ARIA props
description: state や property 属性を要求するロールには、ネイティブなホスト要素のセマンティクスで代替されない限り、それらの属性が必要です。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

1 つ以上の `aria-*` 属性を要求するロールを指定するリテラルな `role` 属性があり、その属性が要素上に 1 つも存在しない場合を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

属性は、値がリテラルでも動的な式でも「存在する」とみなされます。ここで問題になるのは属性の存在そのものであり、値の妥当性は対象外です（不正な値は `a11y/invalid-aria-value` が扱います）。

一部の必須プロパティは、ARIA-in-HTML の仕様に従って特定のホスト要素がネイティブに供給するため、明示的な属性は不要です。

- `aria-checked` — `<input type="checkbox">` と `<input type="radio">` が供給。
- `aria-selected` — `<option>` が供給。
- `aria-level` — `<h1>`〜`<h6>` が供給。
- `aria-valuenow` — `<input type="range">`、`<progress>`、`<meter>` が供給。

検出しないもの:

- `<div role="checkbox" aria-checked="true">` — 必須プロパティがリテラルとして存在する。
- `<div role="checkbox" aria-checked={checked}>` — 必須プロパティが式として存在する。
- `<input type="checkbox" role="switch">` — `switch` が要求する `aria-checked` は、input のネイティブなチェックボックスのセマンティクスで供給される。
- ロールのフォールバックリスト（`role="switch checkbox"`） — 実行時に実際に適用されるのは先頭のトークンだけなので、どちらの解釈でチェックしても誤検出のおそれがある。このルールはフォールバックリストを一律スキップする。
- 式で値が決まるロール（静的には値がわからないため）: `role={dynamicRole}`。

## なぜ重要か

一部の WAI-ARIA ロールは、支援技術が自力では推測できない状態を持ちます。チェック済み・未チェックを知る手段のない `role="checkbox"` は、発見可能な状態を持たないコントロールとしてアナウンスされます。ユーザーには「チェックボックス」としか聞こえず、それ以上の情報はなく、見た目には何かが欠けている兆候もありません。

## 修正方法

ロールが要求する属性を追加します:

```svelte
<div role="checkbox" aria-checked={checked}>Subscribe</div>
```

または、その状態をすでにネイティブに供給する要素を使います:

```svelte
<input type="checkbox" bind:checked />
```

## 無効化

必須プロパティを意図的に省略する場合は、`<!-- svelte-vitals-disable-next-line a11y/required-aria-props -->` で個別の要素を抑制するか、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/required-aria-props': 'off'
  }
};
```
