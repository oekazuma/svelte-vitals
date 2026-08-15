---
title: a11y/top-level-landmark · ランドマークのネスト
description: banner・main・complementary・contentinfo ランドマークは、他のランドマークの内側に置いてはいけません。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

ルートを構成するレイアウトチェーン（`+layout.svelte` から `+page.svelte` まで）と、そこから解決したローカルコンポーネントを合わせたときに、`banner`・`main`・`complementary`・`contentinfo` のいずれかのランドマークが、別のランドマークの内側にネストしてしまっているケースを検出します。

代表的なケースは、レイアウトが子要素を `<main>` の中に描画し、ページが別のランドマーク、例えば `role="complementary"` の `<aside>` を描画する場合です。

```svelte +layout.svelte
<header>サイトナビゲーション</header><main><slot /></main>
```

```svelte +page.svelte
<h1>ページの本文</h1><aside role="complementary">関連リンク</aside>
```

どちらのファイル単体を見ても問題はありません。ファイル単位のマークアップ linter ではこれを検出できません。このネストは、レイアウトの `<main>` とページの `complementary` をファイルをまたいで合成して初めて存在するものだからです。

検出しないもの:

- `banner`/`main`/`complementary`/`contentinfo` のいずれのランドマークも存在しないルート。
- 中間の非ランドマークコンポーネントを介したネスト: `+page.svelte` が `<main>` の中に `<Sidebar />` を配置し、`Sidebar.svelte` 自身が `role="complementary"` を描画するケースは対象外です。検出はファイル単位のカウントとレイアウトの `<slot>` の直接ケースに限られ、すべての中間コンポーネントをたどるコールグラフ解析ではありません。

## なぜ重要か

支援技術は `banner`・`main`・`complementary`・`contentinfo` を、それぞれ独立したページ最上位の領域だという前提でランドマークとして公開し、ユーザーはキー操作でそれらの間をジャンプします。あるランドマークが別のランドマークの内側にネストしていると、その意味が失われます。ランドマークナビゲーションから消えてしまうか、本来独立した領域であるはずが外側のランドマークのコンテンツの一部として読み上げられてしまいます。

## 修正方法

すべてのランドマークがルートの最上位で合成されるよう、ネストしたランドマークを外に出します。

```svelte +layout.svelte
<header>サイトナビゲーション</header><main><slot /></main>
```

```svelte +page.svelte
<h1>ページの本文</h1>
<aside role="complementary">関連リンク</aside>
<!-- +layout.svelte の <main> の下から外に出した -->
```

## モードによる違い

両モードともランドマークを収集しますが、収集元が異なるため結果が食い違うことがあります。

- **静的(CLI)** は、ルートのレイアウトチェーンと、そこから解決したローカルコンポーネントを合成してネストを検出します。解決できないコンポーネント（`node_modules` や動的に選ばれるコンポーネント）によるネストは見えません。
- **レンダリング(vite)** は最終的なプリレンダリング済み HTML を読むため、解決可否によらずどのコンポーネントが生んだネストも認識します。ソースファイルを持たないため、検出結果の位置は特定のファイル・行ではなくルート自体に紐づきます。同じ不具合でも、永続化される検出キーはモードによって異なります。

両者が食い違う場合は、レンダリング結果を信頼してください。ブラウザに配信される内容を反映しているのはそちらです。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/top-level-landmark': 'off'
  }
};
```
