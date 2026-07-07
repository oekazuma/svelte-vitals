---
title: CORRECT005 · 非 bindable prop の変異
description: $bindable を宣言していない $props() の値を変異させてはいけません。
---

**重大度:** warning · **カテゴリ:** correctness

## チェック内容

`$props()` から分割代入された値のうち `$bindable` を宣言していないものへの変異を検出します — メンバー書き込み(`user.name = …`、`obj.count += 1`)、`delete obj.x`、変異メソッド呼び出し(`items.push(…)`、`arr.splice(…)`、`map.set(…)` など)です。`...rest` で受けたバインディングも対象になります — rest props は個別に `$bindable` を宣言できないためです。prop 自体への単純な再代入(`count = 5`)は対象外です — Svelte の公式ドキュメントは一時的な状態保持のための再代入を明示的に許容しており、禁止されているのは変異のみです。コンポーネントのスクリプトとテンプレートを静的(CLI)解析します。

prop と同名のローカル(関数・アロー関数のパラメータ、ブロックスコープの `let`/`const` による再宣言、`for`/`for-of`/`for-in` のループ変数、`catch` 節のパラメータ、`{#each ... as x}` のループ変数)を変異させても検出対象にはなりません — そのバインディングは prop をシャドーイングしており、もはや prop 自体ではないためです。`{#snippet}`/`{:then}`/`{:catch}` のバインディングは追跡しておらず、理論上は誤検出につながり得ます — これは意図的に部分的な緩和策であり、完全なスコープ解決ではありません。

## なぜ重要か

Svelte の公式ドキュメントは明確に「`$bindable` でない限り prop を変異させてはいけない」と述べています。コンパイラが捕まえない失敗モードが3つあります:

- **プレーンオブジェクト**の prop を変異させても、オブジェクトが state proxy でないため**無言で何も起きません**(開発時の警告すら出ません)。
- **リアクティブな state proxy** の prop を変異させると動作はしますが、`ownership_invalid_mutation` という開発時警告が出ます — ただしそれは**そのコードパスが実際に実行された場合のみ**です。
- 使用中の**フォールバック値**もプレーンオブジェクトと同様に振る舞い、変異は反映されません。

静的解析であれば、コードパスが実行される前のレビュー・CI の時点でこの3つすべてを捕まえられます。

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
