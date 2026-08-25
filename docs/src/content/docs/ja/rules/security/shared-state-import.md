---
title: security/shared-state-import · サーバーからの共有 runes 状態の import
description: server / universal ファイルが、モジュールスコープに $state を持つ .svelte.ts を import しています。サーバープロセスでは 1 つのインスタンスを全リクエストで共有します。
---

**重大度:** warning · **カテゴリ:** security

## チェック内容

SvelteKit のルート/フックファイルの import のうち、解決先がリポジトリ内の `.svelte.ts`/`.svelte.js` モジュールで、そのモジュールが**モジュールスコープの `$state`**（トップレベルの `$state(...)` 宣言、または `$state` フィールドを持つクラスのモジュールスコープインスタンス）を持つものを検出します。検出には2つの形があります。

- サーバーコードがその状態を**変異させている**（handler 外での書き込み。handler 内の書き込みは `security/handler-state-write` が critical で報告します）
- import が**読み取り専用**（それでもサーバー上では、起動時の値を持ち続ける1つのインスタンスを全リクエストが共有します）

対象は直接 import（`$lib/…` と相対パス）のみで、`import type` は対象外です。こうしたモジュールをクライアント専用で使うのは慣用的な共有ストアパターンとして正当であり、検出しません。サーバーで実行されるファイルからの import だけを対象とします。

検出しないもの: 同じファイルで `ssr = false` を export している universal な `+page.ts`/`+layout.ts`。SvelteKit の状態管理ドキュメント: 「SSR を使っていないなら、あるユーザーのデータが別のユーザーに漏れる心配はありません」。そのファイルの load はサーバーで実行されないため、漏れる先の共有サーバーインスタンスがそもそも存在しません。この除外は同一ファイルに限られるため、`ssr` の値に関わらず常にサーバーで実行される `+page.server.ts` は引き続き検出されます。

拡張子なしの `….svelte` という specifier は、解決時に `….svelte.ts` へ正規化されます。そのため、コンポーネント `X.svelte` を import していて、同名の `$state` を持つ `X.svelte.ts` が並存する場合、検出結果がコンポーネント側の import に誤って紐づくことがあります（まれな命名の偶然です）。

## なぜ重要か

ブラウザではユーザーごとに別々のモジュールインスタンスが作られますが、サーバーにはちょうど1つしかなく、全リクエストがそれを共有します。ユーザーごとのデータを入れれば、ユーザー同士が互いのデータを見てしまいます。入れなくても、サーバー側の読み取りは起動時の古い値のままで、現在のユーザーのブラウザが見ている値と一致しません。

## 修正方法

サーバーで実行されるコードでは共有モジュール状態に頼らず、`load` からデータを返して `page.data` か context API で渡します。

```ts +page.server.ts
import { quizState } from '$lib/quiz.svelte.js'; // ❌ サーバー上では全ユーザーで1インスタンス

export async function load({ locals }) {
  return { bookmarks: await db.bookmarksFor(locals.user) }; // ✅
}
```

モジュールが本当にクライアント専用なら、server ファイルから import しない構造に変えます。import が意図的で安全なら、その直前に `// svelte-vitals-disable-next-line security/shared-state-import` を書いてください。

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line security/shared-state-import -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'security/shared-state-import': 'off'
  }
};
```
