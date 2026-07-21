---
title: CORRECT004 · 変更されない $state
description: 変更されない $state には const（または $state.raw）を使います。
---

**重大度:** info · **カテゴリ:** correctness

## チェック内容

コンポーネント内のどこでも書き込みもエスケープもされない `let x = $state(...)` を検出します。再代入なし、変更なし（`x.a = …`、`x.push()`）、バインドなし（`bind:value={x}`）、関数やコンポーネントへの受け渡しなしのものです。コンポーネントのスクリプトとテンプレートを静的（CLI）解析します。

## なぜ重要か

変更されない `$state` は、使わないリアクティビティ（deep proxy と依存追跡）のコストを払っています。`const` の方が明確で軽量です。値をまるごと差し替えるだけ（プロパティは変更しない）なら `$state.raw` が適します。

## 修正方法

```svelte
<script>
  // let title = $state('Dashboard'); の代わりに
  const title = 'Dashboard';

  // まるごと差し替えるが deep mutate しないなら $state.raw:
  let data = $state.raw(initial);
  data = nextValue;
</script>
```
