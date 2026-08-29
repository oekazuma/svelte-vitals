# Plan 056: `guardArgs` の last-wins 判定を全ブール値トークンに広げる(`--flag=true --flag=false` がフラグを OFF にしない)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 690dd5e4..HEAD -- packages/cli/src/gunshi/guard.ts packages/cli/test/gunshi-analyze.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P1       | S      | LOW  | none       | bug      | commit `690dd5e4`, 2026-08-28 |

## Why this matters

CLI のブールフラグは「最後の出現が勝つ」規約(`--flag=false` で OFF)を掲げているが、`guardArgs` の実装は `--flag` と `--flag=false` の 2 形しか見ていない。**実バイナリで再現済み**: `examples/kitchen-sink` に対して `--score --score=false` は正しく full report になるのに、`--score=true --score=false` はスコア 1 行出力のまま(OFF にならない)。CI で「ベースコマンド+上書き」のようにフラグを 2 ソースから合成すると、最後に `=false` を付けても打ち消せず、レポーター挙動と exit code が規約とズレる。同じ欠陥は `analyze` の全ブールフラグと `install`/`explain`/`ci` のフラグリストにも及ぶ。

## Current state

- `packages/cli/src/gunshi/guard.ts:47-62` — 問題の 2 箇所(HEAD の実コード):

  ```ts
  // Duplicate boolean tokens are last-wins under `node:util`'s parseArgs (overwrites on
  // repetition, then a final literal 'false' coerces to off) — so when a flag's LAST occurrence
  // is `=false`, every token of that flag must go, not just the `=false` ones.
  const offFlags = new Set(
    booleanFlags.filter((flag) => {
      let lastToken: string | undefined;
      for (const t of argv) if (t === `--${flag}` || t === `--${flag}=false`) lastToken = t;
      return lastToken === `--${flag}=false`;
    })
  );
  const argvNormalized = argv.filter((token) => {
    for (const flag of booleanFlags) {
      if (token === `--${flag}=false` || (offFlags.has(flag) && token === `--${flag}`)) return false;
    }
    return true;
  });
  ```

  欠陥は 2 つで対になっている。(1) `lastToken` スキャンが `--flag=true`(や他の明示値)を出現として見ない。(2) フィルタが除去するのは `--flag=false` と bare `--flag` だけなので、`--flag=true` トークンは生き残り gunshi に渡って ON に戻す。`--score=true --score=false` では (1) は偶然正しく off 判定するが (2) で `=true` が残るため ON になる。

- `packages/cli/test/gunshi-analyze.test.ts:197-206` — 既存の pin は `--score --score=false` のセルだけ:

  ```ts
  describe('--score --score=false: last-wins through the real dispatch path', () => {
    it('a trailing =false turns --score off (falls through to the normal reporter path)', async () => {
      const dir = tmpProjectDir();
      const { code, err } = await run([dir, '--score', '--score=false']);
      expect(code).toBe(2);
      expect(err).toContain('No SvelteKit project found');
    });
  });
  ```

- `guard.ts` の doc コメント(:11-13)が規約の正: 「Any explicit value on a declared boolean — including the literal string `'false'` — resolves to `true`」を gunshi に渡す前に書き換えで吸収する、という設計。つまり `--flag=true` は「ON の明示」、`--flag=<false 以外の任意値>` も gunshi 上は ON。last-wins 判定はこの意味論の上で「最後のトークンの値が literal `false` のときだけ OFF」とする。

- リポジトリ規約: コードコメントは英語のみ。conventional commits。

## Commands you will need

| Purpose   | Command                                                                          | Expected on success              |
| --------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Install   | `pnpm install`                                                                   | exit 0                           |
| Build     | `pnpm build`                                                                     | exit 0                           |
| CLI tests | `pnpm --filter svelte-vitals run test`                                           | all pass                         |
| 実機確認  | `node packages/cli/dist/bin.js examples/kitchen-sink --score=true --score=false` | full report(スコア 1 行ではない) |
| Full      | `pnpm test && pnpm lint`                                                         | exit 0                           |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/cli/src/gunshi/guard.ts`
- `packages/cli/test/gunshi-analyze.test.ts`(セル追加)
- 必要なら `packages/cli/test/` の guard 単体テストファイル(既存があれば追記、なければ `gunshi-analyze.test.ts` に寄せる)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/cli/src/resolve-args.ts` の `RUN_BOOLEAN_FLAGS` 等のフラグリスト — リスト同期問題は別所見(260828-DEBT-06)で、この計画では扱わない。
- gunshi 本体・`node:util` parseArgs のフォールバックパスの挙動変更。
- `--flag=<任意値>` を値として解釈する新機能 — 意味論は現状維持(false リテラルのみ OFF)。

## Git workflow

- Branch: `advisor/056-guard-args-last-wins`
- Conventional commits、例: `fix(cli): make boolean last-wins see every --flag=<value> token`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 失敗するテストを先に追加する(TDD red)

`packages/cli/test/gunshi-analyze.test.ts` の既存 `--score --score=false` describe に 3 セルを追加する(既存ケースの `run`/`tmpProjectDir` ヘルパーをそのまま使う)。

1. `--score=true --score=false` → OFF(既存セルと同じ assert: exit 2 + `No SvelteKit project found`)
2. `--score=false --score=true` → ON のまま(スコアパスに入る挙動を assert。既存の ON 側アサートパターンに合わせる — ON はこの fixture では `--score overrides --reporter` 警告経由等、既存テストの ON 判定方法を踏襲)
3. `--score=false --score` → ON(bare が最後なら ON。既存挙動の pin)

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test` → セル 1 が **fail**、2・3 は pass(2 が fail する場合は現状挙動の読み違いなので STOP)

### Step 2: `guardArgs` を直す

`guard.ts` の `offFlags` スキャンとフィルタを次の意味論に変える。

- 出現として数えるトークンは `--${flag}` に完全一致、または `--${flag}=` で始まる全て。
- OFF 判定は「最後の出現が `--${flag}=false`」のとき(bare や `=true` が最後なら ON)。
- OFF のフラグは、そのフラグの**全トークン**(bare・`=false`・`=true`・その他の `=値` 全て)を argv から除去する。
- ON のフラグは従来どおり `=false` トークンだけ除去(過去の出現の `=false` は消し、bare/`=true` は gunshi に渡す)。

実装形の例(スキャンとフィルタで同じ述語を共有すること):

```ts
const isTokenOf = (flag: string, t: string) => t === `--${flag}` || t.startsWith(`--${flag}=`);
```

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test` → Step 1 の 3 セル含め all pass

### Step 3: 実機確認と changeset

実機確認(build 済み前提)を行い、`pnpm changeset` で `svelte-vitals` patch(英語)。内容例: "Boolean flags now honor last-wins for every spelling: `--flag=true --flag=false` turns the flag off."

**Verify**: `node packages/cli/dist/bin.js examples/kitchen-sink --score=true --score=false` → full report。`node packages/cli/dist/bin.js examples/kitchen-sink --score=false --score=true` → スコア 1 行。

### Step 4: 最終検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0

## Test plan

- 追加は Step 1 の 3 セル。既存セル(`--score --score=false`、`--score=false --score` が既にあればそれ)と合わせて 4 方向の真理表が pin される。
- `install`/`explain`/`ci` のフラグリストも同じ `guardArgs` を通るため、analyze 側のテストで関数の意味論が固定されれば足りる(コマンドごとの重複テストは追加しない)。

## Done criteria

- [ ] `--score=true --score=false` が実バイナリで full report になる
- [ ] 真理表 4 セルがテストで pin されている
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(cli patch、英語)が存在する
- [ ] `plans/README.md` の 056 行を更新済み

## STOP conditions

- "Current state" の `guard.ts` 抜粋と実コードが不一致。
- Step 1 のセル 1 が HEAD で fail **しない**(先に直された可能性)。
- 修正後に既存の help-golden / guard 系テストが落ち、その原因が「`--flag=<値>` を値フラグとして扱う既存経路との衝突」に見える場合(`valueFlags` と `booleanFlags` に同名フラグが両方いる等 — 設計前提が崩れているので報告)。

## Maintenance notes

- 新しいブールフラグを追加しても `guardArgs` はリスト引数経由なので自動で正しくなる。ただしフラグリスト 4 面の手動同期問題(260828-DEBT-06)は残っており、そちらが次の欠陥源。
- `--flag=yes` 等の非 `false` 値は「ON」として扱う現仕様を変えるなら、doc コメント(:11-13)とこの真理表テストの両方を更新すること。
