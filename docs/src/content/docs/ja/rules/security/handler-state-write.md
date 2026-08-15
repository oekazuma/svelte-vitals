---
title: security/handler-state-write · handler から import した状態への書き込み
description: load 関数や action が、import したモジュールの状態に書き込んでいます。サーバーではこの状態を全リクエストで共有します。
---

**重大度:** critical · **カテゴリ:** security

## チェック内容

サーバーで実行される handler（`load`、form action、`+server` の HTTP handler、`hooks.server` の handler）の内部から、**import した binding** への書き込みを検出します。対象はプロパティ代入（`state.user = …`）、インクリメント/`delete`、`.set(...)` / `.update(...)` 呼び出しです。

universal な `+page.ts`/`+layout.ts` の load も対象です。SSR 時はサーバーで実行されるためです。

検出しないもの:

- 同じファイルで `ssr = false` を export している universal な `+page.ts`/`+layout.ts`。その load はサーバーで実行されないため、リークする共有インスタンスがそもそも存在しません。`+page.server.ts` は `ssr` の値に関わらず常にサーバーで実行されるため、server 系のファイルはこの除外の対象外です。
- 読み取り、その他のメソッド呼び出し（`logger.info(…)`）、ローカル変数への書き込み。
- インストール済みパッケージからの import への `.set()`/`.update()`。
- 解決先が `src/lib/server` になる **永続化クライアント**への `.set()`/`.update()`。ディレクトリエントリポイント（`import { db } from '$lib/server'`）と `src/lib/server/**` 配下が該当します。Drizzle の `db.update(...).set(...)` のような呼び出しは永続化であり、共有状態への書き込みではないためです。

`src/lib/server` の除外は解決後のパスに対して働くので、`$lib/server/` alias 経由でも相対パス（`../../lib/server/db`）経由でも同じように適用されます。`..` でプロジェクトルートの外へ抜ける specifier は、保守的にリポジトリ内の共有状態としては扱いません。

ただし除外の条件はディレクトリだけではありません。svelte-vitals は対象モジュールを読み、export がインメモリコンテナで**ない**場合にのみ除外します。`new Map`/`Set`/`WeakMap`/`WeakSet`、あるいはオブジェクト・配列リテラルで初期化された export は自作ストア（リクエストごとに上書きされる単一の共有インスタンス）なので、`src/lib/server` 配下でも検出します。

```ts
// src/lib/server/store.ts
export const db = new Map(); // handler から db.set(...) すると検出
export const client = drizzle(url); // コンテナリテラルではないので除外
```

コンテナだと断定できないものはすべて除外のままなので、実クライアントのラッパーや re-export、読めないモジュールが誤検知になることはありません。読み込むのは handler が実際に書き込んでいるモジュールだけです。

## なぜ重要か

SvelteKit の状態管理ドキュメントが「NEVER DO THIS」と明記するパターンです。サーバーは、全ユーザーが共有する長寿命の1プロセスです。あるリクエスト中に書き込まれたモジュール状態は、次のリクエストが来てもそこに残っています。そこにリクエストごと・ユーザーごとのデータが入っていれば、あるユーザーのデータが別のユーザーに漏れる可能性があります。開発中はユーザーが1人なので完璧に動き、本番で静かに壊れます。

ただし、検出されたすべての書き込みがリークとは限りません。IP やURL、キャッシュキーのような個人に紐づかない値をキーにしたレートリミッターやメモ化キャッシュは、無害な形です。ユーザー間でデータを共有すること自体が設計上の目的であり、それは問題ありません。同じ呼び出し形からどちらも生まれるため、この検出は書き込みそのものに対して機械的に発火します。どちらに該当するかはレビューして確認してください。

## 修正方法

保存せず、データを返します。

```ts
// +page.ts
import { user } from '$lib/user';

export async function load({ fetch }) {
  const response = await fetch('/api/user');
  user.set(await response.json()); // ❌ サーバー上では全リクエストで共有される

  return { user: await response.json() }; // ✅ リクエストごとの page data
}
```

ユーザー別のデータは cookies/`locals` とデータベースに置き、load したデータは `page.data` か context API でコンポーネントに渡します。書き込みが本当に、個人に紐づかないデータをキーにしたレートリミッターやメモ化キャッシュなら、その直前に `// svelte-vitals-disable-next-line security/handler-state-write` を書いてください。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line security/handler-state-write -->` を置きます。ルールごと無効化するには:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'security/handler-state-write': 'off'
  }
};
```
