---
title: MCP サーバー
description: Model Context Protocol を通じて AI エージェントが svelte-vitals 分析を実行できるようにします。
---

`@svelte-vitals/mcp` は、svelte-vitals をツールとして公開する [Model Context Protocol](https://modelcontextprotocol.io) サーバーです。AI エージェントはそのツールループ内でこれらのツールを呼び出すことができます。エージェントは構造化された実行可能な検出結果を受け取ります — それぞれに `fix`、`recommendation`、`docsUrl` が含まれており、CLI サブプロセスを手動で起動する必要はありません。

> **ESM のみ**（Node 18+）。ES モジュールのみを提供します。`require()` は設計上サポートされていません。

## ツール

### `analyze`

SvelteKit プロジェクトの静的モード分析を実行します。

**入力パラメータ：**

| パラメータ       | 型                                   | 説明                                               |
| ---------------- | ------------------------------------ | -------------------------------------------------- |
| `path`           | `string?`                            | SvelteKit プロジェクトへのパス（デフォルトは cwd） |
| `metaComponents` | `string[]?`                          | ヘッドメタデータを出力するコンポーネント名         |
| `route`          | `string?`                            | この glob に一致するルートのみを分析               |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'?`        | 動的メタデータ値の扱い方                           |
| `rules`          | `string[]?`                          | 有効にするルール ID（他はすべて無効）              |
| `ignore`         | `string[]?`                          | 無効にするルール ID                                |
| `failOn`         | `'critical' \| 'warning' \| 'info'?` | レスポンスの `failed` フラグの重大度閾値           |

**返り値：** ルートごとおよびサイト全体のスコアと検出結果のリスト。各検出結果には `fix`、`recommendation`、`docsUrl` が含まれます。

### `explain_rule`

単一ルールのドキュメントを返します。

**入力パラメータ：**

| パラメータ | 型       | 説明                      |
| ---------- | -------- | ------------------------- |
| `ruleId`   | `string` | ルール ID（例：`SEO001`） |

**返り値：** ルールのタイトル、カテゴリ、重大度、根拠、ドキュメント URL、修正テンプレート。

## セットアップ

### Claude Desktop / Claude Code

MCP クライアント設定（例：`~/.claude/claude_desktop_config.json`）に追加します：

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

### その他の MCP クライアント

stdio トランスポート MCP サーバーをサポートする任意のクライアントで同じパターンを使用できます — コマンドを `npx` に、引数を `["-y", "@svelte-vitals/mcp"]` に設定してください。

## トランスポート

サーバーは **stdio** を通じて通信します — HTTP ポートは開きません。
