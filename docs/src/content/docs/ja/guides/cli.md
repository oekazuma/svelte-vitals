---
title: CLI リファレンス
description: svelte-vitals のすべてのコマンドラインフラグの完全なリファレンス。
---

## 使用方法

```bash
svelte-vitals [path] [options]
```

`path` は省略可能で、デフォルトはカレントディレクトリです。

## フラグ

### `--reporter <fmt>`

出力フォーマットを選択します。

| 値        | 説明                                                        |
| --------- | ----------------------------------------------------------- |
| `console` | 人間が読みやすいテキスト出力（デフォルト）                  |
| `json`    | マシン可読な JSON                                           |
| `agent`   | AI コーディングエージェント向け Markdown 修正ドキュメント   |
| `sarif`   | SARIF v2.1（GitHub Code Scanning などの SAST ツールに対応） |
| `github`  | GitHub Actions アノテーション形式                           |

**自動選択：** 既知の AI エージェント環境（例：Claude Code が `CLAUDECODE` を設定）で実行された場合、`agent` レポーターが自動的に選択されます。GitHub Actions（`GITHUB_ACTIONS=true`）で実行された場合は `github` レポーターが自動選択されます。明示的な `--reporter` フラグは常に自動選択よりも優先されます。`SVELTE_VITALS_REPORTER` 環境変数でも上書きできます。

### `--json`

`--reporter=json` のエイリアスです。

### `--fail-on <severity>`

指定した重大度の閾値に達した検出結果が存在する場合、終了コード `1` で終了します。

| 値         | 動作                                   |
| ---------- | -------------------------------------- |
| `critical` | クリティカルな検出結果のみで失敗       |
| `warning`  | 警告またはクリティカルな検出結果で失敗 |
| `info`     | 任意の検出結果で失敗                   |

デフォルト動作（`--fail-on` なし）：クリティカルな検出結果が存在する場合のみ終了コード `1`。

### `--fail-on-warning`

`--fail-on=warning` のエイリアスです。

### `--min-health <0-100>`

組み合わせた Health スコアが指定値を下回った場合、終了コード `1` で終了します。`0` から `100` の数値を受け付けます。

```bash
svelte-vitals --min-health 80
```

スコアの計算方法については [Health レポート](/svelte-vitals/ja/guides/health-report/) を参照してください。

### `--route <glob>`

指定した glob パターンに一致するルートのみを分析します。

```bash
svelte-vitals --route "/blog/**"
```

### `--by-route`

コンソール出力にルートごとのスコア内訳を表示します。

### `--rules <ids>`

指定したルールのみを有効にし、他はすべて無効にします。ルール ID のカンマ区切りリストを受け付けます。

```bash
svelte-vitals --rules SEO001,SEO002
```

### `--ignore <ids>`

指定したルールを無効にします。ルール ID のカンマ区切りリストを受け付けます。

```bash
svelte-vitals --ignore PERF001
```

### `--meta-components <names>`

`<head>` メタデータを出力するカスタムコンポーネント名のカンマ区切りリストです。アナライザーにそれらのコンポーネントをヘッドメタデータエミッターとして扱うよう指示します。

```bash
svelte-vitals --meta-components "SeoHead,PageMeta"
```

### `--treat-dynamic-as <mode>`

メタデータの値が動的に設定されているルートをどのように扱うかを指定します。

| 値     | 動作                         |
| ------ | ---------------------------- |
| `pass` | 動的な値はパス（デフォルト） |
| `warn` | 動的な値は警告を生成         |
| `fail` | 動的な値は欠落として扱う     |

### `-h, --help`

ヘルプテキストを表示して終了します。

### `-v, --version`

バージョンを表示して終了します。

## 終了コード

| コード | 意味                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| `0`    | 失敗する検出結果なし                                                                 |
| `1`    | クリティカルな検出結果が存在する、または `--fail-on` / `--min-health` の閾値に達した |
| `2`    | 実行エラー（SvelteKit プロジェクトでない / 内部エラー）                              |
