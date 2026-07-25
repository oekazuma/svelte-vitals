---
title: correctness/base-path-navigation · Root-relative navigation under a base path
description: 'ハードコードされたルート相対リンクは kit.paths.base ではなくドメインのルートを指すため、base path 配下ではアプリの外に出てしまい、本番環境で404になります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

対象になるのは `kit.paths.base` を設定しているプロジェクトだけです。その場合に、ハードコードされたルート相対リテラルで書かれたナビゲーションを3つの箇所で検出します:

```svelte
<a href="/about">About</a>
```

```js
goto('/dashboard');
redirect(303, '/login');
```

`base: '/docs'` の下では、これらは `/about`・`/dashboard`・`/login` というドメインのルート、つまりアプリの外を指してしまい、本番環境で404になります。

base path の読み取り方は SvelteKit 自身と同じです。Vite の設定に `sveltekit({ paths: { base } })` の引数があればそちらを見ます(この場合 `svelte.config` は無視されます。SvelteKit 自身も警告を出します)。無ければ `svelte.config.js`/`.ts` の `kit.paths.base` を見ます。設定側で値を計算している場合 — よくある `base: dev ? '' : '/repo'` というデプロイ用の書き方 — も検出対象になります。少なくともどれかの環境では base 配下で配信されるからです。base が無い場合や、明示的に `base: ''` の場合は、このルールは一切発火しません。

検出は静的なリテラルだけを対象にします。そのため正しい書き方が誤検出されることはありません。`href="{base}/about"`、`href={resolve('/about')}`、`goto(resolve('/about'))`、``goto(`${base}/about`)`` はいずれも文字列リテラルではなく動的な式だからです。

## なぜ重要か

この不具合は、開発している環境では見えません。base path は通常デプロイ先の環境でだけ適用されるため、手元では `base` が `''` になり、ハードコードされたリンクはすべて正しく動いてしまいます。他のツールも教えてくれません。Svelte のコンパイラにはただの属性に見えますし、`svelte-check` が検査するのは文字列の型であって、それが実行時に何に解決されるかではありません。結果として「デプロイしたら全部のリンクが404になる」という形で表面化します。

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

goto(resolve('/dashboard'));
redirect(303, resolve('/login'));
```

`resolve()`(SvelteKit 2.26以降)が base path を前置してくれます。ルートIDを渡せばルートパラメータの埋め込みも行います。非推奨になった `base` と `resolveRoute` の置き換えです。

## 制限事項

`<form action="/…">`、`fetch('/api/…')`、静的アセット(`<img src="/logo.png">`、`<link href>`)は対象外です。アセットも同じように壊れますが、修正には `resolve()` ではなく `asset()` を使うため、別のルールに委ねています。動的なパスはすべて静的解析の範囲外で、`<svelte:element this="a">` や名前空間インポートの `goto`/`redirect`(`import * as nav from '$app/navigation'`)も同様です。Vite の設定の `sveltekit()` に静的に読めない引数(別ファイルからインポートした設定オブジェクトなど)が渡されている場合は、推測せずに沈黙します。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/base-path-navigation': 'off'
  }
};
```
