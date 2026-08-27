---
title: a11y/disallowed-aria-props · この role では許されない ARIA 属性
description: 要素の role が対応しない aria-* 属性は無視され、role が禁止する属性 — 素の div への名前付け — は公開されない名前になります。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

要素の role が**禁止する**、または**所有しない** `aria-*` 属性を、ARIA 1.3 の role 表に照らしてコンポーネントのソースから検出します。

判定に使う role:

- 明示的な `role` — ブラウザが `role="switch checkbox"` を解決するのと同じく、最初の具体的なトークン。ARIA が定義しない role は `a11y/invalid-role` の検出であってこのルールのものではありません。DPUB-ARIA の role（`doc-toc` など）は判定されません — このルールが読む role 表は DPUB を含まないためです。
- それ以外は要素の implicit role — そして implicit role が文脈で変わる要素（`<a>` は `href` があるときだけ `link`、`<img alt="">` は `presentation`、`<input>` は `type` 次第）については、**その要素が取り得るすべての role**。判定はそのすべての下で成立するときにだけ行います。したがって `<div aria-label>` は発火し（`<div>` はどこでも `generic` で、`generic` は名前を取らない）、`<a aria-label>`、`<img aria-label>`、`<input aria-checked>` は発火しません。`<input>` はグローバルでない属性については事実上このルールで判定できません。`<input type="text" aria-checked>` は Svelte コンパイラの `a11y_role_supports_aria_props_implicit` がカバーします。
- 式による role、または literal な role のない spread は role を不明にします: 検出なし。

検出は 2 種類で、メッセージが異なります。

- 禁止 — 名前を取らない role の要素（`<div>`、`<span>`、`<p>`、`<code>`、`<label>`、`<time>` など）に置かれた `aria-label`、`aria-labelledby`、`aria-braillelabel`、または role の表が禁止と記す属性（`generic` に対する `aria-roledescription`）。メッセージ: "`aria-label` is prohibited on `<div>` — its role does not take a name"
- 非対応 — role の表に無い属性: `role="button"` の `aria-checked`、`<span>` の `aria-level`。メッセージ: "`aria-level` is not supported by role `generic`"

```svelte
<div aria-label="Breadcrumb">Home / Gallery</div>

<div role="button" tabindex="0" aria-checked="true">Toggle</div>
```

検出しないもの:

- `a11y/unknown-aria-attribute` が既に報告する属性 — typo 1 つに検出 1 件。
- ARIA 1.3 の表からは消えたが Svelte コンパイラのデータがまだ受け入れる (role, 属性) の組（`listitem` の `aria-level`、`listbox` の `aria-expanded` など）。同じマークアップでコンパイラとこのルールの判定が食い違う場合はコンパイラを優先します。
- `<address aria-label>` と `<hgroup aria-label>`: データセットは両方を名前を取らないと記しますが、ARIA in HTML 仕様と axe は両方に `role=group`（名前を取る）を与えています。このルールは仕様に従います。
- 値で直るもの（`a11y/invalid-aria-value`）や必須属性の欠落（`a11y/required-aria-props`）。

**Svelte コンパイラとの重複。** 明示的な role とコンパイラが対応表に持つ implicit role については、`a11y_role_supports_aria_props` / `_implicit` も*非対応*の場合を報告し、このルールはそれと一致します。コンパイラは*禁止*の場合には沈黙します — `<div aria-label>` は警告なしでコンパイルされます — そしてそれが実コードに現れるケースです。

**axe との違い。** axe の `aria-prohibited-attr` は、要素にテキスト内容があるとき _needs review_、無いときだけ _serious_ と評価し、最も近い祖先の role が widget であれば除外します。このルールはこれら全部を報告します: ARIA は、他に何がその要素を名付けているかに関わらず、その role でその属性を禁止しているからです。知っておくべきは `<label>` です — 仕様は `generic` として公開される場合にだけ名前付けを禁じますが、データセットと axe は無条件に禁じており、`<label for=… aria-label="close sidebar">` は発火します。

## なぜ重要か

非対応の `aria-*` 属性は支援技術に捨てられ、作者が伝えるつもりだった状態は伝わりません。禁止された属性はさらに悪く、素の `<div>` の `aria-label` はソース上ではラベル付きの領域に見えますが、スクリーンリーダーは何も読み上げません — ラベルは作者の頭の中にだけ存在します。

## 修正方法

属性に対応する role を要素に与えるか、その意味論を持つ要素へ属性を移します。

```svelte
<nav aria-label="Breadcrumb">Home / Gallery</nav>

<div role="switch" tabindex="0" aria-checked="true">Toggle</div>
```

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別の要素を抑制するには `<!-- svelte-vitals-disable-next-line a11y/disallowed-aria-props -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-aria-props': 'off'
  }
};
```
