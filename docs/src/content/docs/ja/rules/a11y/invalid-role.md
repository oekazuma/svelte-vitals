---
title: a11y/invalid-role · Invalid ARIA role
description: role 属性には、タイポでも抽象ロールでもない、具体的な WAI-ARIA ロールを指定します。
---

**重大度:** warning · **カテゴリ:** a11y

## チェック内容

リテラルな `role` 属性の値が、有効かつ具体的な WAI-ARIA ロールでない場合を検出します。`src/` 配下のすべての `.svelte` コンポーネントを静的（CLI）解析します。

`role` にはスペース区切りのフォールバックリスト（`role="switch checkbox"`）を指定できますが、その各トークンを個別にチェックします。検出対象は次の 2 種類です。

- **未知のトークン** — タイポや存在しないロール名（例: `role="botton"`）。
- **抽象ロール** — WAI-ARIA の分類体系を整理するためだけに存在し、直接使うことを意図していないロール（例: `role="widget"`、`role="input"`）。

検出しないもの:

- 具体的なロール: `role="button"`。
- すべてのトークンが具体的なフォールバックリスト: `role="switch checkbox"`。
- 式で値が決まるロール（静的には値がわからないため）: `role={dynamicRole}`。

## なぜ重要か

支援技術は `role` を固定の WAI-ARIA 語彙にマッピングします。認識できないロール（タイポや抽象ロール）は無視されるか誤読され、要素は暗黙の（多くは汎用的な）セマンティクスにフォールバックします。ボタン・スイッチ・ダイアログとして読み上げさせたいという作者の意図は、見た目には何の異常もないまま失われます。

## 修正方法

具体的な WAI-ARIA ロールを指定するか、要素本来のネイティブなセマンティクスで十分ならその属性自体を削除します:

```svelte
<div role="button">Click</div>
```

## 無効化

意図的に非標準なロールを使う場合は、`<!-- svelte-vitals-disable-next-line a11y/invalid-role -->` で個別の要素を抑制するか、ルールを無効化してください:

```js svelte-vitals.config.mjs
export default {
  rules: {
    'a11y/invalid-role': 'off'
  }
};
```
