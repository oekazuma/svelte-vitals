---
title: security/server-module-state · サーバーのモジュールスコープ状態
description: ルートや hooks のファイルで、モジュールスコープの変数を関数の中から再代入しています。サーバーではこの変数を全リクエストで共有します。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイル（`+page(.server).ts`、`+layout(.server).ts`、`+server.ts`、`hooks.server.ts`）で、**モジュールスコープの `let`/`var`** への関数内からの再代入（`=`、`+=`、`??=`、`++` など）を検出します。request handler から直接再代入している場合は、ヘルパー関数内での再代入より強いメッセージで報告します。

検出しないもの:

- トップレベルでの初期化と `const` の binding。
- 変異型キャッシュ（`const cache = new Map()` + `cache.set(…)`）。意図的なメモ化パターンです。ただしリクエスト由来のデータを入れれば同じリスクがあります。
- `src/lib/server/**` 配下。正当なシングルトンを置く場所のためスキャンしません。
- SvelteKit の `init` フック内の代入。サーバー起動時に一度だけ実行されるためです。

## なぜ重要か

SvelteKit のドキュメントは「サーバーでの共有状態を避けよ」と述べています。サーバー上のモジュール変数は、全ユーザーが共有する1つのインスタンスです。action が Alice のフォームデータをそこへ入れれば、次に来た Bob のリクエストがそれを読みます。プロセスが再起動するたびに値が静かに消えるという問題もあります。

## 修正方法

```ts +page.server.ts
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

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line security/server-module-state -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'security/server-module-state': 'off'
  }
};
```
