---
title: PERF013 · Sequential independent awaits
description: 互いの結果を使わない await の逐次実行は無駄です。同時に開始しましょう。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

`load` 関数（universal / server の両方）内で、先行するどの await の結果も使っていない await を検出します。データフロー上の理由なくリクエストが直列化されている状態です。検出は PERF011 と同じ保守的な直線走査を使います（束縛と中間定数を通じた前方 taint 伝播、コールバック引数のシャドーイング考慮、`await parent()` は対象外）。

## 重要な理由

独立した2つのリクエストを逐次 await すると、レイテンシは両者の合計になります。同時に開始すれば最も遅いリクエスト分だけで済みます。load 関数内でのこの直列化はページ訪問のたびに発生する純粋な無駄で、リクエストが本当に独立していれば `Promise.all` は挙動を変えずに同じデータを返します。

## 修正方法

```ts
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## 制限事項

静的なデータフロー解析には副作用の順序が見えません。先行する await が後続リクエストの前提となるセットアップ（セッション、ロケール、キャッシュ準備など）を行っている場合、その逐次実行は意図的です。このルールが `info` で報告するのはそのためです。意図的な逐次実行は `// svelte-vitals-disable-next-line PERF013` で行単位に抑制するか、設定で severity を調整してください。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF013: 'off'
  }
};
```
