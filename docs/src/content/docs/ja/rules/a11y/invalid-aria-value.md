---
title: a11y/invalid-aria-value · 不正な ARIA 属性値
description: aria-* 属性の値は、その属性に WAI-ARIA 仕様が定める型と一致させます。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

リテラルな `aria-*` 属性の値が、その属性に WAI-ARIA 仕様が定める型と一致しない場合を検出します。コンポーネントのソースを解析します。CLI と Vite プラグインの両方が対象で、プラグインも同じ `.svelte` ファイルを読むため、どちらのモードでも結果は同一です。 `--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

チェック対象は仕様で定義済みの属性のみです（未知の属性名は `a11y/unknown-aria-attribute` が扱い、本ルールの対象外です）。仕様上の型ごとに検証方法が異なります。

- **boolean**(例: `aria-hidden`) — `true` か `false` のみ許可。
- **tristate**(例: `aria-checked`) — `true`・`false`・`mixed` のみ許可。
- **token**(例: `aria-live`) — その属性に定義された固定の値の中から選ぶ。
- **tokenlist**(例: `aria-relevant`) — 空白区切りの各語がすべて固定の値の中に含まれる。
- **integer**(例: `aria-colcount`) — 整数であること。
- **number**(例: `aria-valuenow`) — 有限の数値であること。
- **string** / **id** / **idlist**(例: `aria-label`、`aria-activedescendant`) — どんなリテラルでも許可(静的にはチェックできない)。

検出しないもの:

- `aria-hidden="true"` — 有効な boolean。
- `aria-live="polite"` — 有効な token。
- 値が動的な属性(実行時の値は静的には分からないため): `aria-hidden={isHidden}`。
- 未知の属性名、例: `aria-bogus="x"` — `a11y/unknown-aria-attribute` の担当。

## なぜ重要か

支援技術は `aria-*` 属性の値が仕様で定めた型と一致していることを前提に読み上げます。`aria-hidden="yes"` は boolean として認識されず、`aria-live="loud"` もライブリージョンの固定トークンのいずれでもありません。どちらも無視されるか誤って解釈され、著者が伝えたかった状態やリージョンがユーザーに届かないまま、見た目には何の異常もありません。

## 修正方法

その属性の WAI-ARIA 型に合った値を指定します(boolean なら `aria-hidden="true"`、token なら `aria-live="polite"` など):

```svelte
<div aria-hidden="true"></div>
```

## 無効化

意図的に非標準な値を使う場合は、`<!-- svelte-vitals-disable-next-line a11y/invalid-aria-value -->` で個別の要素を抑制するか、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/invalid-aria-value': 'off'
  }
};
```
