# Plan 023: 抑制ファイル(`svelte-vitals-suppressions.json`)— 既存 finding を受け入れて新規だけをゲートする導入ランプ

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e37dfb4..HEAD -- packages/cli/src/index.ts packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/cli/src/baseline.ts`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW(新規フィルタの追加のみ。既存の `--diff`/`--staged`/`--baseline` の意味は不変)
- **Depends on**: none(014 の `findingKey` を再利用)
- **Category**: direction(旧 DIR-03)
- **Planned at**: commit `e37dfb4`, 2026-07-13

## Why this matters

既存プロジェクトに svelte-vitals を導入するとき、蓄積した既存 finding が大量にあると
ゲート(`--fail-on`)を入れられない。`--baseline <ref>`(PR #142)は「PR の base との差分」
という**一時的な比較**には効くが、「現状を記録して恒久的に受け入れ、新規だけ失敗させる」
永続的なランプが無い(plans/README.md 方向性メモ DIR-03)。本計画で **抑制ファイル**を導入する。

**命名について(設計判断)**: `--baseline <ref>` と用語が衝突するため、ファイル方式は
"baseline" ではなく **"suppressions"** と呼ぶ(ESLint bulk suppressions の前例)。
Plan 014 の Maintenance notes に予告済みの整合。

決定済み設計(メンテナーがモデルに設計委任・2026-07-13。Appendix A が正):

1. ファイルは解析対象ディレクトリ直下の `svelte-vitals-suppressions.json`。存在すれば
   **自動適用**(stderr に件数を通知)。`--no-suppressions` で一時無効化。
2. `--update-suppressions` で生成/全書き換え(現在の penalized finding 全部を記録、
   stale エントリは自動 prune、exit 0、レポートは出力せず書き込みサマリーのみ)。
3. エントリのキーは Plan 014 の `findingKey` と同一(`id` + `route` + `location`、line なし)。
4. 適用順序: `--diff`/`--staged` → `--baseline <ref>` → **suppressions**(最後)。
5. 適用時、ファイル内の**未使用(stale)エントリ数**を stderr で通知(失敗はさせない)。

## Current state

- **フィルタチェーン**: `packages/cli/src/index.ts:219-255` — `applyScope(results, opts)`
  に抽出済み(並行セッションの Plan 020 での再構成)。`--diff`/`--staged` ブロック →
  `--baseline` ブロックの順で `let scoped` を絞り、最後に `return scoped;`:

```ts
export async function applyScope(results: Result[], opts: ApplyScopeOptions): Promise<Result[]> {
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));
  let scoped = results;

  if (opts.staged || opts.diffBase !== undefined) {
    /* …filterToChangedFiles… */
  }

  if (opts.baseline !== undefined) {
    /* …checkoutBaseline → filterToNewFindings… */
  }

  return scoped;
}
```

`ApplyScopeOptions` の型定義(index.ts、`applyScope` の直上)と、`run()` からの呼び出し
箇所を実ファイルで確認して配線すること。

- **キー関数**: `packages/cli/src/baseline.ts:12` — `findingKey(r): string` =
  `` `${r.id}::${r.route ?? ''}::${r.location ?? ''}` ``(export 済み。再利用する —
  suppressions 用に複製しない)。
- **penalized 判定**: `@svelte-vitals/core` の `isPenalized(r.detection, config.treatDynamicAs)`
  (`packages/core/src/rule.ts`。`filterToChangedFiles` 等が使う既存の流儀を確認)。
  抑制ファイルに書くのは **penalized な finding のみ**(passing シードは書かない・消さない)。
- **フラグ処理**: `packages/cli/src/bin.ts:70-88` — mri の `boolean` は現在
  `['by-route', 'staged', 'score', 'verbose']`、`string` に `'diff'`/`'baseline'` 等。
  `--no-color`/`--no-animation` の扱い(mri は `--no-x` を `x: false` にする)を実コードで
  確認し、`--no-suppressions` は同じ流儀に合わせる。
- **ファイル I/O の前例**: `packages/cli/src/config-file.ts`(cwd 直下のみ探索・上方探索なし)。
  suppressions も同じ「解析対象 cwd 直下のみ」。
- **テストの流儀**: `packages/cli/test/run-diff.test.ts` / `run-baseline.test.ts`
  (capture + `vi.mock`)、`applyScope` の独立テストが存在するか確認し、あればそこに追加。

## Commands you will need

| Purpose   | Command                                                     | Expected on success |
| --------- | ----------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter "./packages/**" install`                     | exit 0              |
| Build     | `pnpm --filter "./packages/**" build`                       | exit 0              |
| Typecheck | `pnpm typecheck`                                            | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`                          | all pass            |
| Lint      | `pnpm lint`                                                 | exit 0              |
| Changeset | 手書き(svelte-vitals: minor、既存 `.changeset/*.md` の形式) | ファイル生成        |

## Scope

**In scope**:

- `docs/superpowers/specs/2026-07-13-suppressions-file-design.md`(新規 — Appendix A の内容で作成)
- `packages/cli/src/suppressions.ts`(新規)
- `packages/cli/src/index.ts`(`applyScope` への配線 + `RunOptions` + update モード)
- `packages/cli/src/resolve-args.ts`、`packages/cli/src/bin.ts`(フラグ + ヘルプ)
- `packages/cli/test/suppressions.test.ts`、`run-suppressions.test.ts`(新規)、
  `resolve-args.test.ts`(ケース追加)
- `docs/src/content/docs/guides/cli.md` + `ja/guides/cli.md`(節追加)、
  `docs/src/content/docs/guides/ci.md` + `ja/guides/ci.md`(導入ランプの1段落)
- `.changeset/`

**Out of scope**:

- `packages/core` — `findingKey`/`isPenalized` は既存を使う。core に足さない。
- `packages/mcp` / `packages/vite` / `packages/action` — 需要が出てから。
- config ファイルへの `suppressions` キー(v1 は固定ファイル名のみ)。
- 行番号ベースの抑制、インライン抑制ディレクティブとの統合(既存の
  `svelte-vitals-disable-next-line` は別機構のまま)。

## Git workflow

- Branch: `advisor/023-suppressions-file`
- Conventional commits、例: `feat(cli): add a suppressions file to accept existing findings and gate only new ones`
- PR 本文は英語。他社ベンチマークツール名をコミット/PR/docs に書かない(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 設計書をリポジトリに作成

`docs/superpowers/specs/2026-07-13-suppressions-file-design.md` を **Appendix A の内容そのまま**で作成。

**Verify**: `test -f docs/superpowers/specs/2026-07-13-suppressions-file-design.md` → exit 0

### Step 2: `packages/cli/src/suppressions.ts`(新規)

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, Result } from '@svelte-vitals/core';
import { isPenalized } from '@svelte-vitals/core';
import { findingKey } from './baseline.js';

export const SUPPRESSIONS_FILE = 'svelte-vitals-suppressions.json';

export interface SuppressionEntry {
  id: string;
  route?: string;
  location?: string;
}

/** ファイルを読む。無ければ undefined、壊れていれば Error を throw(呼び出し側で exit 2 に写像)。 */
export function loadSuppressions(cwd: string): SuppressionEntry[] | undefined;

/**
 * penalized な finding をエントリ化して全書き換え(prune 込み)。
 * (id, route, location) で安定ソートし、{ "version": 1, "suppressions": [...] } を
 * 2-space インデントで書く(diff 安定性のため)。書いた件数を返す。
 */
export function writeSuppressions(cwd: string, results: Result[], config: Config): number;

/**
 * 適用: エントリのキー集合に一致する penalized finding を除去。
 * passing シードは対象外(除去しない)。戻り値に stale(どの finding にも一致しなかった
 * エントリ)件数を含める: { results, suppressed, stale }。
 */
export function applySuppressions(
  results: Result[],
  entries: SuppressionEntry[],
  config: Config
): { results: Result[]; suppressed: number; stale: number };
```

- キーの照合は `findingKey` を経由(エントリ → `` `${id}::${route ?? ''}::${location ?? ''}` `` に
  正規化して比較)。
- `loadSuppressions` の検証: JSON でない / `version !== 1` / `suppressions` が配列でない /
  エントリに `id`(string)が無い → `Error('invalid svelte-vitals-suppressions.json: <理由>')`。
  余分なキーは無視(前方互換)。

**Verify**: `pnpm typecheck` → exit 0

### Step 3: 配線 — 自動適用 + `--no-suppressions` + `--update-suppressions`

- `RunOptions` に追加:
  `/** Disable applying svelte-vitals-suppressions.json for this run. */ noSuppressions?: boolean;`
  `/** Analyze, then (re)write svelte-vitals-suppressions.json with all currently penalized findings and exit 0. */ updateSuppressions?: boolean;`
- `applyScope`(または `run()` 内の適用順で同等の位置)の **`--baseline` ブロックの後**に:

```
if (!opts.noSuppressions) {
  entries = loadSuppressions(cwd)        // throw は run() の既存 catch で exit 2(メッセージに svelte-vitals: プレフィックス)
  if (entries !== undefined) {
    { results: scoped, suppressed, stale } = applySuppressions(scoped, entries, config)
    if (suppressed > 0 || stale > 0) errorLog(
      `svelte-vitals: ${suppressed} finding(s) suppressed by ${SUPPRESSIONS_FILE}` +
      (stale > 0 ? ` (${stale} stale entr${stale === 1 ? 'y' : 'ies'} — re-run --update-suppressions to prune)` : '') + '.'
    )
  }
}
```

※ `applyScope` に config が渡っていない場合はシグネチャ拡張が必要 — 実コードを見て
最小の変更で通す(`ApplyScopeOptions` に `config` を足すのは可)。

- **update モード**: `run()` で `opts.updateSuppressions` のとき、解析(スコープフィルタは
  `--diff`/`--staged`/`--baseline` を**適用しない** — 全量を記録するのが目的)後に
  `writeSuppressions` し、`svelte-vitals: wrote N suppression(s) to svelte-vitals-suppressions.json.`
  を stderr に出して **exit 0**(レポーター出力・exit ゲートはスキップ)。
  `--update-suppressions` と `--no-suppressions` の同時指定は resolve-args で fatal error。
- `resolve-args.ts` / `bin.ts`: `--update-suppressions`(boolean)を追加、
  `--no-suppressions` は `--no-color` と同じ mri の流儀で。ヘルプに 2 行追加:

```
  --update-suppressions       Write svelte-vitals-suppressions.json accepting all current findings (introduce gates on legacy projects)
  --no-suppressions           Ignore svelte-vitals-suppressions.json for this run
```

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck` → exit 0

### Step 4: テスト

- `suppressions.test.ts`(ユニット): load(無し→undefined / 壊れ JSON→throw / version 不一致→throw)、
  write(penalized のみ・ソート済み・prune)、apply(一致除去 / passing シード不変 /
  stale カウント / 空エントリ)。
- `run-suppressions.test.ts`(run-diff.test.ts の capture パターン):
  (1) ファイルありで penalized finding が消え exit 0、stderr に suppressed 件数、
  (2) `--no-suppressions` で従来どおり exit 1、
  (3) `--update-suppressions` でファイルが書かれ exit 0(注入 writeFile か一時 fixture)、
  (4) stale エントリ通知、(5) 壊れたファイル → exit 2、
  (6) `--diff` との併用(順序: diff 後に suppressions)。
- `resolve-args.test.ts`: 新フラグのマッピング + 同時指定エラー。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 5: docs + changeset

- `guides/cli.md`(+ja): `--update-suppressions` / `--no-suppressions` /
  `svelte-vitals-suppressions.json` の節(`--baseline <ref>` との違い —
  「ref 比較は一時的、抑制ファイルは恒久的な受け入れ」— を明記)。
- `guides/ci.md`(+ja): 「既存プロジェクトへの導入ランプ」1 段落
  (`--update-suppressions` → ファイルをコミット → ゲート有効化、の手順)。
- changeset: svelte-vitals minor(英語)。

**Verify**: `pnpm --filter "./packages/**" build && pnpm typecheck && pnpm --filter svelte-vitals test && pnpm lint` → すべて exit 0

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] 一時 fixture で `--update-suppressions` → ファイル生成(exit 0)→ 再実行で全 finding 抑制
      (exit 0)→ 新規 finding 追加で exit 1、の一連がテストで固定されている
- [ ] passing シードが抑制ファイルの write/apply の対象外であることがテストで固定
- [ ] `--baseline <ref>` と suppressions の適用順(baseline 後)がテストで固定
- [ ] docs(cli en/ja + ci en/ja)+ changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)

## STOP conditions

- `applyScope` の現行シグネチャが本計画の想定(config を渡せる/拡張できる)と大きく異なる。
- `findingKey` が baseline.ts から export されていない、または形が変わっている。
- mri の `--no-suppressions` 取り扱いが既存 `--no-color` の流儀で解決できない。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- 抑制された finding は results から除去されるため **Health も上がる**(設計どおり —
  導入ランプの目的は「新規だけを見る」こと)。docs に明記済みであることをレビューで確認。
- キーに line を含めない(014 と同じトレードオフ): 同一ファイル・同一ルールの2件目は
  1件目の抑制に隠れる。問題になったらキーの多重度カウント化を検討。
- 将来 config ファイルにパス指定キーを足す場合、`SUPPRESSIONS_FILE` 定数が単一の正。
- インライン `svelte-vitals-disable-next-line` とは独立の機構。統合要望が出たら設計から。

## Appendix A: 設計書全文(Step 1 でこの内容のファイルを作成する)

```markdown
# Suppressions file: accept existing findings, gate only new ones

**Date:** 2026-07-13
**Status:** Accepted (design delegated to the advisor by the maintainer, 2026-07-13; implementation plan: `plans/023-suppressions-file.md`)
**Packages:** `svelte-vitals` (CLI only)

## Goal

Adopting svelte-vitals on an existing project is blocked by accumulated
findings: you cannot turn on `--fail-on` gating without first fixing
everything. `--baseline <ref>` (PR #142) covers the _transient_ case (compare a
PR against its base), but there is no _persistent_ ramp — "record today's
findings, accept them, and fail only on new ones". This design adds a
suppressions file (direction note DIR-03).

**Naming:** the file mechanism is called **suppressions**, not "baseline" —
`--baseline <ref>` already means the git-ref comparison, and overloading the
word was flagged as a hazard in plan 014's maintenance notes. Precedent:
ESLint's bulk suppressions.

## Decisions

1. **File:** `svelte-vitals-suppressions.json` in the analyzed directory (same
   placement rule as `svelte-vitals.config.*`; no upward search). Applied
   **automatically** when present, with a stderr notice
   (`N finding(s) suppressed by svelte-vitals-suppressions.json`).
   `--no-suppressions` disables application for one run.
2. **Creating/updating:** `--update-suppressions` runs the analysis, writes
   ALL currently penalized findings to the file (full rewrite — stale entries
   are pruned), prints a summary to stderr, and exits 0. Reporter output and
   exit gating are skipped in this mode. Scoping flags (`--diff`/`--staged`/
   `--baseline`) are ignored while updating — the file records the whole
   project.
3. **Entry identity:** same key as `--baseline`'s `findingKey`
   (`id` + `route` + `location`, **no line number** — line drift must not
   resurface accepted findings; the known trade-off is that a second violation
   of the same rule in the same file is masked).
4. **Format:** `{ "version": 1, "suppressions": [{ "id", "route"?, "location"? }] }`,
   entries sorted by (id, route, location) for stable diffs. Unknown keys are
   ignored (forward compatibility); a malformed file is a hard error (exit 2)
   — silently ignoring a typo'd suppressions file would un-gate CI.
5. **Application order:** `--diff`/`--staged` → `--baseline <ref>` →
   suppressions (last). Only penalized findings are removed; passing seeds are
   untouched. Suppressed findings leave `results` entirely, so scores/Health
   rise accordingly — intended: the ramp's purpose is to make dashboards and
   gates reflect _new_ debt only.
6. **Stale entries:** application reports a stale count on stderr (with a hint
   to re-run `--update-suppressions`) but never fails the run.

## Non-goals

- A config-file key or custom path (fixed filename in v1).
- MCP / vite / action integration (CLI only in v1).
- Line-scoped suppression or merging with the inline
  `svelte-vitals-disable-next-line` directive — separate mechanisms.

## Test plan

Unit: load (missing/malformed/version), write (penalized-only, sorted, prune),
apply (removal, passing seeds untouched, stale count). Run-level: auto-apply →
exit 0, `--no-suppressions` restores failure, `--update-suppressions` writes
and exits 0, malformed file exits 2, ordering with `--diff`/`--baseline`.
The full adoption-ramp sequence (update → all suppressed → new finding fails)
is pinned end-to-end.
```
