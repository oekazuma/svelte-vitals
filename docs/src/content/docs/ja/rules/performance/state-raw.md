---
title: performance/state-raw · Raw state opportunity
description: '再代入しかしないオブジェクト・配列の $state は、使われない深いリアクティビティの代金を払い続けます。$state.raw ならプロキシを省けます。'
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

トップレベルのオブジェクト・配列リテラルの `$state` のうち、1回以上再代入され、一度も変更（mutate）されないものを検出します:

```svelte
<script>
  let posts = $state([]);

  async function refresh() {
    posts = await fetch('/api/posts').then((r) => r.json()); // 再代入のみ — $state.raw が適する
  }
</script>
```

検出は意図的に保守的です。深いリアクティビティに依存しうる痕跡が1つでもあれば候補から外します。プロパティや要素への書き込み・`delete`・メソッド呼び出しがないこと、受け渡し（関数の引数、コンポーネントの prop、`bind:`、`use:`/`transition:`/`animate:` ディレクティブの式）がないこと、別名参照（`const inner = obj.items`、ヘルパー内の `return obj`、インラインハンドラーでの保存）がないこと、そしてその値またはそのメンバーパス（`{#each obj.items as item}` のような）を回す `{#each}` ブロック内でアイテムを編集していないこと（`bind:value={item.text}` や `<Row {item} />` がある編集可能リストは深いリアクティビティが必要です）。

## なぜ重要か

`$state` のオブジェクトと配列は、プロパティ単位の変更を追跡できるように深いプロキシで包まれます。この仕組みはすべてのプロパティアクセスに上乗せコストを課します。再代入しかしない束縛（典型は API レスポンス）はこの仕組みを一度も使いません。Svelte 公式も「再代入しかしない大きなオブジェクトには `$state.raw` を」と案内しています。`$state.raw` でも再代入は完全にリアクティブなままで、プロキシが必要になるのはプロパティ単位の変更だけです。

## 修正方法

```svelte
<script>
  let posts = $state.raw([]);
</script>
```

初期値も再代入のコードもそのままで動きます。

## 制限事項

「大きい」かどうかは静的には判定できないため、オブジェクト・配列リテラルの初期値であることを代理条件にしています。このため `let data = $state(null)` に後から代入する書き方は検出されません（初期値がコンテナリテラルではないため）。受け渡しの扱いは保守的で、束縛全体の `bind:` を含むあらゆる別名参照が候補を外します。束縛名を経由しない深い別名（`const x = someAlias.b`）は静的解析の射程外です。runes モジュール（`.svelte.ts`）とクラスフィールドの `$state` はこのバージョンでは対象外です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'performance/state-raw': 'off'
  }
};
```
