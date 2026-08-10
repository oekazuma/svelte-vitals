---
title: svelte-vitals install
description: Vite との連携、Agent Skills、設定ファイル、CI をセットアップする。
sidebar:
  order: 2
---

svelte-vitals の Vite との連携、**Claude Code**・**Codex**・**Cursor** 向けの [Agent Skills](/ja/guides/agent-skills)、[設定ファイル](/ja/guides/configuration)、[CI ワークフロー](/ja/guides/ci) を対話的にセットアップします。プロジェクトに必要な配線を一度の実行でまとめて行えます。

```bash
npx svelte-vitals@latest install
```

フラグなしで実行すると対話式ウィザードが起動します。ターゲットを選択し、変更計画を確認して適用します。ピッカーはターゲットを **Vite integration**、**Agent Skills & rules**、**CI（GitHub Actions）**、**Config file** のカテゴリごとにグループ化するため、それぞれ何のためのものか分かりやすくなっています。非対話環境／CI ではフラグだけで実行できます。

## `--client <ids>`

設定するターゲットをカンマ区切りで指定します：`vite-plugin`、`vite-hooks`、`claude-skill`、`cursor-rules`、`claude-skill-improve`、`config-file`、`ci-workflow`。指定した場合は対話式の選択がスキップされます。

`vite-plugin` はビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します（ライブダッシュボードはデフォルトで有効）。`vite-hooks` は `svelteVitalsHandle` を `src/hooks.server.{ts,js}` に組み込み、閲覧に応じてダッシュボードのルート別精度を上げます。

どちらも `magicast` によるコードモッドで、確実に認識できる形のファイルだけを変更します。認識できない場合は手を付けず、スニペットを表示します。書き込み時に `@svelte-vitals/vite` が依存関係になければ、検出したパッケージマネージャーで自動インストールします。**`--force` はこの2つには適用されず**、既存の登録は常にそのまま維持されます。

`claude-skill` は [`/svelte-vitals` Agent Skill](/ja/guides/agent-skills#svelte-vitals) を `.claude/skills/`・`.agents/skills/`・`.cursor/skills/` へ同時に、バイト単位で同一の内容で書き出します（3つとも同じフロントマター形式の `SKILL.md` 規約を読むため）。`cursor-rules` は `.cursor/rules/svelte-vitals.mdc` を書き出します。

どちらもインストール時点のルールセット（各ルールの id・タイトル・severity・rationale をカテゴリごとに）から生成されます。コードモッドではなく全文を再生成するため、**`--force` はこの2つに適用され**、既存ファイルを上書きします。

`claude-skill-improve` は [`/improve-svelte` Agent Skill](/ja/guides/agent-skills#improve-svelte) を同じ3つの場所（`improve-svelte/` 以下の `.claude/skills/improve-svelte/SKILL.md`、`.agents/skills/improve-svelte/SKILL.md`、`.cursor/skills/improve-svelte/SKILL.md`）に書き出します。`claude-skill`／`cursor-rules` と同様に毎回全文を再生成するため、**`--force` が適用されます**。

`config-file` はオプション（`treatDynamicAs`、`metaComponents`、`rules`、`failOn`、`weights`）をすべてコメントアウトした `svelte-vitals.config.{mjs,ts}` の雛形を生成します。拡張子は環境に合わせて自動で選びます。詳細は [設定ファイル](/ja/guides/configuration) を参照してください。エージェントターゲットと同様に毎回全文を再生成するため、**`--force` が適用されます**（上書きするのは既に存在するファイルで、再生成しても拡張子は変わりません）。

`ci-workflow` は `.github/workflows/svelte-vitals.yml` を生成します。これは単体の [`svelte-vitals ci install`](/ja/guides/ci) コマンドが書き出すのと同じファイルです。別コマンドを覚えておく代わりに、他のターゲットと同じ実行でCIもセットアップできます。毎回全文を再生成するため、**`--force` が適用されます**。既存ワークフローのピン留めされたアクションバージョンだけを更新したい場合は、これまで通り `svelte-vitals ci upgrade`（このウィザードには含まれません）を使います。

## モノレポでの `--app <app>`

`vite-plugin`、`vite-hooks`、`config-file` の3ターゲットは SvelteKit の**アプリ**ディレクトリに書き込む必要があります。`vite.config.*` と `src/hooks.server.*` はアプリディレクトリにあり、`svelte-vitals.config.*` も[分析対象ディレクトリからしか読み込まれません](/ja/guides/configuration#探索場所)。モノレポのルートで `install` を実行した場合、これらのターゲットは[アナライザーと同じ方法](/ja/guides/cli#モノレポ)で対象アプリを解決します：

- 明示的な `--app apps/web` が常に最優先です（そのディレクトリに `svelte.config.{js,ts}` がなければ終了コード `2` で失敗します）。
- それ以外で、カレントディレクトリ自体が SvelteKit アプリならそのまま使われます。
- それ以外は自動検出が働きます。見つかったアプリが1件ならそのまま使い（通知あり）、複数見つかった場合、対話的な端末では選択プロンプトを表示し、非対話環境では `--app` を求めて終了コード `2` になります。

それ以外のターゲット（エージェントスキル/ルール、`ci-workflow`）は常にカレントディレクトリ基準で書き込みます。モノレポではリポジトリルートがそれらの正しい置き場所だからです。

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

ディスク上に既にある `claude-skill`／`cursor-rules`／`claude-skill-improve` ファイルだけを現行のルールセットで再生成します。どのターゲットをインストールしたか覚えていなくても、追加されたルールを1コマンドで反映できます。無いファイルを作ることはありません。

`--yes`・`--force`・`--app` は warning を出して無視され、`--client` との併用は致命的エラーです。生成済みファイルが1件も無い場合は案内を表示して終了コード `0` で終了します。

```bash
# 非対話：エージェントスキルの生成と Vite プラグインの登録
npx svelte-vitals@latest install --client claude-skill,vite-plugin --yes

# 何が変更されるかを書き込まずにプレビュー
npx svelte-vitals@latest install --client config-file --dry-run

# ルール追加後、既にインストール済みのエージェントスキル/ルールファイルを再生成
npx svelte-vitals@latest install --refresh

# 他と同じ実行でCIもセットアップ
npx svelte-vitals@latest install --client claude-skill,ci-workflow --yes
```

対象ファイルを読み取れない場合は、そのパスを報告して終了コード `2` で失敗します。中身を確認できないファイルを上書きすることはありません。

> **CLI に一本化したため削除:** `claude-code`、`cursor`、`codex` の3つのターゲット ID は `@svelte-vitals/mcp` サーバーを設定するためのものでしたが、このパッケージは廃止されました。現在これらを渡すと warning を出してスキップします。代わりに `claude-skill` を使ってください（Claude Code・Codex・Cursor がいずれも読み取る単一のスキルファイルを生成します）。`explain_rule` ツールが返していたルール単位の詳細は [`svelte-vitals explain`](/ja/guides/cli#explain) が置き換えます。
