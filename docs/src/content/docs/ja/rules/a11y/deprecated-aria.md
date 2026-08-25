---
title: a11y/deprecated-aria · 非推奨の ARIA role または属性
description: ARIA 1.3 が — 全体として、または置かれた role 上で — 非推奨にした role や aria-* 属性は、いまも動くが、そこではもう定義されていません。
---

**重大度:** info · **カテゴリ:** a11y

`warning` ではなく `info` としています。role や属性は現行の支援技術ではまだ動くためです。この検出が言っているのは、ARIA 1.3 がそれを定義から外したので、そこでの意味がもう保証されないということです。

## チェック内容

ARIA 1.3 の表に照らして 3 つを、コンポーネントのソースから検出します。

- 非推奨の role: `role="directory"`（代替は `list`）。
- 全体として非推奨の属性: `aria-dropeffect` と `aria-grabbed`。どの要素でも。
- 解決した role 上で非推奨の属性: `checkbox` の `aria-haspopup`、`generic`（素の `<div>`/`<span>`）の `aria-disabled`、その他 ARIA 1.2 と 1.3 が外した組み合わせ。role の解決は `a11y/disallowed-aria-props` と同じです — 明示的な role の最初の具体的トークン、または要素が取り得るすべての implicit role で、そのすべての下で非推奨のときにだけ検出します。

```svelte
<div role="checkbox" tabindex="0" aria-checked="false" aria-haspopup="true">…</div>

<div aria-grabbed="true">…</div>
```

検出しないもの: `a11y/unknown-aria-attribute` が既に報告する属性。role ごとの判定は、DPUB-ARIA の role、式による role、literal な role のない spread では判定しません — role が不明なためです。一方、非推奨の role と 2 つのグローバル属性はそれに関わらず報告されます。

**Svelte コンパイラとの重複。** 明示的な role については、コンパイラは role ごとのケースを*非対応*として（`a11y_role_supports_aria_props`、warning）報告します — その ARIA データは非推奨属性にフラグを付けるのではなく削除したためです。判定は同じで、ラベルと重大度が異なります。素の `<div>`/`<span>` — 実際に多いケースの `aria-disabled` — ではコンパイラは沈黙します。`role="directory"` と 2 つのグローバル属性についても沈黙します。

## なぜ重要か

ARIA における非推奨は role の定義からの削除です。今日の支援技術の多くは古い意味をまだ尊重しますが、次の版がそうする必要はなく、属性を残したままの書き換えは未定義の挙動への依存を残します。

## 修正方法

`role="directory"` は `role="list"` に置き換え、`aria-dropeffect`/`aria-grabbed` は削除し（ドラッグ&ドロップはいまはウィジェット自身の意味論で表現します）、role 上で非推奨の属性はその role がまだ定義している要素へ移すか削除します。

```svelte
<div role="checkbox" tabindex="0" aria-checked="false">…</div>
```

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別の要素を抑制するには `<!-- svelte-vitals-disable-next-line a11y/deprecated-aria -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/deprecated-aria': 'off'
  }
};
```
