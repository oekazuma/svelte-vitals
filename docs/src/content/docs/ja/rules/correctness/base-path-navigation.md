---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: ルート相対リンクをハードコードすると kit.paths.base ではなくドメインのルートを指すため、base path の配下ではアプリの外に出てしまい、本番で 404 になります。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

対象になるのは base path を設定しているプロジェクトだけです（Vite 設定の `sveltekit({ paths: { base } })`、または `svelte.config.*` の `kit.paths.base`。前者が優先されます）。その場合に、ハードコードされたルート相対リテラルで書かれたナビゲーションを3つの箇所で検出します:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

`base: '/docs'` の下では、これらは `/about`・`/dashboard`・`/login` というドメインのルート、つまりアプリの外を指してしまい、本番環境で404になります。

base path の読み取り方は SvelteKit 自身と同じです。Vite の設定に `sveltekit({ paths: { base } })` の引数があればそちらを（この場合 `svelte.config` は無視されます。SvelteKit 自身も警告を出します）、無ければ `svelte.config.js`/`.ts` の `kit.paths.base` を見ます。

設定側で値を計算している場合 — よくある `base: dev ? '' : '/repo'` — も対象です。少なくともどれかの環境では base 配下で配信されるためです。base が無い場合や明示的に `base: ''` の場合は発火しません。

検出は静的なリテラルだけを対象にします。そのため正しい書き方が誤検出されることはありません。`href="{base}/about"`、`href={resolve('/about')}`、`goto(resolve('/about'))`、``goto(`${base}/about`)`` はいずれも文字列リテラルではなく動的な式だからです。

## なぜ重要か

この不具合は開発環境では見えません。base path は通常デプロイ先でだけ適用されるため、手元では `base` が `''` になり、ハードコードされたリンクはすべて動いてしまいます。他のツールも教えてくれません。コンパイラにはただの属性に見え、`svelte-check` が検査するのは文字列の型で、実行時の解決結果ではないからです。結果として「デプロイしたら全部のリンクが404」という形で表面化します。

## 修正方法

`$app/paths` の `resolve()` でパスを包みます:

```svelte
<script>
  import { resolve } from '$app/paths';
</script>

<a href={resolve('/about')}>About</a>
```

```js
import { resolve } from '$app/paths';
import { goto } from '$app/navigation';
import { redirect } from '@sveltejs/kit';

goto(resolve('/dashboard')); // コンポーネントや .svelte.ts モジュールで
redirect(303, resolve('/login')); // load 関数や form action で
```

`resolve()`(SvelteKit 2.26以降)が base path を前置してくれます。ルートIDを渡せばルートパラメータの埋め込みも行います。非推奨になった `base` と `resolveRoute` の置き換えです。

## 制限事項

対象外:

- `<form action="/…">`、`fetch('/api/…')`、静的アセット（`<img src="/logo.png">`、`<link href>`）。アセットも同じように壊れますが、修正には `resolve()` ではなく `asset()` を使うため別のルールに委ねています。
- 動的なパス全般、`<svelte:element this="a">`、名前空間インポートの `goto`/`redirect`（`import * as nav from '$app/navigation'`）。
- 静的に読めない `sveltekit()` の引数（別ファイルからインポートした設定オブジェクトなど）。推測せずに沈黙します。
- 素の `.ts`/`.js` モジュールの `goto()`。収集対象は `.svelte`・`.svelte.ts`・`.svelte.js` に限られます。
- `src/hooks.client.ts` や `src/hooks.ts` の `redirect()`。Kit モジュール側の収集対象から外れています。

## 無効化

```js svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
