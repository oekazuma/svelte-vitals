---
title: security/shared-state-import · サーバーからの共有 runes 状態の import
description: Kit の server/universal ファイルが、モジュールスコープ $state を持つ .svelte.ts モジュールを import しています。サーバープロセスでは1つのインスタンスを全員で共有します。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイルの import のうち、解決先がリポジトリ内の `.svelte.ts`/`.svelte.js` モジュールで、そのモジュールが**モジュールスコープの `$state`**（トップレベルの `$state(...)` 宣言、または `$state` フィールドを持つクラスのモジュールスコープインスタンス）を持つものを検出します。検出には2つの形があります。

- サーバーコードがその状態を**変異させている**（handler 外での書き込み。handler 内の書き込みは SEC003 が critical で報告します）
- import が**読み取り専用**（それでもサーバー上では、起動時の値を持ち続ける1つのインスタンスを全リクエストが共有します）

対象は直接 import（`$lib/…` と相対パス）のみで、`import type` は対象外です。こうしたモジュールをクライアント専用で使うのは慣用的な共有ストアパターンとして正当であり、検出しません。サーバーで実行されるファイルからの import だけを対象とします。

拡張子なしの `….svelte` という specifier は、解決時に `….svelte.ts` へ正規化されます。そのため、コンポーネント `X.svelte` を import していて、同名の `$state` を持つ `X.svelte.ts` が並存する場合、検出結果がコンポーネント側の import に誤って紐づくことがあります（まれな命名の偶然です）。

## なぜ重要か

ブラウザではユーザーごとに別々のモジュールインスタンスが作られますが、サーバーにはちょうど1つしかなく、全リクエストがそれを共有します。ユーザー別のデータを入れれば、ユーザー同士が互いのデータを見てしまいます。入れなくても、サーバー側の読み取りは起動時の古い値のままで、現在のユーザーのクライアントが見ている値と一致しません。

## 修正方法

サーバーで実行されるコードでは共有モジュール状態に頼らず、`load` からデータを返して `page.data` か context API で渡します。

```ts
// +page.server.ts
import { quizState } from '$lib/quiz.svelte.js'; // ❌ サーバー上では全ユーザーで1インスタンス

export async function load({ locals }) {
  return { bookmarks: await db.bookmarksFor(locals.user) }; // ✅
}
```

モジュールが本当にクライアント専用なら、server ファイルから import しない構造に変えます。import が意図的で安全なら、その直前に `// svelte-vitals-disable-next-line SEC005` を書いてください。
