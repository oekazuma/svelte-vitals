---
title: performance/state-raw · Raw state opportunity
description: '再代入しかしないオブジェクト・配列の $state には、一度も使わない深いリアクティビティのコストがかかり続けます。$state.raw ならプロキシを省けます。'
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

オブジェクトリテラルまたは配列リテラルで初期化されたトップレベルの `$state` 束縛のうち、1回以上再代入され、中身は一度も変更（mutate）されないものを検出します:

```svelte
<script>
  let posts = $state([]);

  async function refresh() {
    posts = await fetch('/api/posts').then((r) => r.json()); // 再代入のみ — $state.raw 向き
  }
</script>
```

検出は意図的に保守的です。深いリアクティビティに依存しうる痕跡が1つでもあれば候補から外します。候補として残るのは、次のすべてを満たす束縛だけです。

- プロパティや要素への書き込み、`delete`、メソッド呼び出しがない
- 外部へ渡していない（関数の引数、コンポーネントの prop、`bind:`、`use:`/`transition:`/`animate:` ディレクティブの式）
- 別名参照を作っていない（`const inner = obj.items`、ヘルパー内の `return obj`、インラインハンドラーでの別の場所への保存）
- その値やそのメンバーパス（`{#each obj.items as item}` など）を回す `{#each}` ブロック内で、アイテムを編集していない（`bind:value={item.text}` や `<Row {item} />` のある編集可能なリストには深いリアクティビティが必要です）

## なぜ重要か

`$state` のオブジェクトと配列は、プロパティ単位の変更を追跡するために深いプロキシで包まれます。そのコストはすべてのプロパティアクセスにかかりますが、再代入しかしない束縛（典型は API レスポンス）はこの仕組みを一度も使いません。

Svelte 公式も、再代入しかしない大きなオブジェクトには `$state.raw` を案内しています。`$state.raw` でも再代入は完全にリアクティブなままで、プロキシが必要なのはプロパティ単位の変更だけです。

## 修正方法

```svelte
<script>
  let posts = $state.raw([]);
</script>
```

変えるのはここだけで、初期値も再代入のコードもそのまま動きます。

## 制限事項

「大きい」かどうかは静的には判定できないため、オブジェクト・配列リテラルの初期値であることを代理条件にしています。このため `let data = $state(null)` に後から代入する書き方は検出されません（初期値がコンテナリテラルではないため）。

外部への受け渡しの判定は保守的で、束縛全体を渡す `bind:` を含め、別名参照が1つでもあれば候補から外します。束縛名が式に現れない深い別名（`const x = someAlias.b`）は静的解析では追えません。runes モジュール（`.svelte.ts`）とクラスフィールドの `$state` は、このバージョンでは対象外です。

## 無効化

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'performance/state-raw': 'off'
  }
};
```
