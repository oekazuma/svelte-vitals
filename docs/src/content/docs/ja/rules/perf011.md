---
title: PERF011 · Load waterfall
description: universal load 内の依存する逐次 await は、1ホップごとにブラウザからのネットワーク往復を要します。
---

**重大度:** warning · **カテゴリ:** performance

## チェック内容

**universal** load（`+page.ts` / `+layout.ts`）内で、後続の await が先行する await の結果を使っているチェーン（直接参照、分割代入した束縛、中間定数経由を含む）を検出します。依存ホップ1つごとに、クライアントサイドナビゲーション時はブラウザからの完全なネットワーク往復が発生します。

走査は意図的に保守的です。load ボディの直線状のステートメント（直接 `try` で包まれたものを含む）だけを追い、`if` 分岐、ループ、ネストした関数には入りません。`await parent()` 自体は検出対象になりませんが、そこから得たデータは依存としてカウントされます。レスポンスボディの読み取り（await res.json() など）は追加の往復を要しないためホップとして数えませんが、そこから得たデータは依存として引き続き伝播します。**server** load 内の依存チェーンは検出しません（並列化は不可能で、すでにサーバーサイドで実行されているためです）。クライアントサイドレンダリングを無効化したファイル（export const csr = false）は対象外です。クライアントランタイムがないため、universal load は SSR 時にしか実行されません。

## 重要な理由

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

一部のデータが独立している場合は、切り出して並列化してください（PERF013 を参照）。

## 制限事項

検出できるのはリテラルな依存チェーンの形だけです。分岐、ループ、ヘルパー関数、モジュールレベルのキャッシュの背後に隠れたチェーンは検出されません。行単位の抑制は `// svelte-vitals-disable-next-line PERF011` で可能です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF011: 'off'
  }
};
```
