---
title: architecture/private-scope-import · プライベートスコープの import
description: プライベートなディレクトリ内のユニットを、その外から import すべきではありません。
---

**重大度:** info · **カテゴリ:** architecture

## チェック内容

プライベートだと宣言したディレクトリの中にあるファイルを、その所有者の外から import している箇所を検出します。

このルールは**設定するまで無効**です。既定の規約を持ちません。プライベートなコードをどこに置くかは、プロジェクト自身が決めることだからです。

## なぜ重要か

プライベートなディレクトリに置いたコードは、1つの所有者のために書かれています。それを外から import すると、独立して動かせるはずだった2つの箇所が結合します。所有者の名前を変えたり削除したりすると、無関係な場所が壊れるようになります。そのユニットは、import している箇所すべてが共有するディレクトリ、つまり一段上に属します。

## 修正方法

そのユニットをプライベートなディレクトリから出し、import している箇所すべての共通のディレクトリへ移して、import のパスを更新します。あるいはプライベートなまま残し、自身のスコープの内側からのみ import します。

## 設定

| オプション | 型            | デフォルト |
| ---------- | ------------- | ---------- |
| `scopes`   | glob のリスト | `[]`       |

各 glob は**プライベートなディレクトリ**にマッチし、その**親**が境界になります。親の内側にあるファイルはそこから import できますが、外側のファイルはできません。

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': {
      options: { scopes: ['**/parts', 'src/routes/**/components'] }
    }
  }
};
```

この設定では次のようになります。

- `Card/parts/Badge.svelte` は `Card/` 配下からのみ import できます。
- `src/routes/blog/components/Toc.svelte` は `src/routes/blog/` 配下からのみ import できます。
- `src/lib/components/Button.svelte` は制約を受けません。どの glob にもマッチしないため、同じディレクトリ名でも意味が変わります。

プライベートなディレクトリが入れ子になっている場合は、内側が優先されます。`**/parts` を指定したとき、`A/parts/B/parts/C` にあるユニットは `A` ではなく `A/parts/B` に対してプライベートです。

glob では `*` がパスセグメント内、`**` がセグメントをまたいでマッチします。2つのセグメントに挟まれた `**` は1セグメント以上にマッチし、0セグメントにはマッチしません。そのため `src/routes/**/components` は `src/routes/components` にマッチしません。その位置にプライベートなディレクトリがある場合は、両方のパターンを列挙してください。

## 制限

検査するのは `.svelte` コンポーネントと `.svelte.ts` / `.svelte.js` モジュールに書かれた import です。`+page.ts` / `+server.ts` のような Kit モジュールに書かれた import は、まだ検査対象外です。

意図的な除外ではなく、解消予定のギャップです。

型のみの import（`import type { X } from '../parts/types'`）も、値の import と同様に検出します。import 自体はビルド時に消えますが、プライベートなユニットの置き場所への構造的な結合はソースコード上に残るためです。

プライベートなディレクトリ自体を名指しする import（ファイルを指定せず、例えば `import { Badge } from '../Card/parts'` のような書き方）は検査していません。これは解消予定のギャップではなく、意図的な制限です。ディレクトリの中身に対して解決しようとすると、この見逃しを別の誤検知に置き換えてしまうためです。

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line architecture/private-scope-import -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': 'off'
  }
};
```
