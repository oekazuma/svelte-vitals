---
title: a11y/placeholder-label-option · プレースホルダーの option がない
description: required かつ単一選択の select には、値を選ばせずに送信できてしまわないよう空の先頭 option が必要です。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

`multiple` 属性を持たず、表示サイズが未指定または `1` の `<select required>` について、その最初の `option` 要素の子がプレースホルダーラベルオプションになっていない場合を検出します。コンポーネントのソースを解析します。CLI と Vite プラグインの両方が対象で、プラグインも同じ `.svelte` ファイルを読むため、どちらのモードでも結果は同一です。 `--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

HTML 仕様上、プレースホルダーラベルオプションとは最初の `option` であり、次のいずれかを満たす必要があります。

- 空の `value` 属性: `<option value="">Choose…</option>`
- `value` 属性がなく、かつテキスト内容もない: `<option></option>`

検出しないもの:

- `multiple`、または表示 `size` が `1` より大きい場合 — ブラウザが初期選択を強制しないため、プレースホルダーが不要です。
- `required` 属性がない場合。
- `required`・`multiple`・`size` が式で値が決まる場合（静的には値がわからないため）。
- 最初の option の `value` が式で決まる場合、またはテキスト内容に `{式}` を含む場合（実質的な値が静的にはわからないため）。
- select の最初の子が `{#each}` ブロックやコンポーネントである場合（最初の option として何が描画されるか静的に判断できないため）。
- `<select>` へのスプレッド属性（`multiple` や `size` を供給しうる）、または最初の `<option>` へのスプレッド属性（`value` を供給しうる）— どちらもチェックの入力が不明になるため、要素ごとスキップします。

```svelte
<select required>
  <option value="">Choose…</option>
  <option value="a">A</option>
</select>
```

## なぜ重要か

required な `<select>` は、最初の option を初期状態の選択値として表示します。その option が空のプレースホルダーでない場合、ユーザーが一度も能動的に選んでいない値をフィールドがすでに保持していることになり、実際には何も選ばないままフォームを送信できてしまいます。スクリーンリーダーもその値をすでに選択済みとして読み上げるため、まだ選択が必要だという手がかりが利用者に伝わりません。

## 修正方法

最初の `option` を空のプレースホルダーにします:

```svelte
<select required>
  <option value="">Choose…</option>
  <option value="a">A</option>
</select>
```

`disabled` だけを付けてはいけません。`select` のリセットアルゴリズムは disabled **でない**最初の option を選ぶため、placeholder を disabled にすると `A` が選ばれた状態になり、`required` は満たされ、ユーザーは自分で選んでいない値を送信することになります — このルールが報告している害そのものです。選択不可にしたい場合は `disabled selected` と書き、placeholder が初期選択のままになるようにしてください。

## 無効化

最初の option が意図的にプレースホルダーではなく実際の値である場合は、`<!-- svelte-vitals-disable-next-line a11y/placeholder-label-option -->` で個別の要素を抑制するか、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/placeholder-label-option': 'off'
  }
};
```
