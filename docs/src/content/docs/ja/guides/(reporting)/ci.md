---
title: CI 連携
description: 生成された GitHub Actions ワークフローで、svelte-vitals の検出結果に基づいてプルリクエストをゲートします。
sidebar:
  order: 3
---

`svelte-vitals ci install` は、プロジェクトにインストールされた svelte-vitals をすべてのプルリクエストで実行する GitHub Actions ワークフローを生成します。1つのステップで diff 上のインラインアノテーション、ジョブサマリー、成否のチェックが揃い、YAML を手書きする必要はありません。

## クイックスタート

```bash
npx svelte-vitals@latest ci install
```

このコマンドは、Node.js のセットアップと、パッケージマネージャーに合わせたインストールステップを含む `.github/workflows/svelte-vitals.yml` を書き出します（[インストールステップ](#インストールステップ)を参照）。コミットしてプルリクエストを開けば、実行される様子を確認できます。

Vite との連携や Cursor rules と一緒にセットアップするなら、[`svelte-vitals install`](/ja/guides/install#--client-ids) でも `ci-workflow` をターゲットとして選べます。`ci install` を別途実行しなくても、同じワークフローファイルを同じ実行の中で書き出せます。

```bash
npx svelte-vitals@latest ci install --dry-run   # 書き込まずにプレビュー
npx svelte-vitals@latest ci install --force     # 既存のワークフローファイルを再生成
```

ファイルが既に存在する場合、`--force` を付けずに `ci install` を再実行しても何もしません（冪等なので、svelte-vitals をアップグレードした後に再実行しても安全です）。`--force` を付けると既存のファイルを現行のテンプレートで置き換えます。ファイルに加えた編集は失われます。既存のファイルが廃止された GitHub Action をまだ呼び出している場合は、`ci install` がその旨を表示します。[Action からの移行](#action-からの移行)を参照してください。

## 既存プロジェクトへの導入

既に検出結果の蓄積がある場合は、まずローカルで `svelte-vitals --update-suppressions` を実行してください。現在のすべての検出結果を受け入れる `svelte-vitals-suppressions.json` が書き出されます。これをコミットしてから任意のゲートを有効にすれば、以降に導入された検出結果だけで失敗します。詳細は [`--update-suppressions`](/ja/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions) を参照してください。

このファイルがあれば、CLI は手元と同じく CI でも自動で適用します。このワークフローは `--diff`/`--baseline` で既に PR 自身の変更分に絞られているため、抑制ファイルの効果は **PR の外**（ローカルの pre-commit フックなど）でもゲートできる点にあります。

## ワークフローの動作

`pull_request` イベントが発生するたびに、生成されるワークフローは以下を行います。

1. `fetch-depth: 0` でリポジトリをフル履歴でチェックアウトし、svelte-vitals が `--diff`/`--baseline` のために PR のベース ref を解決できるようにします。
2. Node.js をセットアップし、ライフサイクルスクリプトを無効にしてプロジェクトの依存関係をインストールします。環境によってはこれらの行がコメントアウトされた状態で書き出されるので、自分で仕上げてください。詳しくは[インストールステップ](#インストールステップ)を参照してください。
3. インストールされた CLI を、PR にスコープを絞って実行します。`--diff "origin/$BASE_REF"` は PR が変更したファイルに検出結果を限定し、[`--baseline "origin/$BASE_REF"`](/ja/guides/cli) はさらに PR が**新たに導入した**検出結果だけに絞り込みます。変更したファイルに元からあった問題が PR をブロックすることはありません。`BASE_REF` は `env:` を通して `github.base_ref` から設定されるため、シェルのコマンド内で `${{ }}` 式が展開されることはありません。
4. GitHub Actions 上の `--reporter github` は、この1回の実行で次のものを書き出します。
   - diff 上のインラインアノテーション。パスはリポジトリのルートからの相対パスなので、アプリがサブディレクトリにあっても正しいファイルに付きます。
   - ジョブサマリー。[`md` レポート](/ja/guides/reporters#md)をジョブのサマリーページに追記したものです。
   - 自身の警告（クラッシュしたルールや設定の警告など）の warning アノテーション。成功したジョブにも表示されます。
5. 検出結果がプロジェクトの `failOn` の閾値（[設定ファイル](/ja/guides/configuration)で指定しなければ `critical`）に達した場合、アノテーションとサマリーを書き出した**後に**ステップを失敗させます。設定が不正な場合など、解析できなかった実行は終了コード `2` でステップを失敗させます。

このワークフローは PR コメントを投稿しないため、書き込み権限は必要ありません（[権限](#権限)を参照）。

## ジョブサマリーの見た目

インストールする前に、ジョブサマリーのプレビューを見ておきましょう（検出結果の各行は実際のルール出力ですが、説明のためにここに寄せ集めたものです。太字の行は、実際のサマリーページでは見出しとして表示されます）。

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

実際のサマリーを見る前に知っておくとよい点：

- Message 列に修正方法まで含まれます。各行は検出結果のメッセージと推奨対応を合わせたものなので、詳細を確認するために完全なレポートを開く必要はありません。
- ルール ID はそのルールのドキュメントへのリンクになっています。
- 問題がない実行にも短いサマリーが付きます。検出結果テーブルの代わりに `✅ No issues found.` と表示されます。
- テーブルは 50 件で打ち切られ、残りの件数が末尾に表示されます。完全なレポートはローカルで svelte-vitals を実行して確認してください。

## インストールステップ

`ci install` は、実行したディレクトリにあるロックファイルからインストールステップを選びます。ロックファイルが複数ある場合の優先順は `pnpm-lock.yaml`、`yarn.lock`、Bun のロックファイル、`package-lock.json` です。

| プロジェクト                                                                                                     | インストールステップ                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                                                                              | コミット SHA でピン留めした `actions/setup-node`（`node-version: 24`）と、その後の `npm ci --ignore-scripts`                                 |
| `pnpm-lock.yaml` があり、`package.json` の `packageManager` か `devEngines.packageManager` で pnpm 11 以降を宣言 | コミット SHA でピン留めした `pnpm/setup`（`runtime: node`）と、その後の `pnpm install --frozen-lockfile --ignore-scripts`                    |
| `pnpm-lock.yaml` があり、宣言された pnpm が 11 より古いか、pnpm のバージョンを宣言していない                     | コメントアウト：`pnpm install --frozen-lockfile --ignore-scripts`                                                                            |
| `yarn.lock`                                                                                                      | コメントアウト：Yarn 1 は `yarn install --frozen-lockfile --ignore-scripts`、それ以降の Yarn は `yarn install --immutable --mode=skip-build` |
| `bun.lock` または `bun.lockb`                                                                                    | コメントアウト：`bun install --frozen-lockfile --ignore-scripts`                                                                             |
| ロックファイルなし                                                                                               | コメントアウト：`npm ci --ignore-scripts`。ロックファイルをコミットし、`ci install --force` を再実行するとステップを生成できる               |

svelte-vitals には Node.js 24.16.0 以降が必要です。そのため、ワークフローはランナーイメージに入っている Node.js に頼らず、自分で Node.js をセットアップします。`node-version: 24` は Node.js 24 系のリリースをセットアップします。`runtime: node` を指定した `pnpm/setup` は、`devEngines.runtime` が宣言するバージョンの Node.js を、宣言がなければその時点の LTS をインストールします。

pnpm のバージョンは、セットアップ Action と同じ方法で読み取ります。`name: "pnpm"` を持つ単一のオブジェクトとして `devEngines.packageManager` があればそれを使い、なければ `packageManager` を使います。配列形式の `devEngines.packageManager` は読み取りません。

コメントアウトされるのは、`ci install` が初回の実行から動くステップを書けない場合です。この CLI は Yarn と Bun のセットアップステップをピン留めしていません。ピン留めした `pnpm/setup` は `package.json` で pnpm 11 以降が宣言されている必要があります。ロックファイルがなければパッケージマネージャーを判別できません。このとき `ci install`（および `install --client ci-workflow`）は `! Add an install step` で始まる行に理由を添えて出力します。その位置で Node.js 24.16.0 以降とパッケージマネージャーをセットアップし、インストールコマンドのコメントを外してください。それまでは、実行する `./node_modules/.bin/svelte-vitals` がないため、svelte-vitals のステップは失敗します。

ステップが `npx svelte-vitals` ではなくこのパスを実行するのは、CI の `npx` が、インストールされていない場合に公開済みの最新リリースをダウンロードして実行するからです。それはロックファイルが固定したバージョンではありません。インストールがなければ、ステップはダウンロードせずに失敗します。このパスには `node_modules` ディレクトリが必要なので、Yarn の Plug'n'Play には対応していません。`.yarnrc.yml` で `nodeLinker: node-modules` を設定してください。

そのディレクトリの `package.json` が `svelte-vitals` を宣言しておらず、ワークスペースのルートでもない場合（`workspaces` フィールドがなく、隣に `pnpm-workspace.yaml` もない場合）、`ci install` はパッケージマネージャーに合わせて追加用のコマンド（`pnpm add -D svelte-vitals` など）も出力します。ワークスペースのルートでは別の案内を出力します。[モノレポ](#モノレポ)を参照してください。

`node_modules` にある `svelte-vitals` が 0.57.0 より古い場合、`ci install` はそのバージョンを示す案内を出力します。古い CLI でもステップは実行されますが、ジョブサマリーは書き出されず、アノテーションのパスもリポジトリのルートではなくアプリからの相対パスになります。devDependency を更新してください。

ライフサイクルスクリプトは無効のままにします。解析には不要なうえ、有効にするとプルリクエスト由来の依存パッケージのコードが実行されるためです。

インストールステップが失敗すると、他のステップと同じくジョブも失敗し、svelte-vitals は実行されません。たとえばロックファイルが `package.json` と食い違っている場合や、レジストリに到達できない場合です。プライベートレジストリを使う場合は、プロジェクトの `.npmrc` が読み取る認証情報を、リポジトリのシークレットから埋める `env:` としてインストールステップに渡してください。ライフサイクルスクリプトは無効で、ジョブ内でパッケージをインストールするステップは他にないため、認証情報が必要なのはインストールステップだけです。

## モノレポ

ワークフローファイルはリポジトリのルートに書き出され、その svelte-vitals のステップもルートで実行されます。ステップがどのアプリを解析するかは、ファイルの書き出し方で決まります。

- `svelte-vitals install --client ci-workflow --app apps/web` は、アプリのパスをステップに書き込みます。`vite-plugin`、`vite-hooks`、`config-file` のターゲットのためにアプリを解決した `install` の実行も同じです（[`--app`](/ja/guides/install#モノレポでの---app-app) を参照）。

  ```yaml
  - run: ./node_modules/.bin/svelte-vitals 'apps/web' --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
  ```

- `ci install` と、アプリを解決しなかった `install` の実行は、パスを書き込みません。svelte-vitals はローカルで実行したときと同じ方法でアプリを選びます。SvelteKit アプリが1つなら自動で解析し、複数あればその一覧を示してステップを終了コード `2` で失敗させます（[モノレポ](/ja/guides/cli#モノレポ)を参照）。1つを選ぶには、`./node_modules/.bin/svelte-vitals` の後ろにパスを追加してください。

svelte-vitals はアノテーションのパスをリポジトリのルートからの相対パスで書き出すため、どちらの場合もアノテーションは diff 上に付きます。

ステップはリポジトリのルートで `./node_modules/.bin/svelte-vitals` を実行します。ルートの `package.json` が `svelte-vitals` を宣言している場合や、npm のワークスペースのようにパッケージマネージャーがアプリのバイナリをルートの `node_modules/.bin` にリンクする場合は、そのまま動きます。pnpm のように、アプリだけで宣言した `svelte-vitals` のバイナリがアプリ側に残る場合は、ステップをアプリで実行してください。`working-directory:` を追加し、パスの引数を外します。

```yaml
- run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
  working-directory: apps/web
  env:
    BASE_REF: ${{ github.base_ref }}
```

`package.json` が `svelte-vitals` を宣言していないワークスペースのルート（`package.json` に `workspaces` フィールドがあるか、`pnpm-workspace.yaml` がある）では、`ci install` と `install --client ci-workflow` がこのことを案内します。

## ルートやルールを除外する

CI 導入時によくぶつかる壁があります。意図的に公開していないルート（認証必須のページや管理画面）が SEO ルールに大量に引っかかる、というものです。除外の仕組みは、svelte-vitals がどこで実行されても読み取るファイルの側にあります。そのため同じ設定がこのワークフロー、ローカルでの実行、Vite プラグインのすべてに同一に適用されます。意図に応じて選んでください。

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

3つともコミットされるファイルです。ワークフローを変更する必要はなく、変更は他の PR と同じようにレビューされます。

## 権限

生成されるワークフローは以下を要求します。

```yaml
permissions:
  contents: read
```

アノテーションとジョブサマリーは GitHub API ではなくステップ自身の出力から作られるため、ワークフローに必要なのは読み取り権限だけです。**フォークからの**プルリクエストでも、同じアノテーションとサマリーが得られます。`persist-credentials: false` はチェックアウト用のトークンをリポジトリの git 設定に残さないため、以降のステップがそのトークンを使うことはできません。

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

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
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
          runtime: node
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
```

ほかのパッケージマネージャーでは、同じ位置（チェックアウトと svelte-vitals のステップの間）で Node.js 24.16.0 以降とそのパッケージマネージャーをセットアップし、ライフサイクルスクリプトを無効にして依存関係をインストールしてください。

各 `uses:` はコミット SHA でピン留めされ、同じ行のコメントにバージョンが書かれています。`ci install` が書き込むのは実行している `svelte-vitals` CLI に同梱されたピンで、GitHub に問い合わせることはありません。最新のピンを得るには `@latest` を付けて実行してください。Renovate の github-actions マネージャーはこの形式を読み取り、更新を提案します。

`--diff`、`--baseline` などのフラグについては[CLI リファレンス](/ja/guides/cli)を、`github` と `md` のレポーターが出力する内容については[レポーターガイド](/ja/guides/reporters)を参照してください。

## Action からの移行

`oekazuma/svelte-vitals-action` をまだ呼び出しているワークフローは引き続き動きますが、この Action は廃止されています。次のコマンドで CLI のステップに置き換えてください。

```bash
npx svelte-vitals@latest ci install --force
```

`--force` はファイル全体を書き直すため、追加のトリガーやステップなど、ファイルに加えた編集は自分で移してください。Action の `path` 入力で指定していたアプリは、ステップのパスの引数か `working-directory:` になります（[モノレポ](#モノレポ)を参照）。新しいワークフローは PR コメントを投稿せず、`pull-requests: write` も要求しません。レポートはジョブサマリーに載ります。`--force` を付けない場合、`ci install` はファイルをそのままにして、廃止された Action をまだ呼び出している旨の行を出力します。

移行するまでは、プロジェクトの `svelte-vitals` をアップグレードしても Action の出力は変わりません。Action がプロジェクトの CLI を実行するとき、CLI は自前のジョブサマリーもリポジトリのルートからの相対パスも書き出さないため、出力が重複することはありません。また、`svelte-vitals: oekazuma/svelte-vitals-action is retired.` で始まり上記のコマンドを示す行を出力し、Action はそれを warning アノテーションとして表示します。この互換動作は svelte-vitals 1.0 まで続きます。
