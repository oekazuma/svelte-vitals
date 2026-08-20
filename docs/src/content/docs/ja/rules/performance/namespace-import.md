---
title: performance/namespace-import · namespace import
description: ツリーシェイクを効かせるため、import * as ではなく名前付き import を使いましょう。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

node_modules のパッケージ（bare specifier）に対する値の `import * as X from '<package>'` を検出します。型のみの import（`import type * as T`）と、bare でない specifier（相対パス、`$lib`、`$app`、`$env`、`#…`）は対象外です。

## なぜ重要か

namespace import（`import * as X`）がツリーシェイク可能なのは、`X` へのアクセスが常に静的（`X.foo()`）な場合だけです。`X` を関数に渡したり動的にインデックスアクセス（`X[key]`）したりすると、バンドラはすべてのエクスポートが参照されうると仮定し、モジュール全体を残します。

named import なら確実にツリーシェイクでき、依存の使用範囲も明示的になります。ツリーシェイクに対応したバンドラであれば `three` や `d3` のようなパッケージでも実際に軽くできますが、保証されるのはシェイク可能であることであって、どの構成でも必ず出力が小さくなることではありません。

## 修正方法

```svelte
<script>
  // import * as _ from 'lodash'; の代わりに
  import debounce from 'lodash/debounce';

  // import * as THREE from 'three'; の代わりに
  import { Scene, WebGLRenderer } from 'three';
</script>
```

## モードによる違い

ありません。このルールはソース — 同じ `.svelte` / `.ts` ファイル — を読むので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのどの面でも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません — コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line performance/namespace-import -->` を置きます。ルールごと無効化するには:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/namespace-import': 'off'
  }
};
```
