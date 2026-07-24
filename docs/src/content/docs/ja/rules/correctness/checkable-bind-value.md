---
title: correctness/checkable-bind-value · bind:value on a checkable input
description: 'checkbox や radio に対する bind:value は DOM の value プロパティを束縛するため、チェックの切り替えを検知できず、束縛した値が更新されなくなります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`bind:value` ディレクティブを持つネイティブの `<input type="checkbox">` または `<input type="radio">` 要素を検出します:

```svelte
<input type="checkbox" bind:value={subscribed} />
```

`bind:value` は DOM の `value` プロパティを束縛します。checkbox・radio のユーザー操作が切り替えるのは _チェック状態_ であって `value` ではないため、`subscribed` は初期値のまま固まってしまい、ユーザーがチェックボックスをクリックしても更新されません。

検出はテンプレートのみを対象にした静的解析です。`type` 属性がリテラルの `"checkbox"` または `"radio"` である場合のみ対象になります — 動的な `type={expr}` や、動的なタグ名を使う `<svelte:element this="input" …>` は静的解析の範囲外のため検出しません。素の `value="…"` 属性（`bind:value` ディレクティブではないもの）は `bind:group` の正しい使い方であり、検出対象と混同することはありません。

## なぜ重要か

Svelte のコンパイラ自身は、checkbox や radio に `bind:value` を使っても警告もエラーも一切出しません — Svelte 5 に対して直接検証済みです（`svelte.compile()` はこのパターンに対して警告ゼロを報告します）。コンポーネントは最初の描画では正しく見えます（束縛した変数の初期値が表示される）が、ユーザーが入力を操作した瞬間から静かに更新が止まります。開発中は何もそのバグを教えてくれず、本番環境で「フォームの変更が保存されない」という形で表面化します。

## 修正方法

単一のチェックボックスなら、チェック状態を直接束縛します:

```svelte
<input type="checkbox" bind:checked={subscribed} />
```

チェックボックスのリストや radio グループなら、代わりにグループを束縛します — 各 input には選択肢を識別するための静的な `value` をそのまま残します:

```svelte
<input type="radio" bind:group={selected} value="a" />
<input type="radio" bind:group={selected} value="b" />
```

## 制限事項

対象になるのは `type` が静的なリテラルであるネイティブの `<input>` 要素だけです。動的な `type={expr}`、`<svelte:element this="input" …>`、`<select bind:value>`、そして `bind:value` 風の prop を受け取る自作コンポーネント（例: 自前の `<Checkbox bind:value>`）は、いずれも静的解析の範囲外のため検出されません。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/checkable-bind-value': 'off'
  }
};
```
