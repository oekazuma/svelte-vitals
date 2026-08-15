---
title: architecture/route-component-import · ルートコンポーネントの import
description: SvelteKit のルートエントリはフレームワークが描画するものであり、他のコンポーネントから import するものではありません。
---

**重大度:** info · **カテゴリ:** architecture

## チェック内容

SvelteKit のルートエントリ —— `+page.svelte`、`+layout.svelte`、`+error.svelte`、および `+page` / `+layout`
の `@` 分岐形式 —— を、別のコンポーネントから import している箇所を検出します。

## なぜ重要か

ルートエントリは、SvelteKit がそれを描画するという前提で書かれています。Kit はページに `data` と
`params` を渡し、エラーページには `page.error` と `page.status` を渡します。別の場所から import
すると、コンポーネントはそのどれも受け取れず、何もないまま描画されるか —— あるいは import
している側のページのデータを、自分のものであるかのように受け取って描画します。

この間違いは起こしやすく、一見もっともらしく見えます。別のページが同じマークアップを必要としていて、
そのマークアップはすでに `+page.svelte` の中にある —— だから import してしまう。他に異議を唱えるものは
何もなく、コンポーネントはそのまま描画されます —— 空のままで。

## 修正方法

共有したいマークアップを `$lib` 配下のコンポーネントとして切り出し、両方の場所からそれを import
してください。ルートエントリ自体は SvelteKit に任せます。

## 設定

| オプション        | 型            | デフォルト                                                        |
| ----------------- | ------------- | ----------------------------------------------------------------- |
| `exemptImporters` | `string-list` | `['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte']` |

`exemptImporters` にマッチするファイルは、ルートエントリを import してもかまいません。ストーリーは
それを見るために描画し、テストはそれに対してアサートするために描画し、どちらも SvelteKit が渡すはずの
ものを手で用意しています。

**このデフォルトは意図的に狭く、設定することは例外的な対応ではなく、想定された手順です。**
`string-list` のオプションはデフォルトに追加されるだけで、置き換えはできません。つまりこの
リストを広げることはできても狭めることはできません —— だからこそ、エコシステム全体で共通する規約
だけをデフォルトとして持たせています。プロジェクトが別の方法でサテライトファイルを示している
場合は、自分のパターンを追加してください。

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/route-component-import': {
      options: { exemptImporters: ['**/*.fixture.svelte'] }
    }
  }
};
```

## 報告されないもの

- ルートエントリへの動的 `import()`。import 宣言ではないため、アナライザーは検出しません。
- 素の `.ts` / `.js` ファイルからの import。import に関する事実は `.svelte` コンポーネントファイルと
  `.svelte.ts` / `.svelte.js` モジュールからのみ収集します。
- 型のみの import（`import type P from './+page.svelte'`、またはすべての指定子がインラインで型
  指定されているもの）。ビルド時に消えるため、何も描画されません。
- ルートが `src/routes` 以外の場所にあるプロジェクト。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line architecture/route-component-import -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'architecture/route-component-import': 'off'
  }
};
```
