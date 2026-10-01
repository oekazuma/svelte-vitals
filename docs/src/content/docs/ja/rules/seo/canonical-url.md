---
title: seo/canonical-url · Canonical URL
description: すべてのルートに <link rel="canonical"> タグを含めるべきです。
---

**重大度:** warning

## チェック内容

すべてのルートには、直接指定またはレイアウトチェーンからの継承で `<link rel="canonical">` タグを含めるべきです。canonical リンクがない、あるいは空のルートを検出します。

セッションのない訪問者を別のページへ送るルートでは、検出を `info` として報告します。クローラーはセッションを持たないので、そのルートでは redirect かエラーしか見ないためです。ソース解析が認識するのは、ページ自身またはその上のレイアウトのサーバー `load` が、`if (!locals.user) redirect(…)` や `error(401)` のように、リクエストの `locals` だけを見るチェックで始まる場合です。`hooks.server.ts` やブラウザ側のガードは読まないので、そうして守られたルートは `warning` のままです。それらのルートでは `overrides` でルールを無効にするか、アプリ全体が非公開なら `seo: { indexable: false }` を設定してください。`rules` でこのルールに指定した重大度は、これらのルートにも適用されます。

## なぜ重要か

canonical URL は、どの URL が正規かを検索エンジンに伝えます。これにより、クエリ文字列違いだけの URL に評価が分散する、重複コンテンツの問題を防げます(末尾スラッシュの有無は SvelteKit 自身が既定で正規化するため、ここでは対象外です)。

## 修正方法

`<svelte:head>` 内に `<link rel="canonical">` を追加するか、メタコンポーネントの canonical プロップを設定します。

```svelte
<svelte:head>
  <link rel="canonical" href="https://example.com/this-page" />
</svelte:head>
```

## モードによる違い

**ソース解析**（CLI、ダッシュボードの静的ベースライン）は、各ルートの `<head>` を、ページとレイアウトチェーンの `<svelte:head>` からリポジトリ内のコンポーネントもたどって合成し、既知のメタコンポーネント（`svelte-meta-tags`、`svelte-seo`、`svead`）と `metaComponents` で宣言したものも加えます。リテラルに読めない値（`{data.title}`）は `dynamic` となり、`treatDynamicAs` で判定されます。関数が `import()` で読み込んでマウントするコンポーネントはブラウザでしか描画されません。その`<link rel="canonical">`は `ssr = false` のルートでは数えますが、サーバーレンダリングされるルートでは数えません。そのルートの HTML には含まれないためです。**レンダリング解析**（Vite プラグインのビルド、ダッシュボードで訪問したルート）は出荷される `<head>` を読み、値はすべてリテラルなので `treatDynamicAs` は関係ありません。ビルドが対象にするのはプリレンダリングされたルートだけです。両者が食い違うときは、レンダリング解析の結果を信じてください。

## 無効化

既存の検出は suppressions ファイルに記録して抑制できます（`npx svelte-vitals --update-suppressions`）。`overrides` でルートやパス単位に絞るか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/canonical-url': 'off'
  }
};
```
