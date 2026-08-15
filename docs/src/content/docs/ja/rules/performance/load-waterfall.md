---
title: performance/load-waterfall · Load waterfall
description: universal load で依存関係のある await が数珠つなぎになると、1 ホップごとにブラウザからのネットワーク往復が発生します。
---

**重大度:** warning · **カテゴリ:** performance

## チェック内容

**universal** load（`+page.ts` / `+layout.ts`）内で、後続の await が先行する await の結果を使っているチェーン（直接参照、分割代入した束縛、中間定数経由を含む）を検出します。クライアントサイドナビゲーションでは、依存ホップ1つごとにブラウザからの完全なネットワーク往復が発生します。

走査は意図的に保守的です。

- load ボディの直線状のステートメント（直接 `try` で包まれたものを含む）だけを追い、`if` 分岐・ループ・ネストした関数には入りません。
- `await parent()` 自体は対象外ですが、そこから得たデータは依存としてカウントされます。
- レスポンスボディの読み取り（`await res.json()` など）は追加の往復を要しないためホップに数えませんが、そこから得たデータは依存として伝播します。
- **server** load 内の依存チェーンは対象外です。並列化は不可能で、すでにサーバーサイドで実行されているためです。
- クライアントサイドレンダリングを無効化したファイル（`export const csr = false`）も対象外です。クライアントランタイムがないため、universal load は SSR 時にしか実行されません。

## なぜ重要か

SvelteKit のパフォーマンスガイドは、リクエストウォーターフォールを主要なレイテンシ源として挙げています。universal load はクライアントサイドナビゲーションのたびにブラウザで再実行されるため、N 個の依存リクエストのチェーンは毎回 N 回の逐次往復を要します。チェーンを server load に移せばロジックはそのままに、ホップはサーバー間通信となり、クライアントのコストは1往復に収まります。

## 修正方法

依存チェーンを server load に移動します:

```ts
// +page.server.ts — same chain, server-side hops
export async function load({ fetch }) {
  const user = await fetch(`/api/user`).then((r) => r.json());
  const posts = await fetch(`/api/posts/${user.id}`).then((r) => r.json());
  return { user, posts };
}
```

一部のデータが独立している場合は、切り出して並列化してください（`performance/sequential-awaits` を参照）。

## 制限事項

検出できるのは、依存チェーンがそのままの形で書かれている場合だけです。分岐、ループ、ヘルパー関数、モジュールレベルのキャッシュの背後に隠れたチェーンは検出できません。特定の行だけ抑制するには `// svelte-vitals-disable-next-line performance/load-waterfall` を使います。

## 無効化

```js svelte-vitals.config.mjs
export default {
  rules: {
    'performance/load-waterfall': 'off'
  }
};
```
