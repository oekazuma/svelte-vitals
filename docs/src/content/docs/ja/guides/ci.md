---
title: CI 連携
description: 生成された GitHub Actions ワークフローで、svelte-vitals の検出結果に基づいてプルリクエストをゲートします。
sidebar:
  order: 9
---

`svelte-vitals ci install` は、すべてのプルリクエストでファーストパーティの GitHub Action である **`@svelte-vitals/action`** を呼び出す GitHub Actions ワークフローを生成します。インラインアノテーション、ジョブサマリー、単一のスティッキー PR コメントまで揃い、YAML を手書きする必要はありません。

## クイックスタート

```bash
npx svelte-vitals@latest ci install
```

このコマンドは `.github/workflows/svelte-vitals.yml` を書き出します。コミットしてプルリクエストを開けば、実行される様子を確認できます。

MCP サーバーや Vite との連携、Agent Skills と一緒にセットアップするなら、[`svelte-vitals install`](/svelte-vitals/ja/guides/install/#--client-ids) でも `ci-workflow` をターゲットとして選べます。`ci install` を別途実行しなくても、同じワークフローファイルを同じ実行の中で書き出せます。`ci upgrade`（後述）にはウィザード側の対応はなく、引き続き単体のコマンドです。

```bash
npx svelte-vitals@latest ci install --dry-run   # 書き込まずにプレビュー
npx svelte-vitals@latest ci install --force     # 既存のワークフローファイルを再生成
```

ファイルが既に存在する場合、`--force` を付けずに `ci install` を再実行しても何もしません（冪等なので、svelte-vitals をアップグレードした後に再実行しても安全です）。以前のバージョンの svelte-vitals が生成したワークフローが既にある場合は、`--force` を付けて再実行すると現行の短いテンプレートに移行できます。

## 既存プロジェクトへの導入

リポジトリに既に検出結果の蓄積がある場合は、まずローカルで `svelte-vitals --update-suppressions` を実行してください。現在のすべての検出結果を受け入れる `svelte-vitals-suppressions.json` が一度で書き出されます。そのファイルをコミットしてから、好きなゲート（`--fail-on`、`--min-health`、pre-commit フック、あるいはこのワークフロー）を有効にすれば、以降はコミット後に導入された検出結果だけで失敗するようになり、蓄積分を事前に直す必要はありません。詳しくは CLI リファレンスの [`--update-suppressions`](/svelte-vitals/ja/guides/cli/#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions) を参照してください。リポジトリにこのファイルがあれば `@svelte-vitals/action` も自動的に適用するため、有効化のための追加の入力は不要です。後述の `diff`/`baseline` によるスコープ絞り込みだけでも、この _ワークフロー_ は PR 自体の変更分に限定されます。抑制ファイルがあれば、それに加えて PR の外（たとえばローカルの pre-commit フックでの `--fail-on`）でも、同じ蓄積の問題に悩まされずにゲートを有効にできます。

## ワークフローの動作

`pull_request` イベントが発生するたびに、生成されるワークフローは以下を行います：

1. `fetch-depth: 0` でリポジトリをフル履歴でチェックアウトし、Action が `diff`/`baseline` のために PR のベース ref を解決できるようにします。
2. `@svelte-vitals/action` を呼び出します。この Action は svelte-vitals を**インプロセスで**（`npx` なし、Node セットアップステップなし、出力ごとの個別スキャンなしで）PR にスコープを絞って実行します。`diff: origin/<base>` は PR が変更したファイルに検出結果を限定し、[`baseline: origin/<base>`](/svelte-vitals/ja/guides/cli/) はさらに PR が**新たに導入した**検出結果だけに絞り込みます。変更したファイルに元からあった問題が PR をブロックすることはありません。
3. この単一の解析結果から、Action は3つの出力をまとめて生成します：
   - diff 上のインラインアノテーション。
   - ジョブサマリー。
   - スティッキー PR コメント。隠された `<!-- svelte-vitals-report -->` マーカーにより、以降のプッシュで新しいコメントを積み上げるのではなく同じコメントを更新します。
4. スキャンでゲート対象の検出結果が見つかった場合、サマリーとコメントを書き込んだ**後に**ジョブを失敗させます。そのため、失敗した実行でも PR コメントは必ず残ります。

## コメントの見た目

インストールする前に、`@svelte-vitals/action` が投稿するスティッキー PR コメントのプレビューを見ておきましょう。実際のコメントは次のようにレンダリングされます（検出結果の各行は実際のルール出力ですが、説明のためにここに寄せ集めたものです。太字の行は、実際の GitHub のコメント上では見出しとして表示されます）：

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
> | Severity    | Rule                                                                                                           | Location                     | Message                                                                                                                          |
> | ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [seo/title-presence](https://oekazuma.github.io/svelte-vitals/ja/rules/seo/title-presence)                     | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [performance/image-dimensions](https://oekazuma.github.io/svelte-vitals/ja/rules/performance/image-dimensions) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [performance/heavy-import](https://oekazuma.github.io/svelte-vitals/ja/rules/performance/heavy-import)         | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

実際のコメントを見る前に知っておくとよい点：

- **その場で更新されます。** PR へのプッシュのたびに再スキャンし、隠しマーカーを使って同じコメントを編集します。新しいコメントが積み上がることはありません。
- **Message 列に修正方法まで含まれます。** 各行は検出結果のメッセージと推奨対応を合わせたものなので、詳細を確認するために完全なレポートを開く必要はありません。
- **ルール ID はそのルールのドキュメントへのリンクになっています。**
- **問題がない PR にも短いコメントが付きます。** 検出結果テーブルの代わりに `✅ No issues found.` と表示されます。
- 同じ内容（テーブル部分を除く）はジョブの**ステップサマリー**にも表示され、元となった検出結果は diff 上に**インラインアノテーション**として直接表示されます。

## Action の入力

`ci install` は `@svelte-vitals/action` の呼び出しを、以下の入力とともに生成します：

| 入力           | 説明                                                                          | デフォルト            |
| -------------- | ----------------------------------------------------------------------------- | --------------------- |
| `path`         | 解析対象のプロジェクトディレクトリ                                            | `.`                   |
| `diff`         | この git ref（例: `origin/main`）と比較して変更されたファイルに検出結果を限定 | （未指定）            |
| `baseline`     | この git ref にまだ存在しない検出結果のみを報告                               | （未指定）            |
| `github-token` | スティッキー PR コメントの読み取り、投稿、更新に使うトークン                  | `${{ github.token }}` |

`reporter` という入力はありません。Action は常にアノテーション、ジョブサマリー、スティッキーコメントを1回のパスでまとめて生成します。この出力の振り分けは、個別に設定するものではありません。

上記の入力が設定のすべてでは**ありません**。Action は CLI と同じ解析を実行するため、コミット済みの
[`svelte-vitals.config.*`](/svelte-vitals/ja/guides/configuration/) と
[`svelte-vitals-suppressions.json`](/svelte-vitals/ja/guides/cli/#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
を自動的に読み取ります。次のセクションを参照してください。

## ルートやルールを除外する

CI 導入時によくぶつかる壁があります。意図的に公開していないルート（認証必須のページや管理画面）が SEO ルールに大量に引っかかるのに、それを除外する Action の入力が見当たらない、というものです。除外の仕組みは、Action がすでに読み取っているファイル側にあります。そのため同じ設定が CLI、MCP サーバー、Vite プラグイン、この Action のすべてに同一に適用されます。意図に応じて選んでください：

- **そのルールが一切不要なら**、[`svelte-vitals.config.*`](/svelte-vitals/ja/guides/configuration/) でグローバルに無効化します：

  ```js
  // svelte-vitals.config.mjs
  export default {
    rules: { 'seo/json-ld': 'off' }
  };
  ```

- **アプリの一部にだけルールやカテゴリが当てはまらないなら**（認証必須ルートのケース）、[`overrides`](/svelte-vitals/ja/guides/configuration/#ルールをルートやファイルにスコープする-overrides) でスコープします。これは恒久的なポリシーで、あとから glob 配下に追加したルートも除外されます。

  ```js
  // svelte-vitals.config.mjs
  export default {
    // (app) ルートグループ配下では SEO チェックを行わない。
    overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]
  };
  ```

- **検出結果自体は正しいが、今すぐ全部は直せないなら**、`svelte-vitals --update-suppressions` で現在の蓄積分を一括で受け入れてファイルをコミットします（上の [既存プロジェクトへの導入](#既存プロジェクトへの導入) を参照）。`overrides` と違いこちらはスナップショットで、同じ問題を持つ*新しい*ルートは再び失敗します。蓄積分の管理には、まさにそれが望ましい挙動です。

3つともコミットされるファイルです。ワークフローの入力は関与せず、変更は他の PR と同じようにレビューされます。

## 権限

生成されるワークフローは以下を要求します：

```yaml
permissions:
  contents: read
  pull-requests: write
```

PR コメントの投稿と更新には `pull-requests: write` が必要です。**フォークからの**プルリクエストでトリガーされたワークフローでは、ワークフローの宣言内容にかかわらず GitHub Actions がトークンの権限を降格します。そのため `@svelte-vitals/action` はフォーク PR を検出した場合、スティッキーコメントをスキップします（これでジョブが失敗することはありません）。その場合でも、インラインアノテーションとジョブサマリーは機能します。

## 手書きする場合

インストーラーを使いたくない場合、`ci install` が生成するのは正確には次の内容です：

```yaml
# Generated by `svelte-vitals ci install`.
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
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          fetch-depth: 0
      - uses: oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

`ci install` は `<sha>`/`<version>` に、このリポジトリに実在する動作可能なコミット SHA を（`svelte-vitals` 自身のビルド時に解決して）自動的に埋め込みます。埋め込まれるのは `@svelte-vitals/action@<version>` のリリースタグが指すコミットそのものとは限りませんが、`packages/action/dist` の内容が該当バージョンと一致するコミットであることは保証されています。いずれにせよ、動作するピンを得る一番簡単な方法はインストーラーの実行です。手書きする場合は、[リポジトリ](https://github.com/oekazuma/svelte-vitals/releases)にある最新の `@svelte-vitals/action@<version>` リリースタグのコミット SHA とバージョンを使ってください。

Action を経由せず svelte-vitals を直接実行したい場合の `--diff` や `--baseline` などの対応フラグについては[CLI リファレンス](/svelte-vitals/ja/guides/cli/)を、Action のサマリーとコメントが基づいている出力フォーマットについては[レポーターガイド](/svelte-vitals/ja/guides/reporters/)を参照してください。

## ピン留めされた Action の更新

`@svelte-vitals/action` はサプライチェーンの安全性のためにコミット SHA でピン留めされています。そのため、新しいリリースが出るたびにワークフロー内のピンは古くなります。ファイル全体を `ci install --force` で再生成することもできますが、それではワークフローに加えたカスタマイズ（追加のトリガーやステップなど）が失われてしまいます。

`svelte-vitals ci upgrade` を使えば、必要な行だけをピンポイントで書き換えられます。既存のワークフロー内の `uses: oekazuma/svelte-vitals/packages/action@<sha>` の行**だけ**を、実行している CLI に同梱されたピンへ書き換え、それ以外の内容（`actions/checkout` など他の `uses:` ピン、独自のトリガー、追加ステップ）はそのまま残します。

```bash
npx svelte-vitals@latest ci upgrade              # その場でピンを書き換える
npx svelte-vitals@latest ci upgrade --dry-run    # 書き込まずに変更前後をプレビュー
```

`ci upgrade` が書き込むピンは、ネットワークから取得するのではなく CLI のビルド時に埋め込まれた値です。最新のピンを得るには（上記のように）`@latest` を付けて実行してください。結果は次の3通りです：

- **アップグレードされた場合**：参照行が同梱ピンと一致していなかったため書き換えられ、行のコメント（`# @svelte-vitals/action@X.Y.Z`）から読み取った旧バージョンが表示されます。
- **既に最新の場合**：すべての参照が既に同梱ピンと一致しており、何も書き込まれません。
- **ワークフローが見つからない / action の参照が見つからない場合**：`ci install` を先に実行するよう促すエラーで終了します。`ci upgrade` はワークフローをゼロから作成することはありません。

Renovate など別のツールで直接ピンを更新している場合でも、`ci upgrade` と競合することはありません。どちらも同じ行を `uses: ... @<sha> # @svelte-vitals/action@<version>` という同じ形式のまま保つためです。
