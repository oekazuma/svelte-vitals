---
title: プラグインモード
description: ビルド時にプリレンダリングされた HTML を分析するために svelte-vitals を vite build に統合します。
sidebar:
  order: 1
---

`@svelte-vitals/vite` は `vite build` に便乗して**プリレンダリングされた HTML** を解析し、CLI と同じ SEO・Performance・（ランドマークと id の）Accessibility のルールを実行します。実際の出力を検査するので、使っているライブラリを問いません。

さらに `src/` 配下（コンポーネント、runes モジュール（`.svelte.ts`/`.svelte.js`）、ルート/フックファイル）を走査し、Correctness・Security・Architecture・残りの Accessibility とコンポーネントスコープの Performance ルールも実行します。デフォルトで有効です。検出結果が `failOn` の閾値に達するとビルドが失敗します。

> **ESM のみ**（Node 22.13+）。ES モジュールのみを提供します。`require()` は設計上サポートされていません。

## インストール

```bash
npm install --save-dev @svelte-vitals/vite
# または
pnpm add -D @svelte-vitals/vite
```

## セットアップ

`vite.config.ts` に `svelteVitals` を追加します：

```ts vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [sveltekit(), svelteVitals({ failOn: 'critical', report: 'console' })]
};
```

## オプション

| オプション       | 型                                                           | デフォルト     | 説明                                                                                                                        |
| ---------------- | ------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                          | `'critical'`   | ビルドを失敗させる最低重大度                                                                                                |
| `report`         | `'console' \| 'json' \| false`                               | `'console'`    | 分析レポートの出力形式                                                                                                      |
| `outFile`        | `string`                                                     | —              | JSON レポートをこのパスのファイルに書き込む                                                                                 |
| `rules`          | `Record<string, 'off' \| 'critical' \| 'warning' \| 'info'>` | `{}`           | ルールごとの上書き（ルールを無効化するか重大度を変更する）                                                                  |
| `metaComponents` | `string[]`                                                   | —              | ヘッドメタデータを出力するカスタムコンポーネント名                                                                          |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                 | `'pass'`       | 動的に設定されたメタデータの扱い方                                                                                          |
| `weights`        | `Partial<Record<Category, number>>`                          | 各カテゴリ `1` | レポート内の組み合わせた Health スコアのカテゴリごとの重み                                                                  |
| `prerenderDir`   | `string`                                                     | —              | プリレンダリングページディレクトリの上書き                                                                                  |
| `ui`             | `boolean`                                                    | `true`         | `vite dev` 中に[ライブダッシュボード](/ja/guides/dev-dashboard)を配信するかどうか。`false` にするとビルド時ゲートのみになる |
| `cwd`            | `string`                                                     | Vite のルート  | プロジェクトルート                                                                                                          |

## 設定ファイル

`@svelte-vitals/vite` はプロジェクトルートの `svelte-vitals.config.*` を自動的に読み込みます。上記の明示的なオプションは常に設定ファイルの値より優先されます。優先順位のルールと、ライブダッシュボードが設定ファイルをどう利用するかは [設定ファイル § Vite プラグインで設定ファイルを再利用する](/ja/guides/configuration#vite-プラグインで設定ファイルを再利用する) を参照してください。

## 対象範囲

**HTML** の検査対象は**プリレンダリング**されたルートのみです。SSR や動的ルートには読むべきビルド出力がないため、`svelte-vitals` CLI を使用してください。ソース走査のほうは、ルートのレンダリング方式に関係なくプロジェクト全体が対象です。

## 動作の仕組み

`vite build` 中、SvelteKit がページをプリレンダリングした後、`@svelte-vitals/vite` は出力された HTML ファイルを探して各ページの `<head>` と本文を解析し、あわせて `src/` を走査してソースレベルのルールを実行します。読んでいるのは実際に配信される HTML なので、動的な値もすでに解決済みです。CLI では `↯ dynamic` としか判定できない `<title>` も、ここでは実際の中身に対して検査されます。いずれかの検出結果が `failOn` の閾値に達すると、ビルドプロセスは非ゼロの終了コードで終わります。

## ライブダッシュボード

開発時には、`@svelte-vitals/vite` は `/__svelte-vitals/` でライブダッシュボードも配信します（デフォルトで有効）。詳細は [ライブダッシュボード](/ja/guides/dev-dashboard) を参照してください。
