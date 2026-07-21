---
title: はじめに
description: svelte-vitals をインストールして、数秒で最初の SEO 監査を実行しましょう。
sidebar:
  order: 1
---

## svelte-vitals とは？

svelte-vitals は、ソースコードのみを使用して動作する、SvelteKit 向けの SEO とパフォーマンスのチェッカーです。実行中のサイト、ブラウザ、ビルドサーバーは不要です。レイアウトチェーンをたどりながら `<svelte:head>` ブロックを解析して各ルートの実効 `<head>` を解決し、ルートごとおよびサイト全体でスコアを算出します。

## 前提条件

Node.js 22.13 以降が必要です。

## インストール

一度だけ実行する場合はインストール不要です：

```bash
npx svelte-vitals@latest
```

開発依存として追加する場合：

```bash
npm install --save-dev svelte-vitals
# または
pnpm add -D svelte-vitals
```

## 最初の実行

任意の SvelteKit プロジェクトのルートで実行してください：

```bash
npx svelte-vitals@latest --verbose
```

サブディレクトリを指定する場合：

```bash
npx svelte-vitals@latest ./apps/web --verbose
```

出力例（`--verbose` を付けると、件数だけでなく、パスした各項目を個別に表示）:

```text
Svelte Vitals  ·  static mode

Health: 79/100
SEO Score: 79/100   (route avg 96 · capped at 79: critical present)

Critical (1)
────────────────────────
✗ SEO001  Missing <title>
            /none
            src/routes/none/+page.svelte

Passed (3)
────────────────────────
✓ SEO001  <title>  /blog
✓ SEO001  <title>  ↯ dynamic  /dynamic
✓ SEO001  <title>  /static

↯ = set dynamically (verified at runtime).
```

`↯` マーカーは値が動的に設定されていること（例:`<title>{data.title}</title>`）を意味します。動的なタイトルはパスし、本当に欠けているか空のメタデータだけが指摘されます。`--verbose` を付けない場合、`Passed` セクションは件数のみ（`Passed (3)`）に折りたたまれ、この脚注も表示されません（画面上に説明対象の `↯` マーカーが無いためです）。

## 終了コード

| コード | 意味                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| `0`    | 失敗する検出結果なし                                                                   |
| `1`    | クリティカルな検出結果が存在する（または `--fail-on` / `--min-health` の閾値に達した） |
| `2`    | 実行エラー（SvelteKit プロジェクトでない、または内部エラー）                           |

これらのコードは安定しており、CI ゲートとして使用できます。

## 次のステップ

- どのパッケージを使えばいいか迷ったら、CLI、Vite プラグイン、MCP サーバーを比較した [パッケージの選び方](/svelte-vitals/ja/guides/choosing-a-package/) を参照してください。
- すべてのフラグについては [CLI リファレンス](/svelte-vitals/ja/guides/cli/) を参照してください。
- `vite build` と連携するには [プラグインモード](/svelte-vitals/ja/guides/plugin-mode/) を使用してください。
- AI エージェントが自動的に分析を実行できるようにするには [MCP](/svelte-vitals/ja/guides/mcp/) を使用してください。`npx svelte-vitals@latest install` で Claude Code / Cursor / Codex に一発で組み込めます。
