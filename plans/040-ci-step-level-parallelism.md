# Plan 040: CI の `check`/`docs` ジョブに GitHub Actions のステップ並列化を適用する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- .github/workflows/ci.yml`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。
> **この計画は Plan 027(dist キャッシュ)と同じファイルを扱う** — Plan 027 が
> まだ `main` にマージされていない場合、このプランは `main`(= Plan 027 適用前の
> 状態)を基準に書かれている。Plan 027 のブランチ(`advisor/027-ci-build-cache`)
> が既にマージ済みなら、drift check がその差分を検出するので、下記の「Current
> state」と実ファイルを突き合わせて不一致箇所(キャッシュ関連のステップが追加
> されている)を踏まえた上で、このプランの変更(ステップの並べ替え・`parallel:`
> 化)を該当箇所に適用すること — 矛盾するものではなく、Plan 027 のキャッシュ
> ステップの後ろに続けて `parallel:` 化すればよい。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(GitHub Actions のネイティブ機能を使うだけで、各ステップの
  実行内容自体は変えない。並列化グループ内の1ステップが失敗すれば、実装の
  仕様どおりグループ末尾の暗黙 `wait` でジョブ全体が失敗する — 現在の「1つでも
  ステップが失敗したらジョブ失敗」という挙動と同じ)
- **Depends on**: 027(同じファイルを扱うため、027 を先にマージしてからこの
  プランを適用することを推奨。027 未マージのまま両方を worktree で作業する場合、
  マージ時にコンフリクトが起きうる)
- **Category**: perf / dx
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

2026-06-25 に GitHub Actions が正式提供したステップレベル並列化機能
(`background`/`wait`/`wait-all`/`cancel`/`parallel` の4キーワード、
`jobs.<job_id>.steps[*].background` / `jobs.<job_id>.steps[*].parallel` の
公式ドキュメントで仕様確認済み)を使うと、**同一ジョブ・同一ランナー内**で
独立したステップを並列実行できる(ジョブを分ける job-level 並列とは異なり、
`actions/checkout`/`setup-node` のセットアップを共有できる)。

`check` ジョブの `pnpm build` 実行後、以下の3ステップは互いに独立している:

1. `Verify action dist is up to date`(`git diff --exit-code -- packages/action/dist`
   — ビルド済みの `packages/action/dist` を git の記録と比較するだけ)
2. `Typecheck`(`pnpm typecheck` = `pnpm -r typecheck`、各パッケージの
   `tsc --noEmit` — ビルド済みの他パッケージの型定義を読むだけで、他の2ステップ
   の結果には依存しない)
3. `Validate publishable packages`(`pnpm check:publish` = `publint` +
   `attw --pack`、ビルド済みの `dist/` を検査するだけ)

3つとも「ビルド後の成果物を読み取って検査するだけ」で、互いの出力に依存しない
ため、`parallel:` でまとめて同時実行できる。同様に `docs` ジョブの
`Check docs`(`astro check`)と `Build docs`(`astro build`)も、互いの出力に
依存せず同じソースを読むだけなので並列化できる。

**`test` ジョブの `pnpm test` はこのプランでは並列化しない**(理由は
Non-goals 参照)。

## Current state

`.github/workflows/ci.yml` の `check` ジョブ(全文、Plan 027 未適用の場合。
Plan 027 適用後は `Build packages` の前に cache ステップが追加されているはず
— 上記ヘッダーの drift check 指示を参照):

```yaml
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
      - name: Build packages
        run: pnpm build
      - name: Verify action dist is up to date
        run: git diff --exit-code -- packages/action/dist
      - name: Typecheck
        run: pnpm typecheck
      - name: Validate publishable packages
        run: pnpm check:publish
```

`docs` ジョブ(全文):

```yaml
  docs:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
      - name: Check docs
        run: pnpm --filter docs check
      - name: Build docs
        run: pnpm --filter docs build
```

- `root package.json` の `check:publish` は `check:publint && check:types`
  (2つの子コマンドを1つの npm script 内で直列実行 — このプランではこの内部を
  分割しない、`check:publish` を1ステップのまま `parallel:` グループに入れる)。
- `docs/package.json` の `check` = `astro check`(型チェック)、`build` =
  `astro build`(本番ビルド)。互いに独立(`grep -A6 '"scripts"' docs/package.json`
  で確認済み)。
- **並列化機能の正式仕様**(GitHub 公式ドキュメント、ユーザー提供の引用を
  正として採用):
  - `background: true` を `run`/`uses` ステップに付けると非同期実行になり、
    ジョブは次のステップにすぐ進む。同一ジョブ内で同時に実行できる
    background ステップは最大10個(超過分はキューイング)。
  - `wait: <step-id>` で指定した background ステップの完了を待つ。
    background ステップが失敗した場合、その `wait`/`wait-all` の時点でジョブが
    失敗する(`continue-on-error` が付いていない限り)。
  - `parallel:` はステップのグループをまとめて `background: true` にし、
    グループ末尾に暗黙の `wait` を置くシンタックスシュガー。個別の `id` は
    不要で、「このグループが全部終わってから先に進みたい」という単純なケースに
    使う。
  - コンポジットアクション内では `background`/`parallel` は使えない(このプラン
    が対象にするステップはどれも通常の `run` ステップであり、コンポジット
    アクションではないため問題ない)。

## Commands you will need

| Purpose                     | Command                                              | Expected on success |
| ---------------------------- | ----------------------------------------------------- | -------------------- |
| YAML 妥当性(ローカル簡易チェック) | `ruby -ryaml -e "YAML.load_file('.github/workflows/ci.yml'); puts 'YAML OK'"`(pyyaml がサンドボックスで導入不能な場合の代替 — Plan 027 の executor が使った方法) | `YAML OK` |
| 参考(ローカルで意味のある検証はここまで) | `pnpm build && pnpm typecheck && pnpm check:publish`(手元で3コマンドが個別に成功することの確認 — 並列実行そのものはローカルで再現できない) | 全て exit 0 |

このプランの変更は CI ワークフロー YAML のみで、GitHub Actions 上でしか
「本当に並列実行されているか」「壁時計時間が短縮したか」を確認できない。
ローカル環境(このサンドボックスを含む)では YAML の構文妥当性と、各ステップの
コマンド自体が独立して成功することしか検証できない。

## Scope

**In scope**(変更してよいファイル):

- `.github/workflows/ci.yml`

**Out of scope**:

- `test` ジョブの `pnpm test` ステップ(Non-goals 参照 — 並列化しない)。
- `lint` ジョブの `pnpm lint` ステップ(prettier + eslint が1つの npm script に
  まとまっており、分割するには `package.json` の `lint` スクリプト自体を分ける
  必要がある — このプランのスコープ外。将来必要になれば別プランで検討)。
- `.github/workflows/setup-node/action.yml`(コンポジットアクション — 上記の
  とおり `background`/`parallel` はコンポジットアクション内では使えないため、
  そもそも対象外)。
- `packages/*/tsup.config.ts`・`package.json` の各スクリプト定義自体。

## Non-goals

- **`test` ジョブを並列化しない**: `pnpm test` はパッケージごとに vitest を
  実行し(core 401・cli 563・vite・mcp・action)、それぞれが CPU を使う重い
  処理。GitHub 公式ドキュメントの `parallel`/`background` の説明は「独立した
  作業を同時に走らせる」ためのものだが、**同一ランナー上で複数の CPU 律速な
  処理を同時に走らせると、コア数の制約から実質的な高速化にならない、またはむしろ
  ランナーの CPU 競合で遅くなるリスクがある**(標準の `ubuntu-latest` ランナーの
  vCPU 数は限られている)。テストの並列化は既に `test` ジョブ自体の
  3-way node マトリクス(job-level 並列、別ランナー)で実現されており、
  同一ジョブ内でさらに5パッケージを `parallel:` にする追加の複雑さとリスクに
  見合う確証がない。実測で「めぼしい時間短縮効果があり、かつランナーの
  リソースが十分」という証拠が出るまでは見送る。
- **`lint` ジョブの分割**: prettier と eslint を分けて並列実行するには
  `package.json` の `lint` スクリプト定義を変更する必要があり(現状1つの
  npm script)、ローカル開発者が実行する `pnpm lint` の意味と CI の並列実行が
  乖離する複雑さを増やす割に、`lint` ジョブは既に `timeout-minutes: 5` と
  最も軽い部類 — 費用対効果が低いと判断し見送る。

## Git workflow

- Branch: `advisor/040-ci-step-level-parallelism`
- コミット: `ci: run independent post-build checks in parallel`(英語、
  1コミットでよい)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `check` ジョブの3ステップを `parallel:` でまとめる

`Build packages` ステップ(または Plan 027 適用後ならそのキャッシュ復元ステップ
群)の後、`Verify action dist is up to date`・`Typecheck`・
`Validate publishable packages` の3ステップを、`parallel:` の下に1つのステップ
としてまとめる:

```yaml
      - name: Build packages
        run: pnpm build
      - parallel:
          - name: Verify action dist is up to date
            run: git diff --exit-code -- packages/action/dist
          - name: Typecheck
            run: pnpm typecheck
          - name: Validate publishable packages
            run: pnpm check:publish
```

(Plan 027 が既にマージされている場合、`Build packages` の前に
`Restore/Cache package builds` ステップがあるはずだが、それらはこの
`parallel:` グループの対象外 — ビルド自体とそのキャッシュ処理は
`parallel:` グループの**前に**そのまま残す。)

**Verify**: YAML として妥当であること(上記コマンドで確認)。

### Step 2: `docs` ジョブの2ステップを `parallel:` でまとめる

```yaml
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
      - parallel:
          - name: Check docs
            run: pnpm --filter docs check
          - name: Build docs
            run: pnpm --filter docs build
```

**Verify**: YAML として妥当であること(同上)。

### Step 3: CI 上で実測して確認する

このプランの変更もワークフロー YAML のみで、ローカル実行では並列化の効果を
確認できない。ドラフト PR を開き、GitHub Actions の実行結果を見て確認する:

1. `check` ジョブのログで、`Verify action dist is up to date`・`Typecheck`・
   `Validate publishable packages` の3ステップが同時に開始されている(タイム
   スタンプがほぼ同一)ことを確認する。
2. いずれか1つのステップ(例えば意図的に typecheck エラーを混入させたテスト
   ブランチなどで)が失敗した場合、他の並列ステップも実行されたうえでジョブ
   全体が失敗することを確認する(部分的にしか実行されない、という誤動作が
   ないこと)。
3. `check`/`docs` ジョブそれぞれの壁時計時間(ジョブ開始から終了まで)が、
   このプラン適用前と比べて短縮していることを確認する(3つの逐次ステップの
   合計時間 → 最も遅い1つのステップの時間に近づくはず)。

**Verify**: 上記1〜3が GitHub Actions の実行ログで確認できること。
**このリポジトリの executor 環境では実際に GitHub Actions を走らせることが
できないため、この Step 3 は実行不能であることを NOTES に明記し、スキップして
よい**(Plan 027 の Step 3 と同じ扱い)— その他のステップ(YAML の妥当性)を
verify できれば STATUS: COMPLETE として報告してよい。

## Test plan

このプランは CI ワークフローの変更であり、vitest によるテストは追加しない。
検証は Step 3 の CI 実測が全てであり、それが唯一の「テスト」に相当する。

## Done criteria

- [ ] `.github/workflows/ci.yml` の YAML が妥当(パース可能)
- [ ] `check` ジョブの `Verify action dist is up to date`/`Typecheck`/
      `Validate publishable packages` が `parallel:` の下に1つのステップとして
      まとまっている
- [ ] `docs` ジョブの `Check docs`/`Build docs` が `parallel:` の下に1つの
      ステップとしてまとまっている
- [ ] `test` ジョブ・`lint` ジョブには変更がない(`git diff` で確認)
- [ ] ドラフト PR 上での実測で、並列実行と壁時計時間の短縮を確認済み
      (実行不能な場合はその旨を NOTES に明記)
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `parallel:`/`background` の構文が、このリポジトリの GitHub Actions
  ランナーが対応しているバージョン(GA から日が浅い機能のため、Enterprise
  ランナーや古いランナーイメージでは未対応の可能性がある)で認識されない
  ことが判明した場合、無理に強行せず STOP して報告する。
- Step 3 の実測で、並列化した3ステップのうちどれか1つが「他のステップの
  ファイルシステム状態を暗黙に前提にしていた」ことが判明し(例えば
  `check:publish` が `git diff` コマンドの副作用に依存していた、等)、
  並列実行で不正確な結果になる場合、`parallel:` 化を撤回して STOP し報告する。

## Maintenance notes

- 将来 `test` ジョブの並列化を検討する場合、まず実際のランナーの vCPU 数と
  現在の `pnpm test` の CPU 使用率プロファイルを計測してから判断すること
  (このプランの Non-goals で見送った理由の裏付けを取ってから着手する)。
- `lint` ジョブの分割も同様に、実測でめぼしい時間短縮が見込めることを確認
  してから検討する。
- GitHub Actions のこの機能は2026-06-25 に GA されたばかり(このプラン作成の
  約3週間前)— ランナーイメージやサードパーティの `act` のようなローカル実行
  ツールが追従していない可能性がある。ローカル CI エミュレーターを使っている
  場合、この構文で失敗する可能性を考慮すること。
