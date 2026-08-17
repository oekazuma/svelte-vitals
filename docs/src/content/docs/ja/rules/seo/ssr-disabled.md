---
title: seo/ssr-disabled · SSR の無効化
description: export const ssr = false にすると、JS を実行しないクローラーからコンテンツが見えなくなり、初回描画も遅くなります。
---

**重大度:** warning · **カテゴリ:** seo

## チェック内容

`export const ssr = false` でサーバーサイドレンダリングを無効化している SvelteKit のルートファイルを検出します（`satisfies`/`as` 形式や同一ファイル内のエイリアス export も対象）。ルートの `+layout` で無効化するとアプリ全体が SPA になるため、その場合はより強い、アプリ全体を対象としたメッセージを出します。

検出対象外: `csr = false`（サーバー専用レンダリングであり、SEO にはむしろ良い）、`export const ssr = dev` のような非リテラル値（静的に評価不能）、export されていない `const ssr = false`（SvelteKit では効果がない）。

## なぜ重要か

SvelteKit 公式の SEO ガイダンスによれば、サーバーレンダリングされたコンテンツはより頻繁に、そして確実にインデックスされます。正当な理由がない限り SSR は有効のままにすべきです。インデックスへのリスクに加えて、SPA モードは空のページを配信し、JavaScript を取得して実行するまで何も描画しないため、最初の描画までにネットワークラウンドトリップが 1 回増えます。

`prerender = true` を併用してもこの問題は解消されません。`ssr = false` では事前レンダリングの出力も空のシェルになります。

## 修正方法

`ssr = false` は、SEO が本当に不要なルートに限定します：

```ts src/routes/(app)/dashboard/+page.ts
export const ssr = false; // これが意図的なら suppression するかルールを off に
```

意図して完全な SPA にしている場合は、config でルールを無効化します：

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/ssr-disabled': 'off'
  }
};
```

または宣言の直前に `// svelte-vitals-disable-next-line seo/ssr-disabled` を書いてください。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line seo/ssr-disabled -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'seo/ssr-disabled': 'off'
  }
};
```
