---
title: a11y/invalid-aria-value · 不正な ARIA 属性値
description: aria-* 属性の値は、その属性に WAI-ARIA 仕様が定める型と一致させます。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

リテラルな `aria-*` 属性の値が、その属性に WAI-ARIA 仕様が定める型と一致しない場合を検出します。コンポーネントのソースを解析します。

チェック対象は仕様で定義済みの属性のみです（未知の属性名は `a11y/unknown-aria-attribute` が扱い、本ルールの対象外です）。仕様上の型ごとに検証方法が異なります。

- **boolean**(例: `aria-hidden`)。`true` か `false` のみ許可。
- **tristate**(例: `aria-checked`)。`true`・`false`・`mixed` のみ許可。
- **token**(例: `aria-live`)。その属性に定義された固定の値の中から選びます。
- **tokenlist**(例: `aria-relevant`)。空白区切りの 1 語以上で、各語が固定の値の中に含まれる。空の値は無効。
- **integer**(例: `aria-colcount`)。整数であること。
- **number**(例: `aria-valuenow`)。有限の数値であること。
- **string** / **id** / **idlist**(例: `aria-label`、`aria-activedescendant`)。どんなリテラルでも許可(静的にはチェックできない)。

ARIA 仕様の字面からは意図的に 2 点ずらしています。いずれも、実際にビルドに使う Svelte コンパイラに合わせるためです。仕様はいくつかの boolean 属性に `undefined` を値として挙げ、長さ 0 の文字列は属性が無いものとして扱うべきだとしていますが、コンパイラはどちらも拒否し（`a11y_incorrect_aria_attribute_type_boolean`）、このルールも拒否します。自分のビルドと食い違うルールは、第二の意見ではなくただのノイズだからです。

属性名と `role` 名は **大文字小文字を区別せず**に照合します（HTML が小文字化するため）。`ARIA-LABLE` はコンパイラと同じく `aria-lable` として報告されます。

検出しないもの:

- `aria-hidden="true"`。有効な boolean です。
- `aria-live="polite"`。有効な token です。
- 値が動的な属性(実行時の値は静的には分からないため): `aria-hidden={isHidden}`。
- 未知の属性名、例: `aria-bogus="x"`。`a11y/unknown-aria-attribute` の担当です。

## なぜ重要か

支援技術は `aria-*` 属性の値が仕様で定めた型と一致していることを前提に読み上げます。`aria-hidden="yes"` は boolean として認識されず、`aria-live="loud"` もライブリージョンの固定トークンのいずれでもありません。どちらも無視されるか誤って解釈され、著者が伝えたかった状態やリージョンがユーザーに届かないまま、見た目には何の異常もありません。

## 修正方法

その属性の WAI-ARIA 型に合った値を指定します(boolean なら `aria-hidden="true"`、token なら `aria-live="polite"` など):

```svelte
<div aria-hidden="true"></div>
```

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

意図的に非標準な値を使う場合は、`<!-- svelte-vitals-disable-next-line a11y/invalid-aria-value -->` で個別の要素を抑制するか、ルールを無効化してください。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/invalid-aria-value': 'off'
  }
};
```
