---
title: レポーター
description: svelte-vitals が検出結果をフォーマットして出力する方法を選択します。
sidebar:
  order: 1
---

svelte-vitals は 7 つの出力レポーターをサポートしています。`--reporter <fmt>` で選ぶか、環境に応じた自動選択に任せてください。

## 利用可能なレポーター

### `console`（デフォルト）

ターミナル使用に適した、人間が読みやすいテキスト出力です。重大度ごとに検出結果をグループ化し、ルートパスとファイルの場所を含みます。

```bash
svelte-vitals --reporter console
```

### `json`

マシン可読な JSON 出力。スクリプトやダッシュボードでの利用、他のツールへの結果の受け渡しに便利です。

```bash
svelte-vitals --reporter json
```

#### 構造

```jsonc
{
  "version": "0.35.0", // このレポートを生成した svelte-vitals のバージョン
  "score": 97, // 総合 Health スコア（0〜100、切り捨て。100 は減点ゼロを意味する）
  "weights": { "seo": 1 }, // 実際に適用されたカテゴリ別の Health 重み
  "categories": {
    "seo": {
      "score": 94,
      "scoreModel": {
        "routeAverage": 94, // ルートごとのスコアの平均（切り捨て）
        "sitePenalty": 0, // サイト全体の検出（route を持たないもの）による減点
        "criticalCap": null // critical によってスコアが抑えられた場合はその上限値、なければ null
      }
    }
  },
  "summary": { "critical": 0, "warning": 33, "info": 44, "passed": 610, "dynamic": 2 },
  "rules": {
    // 実行されたすべてのルール。`findings: 0` のエントリは実行された上で何も検出しなかったことを示す。
    // このマップに現れないルールはトップレベルで無効化されている（`--ignore`、`--rules`、`--category`、
    // または設定ファイルの `rules: { id: 'off' }`）。`overrides` で無効化したルールは実行はされるため、
    // 引き続きここに現れる（詳しくは後述）。
    "architecture/unit-entry-file": { "findings": 0, "passed": 12 }
  },
  "routes": [
    {
      "route": "/about", // ルート ID。ファイル単位のルールではソースファイルのパス
      "score": 95, // このルートで実行されたチェックのうち、重大度で重み付けした上で合格した割合
      "issues": [
        {
          "id": "seo/single-h1", // ルール ID
          "category": "seo",
          "severity": "warning", // 設定した severity の上書きを反映した後の値
          "title": "Two <h1> elements", // 人が読む検出内容
          "detection": { "presence": "none", "value": "absent" },
          "location": "src/routes/about/+page.svelte",
          "line": 12,
          "recommendation": "Keep exactly one <h1> per page.",
          "docsUrl": "https://svelte-vitals.dev/rules/seo/single-h1",
          "fix": { "description": "…", "snippet": "…", "lang": "svelte" }
        }
      ]
    }
  ],
  "siteIssues": [] // route を持たない検出（robots.txt、sitemap.xml など）。issue の構造は同じ
}
```

次の2つのフィールド名は、取り違えても**エラーにならず静かに空振りする**ため、特に注意してください。

- ルールの識別子は **`id`** です（`rule` ではありません）
- 検出内容のテキストは **`title`** です（`message` ではありません）

`line`・`docsUrl`・`fix` はルールが提供した場合のみ、`location` はファイルに紐づく検出の場合のみ現れます。`issues` に並ぶのは**失敗した検出のみ**です。合格したチェックは `summary.passed` に数として計上されますが、一覧には出ません。失敗が1件も無いルートも `routes` には現れ、`issues` が空配列のまま自分のスコアを持ちます。

`rules` は、レポートの他の部分では答えられない問い、**そのルールがそもそも実行されたかどうか**に答えます。`issues` に載るのは失敗した検出結果だけなので、何も検出しなかったルールはそこに痕跡を残しません。トップレベルで無効化した（`--ignore`、`--rules`、`--category`、または設定ファイルの `rules: { id: 'off' }`）ルールも同じく現れません。判定には `rules` を見ます。存在すれば実行された、存在しなければトップレベルで除外された、という意味です。ただし一つだけ例外があり、それは次に述べます。

件数が表すのはツリーではなくレポートそのものです。baseline、抑制、`--diff` によるフィルタリングはレポートを組み立てる前に適用されるため、検出結果がすべて抑制されたルールも `findings: 0` のまま `rules` に残ります。`overrides` で無効化したルールも同様です。トップレベルとは異なり、`overrides` はルールが実行された後にその結果（合格分も含む）を取り除くため、`{ "findings": 0, "passed": 0 }` として現れ、選択されて何も検出しなかったルールと見分けがつきません。`rules` に存在することが保証するのは、`--ignore`・`--rules`・`--category`・設定ファイルのトップレベルの `rules` で除外されなかったことだけで、`overrides` が検出結果を何も残さなかったことまでは保証しません。

### `agent`

AI コーディングエージェント向けに設計された Markdown 修正ドキュメントです。失敗した各検出結果には以下が含まれます：

- ルートとソースファイルの場所
- スニペット付きの具体的なコード修正
- 受け入れチェック

`agent` レポーターは、既知の AI エージェント環境（例：Claude Code が `CLAUDECODE` を設定）が検出された場合に自動選択されます。明示的に指定せず自動選択された場合は、上書き方法を案内する 1 行のヒントが stderr に出力されます。

```bash
svelte-vitals --reporter agent
```

環境変数で自動選択を上書きするには：

```bash
SVELTE_VITALS_REPORTER=agent svelte-vitals
```

### `sarif`

[SARIF v2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) 形式。GitHub Code Scanning、Azure DevOps、その他 SARIF を使用する SAST ツールと互換性があります。

```bash
svelte-vitals --reporter sarif
```

### `github`

GitHub Actions の [ワークフローコマンド](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions) 形式。プルリクエストにインラインで表示される `::error` および `::warning` アノテーションを出力します。

`github` レポーターは `GITHUB_ACTIONS=true` が設定されている場合（GitHub Actions が自動的に設定）に自動選択されます。

```bash
svelte-vitals --reporter github
```

### `md`

コンパクトな Markdown サマリーです。Health スコア、カテゴリ別スコア表、重大度別件数、各ルールのドキュメントページへのリンク付き検出結果テーブルを含みます。GitHub Actions のジョブサマリーや PR コメント向けに設計されており、GitHub のコメントサイズ制限内に収まるよう検出結果の行数は 50 件に制限されます。このレポーターを自動的にワークフローへ組み込む `svelte-vitals ci install` については [CI 連携ガイド](/ja/guides/ci) を参照してください。

```bash
svelte-vitals --reporter md
```

## HTML レポート

`--reporter html` は自己完結の HTML レポートを出力します。**[ライブダッシュボード](/ja/guides/dev-dashboard)と同じ UI** で、レンダラーを共有しているため乖離しません。検索・並び替え可能なルート一覧、重大度とカテゴリのフィルター、ダークモード、検出結果ごとの [AI Prompt](/ja/guides/dev-dashboard#指摘ごとに修正プロンプトをコピーする) が使えます。

静的ファイルには背後に dev サーバーがないため、ライブ更新の仕組み（SSE、`measured` への精緻化）はありません。CSS と JS をインライン化しているためオフラインで動作し、CI 成果物としても扱いやすくなっています。

```bash
svelte-vitals --reporter html                 # svelte-vitals-report.html を出力
svelte-vitals --reporter html --out-file report.html
svelte-vitals --reporter html --out-file -     # ファイルではなく標準出力へ
```

デフォルトではカレントディレクトリに `svelte-vitals-report.html` を書き出し、パスを stderr に表示します。`--out-file <path>` で出力先を変更でき、`--out-file -` で標準出力にストリームします（パイプや CI 成果物向け）。

## 自動選択の優先順位

1. **明示的な `--reporter <fmt>`**：常に最優先。
2. **`SVELTE_VITALS_REPORTER` 環境変数**：自動検出を上書き。
3. **AI エージェント環境**（例：`CLAUDECODE` が設定されている）→ `agent`。
4. **GitHub Actions**（`GITHUB_ACTIONS=true`）→ `github`。
5. **デフォルト** → `console`。

## 例：CI パイプライン

```yaml
# .github/workflows/seo.yml
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on warning
  # GITHUB_ACTIONS はすでに設定済み；github レポーターが自動選択される
```
