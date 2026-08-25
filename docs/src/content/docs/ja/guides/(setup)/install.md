---
title: svelte-vitals install
description: Vite との連携、Cursor rules、設定ファイル、CI をセットアップする。
sidebar:
  order: 2
---

svelte-vitals の Vite との連携、Cursor rules、[設定ファイル](/ja/guides/configuration)、[CI ワークフロー](/ja/guides/ci) を対話的にセットアップします。プロジェクトに必要な配線を一度の実行でまとめて行えます。（[Agent Skills](/ja/guides/agent-skills) は別途 `npx skills add oekazuma/svelte-vitals` でインストールします。）

```bash
npx svelte-vitals@latest install
```

フラグなしで実行すると対話式ウィザードが起動します。ターゲットを選択し、変更計画を確認して適用します。ピッカーはターゲットを **Vite integration**、**Agent rules**、**CI（GitHub Actions）**、**Config file** のカテゴリごとにグループ化するため、それぞれ何のためのものか分かりやすくなっています。非対話環境／CI ではフラグだけで実行できます。

`svelte-vitals install --help` が表示するすべてのフラグです。CLI 自身の引数宣言と ja リソースから生成されています（フラグ名自体は CLI の実際の綴りのまま、英語です）。各ターゲットの詳しい挙動は以下の各セクションを参照してください。

<!-- cli-reference:start -->

| Flag                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--client <client>` | カンマ区切り: vite-plugin,vite-hooks,cursor-rules,config-file,ci-workflow （対話式ピッカーをスキップする。ピッカーはこれらをカテゴリごとにグループ化する — Vite integration、Agent rules、CI、Config file） vite-plugin はビルドモードのプラグインを vite.config.{ts,js,mjs} に登録する。vite-hooks は svelteVitalsHandle フックを src/hooks.server.{ts,js} に組み込み、閲覧に応じてライブダッシュボード のルート別精度を上げる。--force はこの2つには適用されない — 既存の登録は常にそのまま残る。 cursor-rules は Cursor rules ファイル（.cursor/rules/svelte-vitals.mdc）を書き出す。 現在のルールセットから生成され、--force で再生成できる。 setup-svelte-vitals、improve-svelte、svelte-vitals の Agent Skills はここでは インストールしない — `npx skills add oekazuma/svelte-vitals` でインストールする。 config-file は、すべてのオプションをコメントアウトした svelte-vitals.config.{js,ts} の雛形を 生成する。プロジェクトが TypeScript 志向に見え（tsconfig.json か vite.config.ts が存在する）、 かつ svelte-vitals が依存関係として宣言されていれば（defineConfig の import が読み込み時に 解決できるか）自動的に .ts（defineConfig 付き）を選び、それ以外は .js（ESM）をデフォルトにする。 既に存在するファイルを --force で再生成できる（拡張子は --force でも 変わらない）。 ci-workflow は .github/workflows/svelte-vitals.yml を生成する。これは `svelte-vitals ci install` が単体で書き出すのと同じファイルで、他のすべてと同じ実行でセットアップしたい場合に選ぶ。 --force で再生成できる。既存ワークフローのピン留めされたアクションバージョンだけを更新したい 場合は、引き続き `svelte-vitals ci upgrade` を使う。 |
| `--app <app>`       | モノレポ: vite-plugin/vite-hooks/config-file の書き込み先となる SvelteKit アプリのディレクトリ （例: --app apps/web）。省略した場合、カレントディレクトリ自体が SvelteKit アプリでなければ、 検出したアプリが1件ならそれを自動的に使用し（通知あり）、複数件なら TTY では選択プロンプトを、 非対話実行では終了コード 2 で --app を求める。他のターゲット（cursor-rules、ci-workflow）は常に カレントディレクトリに書き込む — モノレポではリポジトリルートがそれらの正しい置き場所のため。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `-y, --yes`         | 確認プロンプトをスキップ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `--dry-run`         | 変更計画を表示し、何も書き込まずに終了                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `--force`           | 既存の svelte-vitals エントリを上書き                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--refresh`         | ディスク上に既にある Cursor rules ファイル（cursor-rules）を現在のルールセットで再生成する。 ディスク上に既にあるファイルだけを再生成し、新規に作成することはない。--client とは併用できない。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `-h, --help`        | このヘルプを表示                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

<!-- cli-reference:end -->

## `--client <ids>`

設定するターゲットをカンマ区切りで指定します：`vite-plugin`、`vite-hooks`、`cursor-rules`、`config-file`、`ci-workflow`。指定した場合は対話式の選択がスキップされます。

`vite-plugin` はビルドモードのプラグインを `vite.config.{ts,js,mjs}` に登録します（ライブダッシュボードはデフォルトで有効）。`vite-hooks` は `svelteVitalsHandle` を `src/hooks.server.{ts,js}` に組み込み、閲覧に応じてダッシュボードのルート別精度を上げます。

どちらも `magicast` によるコードモッドで、確実に認識できる形のファイルだけを変更します。認識できない場合は手を付けず、スニペットを表示します。書き込み時に `@svelte-vitals/vite` が依存関係になければ、検出したパッケージマネージャーで自動インストールします。**`--force` はこの2つには適用されず**、既存の登録は常にそのまま維持されます。

`cursor-rules` は `.cursor/rules/svelte-vitals.mdc` を書き出します。インストール時点のルールセット（各ルールの id・タイトル・severity・rationale をカテゴリごとに）から生成されます。コードモッドではなく全文を再生成するため、**`--force` が適用され**、既存ファイルを上書きします。（[`/setup-svelte-vitals`・`/improve-svelte`・`/svelte-vitals` の Agent Skills](/ja/guides/agent-skills) はこのインストーラーのターゲットではありません — `npx skills add oekazuma/svelte-vitals` でインストールします。）

`config-file` はオプション（`treatDynamicAs`、`metaComponents`、`rules`、`failOn`、`weights`）をすべてコメントアウトした `svelte-vitals.config.{js,ts}` の雛形を生成します。拡張子は環境に合わせて自動で選びます。詳細は [設定ファイル](/ja/guides/configuration) を参照してください。`cursor-rules` と同様に毎回全文を再生成するため、**`--force` が適用されます**（上書きするのは既に存在するファイルで、再生成しても拡張子は変わりません）。

`ci-workflow` は `.github/workflows/svelte-vitals.yml` を生成します。これは単体の [`svelte-vitals ci install`](/ja/guides/ci) コマンドが書き出すのと同じファイルです。別コマンドを覚えておく代わりに、他のターゲットと同じ実行でCIもセットアップできます。毎回全文を再生成するため、**`--force` が適用されます**。既存ワークフローのピン留めされたアクションバージョンだけを更新したい場合は、これまで通り `svelte-vitals ci upgrade`（このウィザードには含まれません）を使います。

## モノレポでの `--app <app>`

`vite-plugin`、`vite-hooks`、`config-file` の3ターゲットは SvelteKit の**アプリ**ディレクトリに書き込む必要があります。`vite.config.*` と `src/hooks.server.*` はアプリディレクトリにあり、`svelte-vitals.config.*` も[分析対象ディレクトリからしか読み込まれません](/ja/guides/configuration#探索場所)。モノレポのルートで `install` を実行した場合、これらのターゲットは[アナライザーと同じ方法](/ja/guides/cli#モノレポ)で対象アプリを解決します。

- 明示的な `--app apps/web` が常に最優先です（そのディレクトリに `svelte.config.{js,ts}` がなければ終了コード `2` で失敗します）。
- それ以外で、カレントディレクトリ自体が SvelteKit アプリならそのまま使われます。
- それ以外は自動検出が働きます。見つかったアプリが1件ならそのまま使い（通知あり）、複数見つかった場合、対話的な端末では選択プロンプトを表示し、非対話環境では `--app` を求めて終了コード `2` になります。

それ以外のターゲット（`cursor-rules`、`ci-workflow`）は常にカレントディレクトリ基準で書き込みます。モノレポではリポジトリルートがそれらの正しい置き場所だからです。

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

ディスク上に既にある `cursor-rules` ファイルだけを現行のルールセットで再生成します。アップグレード後に追加されたルールを1コマンドで反映できます。無いファイルを作ることはありません。（`npx skills add` でインストールした Agent Skills の更新は `skills` CLI が行い、`--refresh` の対象ではありません。）

`--yes`・`--force`・`--app` は warning を出して無視され、`--client` との併用は致命的エラーです。生成済みファイルが1件も無い場合は案内を表示して終了コード `0` で終了します。

```bash
# 非対話：Cursor rules ファイルの生成と Vite プラグインの登録
npx svelte-vitals@latest install --client cursor-rules,vite-plugin --yes

# 何が変更されるかを書き込まずにプレビュー
npx svelte-vitals@latest install --client config-file --dry-run

# ルール追加後、既にインストール済みの Cursor rules ファイルを再生成
npx svelte-vitals@latest install --refresh

# 他と同じ実行でCIもセットアップ
npx svelte-vitals@latest install --client cursor-rules,ci-workflow --yes
```

対象ファイルを読み取れない場合は、そのパスを報告して終了コード `2` で失敗します。中身を確認できないファイルを上書きすることはありません。

認識できない `--client` の ID は warning を出してスキップされ、残りの有効なターゲットはそのままインストールされます。有効な ID が1つもない場合は、何もインストールせずに黙って終わるのではなく、コマンド自体が失敗します。
