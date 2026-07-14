# Plan 037: 設計スパイク — whole-project 解析の dev-server イベントループ専有を計測・検討する

> **Executor instructions**: This is a **measure-first design spike**, not a build
> plan. The original finding behind this plan is MED confidence — it identifies a
> plausible blocking pattern by reading the code, but nobody has measured actual
> blocking duration under realistic load. Your first and most important deliverable
> is a measurement; only design a worker-thread migration if the measurement shows
> a real problem. Do not implement `worker_threads` isolation speculatively. If
> anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/vite/src/ui/analysis.ts packages/cli/src/providers/source/parse.ts packages/cli/src/providers/source/routes.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: L(計測 + 設計。worker_threads 移行の本実装は対象外)
- **Risk**: MED(計測自体は無害だが、結論次第で L 工数の実装プランに繋がる可能性)
- **Depends on**: Plan 034(パースキャッシュが入っていると、計測対象の「保存の
  たびに何が起きるか」の実態が変わるため、Plan 034 の後に計測する方がより正確な
  「今後実際に困るケース」を測れる — 順序は必須ではないが推奨)
- **Category**: perf
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

Vite dev dashboard の whole-project 解析(`packages/vite/src/ui/analysis.ts` の
`runOnce`)は、`svelte/compiler` の同期パース(`packages/cli/src/providers/source/parse.ts`
が使う `parse` エクスポート)を、dev サーバーと同じ Node プロセス・同じイベント
ループ上で実行する。`packages/vite/src/ui/middleware.ts` は同じイベントループ上で
`/ingest`・`/events`(SSE)・`/data.json` を処理している。理論上、大規模プロジェクト
での保存時に、解析がイベントループを長時間占有し、HMR ping やダッシュボード自身の
SSE/`data.json` リクエストの応答が遅延する可能性がある。

ただし監査時点でこれは**未計測の推測**であり、実際にどの程度のプロジェクト規模で
どの程度のブロッキングが発生するのか(あるいは全く問題にならない程度なのか)は
分かっていない。`worker_threads` によるプロセス内分離は L 工数・MED リスク
(メッセージパッシングでの `Result[]`/エラー伝播、ワーカーのライフサイクル管理が
必要)の実装であり、実際に問題がある確証がないまま着手するのは過剰投資になりうる。
このプランはまず**測る**ことを最優先にする。

## Current state

- **同期パース** — `packages/cli/src/providers/source/parse.ts:1` 付近
  (`svelte/compiler` の同期 `parse` を使用 — 実装の詳細は Step 1 で再確認する)。
- **並列だが同期処理を含む解決** — `packages/cli/src/providers/source/routes.ts:196`
  (`Promise.all(pages.map((page) => resolveRoute(...)))` — 各 `resolveRoute` は
  `await` を挟むが、内部の `parse` 呼び出し自体は同期でイベントループをブロック
  する)。
- **dev dashboard の呼び出し元** — `packages/vite/src/ui/analysis.ts` の
  `runOnce`(既に全文読了済み)、`packages/vite/src/ui/middleware.ts` が同じ
  イベントループ上で `/ingest`・`/events`・`/data.json` を処理する
  (既にセキュリティ監査で読了済み、ファイル冒頭に loopback チェックあり)。
- **既存のテストインフラ** — `packages/cli/test/fixtures/` に既存の SvelteKit
  プロジェクトフィクスチャがあるが、「大規模プロジェクト」を模した規模のフィクス
  チャ(数百ルート)は存在しない可能性が高い(Step 1 で確認)。

## Commands you will need

| Purpose                     | Command                                          | Expected on success |
| ----------------------------- | --------------------------------------------------- | -------------------- |
| ベンチマーク用の一時プロジェクト生成 | (Step 2 で作成するスクリプト、`node scripts/...` 相当) | 実行完了 |
| 既存テスト                    | `pnpm --filter @svelte-vitals/vite test`          | all pass              |

## Scope

**In scope**:

- 計測: 大規模プロジェクト(合成フィクスチャ)に対する whole-project 解析1回の
  所要時間と、その間イベントループが実際にどの程度ブロックされるか(例: 解析実行中
  に定期的な `setImmediate`/`setInterval` の tick 遅延を測る、という古典的な
  イベントループ遅延測定手法)を測るベンチマークスクリプトの作成と実行。
- 計測結果に基づく設計ドキュメントの作成(`docs/superpowers/specs/`)。
- (計測が実際の問題を示した場合のみ)`worker_threads` 移行のごく簡単な技術検証
  (メッセージパッシングで `Result[]` を往復できるかの smoke test 程度)。

**Out of scope**:

- `worker_threads` を使った本実装(このプランで問題が実証された場合、別の実装
  プランとして改めて起票する)。
- Plan 034/036 が扱う「何を解析するか」の絞り込み最適化(本プランは「解析自体を
  どこで実行するか」という別の軸)。

## Git workflow

- Branch: `advisor/037-design-spike-dev-server-analysis-isolation`
- コミット: 計測スクリプト + 結果 + 設計ドキュメントをまとめて1つでよい
  (`docs: measure dev-dashboard analysis blocking and spike worker isolation`)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 既存フィクスチャの規模を確認する

`packages/cli/test/fixtures/` にある既存の SvelteKit プロジェクトフィクスチャの
ルート数を数える(`find <fixture> -name '+page.svelte' | wc -l` 相当)。既存の
最大フィクスチャが小規模(数ルート程度)であれば、Step 2 で合成フィクスチャを
新規生成する必要があることを確認する。

### Step 2: 大規模プロジェクトを合成するスクリプトを書く

一時ディレクトリに、N 個(例: 50, 200, 500 の3段階)のルート(`+page.svelte`)と
それぞれ現実的な量の `<head>` タグ・コンポーネントを持つ SvelteKit ライクな
プロジェクト構造を機械的に生成する小さなスクリプトを書く(`packages/vite/scripts/`
などの一時的な場所に置いてよい — 本番コードではないので `packages/vite/src/` には
置かない)。

### Step 3: イベントループのブロッキングを計測する

生成したプロジェクトそれぞれに対して、`packages/cli` の `analyzeProject`(または
`collectRoutes`)を直接呼び出しつつ、以下のいずれかの方法でイベントループの
ブロッキングを計測する:

- **古典的な手法**: 解析呼び出しの直前から一定間隔(例: 10ms)で `setInterval`
  の tick を記録しておき、解析中に tick 間隔が異常に開く(例: 100ms 以上)瞬間が
  あるか、あるとすれば合計でどれくらいの時間 loop が「詰まって」いたかを算出する。
- 代替として Node の `perf_hooks`(`monitorEventLoopDelay`)が使えるならそちらを
  使ってもよい。

各プロジェクト規模(50/200/500ルート)について、解析の総所要時間と、イベント
ループの最大遅延・累積遅延を記録する。

### Step 4: 結果を評価し、設計ドキュメントを書く

`docs/superpowers/specs/<today>-dev-server-analysis-isolation-design.md` を作成
し、以下を含める:

- Step 3 の計測結果(表: プロジェクト規模・解析所要時間・イベントループ最大遅延・
  累積遅延)。
- **判断**: 遅延が実用上無視できる範囲(具体的な閾値はメンテナーの感覚に委ねる
  必要があるが、目安として「HMR の典型的な応答時間(数十ms)に対して顕著に大きい
  遅延が繰り返し発生するか」を基準に評価する)であれば、**このプランはここで
  完了とし、`worker_threads` 移行は「見送り」として記録する**(元の finding が
  「未計測の匂い」であったことを踏まえ、実測の結果「問題なし」であれば、それ自体
  が価値ある成果 — 見送りの理由を明記して次回の再監査を防ぐ)。
- 遅延が無視できない規模で確認された場合のみ、`worker_threads` 移行の設計
  (メッセージ形式、`Result[]` のシリアライズ境界、ワーカーのライフサイクルと
  `runner.stop()` との連携、フォールバック(ワーカー起動失敗時はインライン実行))
  を記述し、Step 5 に進む。

### Step 5(条件付き・遅延が実証された場合のみ): 技術的成立性の最小検証

`worker_threads` でメッセージパッシングを使い、`analyzeProject` の呼び出しと
`Result[]` の返却が正しく行える最小限のプロトタイプを書き、動作を確認する
(本実装ではなく成立性の確認)。

## Test plan

このプランはスパイクであり、既存のテストスイートへの変更は必須ではない。Step 2 の
合成スクリプトと Step 3 の計測コードは使い捨てであり、テストは書かない
(その旨をコードコメントに明記する)。

## Done criteria

- [ ] 50/200/500 ルート規模での解析所要時間とイベントループ遅延が計測されている
- [ ] 計測結果に基づき「worker_threads 移行が必要か」の判断が設計ドキュメントに
      明記されている
- [ ] 判断が「見送り」の場合、その理由(閾値と実測値)が `plans/README.md` の
      「considered and rejected」相当のセクションに転記されている
- [ ] 判断が「移行を推奨」の場合、設計ドキュメントに移行方針と未決事項が明記され、
      別の実装プランとして起票する準備ができている
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- 合成プロジェクトの生成やイベントループ遅延の計測方法自体に技術的な障害
  (例: サンドボックス環境で `perf_hooks` が使えない、大規模ファイル生成が
  ディスク制約に引っかかる)がある場合、代替の計測手法を検討し、それでも測れ
  なければ「計測不能」として正直に報告する — 推測で結論を出さない。
- 計測結果が測定誤差の範囲内で判断がつかない(何度測っても閾値付近で揺れる)場合、
  無理に結論を出さず、その旨を報告してメンテナーの判断を仰ぐ。

## Maintenance notes

- このプランの合成フィクスチャ生成スクリプトは、将来 Plan 034/036 の効果測定
  (「変更していないファイルを読み直さない」「影響のないルートを解析しない」)
  にも再利用できる可能性がある — 使い捨てにせず `packages/vite/scripts/` や
  `docs/superpowers/` 配下に残しておくことを検討してもよい(必須ではない)。
- 「見送り」の判断をした場合でも、将来プロジェクト規模が今回計測した上限
  (500ルート)を大きく超えるユーザー報告があれば、この計測を再度行う価値がある。
