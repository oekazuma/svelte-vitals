---
title: a11y/aria-hidden-focus · aria-hidden がフォーカス可能な要素を隠している
description: キーボードでフォーカスできる要素を aria-hidden="true" で支援技術から隠してはいけません。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

リテラルな `aria-hidden="true"` によって支援技術から隠されている、キーボードでフォーカス可能な要素を検出します。属性が要素自身に付いている場合も、祖先に付いている場合も対象です。

```svelte
<div aria-hidden="true">
  <button>Hidden but focusable</button>
</div>

<a href="/x" aria-hidden="true">Also flagged</a>
```

「フォーカス可能」の判定は `a11y/interactive-nesting` の子孫側と同じ要素集合です: `<button>`、`<a href>`、フォームコントロール、`<audio controls>`/`<video controls>`、リテラルな `tabindex` ≥ 0、リテラルなインタラクティブ ARIA ロール。

検出しないもの:

- 式で与えられた `aria-hidden`（`aria-hidden={!open}`）。トグルされる値は静的には判定できないため、閉じている間は隠し、開いたら外すという正当な開閉パターンがこのルールに引っかかることはありません。式の `tabindex` も同じ理由で判定不能（`-1` に解決されうる）なので、その要素は対象外です。
- リテラルな負の `tabindex` でタブ順から外された要素。`<button tabindex="-1" aria-hidden="true">` は定石の修正形で、アクセシビリティツリーとキーボードフォーカスの両方から一貫して隠れています。
- `disabled` の付いたフォームコントロール（`<button>`、`<input>`、`<select>`、`<textarea>`）。無効化された要素はタブ順からも外れています。
- `inert` または `hidden` 属性を持つ要素とその配下すべて。`inert` のサブツリーはフォーカス不能になり、`hidden` のサブツリーはレンダリングされないため、どちらも `aria-hidden` との組み合わせは欠陥ではなく一貫した状態です。
- `aria-hidden="false"`、およびフォーカス可能な要素を含まない `aria-hidden="true"` のサブツリー（装飾用の `<svg aria-hidden="true">` アイコンは検出されません）。
- 値なしの省略記法 `<div aria-hidden>`。Svelte はこれを `aria-hidden=""` としてレンダリングし、空値は不正な値として支援技術に未設定と扱われるため、リテラルな `"true"` だけを見るこのルールの対象外です。また、タグが静的に判定できない `<svelte:element>` も、他の要素系ルールと同じ既知の非対応事項です。
- `aria-hidden` コンテナの内側にレンダリングされる子コンポーネント内のフォーカス可能な要素。このルールは 1 つのコンポーネント自身のテンプレートしか見ないため、この変種は既知の非対応事項です。

## なぜ重要か

`aria-hidden="true"` の内側にある要素は、支援技術には一切アナウンスされないのに、キーボードでは到達できたままです。スクリーンリーダーのユーザーは Tab キーで「自分にとって存在しない」コントロールに着地することになります。しかも作った本人はこの欠陥に気づけません。`aria-hidden` は見た目を何も変えないので、晴眼の開発者にはページは普段どおりに見え、普段どおりにクリックできます。このバグに遭遇するのは支援技術のユーザーだけです。WAI-ARIA がフォーカス可能なコンテンツをこの方法で隠すことを禁じているのは、そのためです。

## 修正方法

`aria-hidden` を外すか、要素をタブ順からも外します。

```svelte
<div aria-hidden="true">
  <button tabindex="-1">Consistently hidden</button>
</div>
```

モーダルの背景やオフスクリーンのパネルのような非アクティブ領域を隠すには、`inert` 属性を使うのがより安全です。サブツリーをアクセシビリティツリーとタブ順から同時に取り除けます。

```svelte
<div inert={dialogOpen}>
  <button>Backdrop content</button>
</div>
```

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

その要素が別の方法（スクリプトによるフォーカス管理など）で本当に到達不能になっている場合は、`<!-- svelte-vitals-disable-next-line a11y/aria-hidden-focus -->` で個別の要素を抑制するか、ルールを無効化してください。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/aria-hidden-focus': 'off'
  }
};
```
