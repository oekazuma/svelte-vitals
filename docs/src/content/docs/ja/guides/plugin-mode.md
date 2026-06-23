---
title: プラグインモード
description: ビルド時にプリレンダリングされた HTML を分析するために svelte-vitals を vite build に統合します。
---

`@svelte-vitals/vite` は Vite / SvelteKit プラグインで、`vite build` に便乗して**プリレンダリングされた HTML の `<head>`** を解析し、CLI と同じ SEO およびパフォーマンスルールを実行します。実際の HTML 出力を検査するため、ライブラリに依存しません。検出結果が `failOn` の閾値に達するとビルドが失敗します。

> **ESM のみ**（Node 18+）。ES モジュールのみを提供します。`require()` は設計上サポートされていません。

## インストール

```bash
npm install --save-dev @svelte-vitals/vite
# または
pnpm add -D @svelte-vitals/vite
```

## セットアップ

`vite.config.ts` に `svelteVitals` を追加します：

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [sveltekit(), svelteVitals({ failOn: 'critical', report: 'console' })]
};
```

## オプション

| オプション       | 型                                  | デフォルト   | 説明                                               |
| ---------------- | ----------------------------------- | ------------ | -------------------------------------------------- |
| `failOn`         | `'critical' \| 'warning' \| 'info'` | `'critical'` | ビルドを失敗させる最低重大度                       |
| `report`         | `'console' \| 'json' \| false`      | `'console'`  | 分析レポートの出力形式                             |
| `outFile`        | `string`                            | —            | JSON レポートをこのパスのファイルに書き込む        |
| `rules`          | `string[]`                          | —            | 有効にするルール ID（他はすべて無効）              |
| `metaComponents` | `string[]`                          | —            | ヘッドメタデータを出力するカスタムコンポーネント名 |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`        | `'pass'`     | 動的に設定されたメタデータの扱い方                 |
| `prerenderDir`   | `string`                            | —            | プリレンダリングページディレクトリの上書き         |

## 対象範囲

分析されるのは**プリレンダリング**されたルートのみです。SSR や動的ルートには `svelte-vitals` CLI を使用してください。

## 動作の仕組み

`vite build` 中、SvelteKit がページをプリレンダリングした後、`@svelte-vitals/vite` は出力された HTML ファイルを探して各ページの `<head>` を解析し、完全なルールセットを実行します。いずれかの検出結果が `failOn` の閾値に達すると、ビルドプロセスは非ゼロのコードで終了します。

## 開発オーバーレイ

開発時には、`@svelte-vitals/vite` は `transformPageChunk` を通じてブラウザにライブ警告を注入します。詳細は [開発オーバーレイ](/svelte-vitals/ja/guides/dev-overlay/) を参照してください。
