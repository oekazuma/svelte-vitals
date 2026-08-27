---
title: correctness/checkable-bind-value · bind:value on a checkable input
description: checkbox や radio の bind:value は DOM の value プロパティを見るため、チェックを切り替えても値が更新されません。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`bind:value` ディレクティブを持つネイティブの `<input type="checkbox">` または `<input type="radio">` 要素を検出します。

```svelte
<input type="checkbox" bind:value={subscribed} />
```

`bind:value` は DOM の `value` プロパティを束縛します。checkbox・radio のユーザー操作が切り替えるのは _チェック状態_ であって `value` ではないため、`subscribed` は初期値のまま固まってしまい、ユーザーがチェックボックスをクリックしても更新されません。

検出はテンプレートのみを対象にした静的解析で、`type` 属性がリテラルの `"checkbox"` または `"radio"` の場合だけ対象になります。動的な `type={expr}` や `<svelte:element this="input" …>` は静的解析の範囲外です。素の `value="…"` 属性（`bind:value` ディレクティブではないもの）は `bind:group` の正しい使い方で、検出対象と混同することはありません。

## なぜ重要か

コンパイル時には何も捕まりません。Svelte 5 で検証済みで、`svelte.compile()` はこのパターンに警告ゼロを報告します。

実行時の挙動は2つの input で分かれます。**checkbox** は `bind_invalid_checkbox_value`（「checkbox に `bind:value` は使えません。`bind:checked` を使ってください」）を throw しますが、これは開発ビルドに限られます。本番ビルドではこのチェックがスキップされ、束縛は checked 状態ではなく `value` 属性を静かに追跡するようになり、下記の radio と同じ挙動になります。**radio** はどちらのビルドでも何も throw しません。最初の描画は正しく見えます（束縛した変数の初期値が表示される）が、ユーザーが操作した瞬間から静かに更新が止まります。開発中は何も教えてくれず、本番で「フォームの変更が保存されない」という形で表面化します。

## 修正方法

単一のチェックボックスなら、チェック状態を直接束縛します。

```svelte
<input type="checkbox" bind:checked={subscribed} />
```

チェックボックスのリストや radio グループなら、代わりにグループを束縛します — 各 input には選択肢を識別するための静的な `value` をそのまま残します。

```svelte
<input type="radio" bind:group={selected} value="a" />
<input type="radio" bind:group={selected} value="b" />
```

## 制限事項

対象になるのは `type` が静的なリテラルであるネイティブの `<input>` 要素だけです。動的な `type={expr}`、`<svelte:element this="input" …>`、`<select bind:value>`、そして `bind:value` 風の prop を受け取る自作コンポーネント（例: 自前の `<Checkbox bind:value>`）は、いずれも静的解析の範囲外のため検出されません。

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/checkable-bind-value': 'off'
  }
};
```
