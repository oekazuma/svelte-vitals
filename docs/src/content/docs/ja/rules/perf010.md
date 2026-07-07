---
title: PERF010 · namespace import
description: ツリーシェイクのため import * as より named import を推奨します。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

bare(node_modules)パッケージからの値の `import * as X from '<package>'` を検出します。型のみの import(`import type * as T`)や、bare でない specifier(相対・`$lib`・`$app`・`$env`・`#…`)は対象外です。`src/**/*.svelte` のスクリプトを静的(CLI)解析します。

## なぜ重要か

namespace import(`import * as X`)がツリーシェイク可能なのは、`X` へのアクセスが常に静的(`X.foo()`)な場合に限られます。`X` を関数に渡したり動的にインデックスアクセス(`X[key]`)したりすると、バンドラはすべてのエクスポートが参照されうると仮定してモジュール全体を残さざるを得ません。named import なら確実にツリーシェイクでき、依存の使用範囲も明示的になります — `three` や `d3` のようなパッケージでも、名前付き import の方が出力は小さくなります。

## 修正方法

```svelte
<script>
  // import * as _ from 'lodash'; の代わりに
  import debounce from 'lodash/debounce';

  // import * as THREE from 'three'; の代わりに
  import { Scene, WebGLRenderer } from 'three';
</script>
```
