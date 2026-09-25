---
title: performance/namespace-import · namespace import
description: ツリーシェイクを効かせるため、import * as ではなく名前付き import を使いましょう。
---

**重大度:** info · **カテゴリ:** performance

## チェック内容

node_modules のパッケージ（bare specifier）に対する値の `import * as X from '<package>'` のうち、ファイル内のどこかで `X` を丸ごと使っているものを検出します。丸ごとの使い方とは、変数によるインデックスアクセス（`X[key]`）、関数への受け渡し（`fn(X)`）、スプレッド、列挙（`Object.keys(X)`）です。静的なメンバーアクセス（`X.foo()`、`X['foo']`、マークアップ中の `{X.foo}` や `<X.Component />`）だけで読んでいる namespace は named import と同じようにツリーシェイクされるため、対象外です。`X` と同名のローカル変数（関数の引数、`{#each}` の要素やインデックス、snippet の引数、`{@const}`、`let:` ディレクティブ）が `X` を隠している範囲では、その変数は namespace の使用とは数えません。型のみの import（`import type * as T`）と、bare でない specifier（相対パス、`$lib`、`$app`、`$env`、`#…`）は対象外です。

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

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line performance/namespace-import -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/namespace-import': 'off'
  }
};
```
