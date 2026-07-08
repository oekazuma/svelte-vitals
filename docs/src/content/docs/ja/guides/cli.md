---
title: CLI リファレンス
description: svelte-vitals のすべてのコマンドラインフラグの完全なリファレンス。
sidebar:
  order: 3
---

## 使用方法

```bash
svelte-vitals [path] [options]
```

`path` は省略可能で、デフォルトはカレントディレクトリです。

> AI エージェントのクライアントに MCP サーバーをセットアップするための [`install` サブコマンド](#svelte-vitals-install) と、GitHub Actions の PR ゲートを生成する `ci install` サブコマンドもあります — 詳しくは [CI 連携](/svelte-vitals/ja/guides/ci/) を参照してください。

以下のフラグは、毎回の実行で指定する代わりに、プロジェクトルートの `svelte-vitals.config` ファイルにまとめて一度だけ設定することもできます — 詳しくは [設定ファイル](/svelte-vitals/ja/guides/configuration/) を参照してください。フラグは常に設定ファイルより優先されます。

## フラグ

### `--reporter <fmt>`

出力フォーマットを選択します。

| 値        | 説明                                                             |
| --------- | ---------------------------------------------------------------- |
| `console` | 人間が読みやすいテキスト出力（デフォルト）                       |
| `json`    | マシン可読な JSON                                                |
| `agent`   | AI コーディングエージェント向け Markdown 修正ドキュメント        |
| `sarif`   | SARIF v2.1（GitHub Code Scanning などの SAST ツールに対応）      |
| `github`  | GitHub Actions アノテーション形式                                |
| `html`    | ブラウザで開く自己完結の HTML レポート                           |
| `md`      | PR コメント / ジョブサマリー向けのコンパクトな Markdown サマリー |

指定できる値：`console, json, agent, sarif, github, html, md のいずれか`

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

### `--score`

組み合わせた Health スコア(整数)のみを stdout に出力し、他のレポーター出力をすべて抑制します。数値をパースせずにシェルプロンプトやスクリプトから使いたい場合に便利です。

```bash
svelte-vitals --score
svelte-vitals --score --min-health 80   # スコアでゲートする。終了コードは通常どおり pass/fail を反映
```

`--score` を `--reporter`/`--json` と組み合わせてもエラーにはなりませんが、レポーター出力は抑制され、stderr に警告が表示されます。終了コードは `--score` の影響を受けず、`--fail-on` と `--min-health` を通常どおり反映します。

### `--route <glob>`

指定した glob パターンに一致するルートのみを分析します。

```bash
svelte-vitals --route "/blog/**"
```

### `--diff [ref]`

`ref`（デフォルトは `HEAD`、つまり未コミットの変更）と比較して**変更された**ファイルにある検出結果のみを報告します。`ref` との**マージベース**を基準に比較し、追跡されていない（新規）ファイルも含まれます — そのため `--diff main` は「このブランチで変更した内容」を意味します。PR チェックとして最適です。

```bash
svelte-vitals --diff          # HEAD と比較した未コミットの変更
svelte-vitals --diff main     # main と比較してこのブランチが変更したすべて
```

### `--staged`

**コミット用にステージされた**ファイル（`git diff --cached`）にある検出結果のみを報告します。これからコミットしようとしている内容だけをチェックする pre-commit フックとして最適です。`--diff` よりも優先されます。

```bash
svelte-vitals --staged --fail-on warning
```

> どちらのフラグも、検出結果をそのソースファイルの場所でフィルタリングし、プロジェクトルートが git のルートであることを前提とします。git が利用できない場合（または `ref` が無効な場合）、svelte-vitals は警告を表示し、プロジェクト全体を分析します。

### `--baseline <ref>`

`ref` と比較して**新規に**追加された検出結果のみを報告します — つまり、`ref` に対して同じ解析を実行したときには存在しなかった検出結果です。`--diff`/`--staged`（ファイル単位でスコープする）とは異なり、`--baseline` は検出結果の同一性でスコープするため、変更したファイルに元からあった既存の issue ではゲートが失敗せず、その変更が実際に**導入した** issue だけが対象になります。デフォルトの `ref` はなく、明示的に指定する必要があります。

内部的には、svelte-vitals は `ref` を一時的な git worktree にチェックアウトして解析し、その検出結果（ルール ID + route + location で照合）を現在の実行結果から差し引きます。チェックアウトに失敗した場合（git リポジトリでない、git が利用できない、`ref` が無効）、svelte-vitals は警告を表示し、実行を失敗させる代わりにすべての検出結果を報告します。

```bash
svelte-vitals --baseline origin/main
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # 推奨する PR ゲート
```

> 検出結果は行番号を含めずに照合されるため、既に 1 件違反があるファイルの下の方に同じルールの 2 件目の違反を追加しても「新規」としては表示されません。

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

### `--category <cats>`

指定したカテゴリのルールのみに分析を限定します。カンマ区切りのリストを受け付け、大文字小文字は区別しません: `seo`、`performance`、`correctness`、`security`、`architecture`。

```bash
svelte-vitals --category seo
svelte-vitals --category seo,performance
```

`--category` は `--rules`/`--ignore`/設定ファイルのルール選択と積集合になります — ルールは両方を通過した場合のみ実行されます。カテゴリを絞り込むと [Health スコア](/svelte-vitals/ja/guides/health-report/) も絞り込まれます。組み合わせたスコアは、検出結果が存在するカテゴリのみの加重平均になるため、フィルタなしの実行結果と直接比較することはできません。未知のカテゴリを指定するとエラーになります(終了コード `2`)。

### `--weights <pairs>`

組み合わせた [Health スコア](/svelte-vitals/ja/guides/health-report/) のカテゴリごとの重み上書きです。カンマ区切りの `category=number` ペアを受け付けます。カテゴリ名は大文字小文字を区別しません。指定しなかったカテゴリはデフォルトの重み `1` になります。

```bash
svelte-vitals --weights seo=2,performance=1
```

未知のカテゴリ、または負の値・数値でない値を指定するとエラーになります（終了コード `2`）。

### 特定の指摘だけをインラインで抑制する

`--ignore` はプロジェクト全体でルールを無効にしますが、意図的な1箇所だけを黙らせたい場合は、対象行の直前に `svelte-vitals-disable-next-line` コメントを書きます。コンポーネントスコープの全ルール（Correctness、Security、Architecture、Performance）に対応: CORRECT001–005、SEC001–002、ARCH001–002、PERF009–010。

```svelte
<script>
  // プリレンダリングされたHTMLは常に非表示。canVibrate() はマウント後にのみ評価する必要があり、
  // そうしないとハイドレーション不一致が発生する。$derived だとハイドレーション中にも評価される。
  // svelte-vitals-disable-next-line CORRECT002
  $effect(() => {
    mounted = true;
  });
</script>
```

マークアップ内では HTML コメントを使います。

```html
<!-- svelte-vitals-disable-next-line SEC001 -->
<div>{@html trustedMarkup}</div>
```

ルール ID を省略すると次の行のすべてのルールを抑制します。複数指定する場合はカンマ区切りで書けます（`CORRECT002, SEC001`）。

2つの制約があります。コメントはその行に単独で書かれている必要があり（同一行の末尾コメントは認識されません）、対象行の**直前**の行になければなりません（間に空行があると一致しません）。

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

svelte-vitals の [MCP サーバー](/svelte-vitals/ja/guides/mcp/)、Vite との連携、AI エージェントのクライアント（**Claude Code**、**Cursor**、**Codex**）向けのエージェント指示ファイルを対話的にセットアップします。各クライアントの設定にサーバーエントリをマージします（既存の他のサーバーはそのまま維持されます）。

```bash
npx svelte-vitals install
```

フラグなしで実行すると対話式ウィザードが起動します — クライアント／ターゲットを選択し、クライアントごとにスコープを選び、変更計画を確認して適用します。非対話環境／CI ではフラグだけで実行できます。

### `--client <ids>`

設定するクライアント／ターゲットをカンマ区切りで指定します：`claude-code`、`cursor`、`codex`、`vite-plugin`、`vite-dev-overlay`、`claude-skill`、`cursor-rules`。指定した場合は対話式の選択がスキップされます。

`vite-plugin` は `@svelte-vitals/vite` のビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します。`vite-dev-overlay` は開発オーバーレイのフックを `src/hooks.server.{ts,js}` に組み込みます。どちらも `magicast` によるコードモッドを使用し、確実に認識できる形のファイルのみを変更します — それ以外の場合は何もせず、代わりに手動で追加するためのスニペットを表示します。どちらかが書き込まれ、かつ `@svelte-vitals/vite` がまだ依存関係に含まれていない場合、検出されたパッケージマネージャー経由で自動インストールされます。**`--force` はこの2つには適用されません** — フラグの有無にかかわらず、既存の登録は常にそのまま維持されます。

`claude-skill` は Claude Code のスキルを `.claude/skills/svelte-vitals/SKILL.md` に書き出します。`cursor-rules` は Cursor のプロジェクトルールファイルを `.cursor/rules/svelte-vitals.mdc` に書き出します。どちらもインストール時点のルールセット（各ルールの id・タイトル・severity・rationale をカテゴリごとにまとめたもの）から生成されるため、エージェントはコードを書く前からルールの知識と、いつ `svelte-vitals --diff`／`--staged` を実行すべきかというプレイブックを持つことになります。Vite 向けの2ターゲットと異なりコードモッドではなく毎回全文を再生成するため、**`--force` はこの2つに適用され**、既存ファイルを最新の内容で上書きします。

### `--scope <project|global>`

設定の書き込み先。選択したすべてのクライアントに適用されます。**Codex は常に global** です（プロジェクトスコープの設定を持たないため）。（Vite ターゲットとエージェントのスキル／ルールターゲットにはスコープがなく、このフラグは無視されます。）

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
