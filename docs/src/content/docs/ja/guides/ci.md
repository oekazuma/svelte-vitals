---
title: CI 連携
description: 生成された GitHub Actions ワークフローで、svelte-vitals の検出結果に基づいてプルリクエストをゲートします。
sidebar:
  order: 9
---

`svelte-vitals ci install` は、すべてのプルリクエストでファーストパーティの GitHub Action である
**`@svelte-vitals/action`** を呼び出す GitHub Actions ワークフローを生成します —
インラインアノテーション、ジョブサマリー、単一のスティッキー PR コメントまで、
YAML を手書きする必要はありません。

## クイックスタート

```bash
npx svelte-vitals@latest ci install
```

これにより `.github/workflows/svelte-vitals.yml` が書き出されます。コミットしてプルリクエスト
を開けば、実行される様子を確認できます。

```bash
npx svelte-vitals@latest ci install --dry-run   # 書き込まずにプレビュー
npx svelte-vitals@latest ci install --force     # 既存のワークフローファイルを再生成
```

`--force` を付けずに `ci install` を再実行しても、ファイルが既に存在する場合は何も行いません
（冪等 — svelte-vitals をアップグレードした後に再実行しても安全です）。以前のバージョンの
svelte-vitals が生成したワークフローが既にある場合は、`--force` で再実行すると現行の
短いテンプレートに移行できます。

## 既存プロジェクトへの導入

リポジトリに既に検出結果の蓄積がある場合は、まずローカルで `svelte-vitals --update-suppressions` を実行してください。現在のすべての検出結果を受け入れる `svelte-vitals-suppressions.json` が一度で書き出されます。そのファイルをコミットしてから、好きなゲート(`--fail-on`、`--min-health`、pre-commit フック、あるいはこのワークフロー)を有効にすれば、以降はそれ以後に導入された検出結果だけで失敗するようになり、蓄積分を事前に直す必要はありません。詳しくは CLI リファレンスの [`--update-suppressions`](/svelte-vitals/ja/guides/cli/#svelte-vitals-suppressionsjson---update-suppressions---no-suppressions) を参照してください。`@svelte-vitals/action` もこのファイルを自動的に適用します — 有効にするための追加の入力は不要です。リポジトリにファイルが存在すれば、以下で説明する `diff`/`baseline` によるスコープ絞り込みが、この _ワークフロー_ を既に PR 自体の変更分に限定しているのに加えて、抑制ファイルによって PR の外(たとえばローカルの pre-commit フックでの `--fail-on`)でも同じ蓄積問題なしにゲートを有効にできるようになります。

## ワークフローの動作

`pull_request` イベントが発生するたびに、生成されるワークフローは以下を行います：

1. `fetch-depth: 0` でリポジトリをフル履歴でチェックアウトし、Action が `diff`/`baseline` の
   ために PR のベース ref を解決できるようにします。
2. `@svelte-vitals/action` を呼び出します。この Action は svelte-vitals を**インプロセスで**
   （`npx` なし、Node セットアップステップなし、出力ごとの個別スキャンなしで）PR にスコープを
   絞って実行します：`diff: origin/<base>` は PR が変更したファイルに検出結果を限定し、
   [`baseline: origin/<base>`](/svelte-vitals/ja/guides/cli/) はさらに PR によって
   **新たに導入された**検出結果に絞り込みます — 変更されたファイル内の既存の問題は
   ブロックしません。
3. この単一の解析結果から、Action は3つの出力をまとめて生成します：
   - diff 上のインラインアノテーション。
   - ジョブサマリー。
   - スティッキー PR コメント — 隠された `<!-- svelte-vitals-report -->` マーカーにより、
     以降のプッシュで新しいコメントを積み上げるのではなく同じコメントを更新します。
4. スキャンでゲート対象の検出結果が見つかった場合、サマリー/コメントが既に書き込まれた
   **後に**ジョブを失敗させます — そのため、失敗した実行でも常に PR コメントを得られます。

## コメントの見た目

何もインストールする前に、`@svelte-vitals/action` が投稿するスティッキー PR コメントの
プレビューを示します — 実際に生成されるコメントはこのようにレンダリングされます
（以下の行は実際のルール出力を、説明のためにまとめたものです。太字の行は、実際の GitHub の
コメント上では見出しとして表示されます）：

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
> | Severity    | Rule                                                              | Location                     | Message                                                                                                                          |
> | ----------- | ----------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [SEO001](https://oekazuma.github.io/svelte-vitals/rules/seo001)   | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [PERF001](https://oekazuma.github.io/svelte-vitals/rules/perf001) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [PERF009](https://oekazuma.github.io/svelte-vitals/rules/perf009) | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

実際のコメントを見る前に知っておくとよい点：

- **その場で更新されます。** PR へのプッシュのたびに再スキャンし、隠しマーカーを使って
  同じコメントを編集します。新しいコメントが積み上がることはありません。
- **Message 列に修正方法まで含まれます。** 各行は検出結果のメッセージと推奨対応を
  合わせたものなので、詳細を確認するために完全なレポートを開く必要はありません。
- **ルール ID はそのルールのドキュメントへのリンクになっています。**
- **問題がない PR にも短いコメントが付きます** — 検出結果テーブルの代わりに
  `✅ No issues found.` と表示されます。
- 同じ内容（テーブル部分を除く）はジョブの**ステップサマリー**にも表示され、
  元となった検出結果は diff 上に**インラインアノテーション**として直接表示されます。

## Action の入力

`ci install` は `@svelte-vitals/action` の呼び出しを、以下の入力とともに生成します：

| 入力           | 説明                                                                          | デフォルト            |
| -------------- | ----------------------------------------------------------------------------- | --------------------- |
| `path`         | 解析対象のプロジェクトディレクトリ                                            | `.`                   |
| `diff`         | この git ref（例: `origin/main`）と比較して変更されたファイルに検出結果を限定 | (未指定)              |
| `baseline`     | この git ref にまだ存在しない検出結果のみを報告                               | (未指定)              |
| `github-token` | スティッキー PR コメントの読み取り・投稿・更新に使うトークン                  | `${{ github.token }}` |

`reporter` という入力はありません — Action は常にアノテーション・ジョブサマリー・
スティッキーコメントを1回のパスでまとめて生成します。この出力の振り分けは個別に
設定するものではなくなりました。

## 権限

生成されるワークフローは以下を要求します：

```yaml
permissions:
  contents: read
  pull-requests: write
```

PR コメントを投稿・更新するには `pull-requests: write` が必要です。**フォークからの**
プルリクエストによってトリガーされたワークフローでは、ワークフローの宣言内容にかかわらず
GitHub Actions がトークンの権限を降格するため、`@svelte-vitals/action` はフォーク PR を
検出してそこではスティッキーコメントをスキップします（これによってジョブが失敗することは
ありません）— その場合でもインラインアノテーションとジョブサマリーは機能します。

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

`ci install` は `<sha>`/`<version>` に、このリポジトリ内で実在する動作可能なコミット SHA を
(`svelte-vitals` 自身のビルド時に解決して)自動的に埋め込みます。ただしこれは必ずしも
`@svelte-vitals/action@<version>` のリリースタグが指す、まさにそのコミットとは限りません —
どのコミットであっても、その `packages/action/dist` は該当バージョンの内容と一致することが
保証されています。いずれにせよ、動作するピン留めを得る一番簡単な方法はインストーラーを
実行することです。手書きする場合は、
[リポジトリ](https://github.com/oekazuma/svelte-vitals/releases)にある最新の
`@svelte-vitals/action@<version>` リリースタグのコミット SHA とバージョンを使ってください。

Action を経由せず svelte-vitals を直接実行したい場合の `--diff`・`--baseline` などの
対応フラグについては[CLI リファレンス](/svelte-vitals/ja/guides/cli/)を、Action のサマリーと
コメントが基づいている出力フォーマットについては
[レポーターガイド](/svelte-vitals/ja/guides/reporters/)を参照してください。

## ピン留めされた Action の更新

`@svelte-vitals/action` はサプライチェーンの安全性のためコミット SHA でピン留めされているため、
新しいリリースが出るたびにワークフロー内のピンは古くなります。ファイル全体を
`ci install --force` で再生成することもできますが、それではワークフローに加えた
カスタマイズ(追加のトリガーやステップなど)が失われてしまいます。

`svelte-vitals ci upgrade` はより外科的な代替手段です — 既存のワークフロー内の
`uses: oekazuma/svelte-vitals/packages/action@<sha>` の行**だけ**を、実行している CLI に
同梱されたピンへ書き換えます。それ以外の内容(`actions/checkout` など他の `uses:` ピン、
独自のトリガー、追加ステップ)はそのまま残ります。

```bash
npx svelte-vitals@latest ci upgrade              # その場でピンを書き換える
npx svelte-vitals@latest ci upgrade --dry-run    # 書き込まずに変更前後をプレビュー
```

`ci upgrade` が書き込むピンはネットワーク経由の取得ではなく CLI のビルドに焼き込まれた値です
— 最新のピンを得るには(上記のように)`@latest` を付けて実行してください。想定される結果：

- **アップグレードされた場合** — 参照行が同梱ピンと一致していなかったため書き換えられ、
  行のコメント(`# @svelte-vitals/action@X.Y.Z`)から読み取った旧バージョンが表示されます。
- **既に最新の場合** — すべての参照が既に同梱ピンと一致しており、何も書き込まれません。
- **ワークフローが見つからない / action の参照が見つからない場合** — `ci install` を
  先に実行するよう促すエラーで終了します。`ci upgrade` はワークフローをゼロから
  作成することはありません。

Renovate など別のツールで直接ピンを更新している場合でも、`ci upgrade` と競合することは
ありません — どちらも同じ `uses: ... @<sha> # @svelte-vitals/action@<version>` という形式の
同じ行を保ちます。
