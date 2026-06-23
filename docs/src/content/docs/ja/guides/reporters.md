---
title: レポーター
description: svelte-vitals が検出結果をフォーマットして出力する方法を選択します。
---

svelte-vitals は 5 つの出力レポーターをサポートしています。`--reporter <fmt>` で選択するか、環境に適したものを自動選択に任せてください。

## 利用可能なレポーター

### `console`（デフォルト）

ターミナル使用に適した、人間が読みやすいテキスト出力です。重大度ごとに検出結果をグループ化し、ルートパスとファイルの場所を含みます。

```bash
svelte-vitals --reporter console
```

### `json`

マシン可読な JSON 出力。スクリプト、ダッシュボード、または他のツールへの結果のフィードに便利です。

```bash
svelte-vitals --reporter json
# またはエイリアスを使用：
svelte-vitals --json
```

### `agent`

AI コーディングエージェント向けに設計された Markdown 修正ドキュメントです。各失敗した検出結果には以下が含まれます：

- ルートとソースファイルの場所
- スニペット付きの具体的なコード修正
- 受け入れチェック

`agent` レポーターは、既知の AI エージェント環境（例：Claude Code が `CLAUDECODE` を設定）が検出された場合に自動選択されます。自動選択された場合（明示的にリクエストされていない場合）、エージェントターミナルで作業している人間が Markdown 出力に驚かないよう、上書き方法を説明する 1 行のヒントが stderr に表示されます。

```bash
svelte-vitals --reporter agent
```

環境変数で自動選択を上書きする：

```bash
SVELTE_VITALS_REPORTER=agent svelte-vitals
```

### `sarif`

[SARIF v2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) 形式。GitHub Code Scanning、Azure DevOps、その他 SARIF を使用する SAST ツールと互換性があります。

```bash
svelte-vitals --reporter sarif
```

### `github`

GitHub Actions の [ワークフローコマンド](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions) 形式。プルリクエストにインラインで表示される `::error` および `::warning` アノテーションを出力します。

`github` レポーターは `GITHUB_ACTIONS=true` が設定されている場合（GitHub Actions が自動的に設定）に自動選択されます。

```bash
svelte-vitals --reporter github
```

## 自動選択の優先順位

1. **明示的な `--reporter <fmt>`** — 常に最優先。
2. **`SVELTE_VITALS_REPORTER` 環境変数** — 自動検出を上書き。
3. **AI エージェント環境**（例：`CLAUDECODE` が設定されている）→ `agent`。
4. **GitHub Actions**（`GITHUB_ACTIONS=true`）→ `github`。
5. **デフォルト** → `console`。

## 例：CI パイプライン

```yaml
# .github/workflows/seo.yml
- name: Check SEO
  run: npx svelte-vitals --fail-on-warning
  # GITHUB_ACTIONS はすでに設定済み；github レポーターが自動選択される
```
