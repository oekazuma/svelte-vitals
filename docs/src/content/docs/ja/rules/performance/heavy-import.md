---
title: performance/heavy-import · 重い依存の import
description: サイズが大きく、ツリーシェイクも効かないパッケージの import は避けましょう。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

重くてツリーシェイクできないことで知られるパッケージ（現状は `lodash` と `moment`）からの `import` を検出します。完全一致で判定するため、`lodash/debounce` のようなサブパス import は対象外です。

**型のみの import は報告しません。** `import type { Moment } from 'moment'` や、すべての specifier が inline type の宣言はビルド時に消えるため、バンドルには何も加わりません。なお `architecture/private-scope-import` は型のみの import も報告し続けます。こちらはツリー内の結合を見るルールで、型だけの import でも結合は同じように生まれるためです。

## なぜ重要か

サイズが大きく、ツリーシェイクもできないパッケージを import すると、一部しか使っていなくてもバンドルに丸ごと取り込まれ、ページ読み込みが遅くなります。

## 修正方法

```svelte
<script>
  // import _ from 'lodash'; の代わりに
  import debounce from 'lodash/debounce'; // または lodash-es

  // import moment from 'moment'; の代わりに
  import { format } from 'date-fns'; // または dayjs
</script>
```

## 設定

| オプション | 型                              | デフォルト         |
| ---------- | ------------------------------- | ------------------ |
| `packages` | マップ（パッケージ → 対処方法） | `lodash`、`moment` |

設定したパッケージは組み込みリストを**置き換えるのではなく追加**します。独自のエントリを追加した後も
`lodash` と `moment` は引き続き検出され、以降のリリースで組み込みリストが拡張されればその恩恵も受けられます。

組み込みと同じキーを指定した場合は、パッケージはリストに残ったまま対処方法だけが置き換わります。
`{ lodash: '社内ヘルパーを使う' }` はエントリを増やすのではなく、検出結果の文面を差し替えます。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  }
};
```

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line performance/heavy-import -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': 'off'
  }
};
```
