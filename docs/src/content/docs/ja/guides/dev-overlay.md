---
title: 開発オーバーレイ
description: ビルドを待たずに開発サーバーでライブの SEO 警告を取得します。
sidebar:
  order: 5
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

`vite dev` 中に `/__svelte-vitals/` でライブダッシュボードを表示します。検索・並び替えができるルート一覧と、選択中ルートの詳細ペインで構成され、作業に合わせてその場で更新されます。

```js
// vite.config.{js,ts}
import { svelteVitals } from '@svelte-vitals/vite';

export default {
  plugins: [svelteVitals({ ui: true }) /* , sveltekit() */]
};
```

有効にすると、`vite dev` はサーバー起動のたびに本来の `Local:`/`Network:` 表示の直後にダッシュボードのURLを出力するので、`/__svelte-vitals/` というパスを覚えておく必要はありません。

```
  ➜  svelte-vitals: http://localhost:5173/__svelte-vitals/
```

dev サーバーの起動直後から、ダッシュボードは**プロジェクト全体**を表示します。起動時に全ルート・全カテゴリ（SEO・Performance・Correctness・Security・Architecture）の静的解析が非同期で実行され（`npx svelte-vitals@latest` と同じ解析です）、ページを1つも訪問しなくても本物のプロジェクト Health が得られます。ソースファイル（`src/` または `static/` 配下、あるいは `svelte.config.*` / `svelte-vitals.config.*`）を保存すると、デバウンス付きの再解析が走り、ダッシュボードが自動的に更新されます。

この静的なベースラインの上に、アプリを操作することで結果が精緻化されます。これは dev handle（上記オーバーレイと同じもの）から供給されるため、`src/hooks.server.ts` の `svelteVitalsHandle()` はそのまま残してください。訪問した各ルートのレンダリング済み `<head>` が解析され、そのライブ結果がそのルートの静的結果を置き換えます — レンダリング済みのページのほうが、特に動的な値については真実に近いためです。ルート見出しには由来を示すバッジが付きます：実際にレンダリングされたページ由来の結果なら `measured`、まだソース解析のみでカバーされているルートなら `static` です。

サイドバーの検索ボックスでは、ルートパスまたは指摘のルールID・タイトル・場所でルートを絞り込めます。並び替えコントロールで一覧の順序を変更できます(既定はスコアが低い順)。ルート(または「Overview」)を選択すると詳細ペインが更新され、選択状態はURLのハッシュに反映されるため、リロードや共有リンクで同じ表示に戻れます。トップバーにはプロジェクト全体の再解析中であることを示す「Analyzing…」表示と、ダークモード切り替えボタンがあります — 設定はブラウザごとに保存され、未設定時はOSの設定に従います。

「Overview」では、全ルートの指摘とプロジェクト全体のサイトチェックをひとつのリストにまとめて表示し、重要度・カテゴリのチップでそのリストを直接絞り込めます。各指摘にはどのルートのものかが表示され、クリックするとそのルートの詳細ペインへ直接移動します。

ライブ更新はループバックオリジン（`localhost`・`127.0.0.1`・`[::1]`）でのみ流れます。`vite dev --host` で LAN の IP からアプリを開いた場合、ハンドルは ingest の POST をスキップする（`Host` ヘッダー偽装への防御）ため、訪問したルートが `measured` に精緻化されません。その場合は `localhost` から開いてください。`SVELTE_VITALS_DEBUG=true` を設定すると、ingest がスキップされた際にログが出力されます。

プロジェクト全体の解析が失敗した場合（例：dev サーバーのルートが SvelteKit プロジェクトでない場合）、失敗は `console.warn` でログに出力され、ダッシュボードはライブのみのモード — 訪問したルートだけを表示 — にフォールバックします。dev サーバーが壊れることはありません。

## バージョンのずれ

ダッシュボードのトップバーには `v<@svelte-vitals/vite のバージョン>` と、その隣に `core v<@svelte-vitals/core のバージョン>` が表示されます。CLI と検出結果を比較するときに重要なのは後者の core バージョンです。`svelte-vitals`（CLI）と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されつつ、共有のルールエンジンである `@svelte-vitals/core` をラップしているだけなので、両方のパッケージ自体は最新に見えていても、実際には**異なる** core バージョンに解決されることがあります。その場合、新しい core リリースで追加されたルールは、実際にそのバージョンに依存している側にしか現れません。

これはパッケージマネージャーのクールダウン/固定機能によって、気づかないうちに発生し得ます — 例えば pnpm の [`minimumReleaseAge`](https://pnpm.io/settings#minimumreleaseage) は、`pnpm dlx svelte-vitals@latest` の実行結果を、lockfile 上の `@svelte-vitals/vite` が依存している core より古い「成熟した」リリース（古い core を伴う）に静かに解決してしまうことがあります。同じプロジェクトで CLI と開発オーバーレイの検出結果が食い違う場合は、まず `svelte-vitals --version` を実行して `(core X.Y.Z)` の部分をダッシュボードのトップバーの `core vX.Y.Z` と比較してください — バグを疑う前に真っ先に確認すべき点です。
