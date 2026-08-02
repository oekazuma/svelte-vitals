---
title: security/handler-state-write · handler から import した状態への書き込み
description: load 関数や action が、import したモジュールの状態に書き込んでいます。サーバーではこの状態を全リクエストで共有します。
---

**重大度:** critical · **カテゴリ:** security

## チェック内容

サーバーで実行される handler（`load`、form action、`+server` の HTTP handler、`hooks.server` の handler）の内部から、**import した binding** への書き込みを検出します。対象はプロパティ代入（`state.user = …`）、インクリメント/`delete`、`.set(...)` / `.update(...)` 呼び出しです。

universal な `+page.ts`/`+layout.ts` の load も対象です。SSR 時はサーバーで実行されるためです。

検出しないもの:

- 読み取り、その他のメソッド呼び出し（`logger.info(…)`）、ローカル変数への書き込み。
- インストール済みパッケージからの import への `.set()`/`.update()`。
- 解決先が `src/lib/server` になる import への `.set()`/`.update()`。ディレクトリエントリポイント（`import { db } from '$lib/server'`）と `src/lib/server/**` 配下のモジュールが該当します。Drizzle の `db.update(...).set(...)` のような DB/KV クライアント呼び出しは永続化であり、共有状態への書き込みではないためです。

`src/lib/server` の除外は解決後のパスに対して働くので、`$lib/server/` alias 経由でも相対パス（`../../lib/server/db`）経由でも同じように適用されます。`..` でプロジェクトルートの外へ抜ける specifier は、保守的にリポジトリ内の共有状態としては扱いません。

## なぜ重要か

SvelteKit の状態管理ドキュメントが「NEVER DO THIS」と明記するパターンです。サーバーは、全ユーザーが共有する長寿命の1プロセスです。Alice のリクエスト中に書き込まれたモジュール状態は Bob のリクエストが来てもそこに残っており、Bob に Alice のデータが返され得ます。開発中はユーザーが1人なので完璧に動き、本番で静かに壊れます。

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

ユーザー別のデータは cookies/`locals` とデータベースに置き、load したデータは `page.data` か context API でコンポーネントに渡します。
