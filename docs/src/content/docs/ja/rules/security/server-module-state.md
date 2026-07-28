---
title: security/server-module-state · サーバーのモジュールスコープ状態
description: server ファイルのモジュールスコープ変数を、関数の中から再代入しています。この変数は全リクエストで共有されます。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイル（`+page(.server).ts`、`+layout(.server).ts`、`+server.ts`、`hooks.server.ts`）で、**モジュールスコープの `let`/`var`** への関数内からの再代入（`=`、`+=`、`??=`、`++` など）を検出します。request handler から直接再代入している場合は、ヘルパー関数内での再代入より強いメッセージで報告します。

トップレベルでの初期化、`const` の binding、変異型キャッシュ（`const cache = new Map()` + `cache.set(…)`）は検出しません。変異型キャッシュは意図的なメモ化パターンです（ただしリクエスト由来のデータを入れれば同じリスクがあります）。`src/lib/server/**` はスキャンしません（正当なシングルトンを置く場所のため）。SvelteKit の `init` フック内の代入も、サーバー起動時に一度だけ実行されるため対象外です。

## なぜ重要か

SvelteKit のドキュメントは「サーバーでの共有状態を避けよ」と述べています。サーバー上のモジュール変数は、全ユーザーが共有する1つのインスタンスです。action が Alice のフォームデータをそこへ入れれば、次に来た Bob のリクエストがそれを読みます。プロセスが再起動するたびに値が静かに消えるという問題もあります。

## 修正方法

```ts
// +page.server.ts
let user; // ❌ このサーバーの全ユーザーで1つの変数

export const actions = {
  default: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    user = { name: data.get('name') }; // ❌ NEVER DO THIS

    await db.saveUser(locals.session, data); // ✅ ユーザーごとの永続化
  }
};
```

cookies/`locals` で認証し、ユーザー別データはデータベースへ永続化します。意図的なプロセス全体キャッシュには `const` コンテナを使うか、代入行の直前に `// svelte-vitals-disable-next-line security/server-module-state` を書いてください。
