---
title: CI 連携
description: 生成された GitHub Actions ワークフローで、svelte-vitals の検出結果に基づいてプルリクエストをゲートします。
sidebar:
  order: 3
---

`svelte-vitals ci install` は、すべてのプルリクエストでファーストパーティの GitHub Action である **`@svelte-vitals/action`** を呼び出す GitHub Actions ワークフローを生成します。インラインアノテーション、ジョブサマリー、単一のスティッキー PR コメントまで揃い、YAML を手書きする必要はありません。

## クイックスタート

```bash
npx svelte-vitals@latest ci install
```

このコマンドは、パッケージマネージャーに合わせたインストールステップを含む `.github/workflows/svelte-vitals.yml` を書き出します（[インストールステップ](#インストールステップ)を参照）。コミットしてプルリクエストを開けば、実行される様子を確認できます。

Vite との連携や Cursor rules と一緒にセットアップするなら、[`svelte-vitals install`](/ja/guides/install#--client-ids) でも `ci-workflow` をターゲットとして選べます。`ci install` を別途実行しなくても、同じワークフローファイルを同じ実行の中で書き出せます。`ci upgrade`（後述）にはウィザード側の対応はなく、引き続き単体のコマンドです。

```bash
npx svelte-vitals@latest ci install --dry-run   # 書き込まずにプレビュー
npx svelte-vitals@latest ci install --force     # 既存のワークフローファイルを再生成
```

ファイルが既に存在する場合、`--force` を付けずに `ci install` を再実行しても何もしません（冪等なので、svelte-vitals をアップグレードした後に再実行しても安全です）。`--force` を付けると既存のファイルを現行のテンプレートで置き換えます。ファイルに加えた編集は失われます。

## 既存プロジェクトへの導入

既に検出結果の蓄積がある場合は、まずローカルで `svelte-vitals --update-suppressions` を実行してください。現在のすべての検出結果を受け入れる `svelte-vitals-suppressions.json` が書き出されます。これをコミットしてから任意のゲートを有効にすれば、以降に導入された検出結果だけで失敗します。詳細は [`--update-suppressions`](/ja/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions) を参照してください。

このファイルがあれば `@svelte-vitals/action` も自動で適用します。このワークフローは `diff`/`baseline` で既に PR 自身の変更分に絞られているため、抑制ファイルの効果は **PR の外**（ローカルの pre-commit フックなど）でもゲートできる点にあります。

## ワークフローの動作

`pull_request` イベントが発生するたびに、生成されるワークフローは以下を行います。

1. `fetch-depth: 0` でリポジトリをフル履歴でチェックアウトし、Action が `diff`/`baseline` のために PR のベース ref を解決できるようにします。
2. ライフサイクルスクリプトを無効にしてプロジェクトの依存関係をインストールします。これにより、Action はロックファイルが固定した版の `svelte-vitals` を見つけられます（[どの svelte-vitals が実行されるか](#どの-svelte-vitals-が実行されるか)を参照）。環境によってはこのステップがコメントアウトされた状態で書き出されるので、自分で仕上げてください。詳しくは[インストールステップ](#インストールステップ)を参照してください。
3. `@svelte-vitals/action` を呼び出します。この Action は svelte-vitals を PR にスコープを絞って実行します。`diff: origin/<base>` は PR が変更したファイルに検出結果を限定し、[`baseline: origin/<base>`](/ja/guides/cli) はさらに PR が**新たに導入した**検出結果だけに絞り込みます。変更したファイルに元からあった問題が PR をブロックすることはありません。
4. Action は3つの出力を生成します：
   - diff 上のインラインアノテーション。
   - ジョブサマリー。
   - スティッキー PR コメント。隠された `<!-- svelte-vitals-report -->` マーカーにより、以降のプッシュで新しいコメントを積み上げるのではなく同じコメントを更新します。
5. スキャンでゲート対象の検出結果が見つかった場合、サマリーとコメントを書き込んだ**後に**ジョブを失敗させます。そのため、失敗した実行でも PR コメントは必ず残ります。

## どの svelte-vitals が実行されるか

Action は `path` のディレクトリから親ディレクトリを順にワークスペースのルートまでたどって `node_modules/svelte-vitals` を探し、最初に見つかったものを使います。

- バージョン 0.44.0 以降がインストールされていれば、Action はそのインストールの CLI を実行します。CI はロックファイルにあるバージョンで解析し、検出結果、レポート、成否はローカルで `svelte-vitals` を実行した場合と一致します。スキャンは2回実行されます。1回目は `--reporter md` でジョブサマリーと PR コメントを作り、その終了コードでステップの成否が決まります。2回目は `--reporter github` でアノテーションを作ります。CLI が stderr に書いた行は warning アノテーションとして表示されます。アノテーション用の実行だけが失敗した場合はその旨の warning が出て、ステップの成否は1回目の実行に従います。
- インストールされた CLI がレポートを出せないとき（起動できない、設定が不正などのエラーで終了する、何も出力しない）は、ステップは CLI 自身のエラーで失敗します。Action が同梱のアナライザーに切り替えることはありません。
- 使えるインストールがなければ、Action は同梱のアナライザーで解析します。解析を始める前に、`svelte-vitals: using the bundled svelte-vitals <version>.` で始まるメッセージを1つ出します。`<version>` は同梱アナライザーのバージョンで、レポートに記載されるものと同じです。

| 状況                                                                                       | レベル  | 解消方法                                                                             |
| ------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------ |
| インストールされた `svelte-vitals` が 0.44.0 より古い                                      | Warning | プロジェクトの `svelte-vitals` を 0.44.0 以降に更新する                              |
| `path` の `package.json` に `svelte-vitals` が宣言されているが、インストールが見つからない | Warning | Action より前のステップで依存関係をインストールする                                  |
| `path` の `package.json` に `svelte-vitals` が宣言されておらず、インストールもされていない | Notice  | `svelte-vitals` を devDependency に追加し、Action より前に依存関係をインストールする |

Action は `node_modules/svelte-vitals` ディレクトリを必要とします。そのため Yarn の Plug'n'Play では、インストールした後でも同梱のアナライザーを使います。`.yarnrc.yml` で `nodeLinker: node-modules` を設定すると、インストールした CLI を Action が使えるようになります。

## インストールステップ

`ci install` は、実行したディレクトリにあるロックファイルからインストールステップを選びます。ロックファイルが複数ある場合の優先順は `pnpm-lock.yaml`、`yarn.lock`、Bun のロックファイル、`package-lock.json` です。

| プロジェクト                                                                                                     | インストールステップ                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                                                                              | `npm ci --ignore-scripts`                                                                                                                    |
| `pnpm-lock.yaml` があり、`package.json` の `packageManager` か `devEngines.packageManager` で pnpm 11 以降を宣言 | コミット SHA でピン留めした `pnpm/setup` と、その後の `pnpm install --frozen-lockfile --ignore-scripts`                                      |
| `pnpm-lock.yaml` があり、宣言された pnpm が 11 より古いか、pnpm のバージョンを宣言していない                     | コメントアウト：`pnpm install --frozen-lockfile --ignore-scripts`                                                                            |
| `yarn.lock`                                                                                                      | コメントアウト：Yarn 1 は `yarn install --frozen-lockfile --ignore-scripts`、それ以降の Yarn は `yarn install --immutable --mode=skip-build` |
| `bun.lock` または `bun.lockb`                                                                                    | コメントアウト：`bun install --frozen-lockfile --ignore-scripts`                                                                             |
| ロックファイルなし                                                                                               | コメントアウト：`npm ci --ignore-scripts`。ロックファイルをコミットし、`ci install --force` を再実行するとステップを生成できる               |

生成される `npm ci` ステップは、ランナーイメージに入っている Node.js と npm で実行されます。`engines` や `devEngines` がそのバージョンを受け付けないプロジェクトでは、その前に独自の Node のセットアップステップが必要です。

コメントアウトされるのは、`ci install` が初回の実行から動くステップを書けない場合です。この CLI は Yarn と Bun のセットアップステップをピン留めしていません。ピン留めした `pnpm/setup` は `package.json` で pnpm 11 以降が宣言されている必要があります。ロックファイルがなければパッケージマネージャーを判別できません。このとき `ci install` は `! Add an install step` で始まる行に理由を添えて出力します。その位置でパッケージマネージャーをセットアップし、インストールコマンドのコメントを外してください。それまでは、Action は同梱のアナライザーを使います。

そのディレクトリの `package.json` が `svelte-vitals` を宣言しておらず、ワークスペースのルートでもない場合（`workspaces` フィールドがなく、隣に `pnpm-workspace.yaml` もない場合）、`ci install` はパッケージマネージャーに合わせて追加用のコマンド（`pnpm add -D svelte-vitals` など）も出力します。ワークスペースのルートでは、アプリ自身の `package.json` で宣言してください。追加しないと、CI は自分で選んだバージョンで解析しません。Action が実行するのは、ほかのパッケージの peer dependency などとしてたまたまインストールされた `svelte-vitals` か、それもなければ同梱のアナライザーです。

ライフサイクルスクリプトは無効のままにします。解析には不要なうえ、有効にすると `pull-requests: write` を与えられたジョブで依存パッケージのコードが実行されるためです。

インストールステップが失敗すると、他のステップと同じくジョブも失敗し、Action は実行されません。たとえばロックファイルが `package.json` と食い違っている場合や、レジストリに到達できない場合です。プライベートレジストリを使う場合は、プロジェクトの `.npmrc` が読み取る認証情報を、リポジトリのシークレットから埋める `env:` としてインストールステップに渡してください。ライフサイクルスクリプトは無効で、ジョブ内でパッケージをインストールするステップは他にないため、認証情報が必要なのはインストールステップだけです。

ワークフローの Action ステップより前にインストールステップがない場合、Action は同梱のアナライザーで解析し、上記のメッセージを出します。チェックアウトと Action の間に[手書きする場合](#手書きする場合)のようにステップを追加するか、`ci install --force` でファイルを再生成してください（ファイルに加えた編集は失われます）。`ci upgrade` が変更するのは Action のピンだけで、インストールステップは追加しません。

## コメントの見た目

インストールする前に、`@svelte-vitals/action` が投稿するスティッキー PR コメントのプレビューを見ておきましょう。実際のコメントは次のようにレンダリングされます（検出結果の各行は実際のルール出力ですが、説明のためにここに寄せ集めたものです。太字の行は、実際の GitHub のコメント上では見出しとして表示されます）。

> **svelte-vitals — Health 78/100**
>
> | Category    | Score |
> | ----------- | ----- |
> | seo         | 65    |
> | performance | 90    |
>
> **1 critical · 1 warning · 1 info** (44 checks passed)
>
> **Findings**
>
> | Severity    | Rule                                                                                                        | Location                     | Message                                                                                                                          |
> | ----------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [seo/title-presence](https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence)                     | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [performance/image-dimensions](https://oekazuma.github.io/svelte-vitals/rules/performance/image-dimensions) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [performance/heavy-import](https://oekazuma.github.io/svelte-vitals/rules/performance/heavy-import)         | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

実際のコメントを見る前に知っておくとよい点：

- その場で更新されます。PR へのプッシュのたびに再スキャンし、隠しマーカーを使って同じコメントを編集します。新しいコメントが積み上がることはありません。
- Message 列に修正方法まで含まれます。各行は検出結果のメッセージと推奨対応を合わせたものなので、詳細を確認するために完全なレポートを開く必要はありません。
- ルール ID はそのルールのドキュメントへのリンクになっています。
- 問題がない PR にも短いコメントが付きます。検出結果テーブルの代わりに `✅ No issues found.` と表示されます。
- 同じ内容（テーブル部分を除く）はジョブの**ステップサマリー**にも表示され、元となった検出結果は diff 上に**インラインアノテーション**として直接表示されます。

## Action の入力

`ci install` は `@svelte-vitals/action` の呼び出しを、以下の入力とともに生成します。

| 入力           | 説明                                                                          | デフォルト            |
| -------------- | ----------------------------------------------------------------------------- | --------------------- |
| `path`         | 解析対象のプロジェクトディレクトリ                                            | `.`                   |
| `diff`         | この git ref（例: `origin/main`）と比較して変更されたファイルに検出結果を限定 | （未指定）            |
| `baseline`     | この git ref にまだ存在しない検出結果のみを報告                               | （未指定）            |
| `github-token` | スティッキー PR コメントの読み取り、投稿、更新に使うトークン                  | `${{ github.token }}` |

`reporter` という入力はありません。Action は常にアノテーション、ジョブサマリー、スティッキーコメントをまとめて生成します。この出力の振り分けは、個別に設定するものではありません。

上記の入力が設定のすべてでは**ありません**。インストールされたものでも同梱のものでも、実行される `svelte-vitals` はローカルの CLI 実行と同じようにプロジェクトを読むため、コミット済みの
[`svelte-vitals.config.*`](/ja/guides/configuration) と
[`svelte-vitals-suppressions.json`](/ja/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
を自動的に読み取ります。次のセクションを参照してください。

## ルートやルールを除外する

CI 導入時によくぶつかる壁があります。意図的に公開していないルート（認証必須のページや管理画面）が SEO ルールに大量に引っかかるのに、それを除外する Action の入力が見当たらない、というものです。除外の仕組みは、Action がすでに読み取っているファイル側にあります。そのため同じ設定が CLI、Vite プラグイン、この Action のすべてに同一に適用されます。意図に応じて選んでください。

- そのルールが一切不要なら、[`svelte-vitals.config.*`](/ja/guides/configuration) でグローバルに無効化します：

  ```js svelte-vitals.config.js
  export default {
    rules: { 'seo/json-ld': 'off' }
  };
  ```

- アプリの一部にだけルールやカテゴリが当てはまらないなら（認証必須ルートのケース）、[`overrides`](/ja/guides/configuration#ルールをルートやファイルにスコープする-overrides) でスコープします。これは恒久的なポリシーで、あとから glob 配下に追加したルートも除外されます。

  ```js svelte-vitals.config.js
  export default {
    // (app) ルートグループ配下では SEO チェックを行わない。
    overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]
  };
  ```

- 検出結果自体は正しいが、今すぐ全部は直せないなら、`svelte-vitals --update-suppressions` で現在の蓄積分を一括で受け入れてファイルをコミットします（上の [既存プロジェクトへの導入](#既存プロジェクトへの導入) を参照）。`overrides` と違いこちらはスナップショットで、同じ問題を持つ*新しい*ルートは再び失敗します。蓄積分の管理には、まさにそれが望ましい挙動です。

3つともコミットされるファイルです。ワークフローの入力は関与せず、変更は他の PR と同じようにレビューされます。

## 権限

生成されるワークフローは以下を要求します。

```yaml
permissions:
  contents: read
  pull-requests: write
```

PR コメントの投稿と更新には `pull-requests: write` が必要です。**フォークからの**プルリクエストでトリガーされたワークフローでは、ワークフローの宣言内容にかかわらず GitHub Actions がトークンの権限を降格します。そのため `@svelte-vitals/action` はフォーク PR を検出した場合、スティッキーコメントをスキップします（これでジョブが失敗することはありません）。その場合でも、インラインアノテーションとジョブサマリーは機能します。

## 手書きする場合

インストーラーを使いたくない場合、npm のプロジェクトに対して `ci install` が生成するのは正確には次の内容です。

```yaml
# Generated by svelte-vitals (`ci install` or `install --client ci-workflow`).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - run: npm ci --ignore-scripts
      - uses: oekazuma/svelte-vitals-action@<sha> # v<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

pnpm 11 以降を宣言している pnpm のプロジェクトでは、次の内容を生成します。

```yaml
# Generated by svelte-vitals (`ci install` or `install --client ci-workflow`).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/setup@fa36a5ef7dcdefc3a7cb25655c122e00cf6e636e # v3.1.2
        with:
          install: false
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - uses: oekazuma/svelte-vitals-action@<sha> # v<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

ほかのパッケージマネージャーでは、同じ位置（チェックアウトと Action の間）でそのパッケージマネージャーをセットアップし、ライフサイクルスクリプトを無効にして依存関係をインストールしてください。

`ci install` は `<sha>`/`<version>` に、実行している `svelte-vitals` CLI に同梱されたピンを埋め込みます。これは `svelte-vitals` の各リリース時点の [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) 最新リリースから解決されたものです。`ci install` 自体が GitHub に問い合わせることはありません。動作するピンを得る一番簡単な方法は(最新の同梱ピンを得るために `@latest` を付けて)インストーラーを実行することです。手書きする場合は、その[リポジトリ](https://github.com/oekazuma/svelte-vitals-action/releases)にある最新リリースタグのコミット SHA とバージョンを使ってください。

Action を経由せず svelte-vitals を直接実行したい場合の `--diff` や `--baseline` などの対応フラグについては[CLI リファレンス](/ja/guides/cli)を、Action のサマリーとコメントが基づいている出力フォーマットについては[レポーターガイド](/ja/guides/reporters)を参照してください。

## ピン留めされた Action の更新

`@svelte-vitals/action` はサプライチェーンの安全性のためにコミット SHA でピン留めされています。そのため、新しいリリースが出るたびにワークフロー内のピンは古くなります。ファイル全体を `ci install --force` で再生成する手もありますが、それではワークフローに加えたカスタマイズ（追加のトリガーやステップなど）が失われてしまいます。

`svelte-vitals ci upgrade` は、Action の `uses:` 行**だけ**を、実行中の CLI に同梱されたピンへ書き換えます。現在の `oekazuma/svelte-vitals-action@<sha>` 形式に加え、移行前の `oekazuma/svelte-vitals/packages/action@<sha>` 形式も認識します。他の `uses:` ピン、トリガー、追加ステップはそのまま残ります。

Action のリポジトリは素の `vX.Y.Z` タグを公開しているため、Renovate も追加設定なしでこの更新を提案します。

```bash
npx svelte-vitals@latest ci upgrade              # その場でピンを書き換える
npx svelte-vitals@latest ci upgrade --dry-run    # 書き込まずに変更前後をプレビュー
```

`ci upgrade` が書き込むピンは、ネットワークから取得するのではなく CLI のビルド時に埋め込まれた値です。最新のピンを得るには（上記のように）`@latest` を付けて実行してください。結果は次の3通りです。

- アップグレードされた場合：参照行が同梱ピンと一致していなかったため書き換えられます（SHA自体が古い場合に加え、SHAは最新でもコメントが最新でない場合――コメントが無い・無関係な内容・移行前の旧形式`# action-vX.Y.Z`/`# @svelte-vitals/action@X.Y.Z`のままの場合も含みます）。表示されるのは行のコメント（認識できるどの形式でも）から読み取った旧バージョンで、認識できるバージョンコメントが無ければ旧SHAの先頭7文字です。
- 既に同梱ピンと一致している場合：すべての参照が既に同梱ピンと一致し、かつ正規の`# vX.Y.Z`コメントも既に付いており、何も書き込まれません。比較する相手はこの CLI に同梱されたピンなので、Action にはより新しいリリースが存在することがあります。そのリリースは、以降の `svelte-vitals` のリリースで `ci upgrade` に反映されます。
- ワークフローが見つからない / action の参照が見つからない場合：どちらも終了コード `2` のエラーで終了します。ワークフローが見つからない場合のエラーは `ci install` を先に実行するよう促します。`ci upgrade` はワークフローをゼロから作成することはありません。

[oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) のリリースタグは素の `vX.Y.Z` 形式なので、Renovate 組み込みの github-actions マネージャーがそのまま解析できます。そのため Renovate など別のツールで直接ピンを更新している場合でも、`ci upgrade` と競合することはありません。どちらも同じ行を `uses: ... @<sha> # v<version>` という同じ形式のまま保つためです。
