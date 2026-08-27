---
title: correctness/prop-mutation · 非 bindable prop の変異
description: $bindable を宣言していない $props() の値は書き換えないでください。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`$props()` から分割代入された値のうち `$bindable` を宣言していないものへの変異を検出します。メンバー書き込み（`user.name = …`、`obj.count += 1`）、`delete obj.x`、変異メソッド呼び出し（`items.push(…)`、`arr.splice(…)`、`map.set(…)` など）です。`...rest` で受けたバインディングも対象です。rest props は個別に `$bindable` を宣言できないためです。

prop 自体への単純な再代入（`count = 5`）は対象外です。Svelte の公式ドキュメントは一時的な状態保持のための再代入を明示的に許容しており、禁止されているのは変異のみです。

prop と同名のローカルは prop をシャドーイングしており prop 自体ではないため、変異させても検出しません。対象は関数やアロー関数のパラメータ、ブロックスコープの `let`/`const` 再宣言、`for`/`for-of`/`for-in` のループ変数、`catch` 節のパラメータ、`{#each ... as x}` のループ変数です。

`{#snippet}`/`{:then}`/`{:catch}` のバインディングは追跡しておらず、理論上は誤検出につながり得ます。意図して部分的な緩和策にとどめており、完全なスコープ解決ではありません。

## なぜ重要か

Svelte の公式ドキュメントは明確に「`$bindable` でない限り prop を変異させてはいけない」と述べています。コンパイラが捕まえない失敗モードが3つあります。

- **プレーンオブジェクト**の prop を変異させても、オブジェクトが state proxy でないため**黙って無視されます**（開発時の警告すら出ません）。
- **リアクティブな state proxy** の prop を変異させると動作はしますが、`ownership_invalid_mutation` という開発時警告が出ます。ただしそれは**そのコードパスが実際に実行された場合のみ**です。
- **フォールバック値**が使われている場合もプレーンオブジェクトと同様に振る舞い、変異は反映されません。

静的解析であれば、コードパスが実行される前のレビューや CI の時点でこの3つすべてを捕まえられます。

## 修正方法

```svelte
<script>
  let { user } = $props();

  // prop を直接変異させる代わりに:
  function rename(name) {
    user.name = name; // 何も起きないか、ownership_invalid_mutation 警告が出る
  }

  // 変異前にクローンする:
  function rename(name) {
    const next = { ...user, name };
    // next を使うか、変更を親に持ち上げる
  }

  // 親子で共有すべきなら bindable にする:
  let { user = $bindable() } = $props();
</script>
```

### legacy mode（`export let`）

同じ種類のバグは legacy mode のコンポーネントにも、別の理由で存在します。Svelte の legacy なリアクティビティは代入ベースなので、`bind:` で渡された prop であっても、変異メソッド呼び出しだけでは更新がトリガーされません。

```svelte
<script>
  export let items;

  // 検出対象 — 変異自体は更新をトリガーしない
  function addItem(item) {
    items.push(item);
  }
</script>
```

リアクティビティを再トリガーするには、変異後に prop を再代入してください — これは回避策ではなく、Svelte 自身が公式に示しているパターンです。

```svelte
<script>
  export let items;

  function addItem(item) {
    items.push(item);
    items = items; // items が変わったことをコンパイラに伝える
  }
</script>
```

## モードによる違い

ありません。このルールが読むのは同じ `.svelte` / `.ts` のソースファイルなので、CLI、Vite プラグインのビルド、ライブダッシュボードの静的ベースラインのいずれでも結果は同一で、レンダリング済み HTML の解析で再評価されることもありません。`--route` で実行範囲を絞ると、このルールは動きません。コンポーネントスコープのルールには、検出を紐づけるルートが無いためです。

## 無効化

個別に抑制するには、対象行の直前に `<!-- svelte-vitals-disable-next-line correctness/prop-mutation -->` を置きます。ルールごと無効化するには、次のように設定します。

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/prop-mutation': 'off'
  }
};
```
