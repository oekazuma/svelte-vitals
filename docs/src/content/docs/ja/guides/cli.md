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

> AI エージェントのクライアントに MCP サーバー、[Agent Skills](/svelte-vitals/ja/guides/agent-skills/)、Vite との連携をセットアップするための [`install` サブコマンド](/svelte-vitals/ja/guides/install/) と、GitHub Actions の PR ゲートを生成する `ci install` サブコマンドもあります — 詳しくは [CI 連携](/svelte-vitals/ja/guides/ci/) を参照してください。

以下のフラグは、毎回の実行で指定する代わりに、プロジェクトルートの `svelte-vitals.config` ファイルにまとめて一度だけ設定することもできます — 詳しくは [設定ファイル](/svelte-vitals/ja/guides/configuration/) を参照してください。フラグは常に設定ファイルより優先されます。

## モノレポ

明示的に `path` を渡した場合(またはアプリのディレクトリ自体で実行した場合)は常にそれが優先されます — svelte-vitals が指定されたターゲットを勝手に読み替えることはありません。

`path` を渡さず、かつカレントディレクトリが SvelteKit アプリでない場合、svelte-vitals はすぐに失敗する代わりに、近くの SvelteKit アプリ(`svelte.config.{js,ts}` と `src/routes` を持つディレクトリ)を探します:

- **1 件だけ見つかった場合:** 自動的にそのアプリを解析します。stderr に通知が出ます(`detected SvelteKit app at apps/web; analyzing it.`)。
- **複数見つかった場合(対話的な TTY):** どれを解析するか単一選択のプロンプトが表示されます。キャンセルすると、何も解析せずに終了コード `0` で終了します。
- **複数見つかった場合(非対話的 — CI、エージェント、パイプ出力など):** svelte-vitals はプロンプトを一切出しません — 検出したアプリの一覧と、`npx svelte-vitals@latest apps/web` のように明示的にパスを渡すヒントとともに終了コード `2` で終了します。
- **見つからなかった場合:** 従来どおり「SvelteKit プロジェクトが見つからない」というエラーで終了コード `2` になります。

```bash
cd my-monorepo
npx svelte-vitals@latest              # apps/web と apps/admin を検出し、どちらか選択を促す(1件だけなら自動選択)
npx svelte-vitals@latest apps/web     # 検出をスキップし、apps/web を直接解析する
```

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

`--score` を `--reporter` と組み合わせてもエラーにはなりませんが、レポーター出力は抑制され、stderr に警告が表示されます。終了コードは `--score` の影響を受けず、`--fail-on` と `--min-health` を通常どおり反映します。

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

> どちらのフラグも、検出結果をそのソースファイルの場所でフィルタリングします。分析対象のプロジェクトが git リポジトリのサブディレクトリ(例:モノレポの `apps/web/`)にある場合でも正しく動作します。ディレクトリが git リポジトリでない場合、git 自体が利用できない場合、または `ref` が無効な場合、svelte-vitals は警告を表示し、代わりにプロジェクト全体を分析します。

### `--baseline <ref>`

`ref` と比較して**新規に**追加された検出結果のみを報告します — つまり、`ref` に対して同じ解析を実行したときには存在しなかった検出結果です。`--diff`/`--staged`（ファイル単位でスコープする）とは異なり、`--baseline` は検出結果の同一性でスコープするため、変更したファイルに元からあった既存の issue ではゲートが失敗せず、その変更が実際に**導入した** issue だけが対象になります。デフォルトの `ref` はなく、明示的に指定する必要があります。

内部的には、svelte-vitals は `ref` を一時的な git worktree にチェックアウトして解析し、その検出結果（ルール ID + route + location で照合）を現在の実行結果から差し引きます。チェックアウトに失敗した場合（git リポジトリでない、git が利用できない、`ref` が無効）、svelte-vitals は警告を表示し、実行を失敗させる代わりにすべての検出結果を報告します。

```bash
svelte-vitals --baseline origin/main
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # 推奨する PR ゲート
```

> 検出結果は行番号を含めずに照合されるため、既に 1 件違反があるファイルの下の方に同じルールの 2 件目の違反を追加しても「新規」としては表示されません。

### `svelte-vitals-suppressions.json` / `--update-suppressions` / `--no-suppressions`

既存プロジェクトに svelte-vitals を導入する場合、たいてい修正しきれない検出結果の蓄積があり、ゲートを有効にする前にすべて直すことはできません。`--baseline <ref>` は **一時的な**ケース(PR とそのベースの比較)をカバーしますが、それとは別に **恒久的な**ランプもあります — 今日の検出結果を一度だけ記録して受け入れ、以降は新規のものだけをゲート対象にする、というものです。

```bash
svelte-vitals --update-suppressions   # svelte-vitals-suppressions.json を書き出し、現在のすべての検出結果を受け入れる
git add svelte-vitals-suppressions.json && git commit -m "chore: accept existing svelte-vitals findings"
svelte-vitals --fail-on warning       # 以降はこのコミット以後に導入された検出結果だけをゲート対象にする
```

`--update-suppressions` はプロジェクト全体を解析し(`--diff`/`--staged`/`--baseline` によるスコープ絞り込みは無視されます — このファイルは差分ではなくプロジェクト全体の状態を記録するためのものです)、現在ペナルティ対象になっているすべての検出結果を解析対象ディレクトリの `svelte-vitals-suppressions.json` に書き込み(パスしている検出結果は書き込まれません)、stderr にサマリーを表示して、レポートを出力せずに終了コード `0` で終了します。

ファイルが存在すると、以降の実行では**自動的に**(`--diff`/`--staged` と `--baseline` の後に)適用され、ルール ID・route・location がエントリと一致するペナルティ対象の検出結果を取り除いたうえで、抑制した件数を表示します:

```
svelte-vitals: 12 finding(s) suppressed by svelte-vitals-suppressions.json.
```

受け入れ済みの検出結果を修正すると、そのエントリは**stale(未使用)**になります(何にも一致しなくなります)。svelte-vitals は stale の件数を stderr に表示してプルーニングを促しますが、それだけで実行を失敗させることはありません:

```
svelte-vitals: 3 finding(s) suppressed by svelte-vitals-suppressions.json (1 stale entry — re-run --update-suppressions to prune).
```

`--no-suppressions` を使うと、その回の実行だけファイルを無視できます(例えばプロジェクトの本当の現状を確認したいとき)。壊れた `svelte-vitals-suppressions.json`(JSON として不正、`version` が一致しない、エントリに `id` がない、など)は黙って無視されるのではなく、致命的エラー(終了コード `2`)になります — タイプミスのあるファイルが CI のゲートを黙って無効化してしまうことを防ぐためです。

**`--baseline <ref>` との違い:** `--baseline` は実行のたびに git の ref を再解析して「何が既存か」を導出します — コミットは不要ですが、常に 1 つの ref としか比較できません。抑制ファイルは、一度だけ(または意図的に)構築してコミットする永続的な記録で、どの ref 上にいても適用され続けます。

> `--baseline` と同様、エントリは行番号なしで照合されます — 受け入れ済みのルールの 2 件目の違反が同じファイルの下の方に追加されても「新規」としては表示されません。このファイルは v1 では CLI にのみ影響します。まだ `@svelte-vitals/vite`、`@svelte-vitals/mcp`、GitHub Action からは読み込まれません。

### `--by-route`

コンソール出力にルートごとのスコア内訳を表示します。

### `--verbose`

すべての指摘を、集約・グループ化なしで表示します(このオプションが導入される前の挙動と同じです)。デフォルトのコンソール出力では、失敗した指摘をルールごとにグループ化し(severityごとに上位5ルールのみ表示、それぞれ代表1件の場所+「他N件」という件数表示)、Passedセクションは件数のみに集約し、`--by-route`はスコアが低い順に上位10ルートまでに制限します。

### `--no-animation`

Health スコア発表時のアニメーションと、解析中に表示されるマスコットを無効にします。どちらもインタラクティブな端末で色が有効な場合のみ再生されます(CI・パイプ/リダイレクトされた出力・AI エージェントのシェルでは再生されません)。このフラグは、それ以外の条件を満たす端末上で個別に無効化したいときにのみ必要です。マスコットの絵はさらに 20 カラム以上の幅を必要とし、それより狭い端末ではこのフラグを指定しなくてもマスコットだけが省略されます(スコアアニメーション自体はマスコットなしで引き続き再生されます)。解析中はプレーンなスピナーに、スコア発表はマスコットなしのアニメーションにフォールバックします。

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

CLI 自身のバージョンと、解決された `@svelte-vitals/core` のバージョンを表示して終了します（例：`0.20.0 (core 0.21.0)`）。`svelte-vitals` と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されており、異なる `@svelte-vitals/core` リリースに依存する状態になり得ます。CLI と[ライブダッシュボード](/svelte-vitals/ja/guides/dev-dashboard/#バージョンのずれ)で検出結果が食い違う場合は、この `core` バージョンをダッシュボードのトップバーに表示される値と比較してください。

## 終了コード

| コード | 意味                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| `0`    | 失敗する検出結果なし                                                                 |
| `1`    | クリティカルな検出結果が存在する、または `--fail-on` / `--min-health` の閾値に達した |
| `2`    | 実行エラー（SvelteKit プロジェクトでない / 内部エラー）                              |
