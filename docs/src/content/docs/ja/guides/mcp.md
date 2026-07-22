---
title: MCP サーバー
description: Model Context Protocol を通じて AI エージェントが svelte-vitals 分析を実行できるようにします。
sidebar:
  order: 6
---

`@svelte-vitals/mcp` は、svelte-vitals を AI エージェントがツールループ内から呼び出せるツールとして公開する [Model Context Protocol](https://modelcontextprotocol.io) サーバーです。エージェントは、構造化されそのまま対処に使える検出結果（各項目に `fix`、`recommendation`、`docsUrl` 付き）を受け取れるため、CLI をサブプロセスとして手動で起動する必要はありません。

> **ESM のみ**（Node 22.13+）。ES モジュールのみを提供します。`require()` は設計上サポートされていません。

## ツール

### `analyze`

SvelteKit プロジェクトの静的モード分析を実行します。

**入力パラメータ：**

| パラメータ       | 型                                   | 説明                                                                                                                                                            |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`           | `string?`                            | SvelteKit プロジェクトへのパス（デフォルトは cwd）                                                                                                              |
| `metaComponents` | `string[]?`                          | ヘッドメタデータを出力するコンポーネント名                                                                                                                      |
| `route`          | `string?`                            | この glob に一致するルートのみを分析                                                                                                                            |
| `diff`           | `string?`                            | この git 参照（例：`"origin/main"`）と比較して変更されたファイルに検出結果を絞り込む。CLI の `--diff` フラグに相当                                              |
| `baseline`       | `string?`                            | この git 参照（例：`"origin/main"`）の時点でまだ存在しなかった検出結果のみを報告する。CLI の `--baseline` フラグに相当                                          |
| `noSuppressions` | `boolean?`                           | この呼び出しでは `svelte-vitals-suppressions.json` を無視する。CLI の `--no-suppressions` フラグに相当                                                          |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'?`        | 動的メタデータ値の扱い方                                                                                                                                        |
| `rules`          | `string[]?`                          | 有効にするルール ID（他はすべて無効）                                                                                                                           |
| `ignore`         | `string[]?`                          | 無効にするルール ID                                                                                                                                             |
| `categories`     | `string[]?`                          | 分析対象をこれらのカテゴリに絞り込む（`rules`/`ignore` の選択との積集合。大文字小文字は区別しない）                                                             |
| `failOn`         | `'critical' \| 'warning' \| 'info'?` | レスポンスの `failed` フラグの重大度閾値                                                                                                                        |
| `weights`        | `Record<string, number>?`            | 組み合わせた Health スコアのカテゴリごとの重み（例：`{"seo": 2}`）。カテゴリ名は大文字小文字を区別せず、指定しなかったカテゴリはデフォルトの重み `1` になります |

**返り値：** ルートごとおよびサイト全体のスコアと検出結果のリスト。各検出結果には `fix`、`recommendation`、`docsUrl` が含まれます。

プロジェクトルートの `svelte-vitals.config` ファイル（[設定ファイル](/svelte-vitals/ja/guides/configuration/) を参照）も自動的に読み込まれます。これらのツール引数は、CLI フラグと同じように設定ファイルより優先されます。

### `explain_rule`

単一ルールのドキュメントを返します。

**入力パラメータ：**

| パラメータ | 型       | 説明                                  |
| ---------- | -------- | ------------------------------------- |
| `ruleId`   | `string` | ルール ID（例：`seo/title-presence`） |

**返り値：** ルールのタイトル、カテゴリ、重大度、根拠、ドキュメント URL、修正テンプレート。

## セットアップ

### クイックセットアップ（推奨）

プロジェクトルートで対話式インストーラーを実行すれば、MCP サーバーは自動で設定されます：

```bash
npx svelte-vitals@latest install
```

**Claude Code**、**Cursor**、**Codex** に対応しており、サーバーエントリを各クライアントの設定にマージします。既存の他のサーバーには手を加えません。利用可能なフラグ（`--client`、`--scope`、`--yes`、`--dry-run`、`--force`）については [`svelte-vitals install`](/svelte-vitals/ja/guides/install/) を参照してください。

### 手動セットアップ

stdio トランスポートをサポートする MCP クライアントであれば、手動でも設定できます。クライアントの設定（例：Claude Code の `.mcp.json` や `~/.claude.json`）に以下を追加します：

```json
{
  "mcpServers": {
    "svelte-vitals": {
      "command": "npx",
      "args": ["-y", "@svelte-vitals/mcp"]
    }
  }
}
```

Codex の場合、`~/.codex/config.toml` に相当する TOML を追加します：

```toml
[mcp_servers.svelte-vitals]
command = "npx"
args = ["-y", "@svelte-vitals/mcp"]
```

## トランスポート

サーバーは **stdio** を通じて通信し、HTTP ポートは開きません。
