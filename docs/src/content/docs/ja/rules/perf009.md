---
title: PERF009 · 重い依存の import
description: 大きくツリーシェイクできないパッケージの import を避けます。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

よく知られた重い/ツリーシェイク不可のパッケージ（現状は `lodash` と `moment`）からの `import` を検出します。完全一致で判定するため、`lodash/debounce` のようなサブパス import は対象外です。`src/**/*.svelte` のスクリプトを静的（CLI）解析します。

## なぜ重要か

大きくツリーシェイクできないパッケージを import すると、一部しか使っていなくてもバンドルに丸ごと取り込まれ、ページ読み込みが遅くなります。

## 修正方法

```svelte
<script>
  // import _ from 'lodash'; の代わりに
  import debounce from 'lodash/debounce'; // または lodash-es

  // import moment from 'moment'; の代わりに
  import { format } from 'date-fns'; // または dayjs
</script>
```
