---
title: svelte-vitals install
description: AI エージェントのクライアント向けに MCP サーバー、Vite との連携、Agent Skills をセットアップする。
sidebar:
  order: 3.2
---

svelte-vitals の [MCP サーバー](/ja/guides/mcp)、Vite との連携、[Agent Skills](/ja/guides/agent-skills) を、AI エージェントのクライアント（**Claude Code**、**Cursor**、**Codex**）向けに対話的にセットアップします。サーバーエントリは各クライアントの設定にマージし、既存の他のサーバーには手を加えません。

```bash
npx svelte-vitals@latest install
```

フラグなしで実行すると対話式ウィザードが起動します。クライアント／ターゲットを選択し、クライアントごとにスコープを選び、変更計画を確認して適用します。ピッカーはターゲットを **MCP server**、**Vite integration**、**Agent Skills & rules**、**CI（GitHub Actions）**、**Config file** のカテゴリごとにグループ化するため、10個のターゲットがあってもそれぞれ何のためのものか分かりやすくなっています。非対話環境／CI ではフラグだけで実行できます。

## `--client <ids>`

設定するクライアント／ターゲットをカンマ区切りで指定します：`claude-code`、`cursor`、`codex`、`vite-plugin`、`vite-hooks`、`claude-skill`、`cursor-rules`、`claude-skill-improve`、`config-file`、`ci-workflow`。指定した場合は対話式の選択がスキップされます。

`vite-plugin` は `@svelte-vitals/vite` のビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します（ライブダッシュボードはデフォルトで有効です）。`vite-hooks` は `svelteVitalsHandle` フックを `src/hooks.server.{ts,js}` に組み込みます。このフックがあると、ページを閲覧するにつれてダッシュボードのルート別の精度が上がります。どちらも `magicast` によるコードモッドで、確実に認識できる形のファイルだけを変更します。認識できないファイルには手を付けず、手動で追加するためのスニペットを表示します。どちらかを書き込んだ時点で `@svelte-vitals/vite` が依存関係になければ、検出したパッケージマネージャーで自動インストールします。**`--force` はこの2つには適用されません**。フラグの有無にかかわらず、既存の登録は常にそのまま維持されます。

`claude-skill` は [`/svelte-vitals` Agent Skill](/ja/guides/agent-skills#svelte-vitals) を3つの慣例的な場所へ同時に書き出します：`.claude/skills/SKILL.md`（Claude Code）、`.agents/skills/SKILL.md`（Codex）、`.cursor/skills/SKILL.md`（Cursor）です。3つとも同じフロントマター形式の `SKILL.md` 規約を読むため、内容はバイト単位で同一です。`cursor-rules` は Cursor のプロジェクトルールファイルを `.cursor/rules/svelte-vitals.mdc` に書き出します。どちらもインストール時点のルールセット（各ルールの id、タイトル、severity、rationale をカテゴリごとにまとめたもの）から生成されます。Vite 向けの2ターゲットと異なりコードモッドではなく毎回全文を再生成するため、**`--force` はこの2つに適用され**、既存ファイルを最新の内容で上書きします。

`claude-skill-improve` は [`/improve-svelte` Agent Skill](/ja/guides/agent-skills#improve-svelte) を同じ3つの場所（`improve-svelte/` 以下の `.claude/skills/improve-svelte/SKILL.md`、`.agents/skills/improve-svelte/SKILL.md`、`.cursor/skills/improve-svelte/SKILL.md`）に書き出します。`claude-skill`／`cursor-rules` と同様に毎回全文を再生成するため、**`--force` が適用されます**。

`config-file` はオプション（`treatDynamicAs`、`metaComponents`、`rules`、`failOn`、`weights`）をすべてコメントアウトした `svelte-vitals.config.{mjs,ts}` の雛形を生成します。拡張子は環境に合わせて自動で選びます。詳細は [設定ファイル](/ja/guides/configuration) を参照してください。エージェントターゲットと同様に毎回全文を再生成するため、**`--force` が適用されます**（上書きするのは既に存在するファイルで、再生成しても拡張子は変わりません）。

`ci-workflow` は `.github/workflows/svelte-vitals.yml` を生成します。これは単体の [`svelte-vitals ci install`](/ja/guides/ci) コマンドが書き出すのと同じファイルです。別コマンドを覚えておく代わりに、他のターゲットと同じ実行でCIもセットアップできます。毎回全文を再生成するため、**`--force` が適用されます**。既存ワークフローのピン留めされたアクションバージョンだけを更新したい場合は、これまで通り `svelte-vitals ci upgrade`（このウィザードには含まれません）を使います。

## `--scope <project|global>`

設定の書き込み先。選択したすべてのクライアントに適用されます。**Codex は常に global** です（プロジェクトスコープの設定を持たないため）。（Vite ターゲット、エージェントのスキル／ルールターゲット、config-file ターゲット、ci-workflow ターゲットにはスコープがなく、このフラグは無視されます。）

| クライアント | project            | global                 |
| ------------ | ------------------ | ---------------------- |
| Claude Code  | `.mcp.json`        | `~/.claude.json`       |
| Cursor       | `.cursor/mcp.json` | `~/.cursor/mcp.json`   |
| Codex        | —                  | `~/.codex/config.toml` |

## モノレポでの `--app <dir>`

`vite-plugin`、`vite-hooks`、`config-file` の3ターゲットは SvelteKit の**アプリ**ディレクトリに書き込む必要があります。`vite.config.*` と `src/hooks.server.*` はアプリディレクトリにあり、`svelte-vitals.config.*` も[分析対象ディレクトリからしか読み込まれません](/ja/guides/configuration#探索場所)。モノレポのルートで `install` を実行した場合、これらのターゲットは[アナライザーと同じ方法](/ja/guides/cli#モノレポ)で対象アプリを解決します：

- 明示的な `--app apps/web` が常に最優先です（そのディレクトリに `svelte.config.{js,ts}` がなければ終了コード `2` で失敗します）。
- それ以外で、カレントディレクトリ自体が SvelteKit アプリならそのまま使われます。
- それ以外は自動検出が働きます。見つかったアプリが1件ならそのまま使い（通知あり）、複数見つかった場合、対話的な端末では選択プロンプトを表示し、非対話環境では `--app` を求めて終了コード `2` になります。

それ以外のターゲット（MCP クライアント設定、エージェントスキル/ルール、`ci-workflow`）は常にカレントディレクトリ基準で書き込みます。モノレポではリポジトリルートがそれらの正しい置き場所だからです。

```bash
cd my-monorepo
npx svelte-vitals@latest install --client vite-plugin,config-file --app apps/web --yes
```

## `--yes`, `-y`

確認プロンプトをスキップします。

## `--dry-run`

変更計画を表示し、何も書き込まずに終了します。

## `--force`

既存の `svelte-vitals` エントリを上書きします。デフォルトでは、既に存在するエントリはそのまま維持されます。

## `--refresh`

ディスク上に既に存在する `claude-skill`／`cursor-rules`／`claude-skill-improve` ファイルだけを、現行のルールセットで再生成します。ルールの追加や rationale の改善を、最初にどのエージェントターゲットをインストールしたか覚えていなくても1コマンドで反映できます。既に存在するファイルだけを再生成し、無いファイルは作りません（refresh はインストールではありません）。`--scope`、`--yes`、`--force` は適用対象外のため無視されます（warning を1行出力）。`--client` との併用は致命的エラーになります。生成済みのエージェントファイルが1件も見つからない場合は案内を表示して終了コード `0` で終了します。

```bash
# 非対話：このプロジェクトに Claude Code + Cursor を設定
npx svelte-vitals@latest install --client claude-code,cursor --scope project --yes

# 何が変更されるかを書き込まずにプレビュー
npx svelte-vitals@latest install --client codex --dry-run

# ルール追加後、既にインストール済みのエージェントスキル/ルールファイルを再生成
npx svelte-vitals@latest install --refresh

# 他と同じ実行でCIもセットアップ
npx svelte-vitals@latest install --client claude-code,ci-workflow --yes
```

既存の設定ファイルが解析できない場合、上書きせずに失敗します（終了コード `2`）。
