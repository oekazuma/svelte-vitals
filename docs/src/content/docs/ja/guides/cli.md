---
title: CLI リファレンス
description: svelte-vitals のすべてのコマンドラインフラグの完全なリファレンス。
---

## 使用方法

```bash
svelte-vitals [path] [options]
```

`path` は省略可能で、デフォルトはカレントディレクトリです。

> AI エージェントのクライアントに MCP サーバーをセットアップするための [`install` サブコマンド](#svelte-vitals-install) もあります。

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
| `html`    | ブラウザで開く自己完結の HTML レポート                      |

指定できる値：`console, json, agent, sarif, github, html のいずれか`

**自動選択：** 既知の AI エージェント環境（例：Claude Code が `CLAUDECODE` を設定）で実行された場合、`agent` レポーターが自動的に選択されます。GitHub Actions（`GITHUB_ACTIONS=true`）で実行された場合は `github` レポーターが自動選択されます。明示的な `--reporter` フラグは常に自動選択よりも優先されます。`SVELTE_VITALS_REPORTER` 環境変数でも上書きできます。

### `--json`

`--reporter=json` のエイリアスです。

### `--out-file <path>`

`--reporter html` の出力先パス（既定 `svelte-vitals-report.html`、`-` で標準出力）。

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

## `svelte-vitals install`

svelte-vitals の [MCP サーバー](/svelte-vitals/ja/guides/mcp/) を、AI エージェントのクライアント（**Claude Code**、**Cursor**、**Codex**）に対話的にセットアップします。各クライアントの設定にサーバーエントリをマージします（既存の他のサーバーはそのまま維持されます）。

```bash
npx svelte-vitals install
```

フラグなしで実行すると対話式ウィザードが起動します — クライアントを選択し、クライアントごとにスコープを選び、変更計画を確認して適用します。非対話環境／CI ではフラグだけで実行できます。

### `--client <ids>`

設定するクライアントをカンマ区切りで指定します：`claude-code`、`cursor`、`codex`。指定した場合は対話式の選択がスキップされます。

### `--scope <project|global>`

設定の書き込み先。選択したすべてのクライアントに適用されます。**Codex は常に global** です（プロジェクトスコープの設定を持たないため）。

| クライアント | project            | global                 |
| ------------ | ------------------ | ---------------------- |
| Claude Code  | `.mcp.json`        | `~/.claude.json`       |
| Cursor       | `.cursor/mcp.json` | `~/.cursor/mcp.json`   |
| Codex        | —                  | `~/.codex/config.toml` |

### `--yes`, `-y`

確認プロンプトをスキップします。

### `--dry-run`

変更計画を表示し、何も書き込まずに終了します。

### `--force`

既存の `svelte-vitals` エントリを上書きします。デフォルトでは、既に存在するエントリはそのまま維持されます。

```bash
# 非対話：このプロジェクトに Claude Code + Cursor を設定
npx svelte-vitals install --client claude-code,cursor --scope project --yes

# 何が変更されるかを書き込まずにプレビュー
npx svelte-vitals install --client codex --dry-run
```

既存の設定ファイルが解析できない場合、上書きせずに失敗します（終了コード `2`）。

## 終了コード

| コード | 意味                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| `0`    | 失敗する検出結果なし                                                                 |
| `1`    | クリティカルな検出結果が存在する、または `--fail-on` / `--min-health` の閾値に達した |
| `2`    | 実行エラー（SvelteKit プロジェクトでない / 内部エラー）                              |
