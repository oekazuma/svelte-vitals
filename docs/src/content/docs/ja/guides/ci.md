---
title: CI 連携
description: 生成された GitHub Actions ワークフローで、svelte-vitals の検出結果に基づいてプルリクエストをゲートします。
sidebar:
  order: 9
---

`svelte-vitals ci install` は、すべてのプルリクエストをスキャンし、インラインアノテーションを
投稿し、ジョブサマリーを書き込み、結果を反映した単一のスティッキー PR コメントを維持する
GitHub Actions ワークフローを生成します — YAML を手書きする必要はありません。

## クイックスタート

```bash
npx svelte-vitals ci install
```

これにより `.github/workflows/svelte-vitals.yml` が書き出されます。コミットしてプルリクエスト
を開けば、実行される様子を確認できます。

```bash
npx svelte-vitals ci install --dry-run   # 書き込まずにプレビュー
npx svelte-vitals ci install --force     # 既存のワークフローファイルを再生成
```

`--force` を付けずに `ci install` を再実行しても、ファイルが既に存在する場合は何も行いません
（冪等 — svelte-vitals をアップグレードした後に再実行しても安全です）。

## ワークフローの動作

`pull_request` イベントが発生するたびに、このジョブは以下を行います：

1. `fetch-depth: 0` でリポジトリをフル履歴でチェックアウトし、`--diff`/`--baseline` が PR の
   ベース ref を解決できるようにします。
2. PR にスコープを絞って svelte-vitals を実行します：`--diff origin/<base>` は PR が変更した
   ファイルに検出結果を限定し、[`--baseline origin/<base>`](/svelte-vitals/ja/guides/cli/) は
   さらに PR によって**新たに導入された**検出結果に絞り込みます — 変更されたファイル内の
   既存の問題はブロックしません。
3. `--reporter github` の出力を発行し、GitHub がこれを diff 上のインラインアノテーションとして
   描画します。
4. `--reporter md` の出力をジョブサマリーとプルリクエストのコメントに発行します。このコメントは
   スティッキーです：隠された `<!-- svelte-vitals-report -->` マーカーにより、以降のプッシュで
   新しいコメントを積み上げるのではなく同じコメントを更新します。
5. スキャンステップでゲート対象の検出結果が見つかった場合、サマリー/コメントのステップが
   実行された**後に**ジョブを失敗させます（`exit 1`）— そのため、失敗した実行でも常に PR
   コメントを得られます。

## 権限

生成されるワークフローは以下を要求します：

```yaml
permissions:
  contents: read
  pull-requests: write
```

PR コメントを投稿・更新するには `pull-requests: write` が必要です。**フォークからの**
プルリクエストによってトリガーされたワークフローでは、ワークフローの宣言内容にかかわらず
GitHub Actions がトークンの権限を降格するため、フォーク PR ではコメントステップの投稿が
失敗することがあります — その場合でもインラインアノテーションとジョブサマリーは機能します。

## 手書きする場合

インストーラーを使いたくない場合、最小限の等価な構成は次の通りです：

```yaml
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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx svelte-vitals . --diff origin/${{ github.base_ref }} --baseline origin/${{ github.base_ref }} --fail-on-warning
```

出力フォーマットの一覧は[レポーターガイド](/svelte-vitals/ja/guides/reporters/)を、
`--diff`・`--baseline`・`--fail-on` については[CLI リファレンス](/svelte-vitals/ja/guides/cli/)
を参照してください。
