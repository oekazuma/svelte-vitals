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
      },
      "keys": 42, // このカテゴリが測定した対象（ルートなど）の数
      "affectedKeys": 6 // そのうち何らかの検出があった数
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
      "score": 95, // このルートが属するカテゴリ/スコープのルール一覧（重大度で重み付け）のうち、無傷で残った割合
      "categories": { "seo": 94 }, // このルートで結果が出たカテゴリごとのスコア。そのカテゴリ自身の一覧に対する割合
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
  "siteIssues": [], // route を持たない検出（robots.txt、sitemap.xml など）。issue の構造は同じ
  "inventories": {
    "seo::route": 110 // "seo" と "route" の組み合わせで測定されるキーそれぞれの、下限値適用後の重大度ウェイト合計
  },
  "examined": {
    "architecture/reserved-name-placement": {
      "capitalisedUnitPlacements.parts → src/**": 28 // この宣言が判定した場所の数（許可・却下を問わない）
    }
  }
}
```

あるキーに対するカテゴリのスコアは、そのカテゴリが持つ重大度ウェイトのうち生き残った割合です。チェックはカテゴリとスコープの組——`inventories` のキーである `seo::route` のような単位——でグループ化されており、同じ組の中でなら `warning` は `info` の5倍、`critical` は15倍のコストがかかるので、重大度の高い検出は必ずより大きなコストになります。ところが組をまたぐとこの順序は成り立ちません。チェック対象が極端に少ない組は下限値25を分母にスコアが計算されるため、そこでは1件あたりの負担が相対的に大きくなり、小さな組の `warning` が大きな組の `critical` より高くつくことがあります。同じルールが同じキーで何度検出されても、コストは1件分のままです。スコアの隣にある `affectedKeys` は、このカテゴリがプロジェクトのどれだけに触れたかを示します——スコアが深さなら、こちらは到達範囲です。

この段落が伝えていないことがもう四つあります。

- **下限値が効いた組は「測った結果」ではなくクランプされた値です。** 9つの組のうち5つは持っているチェックが25点未満なので、`inventories` はそのすべてに 25 を報告します。ルールが1本の組と8本の組が、そこでは同じ値に見えます。この数字はスコアが実際に使った分母であって、何本のチェックが走ったかではありません。実際に報告したチェックは `rules` で確認してください。
- **`keys` はカテゴリごとの数で、プロジェクト全体の数ではありません。** あるカテゴリの `keys` は、そのカテゴリが触れたキーの数です。したがって同じ実行でもカテゴリによって分母が異なり、`seo` が13キー、`architecture` が334キーということが起こります。

- キーごとのスコアは**同一カテゴリ内でのみ**比較可能です。カテゴリをまたいだ数値が示すのは、どちらの問題がより深刻かではなく、どちらのカテゴリで自身のチェックがより多く失敗しているかです。
- `inventories` は一つの組に属するすべてのキーの分母を示すので、ルートごとのカテゴリスコア（`routes[].categories`）はそこから手計算で検算できます。これが成り立つのは、キーがルート ID かソースファイルパスのどちらか一方であり、この二つの空間が重ならないため、あるキーの1カテゴリ内の結果が必ず単一のスコープに属するからです。ルート自身の `score` はそうはいきません。複数の組にまたがるルートでは、触れたすべての組の生の重みを合計してから一度だけ下限値を適用するのに対し、`inventories` は各組を個別に下限値適用済みで公開しているため、両者は食い違うことがあります。

次の2つのフィールド名は、取り違えても**エラーにならず静かに空振りする**ため、特に注意してください。

- ルールの識別子は **`id`** です（`rule` ではありません）
- 検出内容のテキストは **`title`** です（`message` ではありません）

`line`・`docsUrl`・`fix` はルールが提供した場合のみ、`location` はファイルに紐づく検出の場合のみ現れます。`issues` に並ぶのは**失敗した検出のみ**です。合格したチェックは `summary.passed` に数として計上されますが、一覧には出ません。失敗が1件も無いルートも `routes` には現れ、`issues` が空配列のまま自分のスコアを持ちます。

`categories` にはそのルートで実際に結果が出たカテゴリだけが並びます。あるカテゴリが無いのは「ここでは測定していない」という意味であり、「ここは満点だった」という意味ではありません。この値がルート自身の `score` の平均になっているとは、どちらの向きにも**保証されません**。`score` はそのルートが測定対象とした全体に対する一つの割合であるのに対し、各カテゴリのスコアはそのカテゴリ自身の一覧に対する割合だからです。ルート上のすべてのカテゴリが同じ割合を示すとき（検出結果が無いルートも含む）は両者が一致し、それ以外では数ポイントずれることがあります。

`rules` は、レポートの他の部分では答えられない問い、**そのルールがそもそも実行されたかどうか**に答えます。`issues` に載るのは失敗した検出結果だけなので、何も検出しなかったルールはそこに痕跡を残しません。トップレベルで無効化した（`--ignore`、`--rules`、`--category`、または設定ファイルの `rules: { id: 'off' }`）ルールも同じく現れません。判定には `rules` を見ます。存在すれば実行された、存在しなければトップレベルで除外された、という意味です。ただし一つだけ例外があり、それは次に述べます。

`rules` の件数が表すのはツリーではなくレポートそのものです。baseline、抑制、`--diff` によるフィルタリングはレポートを組み立てる前に適用されるため、検出結果がすべて抑制されたルールも `findings: 0` のまま `rules` に残ります。`overrides` で無効化したルールも同様です。トップレベルとは異なり、`overrides` はルールが実行された後にその結果（合格分も含む）を取り除くため、`{ "findings": 0, "passed": 0 }` として現れ、選択されて何も検出しなかったルールと見分けがつきません。`rules` に存在することが保証するのは、`--ignore`・`--rules`・`--category`・設定ファイルのトップレベルの `rules` で除外されなかったことだけで、`overrides` が検出結果を何も残さなかったことまでは保証しません。

`examined` は別の、トップレベルの独立したマップです —— ルール ID、その下に宣言のラベル、その下にその宣言が判定した場所の数（許可したか却下したかを問わない）が入ります。`--diff`・`--baseline`・抑制によって絞り込まれることはありません。これらは `rules` に適用されるものであり、`examined` はレポートではなく分析そのものを表すため、`rules` の中ではなく隣に置かれています。何も数えなかったルールにはエントリがなく、実際に現れるエントリは、そのルール自身の診断が使うのと同一の宣言ラベルを使います —— `architecture/reserved-name-placement` の集約された finding と `examined` のエントリは `capitalisedUnitPlacements.parts → src/**` という文字列を共有しており、両者を並べて読むことができます。0 でない件数は、その宣言が少なくとも一度は検査されたことを示します —— 検出結果が無いルールだけでは答えられない問いです。

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
