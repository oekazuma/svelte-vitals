---
title: PERF012 · Minification disabled
description: vite.config に残った build.minify:false は、ミニファイされていない JS/CSS を本番に出荷します。
---

**重大度:** warning · **カテゴリ:** performance

## チェック内容

本番ビルドのミニファイを `build.minify: false` で無効化している Vite 設定を検出します。CLI は `vite.config.*`（Vite 自身の解決順で最初に見つかったファイル）を静的解析し、リテラル形式（`export default { … }`、`defineConfig({ … })`、同一ファイル内のエイリアスエクスポート。`satisfies`／`as` は unwrap）を検出します。Vite プラグインは `vite build` 中に**解決済み**の設定値を読むため、関数形式や条件分岐の設定も検出でき、実際のビルドに適用されないオーバーライドを誤検知することもありません。

検出しないもの: `minify: 'esbuild' | 'terser' | true`、`build` オブジェクト外の `minify` キー、Vite 設定を持たないプロジェクト。

## 重要な理由

Vite はデフォルトで esbuild によるミニファイを行います。これを無効化する設定は、本番の問題をデバッグした際の消し忘れであることがほとんどです。ミニファイされていないバンドルは数倍のサイズになり、すべてのルートがダウンロードとパースの時間で代償を払います。しかもツールチェーンは何も警告しません。ビルドは成功し、開発時の挙動も変わらないためです。

## 修正方法

オーバーライドを削除する（デフォルトでミニファイされます）か、本番ではミニファイが維持されるようにスコープを限定します:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production' ? 'esbuild' : false
  }
}));
```

CLI の静的解析はこの条件分岐形式を意図的にスキップします。実際のビルドがどちらの分岐を通るかを検証できるのは、解決済みの値を見るプラグインチャネルだけです。

## 制限事項

2つのチャネルには検出力の差があります。CLI はリテラルの `build.minify: false` だけを検出し、`false` に評価される動的な式は見えません。Vite プラグインは解決済みの値で判定するため、実行されたビルドに対する判定は正確ですが、問題の設定が動的な場合、検出結果は設定ファイルの1行目を指します。

## 無効化

ミニファイしない本番出力が意図的な場合は、設定でルールを無効化してください:

```js
// svelte-vitals.config.mjs
export default {
  rules: {
    PERF012: 'off'
  }
};
```
