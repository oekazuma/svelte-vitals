---
title: 設定ファイル
description: 毎回フラグを指定する代わりに、svelte-vitals.config で一度だけ設定します。
sidebar:
  order: 3.5
---

`--rules`、`--ignore`、`--fail-on`、`--weights` を実行のたびに指定する代わりに、プロジェクトルートに `svelte-vitals.config` ファイルを置いて設定をまとめられます。CLI と [MCP サーバー](/svelte-vitals/ja/guides/mcp/) はどちらもこのファイルを自動的に読み込みます（MCP サーバーは CLI と同じ `analyzeProject` 関数を呼び出しているため、この機能をそのまま引き継ぎます）。

## 探索場所

svelte-vitals は次のファイルを、この優先順で**分析対象ディレクトリのみ**から探します（親ディレクトリへの上方探索は行いません — 分析対象ディレクトリは SvelteKit プロジェクトのルートであり、`vite.config.*` が置かれている場所と同じです）：

1. `svelte-vitals.config.mjs`
2. `svelte-vitals.config.js`
3. `svelte-vitals.config.ts`

最初に見つかったファイルが採用されます。どれも存在しない場合、この機能がなかった頃と同様、組み込みのデフォルト設定で実行されます。

## 例

```js
// svelte-vitals.config.mjs
import { defineConfig } from 'svelte-vitals';

export default defineConfig({
  treatDynamicAs: 'warn',
  metaComponents: ['Seo'],
  rules: {
    SEO008: 'off'
  },
  failOn: 'warning',
  weights: {
    seo: 2
  }
});
```

`defineConfig` は、渡したオブジェクトを組み込みのデフォルトにマージするだけの恒等関数（identity helper）です — 型チェックとエディタの補完のために存在するのであって、特別な処理をしているわけではありません。プレーンなオブジェクトの default export でもまったく同じように動作します。

```js
// svelte-vitals.config.mjs
export default {
  failOn: 'warning'
};
```

`defineConfig` は `svelte-vitals` からインポートしてください — 実際にインストールしているパッケージです。（`@svelte-vitals/core` からも re-export されていますが、このパッケージは通常は推移的な依存関係であり、pnpm のデフォルトである厳格な `node_modules` の構成では、プロジェクトから推移的な依存関係を直接解決できません。）

## 利用可能なオプション

| オプション       | 型                                                           | デフォルト     | 説明                                                                                       |
| ---------------- | ------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'`                                 | `'pass'`       | メタデータの値が動的に設定されているルートをどう採点するか                                 |
| `metaComponents` | `string[]`                                                   | `[]`           | `<head>` メタデータを出力するカスタムコンポーネント名                                      |
| `rules`          | `Record<string, 'off' \| 'critical' \| 'warning' \| 'info'>` | `{}`           | ルールごとの上書き — ルールを無効化するか重大度を変更する                                  |
| `failOn`         | `'critical' \| 'warning' \| 'info'`                          | `'critical'`   | 実行を失敗させる（終了コード `1`）最低重大度                                               |
| `weights`        | `Partial<Record<Category, number>>`                          | 各カテゴリ `1` | 組み合わせた [Health スコア](/svelte-vitals/ja/guides/health-report/) のカテゴリごとの重み |

`Category` は `'seo' | 'performance' | 'correctness' | 'security' | 'architecture'` です。

## 優先順位

各フィールドについて、次のうち最初に設定されているものが優先されます：**CLI フラグ > 設定ファイル > 組み込みのデフォルト**。これはフィールド単位であり、全か無かではありません — 一度きりの `--fail-on info` を指定しても、設定ファイルの他の内容は破棄されません。

一つ例外があります。`rules` はキー単位でマージされるのではなく、全体が丸ごと置き換わります。コマンドラインで `--rules` または `--ignore` を指定した場合、フラグから構築されたルールセットがその実行では設定ファイルの `rules` を完全に置き換えます — マージはされません。

## バリデーション

- **無効で svelte-vitals が停止する（終了コード `2`）**：ファイルを読み込めない（構文エラー、default export がない、または後述する Node のバージョンで `.ts` ファイルを読み込めない場合）、`rules` 内に未知のルール ID がある、`weights` 内に未知のカテゴリまたは負の値・数値でない値がある場合。
- **無効だが無視され、警告が出る（分析は続行される）**：認識できない `treatDynamicAs` または `failOn` の値（フラグ／デフォルトにフォールバック）、認識できないトップレベルキー（将来の設定フィールドとの前方互換性のため）。

## TypeScript の設定ファイル

`svelte-vitals.config.ts` は **Node 22.18 以降または 23.6 以降**であれば無フラグでそのまま動作します（このバージョンで Node のネイティブな TypeScript 型ストリッピングがフラグなしで使えるようになりました）。svelte-vitals のフロアは Node 22.13 なので、**22.13〜22.17** では `.ts` 設定ファイルの読み込みが分かりやすいエラーで失敗します。次のいずれかを選んでください：

- Node 22.18 以降にアップグレードする（同じ 22 系の LTS のままで済みます）。
- `node --experimental-strip-types` を付けて再実行する。
- ファイルを `.mjs` または `.js` にリネームする — プレーンな JavaScript はサポートされているすべての Node バージョンでフラグなしに動作します。

## Vite プラグインで設定ファイルを再利用する

`@svelte-vitals/vite` 自体は `svelte-vitals.config.*` を読み込みません — `svelte-vitals` の CLI パッケージにあえて依存していないため、読み込むためのローダーがそもそも存在しないのです。`vite.config.ts` はすでに Vite 自身の TypeScript 読み込みを経由しているので、そこで設定ファイルを import し、プラグインオプションに直接展開してください。

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteVitals } from '@svelte-vitals/vite';
import config from './svelte-vitals.config.js';

export default {
  plugins: [sveltekit(), svelteVitals({ ...config, report: 'console' })]
};
```

こうすることで、CLI と Vite プラグインの両方に対して `treatDynamicAs` / `metaComponents` / `rules` / `failOn` の設定を一箇所にまとめられます。（プラグインには Health の `weights` という概念自体がないため、含まれていても無視されます。）
