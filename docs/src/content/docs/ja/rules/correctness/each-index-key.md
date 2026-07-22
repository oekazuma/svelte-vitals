---
title: correctness/each-index-key · Index used as each key
description: '{#each} ブロックのキーに index を使うと、アイテムの同一性が位置ベースになります。キーなしと同じバグが、隠れた形で起こります。'
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

キーが index 束縛そのものになっている `{#each}` ブロック（例: `{#each items as item, i (i)}`）を検出します。CLI の静的解析が `src/` 配下のすべての `.svelte` コンポーネントを対象にチェックします。

index の単純な文字列化（`(String(i))`、``(`${i}`)``、`(i.toString())`）も検出します。これらも位置ベースの同一性であることに変わりはありません。

検出しないもの: アイテムのデータと index を組み合わせた複合キー（`(item.id + '-' + i)`、``(`${item.id}-${i}`)``）。重複アイテムを含むリストでは素のアイテムキーが Svelte の duplicate-key エラーを投げるため、index の付加が意図的な回避策になっている場合があります。ただしトレードオフに注意してください。このキーもアイテムが移動すると変わるため、移動したアイテムは追跡されずに破棄・再生成されます。可能なら真に一意な id を使うのが望ましいです。

## 重要な理由

Svelte 公式ガイダンスは明確です。キーはオブジェクトを一意に識別しなければならず、index をキーに使ってはいけません。index キーではアイテムの同一性がリスト内の位置に従うため、並べ替えや途中への挿入・削除が起きると、要素の状態（フォーカス、入力値、トランジション）がアイテムではなく位置に張り付きます。これはキーなしブロックとまったく同じ故障モードです。しかもキーが見えている分だけ安全そうに見え、バグはレビューではなく本番で発覚しがちです。

## 修正方法

アイテムを一意に識別する値でキーを付けます:

```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

## 無効化

リストが並べ替えも途中挿入・削除も起こさないと確実に言える場合は、`<!-- svelte-vitals-disable-next-line correctness/each-index-key -->` で個別に抑制するか、ルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    'correctness/each-index-key': 'off'
  }
};
```
