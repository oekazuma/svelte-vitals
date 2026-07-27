---
title: performance/heavy-import · 重い依存の import
description: サイズが大きく、ツリーシェイクもできないパッケージの import を避けます。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

重くてツリーシェイクできないことで知られるパッケージ（現状は `lodash` と `moment`）からの `import` を検出します。完全一致で判定するため、`lodash/debounce` のようなサブパス import は対象外です。`src/**/*.svelte` のスクリプトを静的（CLI）解析します。

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
`lodash` と `moment` は引き続き検出され、以降の svelte-vitals リリースで組み込みリストが拡張されれば
その恩恵も受けられます。組み込みと同じキーを指定した場合は、そのパッケージはリストに残ったまま対処方法だけが
置き換わります。`{ lodash: '社内ヘルパーを使う' }` はエントリを増やすのではなく、検出結果の文面を差し替えます。

```js
// svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  }
};
```
