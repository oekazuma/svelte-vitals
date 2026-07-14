# Plan 027: CI の `pnpm build` 重複実行を dist キャッシュで排除する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- .github/workflows/ci.yml`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW(CI ワークフローの追加ステップのみ。キャッシュミス時は素のフルビルドにフォールバックするため、キャッシュが壊れても最悪ケースは「今と同じ」)
- **Depends on**: none
- **Category**: perf / dx
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`.github/workflows/ci.yml` は4つのジョブ(`lint`/`check`/`test`/`docs`)を実行するが、
`check` ジョブが `pnpm build`(`pnpm -r build`、5パッケージ全部)を実行したあと、
`test` ジョブの Node 3-way マトリクス(`22.13.0`/`24.16.0`/`26`)がそれぞれ独立に
**もう一度** `pnpm build` を実行している。つまり同一コミットに対して、テストを走らせる前
提としてのビルドが CI 実行1回あたり **計4回**(check 1 + test matrix 3)行われる。
`actions/setup-node` の `cache: pnpm` は pnpm store(ダウンロード済み依存)だけをキャッ
シュし、`tsup` のビルド出力(`packages/*/dist`)はキャッシュされない。

ビルド入力(各パッケージの `src/`)はテストを走らせる Node バージョンに依存しないので、
この重複は完全に無駄な計算であり、パッケージ数が増えるほど CI 時間に対して線形に効いてくる。
`packages/*/dist` を lockfile + ソースのハッシュでキャッシュし、`test` ジョブがそれを
再利用できるようにすれば、実質的なビルド回数を4回から1回に減らせる。

## Current state

- `.github/workflows/ci.yml` — `check` ジョブ:

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

- 同ファイル、`test` ジョブ(3-way node matrix):

```yaml
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      matrix:
        node-version: ['22.13.0', '24.16.0', '26']
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          persist-credentials: false
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
        with:
          node-version: ${{ matrix.node-version }}
      - name: Build packages
        run: pnpm build
      - name: Run tests
        run: pnpm test
```

- `.github/workflows/setup-node/action.yml` — `actions/setup-node@...` の `cache: 'pnpm'`
  は pnpm のダウンロード store のみをキャッシュする(38-42行目)。`packages/*/dist` を
  キャッシュする仕組みは現状どこにもない。
- 各パッケージの `build` スクリプトは全て `tsup`(`packages/cli` のみビルド前に
  `node scripts/gen-action-pin.mjs` を実行 — キャッシュキーに影響しないメタデータ生成
  なので無視してよい)。
- **重要な制約**: `check` ジョブには `Verify action dist is up to date`
  (`git diff --exit-code -- packages/action/dist`)というステップがある。`packages/action/dist`
  は Git にコミットされた成果物であり、`tsup` の再ビルド結果と一致している必要がある —
  つまり `check` ジョブの `pnpm build` の**出力そのもの**(特に `packages/action/dist`)は
  「ビルドキャッシュから復元した dist」であってもこの diff チェックと矛盾してはならない
  (ソースが変わっていなければ tsup の出力は決定的であるべきなので、通常は問題にならない
  はずだが、Step 2 でキャッシュキーにこのファイルの扱いを明記する)。

## Commands you will need

| Purpose                     | Command                                              | Expected on success |
| ---------------------------- | ----------------------------------------------------- | -------------------- |
| ワークフロー構文の妥当性(ローカルでの簡易チェック) | `cd .github/workflows && python3 -c "import yaml,sys; yaml.safe_load(open('ci.yml'))"` (or any YAML linter available) | エラーなし |
| ビルド確認(参考、CI相当) | `pnpm build`                                         | exit 0               |
| テスト確認(参考、CI相当) | `pnpm test`                                          | all pass             |

このプランは CI ワークフロー YAML のみを変更するため、ローカルで実行して検証できる
コマンドは限られる。**最終検証は実際に CI 上で行う**(PR を開いて Actions の実行結果を
見る)ことが前提 — Step 3 の Done criteria 参照。

## Scope

**In scope**(変更してよいファイル):

- `.github/workflows/ci.yml`

**Out of scope**(関連して見えても触らない):

- `.github/workflows/setup-node/action.yml` — pnpm store のキャッシュは引き続きこの
  action に任せる。dist キャッシュは `ci.yml` 側に追加のステップとして足す。
- `packages/*/tsup.config.ts` — ビルド設定自体は変更しない。
- `docs` ジョブ — `pnpm --filter docs build` は対象外(docs は他パッケージの dist に
  依存しないため、このプランのスコープに含めない)。

## Git workflow

- Branch: `advisor/027-ci-build-cache`
- コミット: `ci: cache package dist output across build/test jobs`(1コミットでよい)
- コミットメッセージは英語(既存 changelog/commit 規約に合わせる)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `check` ジョブに dist キャッシュの保存ステップを追加する

`check` ジョブの `Build packages` ステップの**前**に `actions/cache` ステップを追加し、
`packages/*/dist` をソース + lockfile のハッシュでキーにして保存/復元する。

```yaml
      - name: Cache package builds
        id: dist-cache
        uses: actions/cache@<pin-latest-major-actions/cache-with-sha> # vX.X.X
        with:
          path: packages/*/dist
          key: dist-${{ hashFiles('packages/*/src/**', 'pnpm-lock.yaml', 'packages/*/tsup.config.ts') }}
```

`actions/cache` はこのリポジトリで既出の action ではないため、`actions/checkout` や
`actions/setup-node` と同じ流儀(コメントでバージョンを明記した SHA ピン)で追加する
こと。SHA は `gh api repos/actions/cache/tags` などで最新の安定版タグを確認して解決す
る(推測でハードコードしない)。

`check` ジョブの `Build packages` ステップは変更しない(キャッシュがヒットしても、
`tsup` 自体は増分ビルドの判断をしないため、キャッシュから復元した dist がある状態で
`pnpm build` を実行してもソースが同じなら同じ出力になるはずだが、**確実性のため
`pnpm build` の実行自体は毎回そのまま行う**——このステップの目的は `test` ジョブが
`check` の成果物を再利用できるようにすることであり、`check` 自身の実行時間短縮は
狙わない。理由: `check` ジョブは `Verify action dist is up to date` の diff チェックと
`check:publish` の両方が生の再ビルド結果に依存しており、キャッシュ復元だけで済ませる
と "ビルドされていないのに気づかない" リスクが生まれるため)。

**Verify**: YAML として妥当であること(`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` がエラーなく終了)。

### Step 2: `test` ジョブがキャッシュを復元し、ヒット時は `pnpm build` をスキップする

`test` ジョブの `Build packages` ステップの前に同じキーで `actions/cache` の復元ステッ
プを追加し、キャッシュがヒットした場合は `Build packages` ステップを `if:` でスキップ
する。

```yaml
      - name: Restore package builds
        id: dist-cache
        uses: actions/cache@<same-pin-as-step-1>
        with:
          path: packages/*/dist
          key: dist-${{ hashFiles('packages/*/src/**', 'pnpm-lock.yaml', 'packages/*/tsup.config.ts') }}
      - name: Build packages
        if: steps.dist-cache.outputs.cache-hit != 'true'
        run: pnpm build
```

同じキー文字列を `check` と `test` の両方のステップで使うこと(コピペで揃える — キー
がずれると `test` 側が常にキャッシュミスして意味がなくなる)。`test` の3並列マトリクス
はそれぞれ独立した runner なので、`check` ジョブが先に走ってキャッシュを書き込んでいる
必要がある。GitHub Actions の同一ワークフロー内でジョブ間の暗黙の実行順は保証されない
ため、`test` ジョブに `needs: check` を追加して `check` の完了(≒ キャッシュ書き込み完
了)を待つようにする。**これは新しい依存関係の追加であり、`test` の開始が `check` の
完了を待つぶん、`lint`/`check`/`test` 全体の合計時間ではなく「開始から全ジョブ完了ま
での時間」が変わりうる — Step 3 で実測して確認すること。**

**Verify**: YAML として妥当であること(Step 1 と同じ確認コマンド)。

### Step 3: CI 上で実測して確認する

このプランの変更はワークフロー YAML のみで、ローカルの `pnpm build`/`pnpm test` 実行
では効果を確認できない。ドラフト PR を開き、GitHub Actions の実行結果を見て確認する:

1. 1回目の実行(キャッシュなし): `check` ジョブでキャッシュが `Cache saved` になること、
   `test` ジョブの3レッグとも `Build packages` ステップが実行されること(キャッシュ未
   ヒットなので通常通りビルドする)。
2. 同じコミットで re-run(または空コミットで再プッシュ): `check`/`test` とも
   `Cache restored` になり、`test` の3レッグで `Build packages` ステップが `skipped`
   と表示されること。
3. `check` ジョブの `Verify action dist is up to date` ステップが引き続き green である
   こと(キャッシュ経由でも `packages/action/dist` の内容が変わらないことの確認)。

**Verify**: 上記1〜3が GitHub Actions の実行ログで確認できること。

## Test plan

このプランは CI ワークフローの変更であり、vitest によるテストは追加しない。検証は
Step 3 の CI 実測が全てであり、それが唯一の「テスト」に相当する。

## Done criteria

- [ ] `.github/workflows/ci.yml` の YAML が妥当(パース可能)
- [ ] `check`/`test` 両ジョブが同一のキャッシュキーで `packages/*/dist` を保存/復元する
- [ ] `test` ジョブに `needs: check` が追加されている
- [ ] ドラフト PR 上での実測で、2回目の実行時に `test` の `Build packages` が3レッグと
      も skip されることを確認済み
- [ ] `check` ジョブの `Verify action dist is up to date` ステップが引き続き green
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `actions/cache` の最新安定版タグ/SHA が確認できない(ネットワークアクセスが使えない
  等)場合、推測でピンを埋めずに STOP して報告する。
- `test` に `needs: check` を追加した結果、CI の合計待ち時間(壁時計)が明らかに悪化す
  る(現状 `lint`/`check`/`test`/`docs` は並列実行されており、`test` が `check` を待つ
  ようになると `lint` 単体より早く終わっていたケースが遅くなる可能性がある)——実測して
  明らかな悪化が見えたら、`needs` を使わない代替案(例: `test` 側もキャッシュミス時は
  常にフルビルドする、`check` を待たない)を検討し、その判断を Maintenance notes に記
  録してから完了とする。
- `check` ジョブの `Verify action dist is up to date` がキャッシュ復元後に red になる
  (= キャッシュから復元した dist が実際のビルド結果と食い違う)場合、原因を調査せずに
  キャッシュ機構を無効化する変更で誤魔化さず、STOP して報告する。

## Maintenance notes

- 新しいパッケージが `packages/` に追加された場合、`packages/*/dist` の glob は自動的
  に含む(キー変更不要)。ただし新パッケージが `tsup` 以外のビルドツールを使う場合は
  キャッシュ対象パスを見直す必要がある。
- `docs` ジョブは今回のスコープ外だが、将来 docs ビルドが他パッケージの dist(型定義な
  ど)を必要とするようになった場合、同じキャッシュキーを再利用できる。
- レビュアーは「`needs: check` によって CI の合計待ち時間が悪化していないか」を実測ログ
  で確認すること — これがこのプランの主なリスクである。
