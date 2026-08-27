---
title: a11y/disallowed-element · 禁止された要素
description: プロジェクトが「使わない」と宣言した要素の出現をすべて報告します — 宣言するまでは何もしません。
---

**重大度:** warning · **カテゴリ:** a11y

宣言駆動のルールで、ルール自身の意見はありません。何も宣言しなければ何もせず、プロジェクトが使いたくないタグを宣言すれば、その出現がすべて検出になります。

## チェック内容

コンポーネントのソース中で、タグ名が宣言リストに含まれるすべての要素。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': { options: { elements: ['iframe', 'marquee'] } }
  }
};
```

`elements` は**素のタグ名**のリストです — 先頭は英字、続けて英数字とハイフンなので、カスタム要素名（`my-widget`）も書けます — 大文字小文字は区別しません。それ以外（`input[type=file]`、`.legacy`、`div > p`）は config 読み込み時に拒否されます。受理してしまうと黙って何にもマッチしない値になり、後で意味を与えると受理済みの config の意味が変わってしまうためです。宣言を「どこに」効かせるかは、他のルールと同じく `overrides` の役割です。`files` や `route` を持つエントリは、マッチしたファイルに対してリストに**追加**します（`string-list` オプションは追加であって置換ではありません）。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': { options: { elements: ['iframe'] } }
  },
  overrides: [
    { files: 'src/routes/(marketing)/**', rules: { 'a11y/disallowed-element': { options: { elements: ['video'] } } } }
  ]
};
```

検出は要素の開始タグの行に紐づくので、タグが何行にまたがっていても、直上の `<!-- svelte-vitals-disable-next-line a11y/disallowed-element -->` 1 つで抑制できます。要素があり禁止要素のないコンポーネントは pass になります。

見えないもの: `<svelte:element this="iframe">` — `this` がリテラルでも、収集器にとってタグは動的です。

## なぜ重要か

そのプロジェクトのマークアップに居場所のない要素があります — コンテンツページの `<iframe>`、移行途中のレガシーなカスタム要素、どこであれ `<font>` — そしてレビューコメントはスケールしません。ここで宣言すれば、ルールがレビュアーになり、他の検出と同じくスコアされ gate されます。

## 修正方法

プロジェクトが好む要素に置き換えるか、許可するファイルについて `overrides` エントリで宣言を絞ります。

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別の要素を抑制するには `<!-- svelte-vitals-disable-next-line a11y/disallowed-element -->` を置きます。宣言を消すか、ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'a11y/disallowed-element': 'off'
  }
};
```
