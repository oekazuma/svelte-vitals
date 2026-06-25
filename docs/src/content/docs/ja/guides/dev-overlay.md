---
title: 開発オーバーレイ
description: ビルドを待たずに開発サーバーでライブの SEO 警告を取得します。
---

`@svelte-vitals/vite` には SvelteKit の `handle` フック — `svelteVitalsHandle` — が含まれており、**開発サーバー**で配信される各ページの SEO 分析を実行します。アプリをナビゲートするとターミナルに警告が出力されます。ビルドステップは不要です。

## 動作の仕組み

`svelteVitalsHandle` は SvelteKit の `transformPageChunk` を使用して各リクエストの完全にレンダリングされた HTML を観察します。最終チャンクが到着した後、`<head>` を解析し、アクティブなルールを実行して、検出結果を `console.warn` で記録します。レスポンスは変更もブロックもされません — 分析はファイアー＆フォーゲットで実行され、独自のエラーを飲み込むため、開発サーバーを壊すことはありません。

このフックは**開発時以外は何もしません**。`esm-env` の `DEV` フラグはビルド時に静的に解決されるため、ルールセットは構築されず、本番環境でのランタイムコストはゼロです。

検出結果はシグネチャで重複排除されます：同じルートが同じ検出結果セットを生成した場合、ホットリロード中のノイズを避けるために一度だけ記録されます。

## セットアップ

まだインストールしていない場合はパッケージをインストールします：

```bash
npm install --save-dev @svelte-vitals/vite
# または
pnpm add -D @svelte-vitals/vite
```

`src/hooks.server.ts` に `svelteVitalsHandle` を追加します：

```ts
// src/hooks.server.ts
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(svelteVitalsHandle());
```

他のハンドルが既にある場合は、`sequence` の中に `svelteVitalsHandle()` を並べて配置してください。

## オプション

`svelteVitalsHandle` はオプションのオブジェクトを受け付けます：

| オプション       | 型                            | 説明                                              |
| ---------------- | ----------------------------- | ------------------------------------------------- |
| `metaComponents` | `string[]`                    | ヘッドメタデータソースとして扱うコンポーネント名  |
| `rules`          | `Record<string, RuleSetting>` | ルールごとの上書き設定（例：`{ SEO008: 'off' }`） |

例：

```ts
export const handle = sequence(
  svelteVitalsHandle({
    metaComponents: ['SeoHead'],
    rules: { SEO008: 'off' }
  })
);
```

## 注意事項

- 分析されるのはレンダリングされた HTML の `<head>` のみです — ブラウザが受け取るデータと同じです。ソースレベルの動的な値（例：`{data.title}`）はハンドルが見る時点で常に解決されているため、`treatDynamicAs` はここでは適用されません。
- `failOn` は使用されません：このハンドルは検出結果を報告するだけで、リクエストをゲートしません。
- 内部分析エラーをターミナルに表示するには `SVELTE_VITALS_DEBUG=true` を設定してください。

## ライブ UI ダッシュボード

`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを表示します。CLI の `--reporter html` と同じレポートが、アプリを操作するたびにその場で更新されます。

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

これは dev handle（上記オーバーレイと同じもの）から供給されるため、`src/hooks.server.ts` の `svelteVitalsHandle()` はそのまま残してください。`http://localhost:5173/__svelte-vitals/` を開いてアプリを操作すると、訪問した各ルートのレンダリング済み `<head>` が解析され、ダッシュボードがライブ更新されます。

オーバーレイと同様、これは dev 専用かつレンダリングベースで、訪問したルートの SEO `<head>` ルールを対象とします。プロジェクト全体のレポート（全ルート・パフォーマンス・サイト全体のチェック）が必要な場合は `npx svelte-vitals` または `--reporter html` を実行してください。
