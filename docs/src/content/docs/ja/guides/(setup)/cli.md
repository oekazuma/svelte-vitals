---
title: CLI リファレンス
description: svelte-vitals のすべてのコマンドラインフラグの完全なリファレンス。
sidebar:
  order: 1
---

## 使用方法

```bash
svelte-vitals [path] [options]
svelte-vitals docs list
svelte-vitals docs show <name>
svelte-vitals explain <rule-id>
```

`path` は省略可能で、デフォルトはカレントディレクトリです。[`docs`](#docs) は CLI に同梱されたガイドを、[`explain`](#explain) はルール1件の根拠・修正方法・設定可能なオプションを表示します。どちらもプロジェクトの解析は行いません。

> サブコマンドもあります。[`install`](/ja/guides/install) は Vite との連携、Cursor rules、設定ファイルをセットアップし（[Agent Skills](/ja/guides/agent-skills) は別途 `npx skills add` でインストールします）、`ci install` は GitHub Actions の PR ゲートを生成します（詳しくは [CI 連携](/ja/guides/ci) を参照してください）。

以下のフラグは、毎回の実行で指定する代わりに、プロジェクトルートの `svelte-vitals.config` ファイルにまとめて一度だけ設定する方法もあります。詳しくは [設定ファイル](/ja/guides/configuration) を参照してください。フラグは常に設定ファイルより優先されます。

## モノレポ

明示的に `path` を渡した場合（またはアプリのディレクトリ自体で実行した場合）は常にそれが優先されます。svelte-vitals が指定されたターゲットを勝手に読み替えることはありません。

`path` を渡さず、かつカレントディレクトリが SvelteKit アプリでない場合、svelte-vitals はすぐに失敗する代わりに、近くの SvelteKit アプリ（`src/routes` があり、かつ `svelte.config.{js,ts}` または `@sveltejs/kit` を宣言した `package.json` のどちらかを持つディレクトリ。現在の `sv create` は SvelteKit の設定を `vite.config.ts` に畳み込み、`svelte.config` ファイルを生成しないため）を探します。

- **1 件だけ見つかった場合:** 自動的にそのアプリを解析します。stderr に通知が出ます（`detected SvelteKit app at apps/web; analyzing it.`）。
- **複数見つかった場合（対話的な TTY）:** どれを解析するか単一選択のプロンプトが表示されます。キャンセルすると、何も解析せずに終了コード `0` で終了します。
- **複数見つかった場合（非対話的: CI、エージェント、パイプ出力など）:** svelte-vitals はプロンプトを一切出さず、検出したアプリの一覧と、`npx svelte-vitals@latest apps/web` のように明示的にパスを渡すヒントとともに終了コード `2` で終了します。
- **見つからなかった場合:** 従来どおり「SvelteKit プロジェクトが見つからない」というエラーで終了コード `2` になります。

```bash
cd my-monorepo
npx svelte-vitals@latest              # apps/web と apps/admin を検出し、どちらか選択を促す(1件だけなら自動選択)
npx svelte-vitals@latest apps/web     # 検出をスキップし、apps/web を直接解析する
```

## フラグ

`svelte-vitals --help` が表示するすべてのフラグです。CLI 自身の引数宣言と ja リソースから生成されており、各行の詳しい使い方・デフォルト値・実行例は以下の各セクションを参照してください（フラグ名自体は CLI の実際の綴りのまま、英語です）。

<!-- cli-reference:start -->

| Flag                                    | Description                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--meta-components <meta-components>`   | 解析が追跡できない head メタデータ出力コンポーネント名（カンマ区切り）                                                           |
| `--treat-dynamic-as <treat-dynamic-as>` | pass \| warn \| fail（デフォルト: pass）                                                                                         |
| `--route <route>`                       | 指定した glob に一致するルートのみ解析                                                                                           |
| `--diff <diff>`                         | ref と比較して変更されたファイルの検出結果のみ報告（デフォルト HEAD。例: --diff main）                                           |
| `--staged`                              | コミット用にステージされたファイルの検出結果のみ報告（pre-commit ゲート）                                                        |
| `--baseline <baseline>`                 | ref の時点では存在しなかった検出結果のみ報告（例: origin/main と比較）                                                           |
| `--update-suppressions`                 | 現在のすべての検出結果を受け入れる svelte-vitals-suppressions.json を書き出す（既存プロジェクトへのゲート導入）                  |
| `--no-suppressions`                     | この実行に限り svelte-vitals-suppressions.json を無視                                                                            |
| `--by-route`                            | コンソール出力にルートごとのスコア内訳を表示                                                                                     |
| `--reporter <reporter>`                 | console \| json \| agent \| sarif \| github \| html \| md（自動選択: AI エージェント環境では agent、GitHub Actions では github） |
| `--out-file <out-file>`                 | --reporter html の出力先パス（デフォルト: svelte-vitals-report.html。'-' で標準出力）                                            |
| `--fail-on <fail-on>`                   | 指定した重大度以上の検出結果があれば失敗（終了コード 1）: critical \| warning \| info                                            |
| `--min-health <min-health>`             | 組み合わせた Health スコアがこの値を下回れば失敗（終了コード 1、0〜100）                                                         |
| `--rules <rules>`                       | 有効にするルール ID（カンマ区切り、他はすべて無効）                                                                              |
| `--config <config>`                     | 解析対象ディレクトリのものではなく、指定したパスの設定ファイルを使用（相対パスはコマンドを実行したカレントディレクトリ基準）     |
| `--ignore <ignore>`                     | 無効にするルール ID（カンマ区切り）                                                                                              |
| `--category <category>`                 | 解析対象カテゴリ（カンマ区切り）: seo \| performance \| correctness \| security \| architecture \| a11y                          |
| `--weights <weights>`                   | カテゴリごとの Health 重み上書き。例: seo=2,performance=1（指定のないカテゴリはデフォルト値 1）                                  |
| `--score`                               | 組み合わせた Health スコアのみを出力（--min-health と併用してゲートに利用可能）                                                  |
| `--no-color`                            | コンソール出力の ANSI カラーを無効化                                                                                             |
| `--no-animation`                        | インタラクティブ端末での Health スコア発表アニメーションとマスコットを無効化                                                     |
| `--verbose`                             | すべての検出結果を上限・グループ化なしで表示（デフォルトはルールごとにグループ化して上限あり）                                   |
| `-h, --help`                            | このヘルプを表示                                                                                                                 |
| `-v, --version`                         | バージョンを表示                                                                                                                 |

<!-- cli-reference:end -->

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

指定できる値：`console, json, agent, sarif, github, html, md` のいずれか

**自動選択：** 既知の AI エージェントハーネス（Claude Code、Cursor、Codex など）で実行された場合、または `SVELTE_VITALS_AGENT=1` が設定されている場合は `agent` レポーターを、GitHub Actions（`GITHUB_ACTIONS=true`）では `github` レポーターを自動的に選択します。認識対象は [gunshi](https://gunshi.dev) のエージェントプロファイルに委譲されており、gunshi の更新とともに拡張されます。`--reporter` を明示的に指定すれば、常に自動選択より優先されます。`SVELTE_VITALS_REPORTER` 環境変数でも上書きできます。

### `--out-file <path>`

`--reporter html` の出力先パスです（デフォルトは `svelte-vitals-report.html`、`-` を指定すると標準出力）。

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

スコアの計算方法については [Health スコア](/ja/guides/health-report) を参照してください。

### `--score`

組み合わせた Health スコア（整数）のみを stdout に出力し、他のレポーター出力をすべて抑制します。JSON をパースせずに数値だけを使いたいシェルプロンプトやスクリプトに便利です。

```bash
svelte-vitals --score
svelte-vitals --score --min-health 80   # スコアでゲートする。終了コードは通常どおり pass/fail を反映
```

`--score` を `--reporter` と組み合わせてもエラーにはなりませんが、レポーター出力は抑制され、stderr に警告が表示されます。終了コードは `--score` の影響を受けず、`--fail-on` と `--min-health` を通常どおり反映します。

### `--route <glob>`

指定した glob パターンに一致するルートのみを解析します。

```bash
svelte-vitals --route "/blog/**"
```

ルートスコープのルールはマッチしたルートに対して動きます。コンポーネントスコープのルール（Correctness、Security、Architecture、`seo/ssr-disabled`、およびコンポーネントスコープの Performance / Accessibility ルール）は、コンポーネントの検出には紐づけるルートが無いためスキップされます。プロジェクトスコープのルール（`seo/robots-txt`、`seo/html-lang` など）は引き続き動きます。`seo/duplicate-title` と `seo/duplicate-description` はマッチしたルート同士だけを比較します。どのルートにもマッチしない glob は警告として報告されます。

### `--diff [ref]`

`ref`（デフォルトは `HEAD`、つまり未コミットの変更）と比較して**変更された**ファイルにある検出結果のみを報告します。比較の基準は `ref` との**マージベース**で、追跡されていない（新規）ファイルも対象に含みます。そのため `--diff main` は「このブランチで変更した内容」を意味します。PR チェックとして最適です。

```bash
svelte-vitals --diff          # HEAD と比較した未コミットの変更
svelte-vitals --diff main     # main と比較してこのブランチが変更したすべて
```

### `--staged`

**コミット用にステージされた**ファイル（`git diff --cached`）にある検出結果のみを報告します。これからコミットしようとしている内容だけをチェックする pre-commit フックとして最適です。`--diff` よりも優先されます。

```bash
svelte-vitals --staged --fail-on warning
```

> どちらのフラグも、検出結果をそのソースファイルの場所でフィルタリングします。解析対象のプロジェクトが git リポジトリのサブディレクトリ（例：モノレポの `apps/web/`）にある場合でも正しく動作します。ディレクトリが git リポジトリでない場合、git 自体が利用できない場合、または `ref` が無効な場合、svelte-vitals は警告を表示し、代わりにプロジェクト全体を解析します。

### `--baseline <ref>`

`ref` と比較して**新規に**追加された検出結果のみを報告します。つまり、`ref` に対して同じ解析をしたときには存在しなかった検出結果です。ファイル単位でスコープする `--diff`/`--staged` とは異なり、`--baseline` は検出結果の同一性でスコープします。そのため、変更したファイルに元からあった問題でゲートが失敗することはなく、その変更が実際に**導入した**問題だけが対象になります。デフォルトの `ref` はなく、明示的な指定が必須です。

内部的には、svelte-vitals は `ref` を一時的な git worktree にチェックアウトして解析し、その検出結果（ルール ID + route + location で照合）を現在の実行結果から差し引きます。チェックアウトに失敗した場合（git リポジトリでない、git が利用できない、`ref` が無効）、svelte-vitals は警告を表示し、実行を失敗させる代わりにすべての検出結果を報告します。

```bash
svelte-vitals --baseline origin/main
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # 推奨する PR ゲート
```

> 検出結果は行番号を含めずに照合されるため、既に 1 件違反があるファイルの下の方に同じルールの 2 件目の違反を追加しても「新規」としては表示されません。

### `svelte-vitals-suppressions.json` / `--update-suppressions` / `--no-suppressions`

既存プロジェクトに svelte-vitals を導入する場合、たいてい検出結果が直しきれないほど蓄積しており、ゲートを有効にする前にすべては直せません。`--baseline <ref>` は **一時的な**ケース（PR とそのベースの比較）をカバーしますが、それとは別に **恒久的な**導入経路もあります。今日の検出結果を一度だけ記録して受け入れ、以降は新規のものだけをゲート対象にする、というものです。

```bash
svelte-vitals --update-suppressions   # svelte-vitals-suppressions.json を書き出し、現在のすべての検出結果を受け入れる
git add svelte-vitals-suppressions.json && git commit -m "chore: accept existing svelte-vitals findings"
svelte-vitals --fail-on warning       # 以降はこのコミット以後に導入された検出結果だけをゲート対象にする
```

`--update-suppressions` はプロジェクト全体を解析し（`--diff`/`--staged`/`--baseline` によるスコープ絞り込みは無視されます。このファイルは差分ではなくプロジェクト全体の状態を記録するためのものです）、現在スコアの減点対象になっているすべての検出結果を解析対象ディレクトリの `svelte-vitals-suppressions.json` に書き込みます（パスしている検出結果は書き込みません）。そして stderr にサマリーを表示し、レポートは出力せずに終了コード `0` で終了します。

ファイルが存在すると、以降の実行では**自動的に**（`--diff`/`--staged` と `--baseline` の後に）適用されます。ルール ID、route、location がエントリと一致する減点対象の検出結果を取り除き、抑制した件数を表示します。

```
svelte-vitals: 12 finding(s) suppressed by svelte-vitals-suppressions.json.
```

受け入れ済みの検出結果を修正すると、そのエントリは何にも一致しなくなり、**stale（未使用）**になります。svelte-vitals は stale の件数を stderr に表示して整理（プルーニング）を促しますが、stale があるだけで実行を失敗させることはありません。

```
svelte-vitals: 3 finding(s) suppressed by svelte-vitals-suppressions.json (1 stale entry — re-run --update-suppressions to prune).
```

**抑制エントリが対象にする範囲:** エントリが意味するのは「この route と location でこのルールが報告するものは何でも受け入れる」であって、「この 1 件のメッセージだけを受け入れる」ではありません。キーは `id` + `route` + `location` で、メッセージは意図的に含まれません。そのため、エントリを記録した時点の検出結果を修正しても、同じルールが同じ場所で別の検出結果を報告すれば、そのエントリは引き続き一致し、新しい検出結果も抑制してしまいます。しかも何かに一致し続けている限り stale にはカウントされません。エントリが stale になるのは、何にも一致しなくなったときだけです。実行が成功したからといってその特定の問題が解消したとは限らないので、`--update-suppressions` で意図的にプルーニングしてください。

`--no-suppressions` を使うと、その回の実行だけファイルを無視できます（例えばプロジェクトの本当の現状を確認したいとき）。壊れた `svelte-vitals-suppressions.json`（JSON として不正、`version` が一致しない、エントリに `id` がない、など）は黙って無視されるのではなく、致命的エラー（終了コード `2`）になります。タイプミスのあるファイルが CI のゲートを黙って無効化してしまうことを防ぐためです。

**`--baseline <ref>` との違い:** `--baseline` は実行のたびに git の ref を再解析して「何が既存か」を導出します。コミットは不要ですが、常に 1 つの ref としか比較できません。抑制ファイルは、一度作って（あるいは意図したときにだけ更新して）コミットする永続的な記録で、どの ref 上にいても適用され続けます。

> `--baseline` と同様、エントリは行番号なしで照合されます。受け入れ済みのルールの 2 件目の違反が同じファイルの下の方に追加されても「新規」としては表示されません。`@svelte-vitals/vite` はこのファイルを読みません。GitHub Action は CLI と同じエンジンを実行するため読み込みます。

### `--by-route`

コンソール出力にルートごとのスコア内訳を表示します。

### `--verbose`

すべての検出結果を、集約もグループ化もせずに表示します。デフォルトのコンソール出力は、失敗した検出結果をルールごとにグループ化し（severityごとに上位5ルールのみを、それぞれ代表1件の場所と「他N件」の件数付きで表示）、Passedセクションを件数のみに集約し、`--by-route`をスコアが低い順に上位10ルートまでに制限します。

### `--no-animation`

Health スコア発表時のアニメーションと、解析中に表示されるマスコットを無効にします。どちらも、色が有効なインタラクティブ端末でしか再生されません（CI、パイプやリダイレクトされた出力、AI エージェントのシェルでは再生されません）。このフラグが必要になるのは、本来なら再生される端末で個別に無効化したいときだけです。マスコットの絵にはさらに 20 カラム以上の幅が必要で、それより狭い端末ではこのフラグを指定しなくてもマスコットだけが省略されます（スコアアニメーション自体はマスコットなしで引き続き再生されます）。無効化した場合、解析中はプレーンなスピナーに、スコア発表はマスコットなしのアニメーションにフォールバックします。

### `--rules <ids>`

指定したルールのみを有効にし、他はすべて無効にします。ルール ID のカンマ区切りリストを受け付けます。

```bash
svelte-vitals --rules seo/title-presence,seo/description-presence
```

### `--ignore <ids>`

指定したルールを無効にします。ルール ID のカンマ区切りリストを受け付けます。

```bash
svelte-vitals --ignore performance/image-dimensions
```

### `--category <cats>`

指定したカテゴリのルールのみに解析を限定します。カンマ区切りのリストを受け付け、大文字小文字は区別しません: `seo`、`performance`、`correctness`、`security`、`architecture`、`a11y`。

```bash
svelte-vitals --category seo
svelte-vitals --category seo,performance
```

`--category` は `--rules`/`--ignore`/設定ファイルのルール選択と積集合になります。ルールは両方を通過した場合のみ実行されます。カテゴリを絞り込むと [Health スコア](/ja/guides/health-report) も絞り込まれます。組み合わせたスコアが、検出結果の存在するカテゴリだけの加重平均になるため、フィルタなしの実行結果とは直接比較できません。未知のカテゴリを指定するとエラーになります（終了コード `2`）。

### `--weights <pairs>`

組み合わせた [Health スコア](/ja/guides/health-report) のカテゴリごとの重みを上書きします。カンマ区切りの `category=number` ペアを受け付け、カテゴリ名の大文字小文字は区別しません。指定しなかったカテゴリはデフォルトの重み `1` になります。

```bash
svelte-vitals --weights seo=2,performance=1
```

未知のカテゴリ、または負の値や数値でない値を指定するとエラーになります（終了コード `2`）。

### 特定の指摘だけをインラインで抑制する

`--ignore` はプロジェクト全体でルールを無効にしますが、意図的な1箇所だけを黙らせたい場合は、対象行の直前に `svelte-vitals-disable-next-line` コメントを書きます。レポートがファイルと**行**を示すすべての検出に対応し、ルートレベルの検出も含まれます。ランドマークの重複、2つ目の `<h1>`、寸法のない画像、`vite.config.ts` の `minify: false` などです。抑制できないのは、直上に置くべき行を持たない検出です。ルートが設定しなかったものを報告する `<head>` メタデータ系のルールと、ファイル名やツリー内の位置を対象とするチェックがこれにあたります。

```svelte
<script>
  // プリレンダリングされたHTMLは常に非表示。canVibrate() はマウント後にのみ評価する必要があり、
  // そうしないとハイドレーション不一致が発生する。$derived だとハイドレーション中にも評価される。
  // svelte-vitals-disable-next-line correctness/effect-as-derived
  $effect(() => {
    mounted = true;
  });
</script>
```

マークアップ内では HTML コメントを使います。

```html
<!-- svelte-vitals-disable-next-line security/raw-html -->
<div>{@html trustedMarkup}</div>
```

ルール ID を省略すると次の行のすべてのルールを抑制します。複数指定する場合はカンマ区切りで書けます（`correctness/effect-as-derived, security/raw-html`）。

コンポーネント内のディレクティブは、**それを合成するすべてのルート**でその検出を抑制します。1 つのルートではなく 1 箇所のマークアップに注釈を付けているためです。ルート単位の抑制は `svelte-vitals-suppressions.json` と `overrides` の役割です。

どのルールも宣言していないルール ID を指定したディレクティブは、フル実行では警告として報告されます。そのままでは何も抑制せずに黙って無視されてしまうためです。`--route` を付けた実行では報告しません。選択範囲外のファイルも解析対象として読むため、それらについて報告すべきではないからで、stale な suppressions の通知と同じゲートです。一方、何も抑制しなかったディレクティブは報告**されません**。コードを直してコメントだけ残った・ルールが config で無効になっている・実行がスコープされている、のいずれも正当であり、既定で報告すると警告そのものが無視されるようになるからです。

ビルドモード（`@svelte-vitals/vite`）はプリレンダリングされた HTML を解析し、そこにはソース行がないため、ルートレベルの検出をインラインでは抑制できません。コンポーネントスコープの検出は引き続き抑制できます。

2つの制約があります。コメントはその行に単独で書かれている必要があり（同一行の末尾コメントは認識されません）、対象行の**直前**の行になければなりません（間に空行があると一致しません）。

### `--meta-components <names>`

`<head>` メタデータを出力するものの、解析が追跡できないコンポーネント名のカンマ区切りリストです。典型的には、組み込みアダプタのない npm パッケージから import したコンポーネントです。解析が解決できるリポジトリ内のコンポーネントは自動的に追跡されるため、それらを指定しても no-op です。指定が効くのは解決に失敗した場合だけです。

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

ヘルプテキストを表示して終了します。解決されたロケールが `ja` のときは日本語で表示されます。
詳しくは下の[ヘルプの言語](#ヘルプの言語)を参照してください。`--help` 以外の出力（エラー・警告・
各種レポーター）はロケールに関わらず常に英語のままです。

#### ヘルプの言語

`--help` の言語は環境変数から決まります（POSIX 方式で、最初に空でない値が採用されます）：
`SVELTE_VITALS_LANG` > `LC_ALL` > `LC_MESSAGES` > `LANG`。値が `ja`・`ja-JP`・`ja_JP.UTF-8` のいず
れかであれば日本語、それ以外（未設定を含む）は英語になります。`--lang` のようなフラグはありません。
端末の環境変数がすでにこれを表しているためです。

```bash
SVELTE_VITALS_LANG=ja svelte-vitals --help
LANG=ja_JP.UTF-8 svelte-vitals docs --help
```

### `-v, --version`

CLI 自身のバージョンと、解決された `@svelte-vitals/core` のバージョンを表示して終了します（例：`0.20.0 (core 0.21.0)`）。`svelte-vitals` と `@svelte-vitals/vite` はそれぞれ独立してバージョン管理されており、異なる `@svelte-vitals/core` リリースに依存する状態になり得ます。CLI と[ライブダッシュボード](/ja/guides/dev-dashboard#バージョンのずれ)で検出結果が食い違う場合は、この `core` バージョンをダッシュボードのトップバーに表示される値と比較してください。

## docs

```bash
svelte-vitals docs list [--json]
svelte-vitals docs show <name>
```

厳選したガイドを **CLI 自体に同梱**しています。読む内容が実行中のバージョンと常に一致し、ネットワークも不要です。`docs list` は各トピックを1行の説明付きで一覧表示し（`--json` で機械可読形式）、`docs show <name>` が本文を表示します。

```bash
npx svelte-vitals docs show scoping
```

収録しているのは、ツールを実行しているときに必要になることをターミナル向けに凝縮した内容です。現在のトピックは、どこかに書き写した一覧ではなく `docs list` で確認してください。完全なリファレンスは引き続きこのサイトで、同梱セットは意図的に小さく保っています。

これが最も効くのは AI エージェントです。そうでなければフラグを推測するか、別バージョンを説明しているかもしれないドキュメントページを取得することになります。`svelte-vitals --version` が stderr に `docs list` への案内を出しているのも同じ理由です。

未知のトピックを渡すと、有効な名前を列挙して終了コード `2` で終了します。

## explain

```bash
svelte-vitals explain --list [--json]
svelte-vitals explain <rule-id> [--json]
```

`--list` は全ルールをカテゴリごとにデフォルト重大度・タイトル付きで一覧表示します。エラーを発生させずにルール ID を知るための手段です。

ID を渡すと、解析せずにそのルールの静的なメタデータを表示します。タイトル、カテゴリ、デフォルトの重大度、根拠（rationale）、ドキュメントの URL、修正テンプレート、そしてオプションを持つルールであれば各オプションの名前・種類・デフォルト値・範囲に加えて、**設定した値が組み込みのデフォルトとどうマージされるか**まで出力します。最後の点は finding からは読み取れない情報です。`integer` のオプションはデフォルトを置き換え、`string-list` はデフォルトに追加され、`string-map` はデフォルトに上書き展開されるため、組み込みで既に存在するキーは重複ではなく値が上書きされます。

```bash
npx svelte-vitals explain performance/heavy-import
```

`--json` を付けると、同じ内容をテキストではなく JSON オブジェクトとして出力します。エージェントやスクリプトから構造的に読み取りたい場合に使います。

未知のルール ID を渡すと、既知の ID をすべて列挙して終了コード `2` で終了するため、綴り違いをすぐ修正できます。ルール ID は完全一致・大文字小文字を区別して照合されます。

## シェル補完

```bash
svelte-vitals complete <bash|zsh|fish|powershell>
```

指定したシェル向けの補完スクリプトを出力します。サブコマンド名（`docs`、`explain`、`install`、
`ci install`/`ci upgrade`）、それぞれのフラグ、そして列挙型のフラグ（`--reporter`、`--fail-on`、
`--category`、`--treat-dynamic-as`）の値まで補完します。パースと `--help` を駆動しているのと同じ
引数定義から生成されるため、補完は常に CLI と一致します。

**Bash**

```bash
mkdir -p ~/.local/share/bash-completion/completions
svelte-vitals complete bash > ~/.local/share/bash-completion/completions/svelte-vitals
source ~/.bashrc
```

**Zsh**

```bash
mkdir -p ~/.zsh/completions
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
svelte-vitals complete zsh > ~/.zsh/completions/_svelte-vitals
exec zsh
```

**Fish**

```bash
mkdir -p ~/.config/fish/completions
svelte-vitals complete fish > ~/.config/fish/completions/svelte-vitals.fish
```

**PowerShell**

```powershell
svelte-vitals complete powershell >> $PROFILE
. $PROFILE
```

各スクリプトは、生成された時点のインストール場所から `svelte-vitals` を再実行します。
`svelte-vitals` をアップグレードしたとき、あるいはパッケージを移動・再インストールしたときは、
スクリプトを再生成してください。

`complete` はサブコマンドなので、同名のディレクトリより優先されます。`complete` という名前の
ディレクトリを解析したい場合は `svelte-vitals ./complete` と書いてください。

## 対応する Svelte/SvelteKit バージョン

ルールは **Svelte 5+（runes）** と **SvelteKit 2+** を前提としています。解析対象プロジェクトの
`package.json` がそれより古い `svelte`/`@sveltejs/kit` バージョンを宣言している場合、stderr に
警告が表示されます。解析自体は通常どおり実行されますが、
[correctness/stale-prop-derivation](/ja/rules/correctness/stale-prop-derivation)や
[correctness/prop-mutation](/ja/rules/correctness/prop-mutation)のように runes
構文を手がかりにするルールは、同じバグの legacy 構文（`export let` / `$:`）版を認識できないため、
runes へまだ移行していないコンポーネントでは検出結果が揃わない場合があります。

## 終了コード

| コード | 意味                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| `0`    | 失敗する検出結果なし                                                                 |
| `1`    | クリティカルな検出結果が存在する、または `--fail-on` / `--min-health` の閾値に達した |
| `2`    | 実行エラー（SvelteKit プロジェクトでない / 内部エラー）                              |
