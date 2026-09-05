# Plan 066: `computeScore` のレジストリ射影(selectRules / buildInventory / ruleScopes)を config 単位でメモ化する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/core/src/scoring/score.ts packages/core/src/scoring/inventory.ts packages/core/src/config-apply.ts packages/core/src/reporter/json.ts packages/core/test/score.test.ts packages/core/test/health.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category    | Planned at                                                                   |
| -------- | ------ | ---- | ---------- | ----------- | ---------------------------------------------------------------------------- |
| P2       | S      | LOW  | none       | performance | commit `13aa7ad0`(= `origin/main` `d3828d9e` と同内容のファイル)、2026-09-03 |

## Why this matters

`computeScore(results, config, options)` は呼ばれるたびに `selectRules([...allRules], config)`(105 ルールのフィルタ)、`buildInventory(config, rules)`、`ruleScopes(rules)`(各 105 エントリの Map)を**作り直す**。この 3 つは `results` に依存せず、`(config, options.rules)` だけの関数である。

呼び出し回数は多い。`buildJsonReport`(`reporter/json.ts`)はルートごとに `computeScore` を 1 回と `scoresByCategory`(カテゴリ数ぶん、最大 6 回)を呼ぶので、R ルートで約 7R 回。加えて `computeHealth` が 6 回。CLI の既定経路(`packages/cli/src/index.ts`)は `computeHealth` を最大 3 回(アニメーション、console レポーター内、`--min-health`)呼ぶ。

監査時の実測(2026-09-03、既存の `packages/core/dist` に対する read-only プローブ、Node 24): 1,681 ルート / 30,258 結果の合成データで `buildJsonReport` は **189.5 ms**、うち **180.1 ms** が 11,767 回の `computeScore` 呼び出し(1 件の結果配列に対するもの)で、1 回あたり約 15 µs。つまりレポート構築時間の約 95% が結果と無関係なセットアップ。bench 設計書(`2026-08-17-bench-gated-decisions.md`)が引く shadcn-svelte docs(1,681 ルート、1,225 ms end-to-end)ではレポート構築が全体の約 15% にあたり、そのほとんどがこれ。dev dashboard は `/data.json` リクエストごとに同じコストを払う。

スコアの意味論は凍結されている(`2026-08-16-score-semantics-freeze.md`)。この計画は**算術を一切変えず**、純粋関数の結果をキャッシュするだけ。したがって done criteria は「kitchen-sink の `--reporter json` 出力がバイト単位で同一」である。

`pnpm bench` は `analyzeProject()` を計測し、レポート構築は含まない(設計書自身が「what this does not measure」に挙げている)。よって計測は本計画の Step 4 のプローブスクリプトで行う。

## Current state

- `packages/core/src/scoring/score.ts:1-7`(import)と `:53-63`(`computeScore` 冒頭):

  ```ts
  import { selectRules } from '../config-apply.js';
  import { allRules } from '../rules/index.js';
  import { buildInventory, ruleScopes, DEDUCTION, type PairKey } from './inventory.js';
  …
  export function computeScore(results: Result[], config: Config, options: ScoreOptions = {}): ScoreResult {
    const routeResults = results.filter((r) => r.route !== undefined);
    const projectResults = results.filter((r) => r.route === undefined);

    // `selectRules` applied here, not just inside `buildInventory`, so `pairOf` and the inventory see
    // the same filtered list — an injected rule that config turns `off` must vanish from both, not map
    // to a pair in one and contribute nothing in the other.
    const rules = selectRules([...(options.rules ?? allRules)], config);
    const inventory = buildInventory(config, rules);
    const pairOf = ruleScopes(rules);
  ```

  以降(`:65-141`)は `inventory` と `pairOf` を読むだけで、どちらも変更しない(`inventory.get(p)`、`pairOf.get(r.id)`)。

- `packages/core/src/scoring/score.ts:41-45`(`ScoreOptions`): `applyCriticalCap?: boolean` と `rules?: readonly Rule[]`。`rules` は「テストとカスタムルールセット」用。
- `packages/core/src/scoring/score.ts:144-153`(`scoresByCategory`): カテゴリごとに `computeScore(rs, config, options)`。`:165-166`(`computeHealth`): `scoresByCategory(results, config)`。
- `packages/core/src/scoring/inventory.ts:24-45` — `buildInventory(config, rules = selectRules(allRules, config))` と `ruleScopes(rules)`。どちらも新しい Map を返す純粋関数。
- `packages/core/src/config-apply.ts:30-32`(`selectRules`)は `rules.filter(...)`。`:41-49`(`withFailedRulesOff`)は `failedRuleIds.length === 0` なら **同じ `config` オブジェクトを返し**、そうでなければ**新しいオブジェクト**を返す。`Config` を in-place で mutate する箇所は監査時の grep(`config\.\w+ =` / `config\.rules\[`)でゼロ。
- `packages/core/src/reporter/json.ts:92`(`computeHealth`)、`:114`(ルートごと `computeScore`)、`:118`(ルートごと `scoresByCategory`)。
- `packages/core/test/score.test.ts` — `describe('computeScore (§12 worked example)')` は `defineConfig({})` と手組みの `Result[]` で `computeScore` を直接呼ぶ。`:193` の `describe('scoresByCategory — scoring options')` が `options` を渡す形。
- `packages/core/test/health.test.ts` — `computeHealth(results, defineConfig({ weights }))` の形。
- kitchen-sink の e2e(`examples/kitchen-sink/test/e2e-static.test.ts:41`)は `execFileSync(process.execPath, [bin, appDir, '--reporter', 'json'])` で built CLI を走らせる。同じコマンドをバイト比較に使う。

## Commands you will need

| Purpose       | Command                                                                                 | Expected on success                              |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Install       | `pnpm install`                                                                          | exit 0                                           |
| Build         | `pnpm build`                                                                            | exit 0                                           |
| Core tests    | `pnpm --filter @svelte-vitals/core run test`                                            | all pass                                         |
| JSON snapshot | `node packages/cli/dist/bin.js examples/kitchen-sink --reporter json > <file>; echo $?` | exit 1(gallery は finding あり)、ファイルに JSON |
| Full          | `pnpm build && pnpm typecheck && pnpm test && pnpm lint`                                | 全て exit 0                                      |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/core/src/scoring/score.ts`(メモ化)
- `packages/core/test/score.test.ts`(呼び出し回数のテスト)
- `.changeset/`(新規 changeset 1 件、`@svelte-vitals/core` の patch)
- 一時ファイル: 計測プローブは scratchpad か `/tmp` に置き、**コミットしない**。

**Out of scope**(触らない):

- `inventory.ts` / `config-apply.ts` — シグネチャも中身も変えない。
- `reporter/json.ts` / `reporter/console.ts` / `packages/cli/src/index.ts` の `computeHealth` 呼び出し回数の削減(3 回 → 1 回)。メモ化が効けば各回のコストは結果走査だけになり、hoist は別の小さな計画で足りる。
- vite dashboard の `buildSnapshot` メモ化(README の 260903-PERF-03)。
- スコア算術・`INVENTORY_FLOOR`・`CRITICAL_CAP`。凍結済み。

## Git workflow

- Branch: `advisor/066-score-registry-memo`(`origin/main` から)
- Conventional commits、例: `perf(core): memoize the rule-registry projection computeScore rebuilds per call`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 変更前の JSON スナップショットを取る

```bash
pnpm build
node packages/cli/dist/bin.js examples/kitchen-sink --reporter json > /tmp/sv-066-before.json; echo "exit $?"
```

exit は 1(gallery は finding を持つ)で正常。ファイルが空でないことを `wc -c` で確認。

### Step 2: 呼び出し回数を数える失敗するテストを書く(TDD red)

`packages/core/test/score.test.ts` に追加する。`vi.mock` でモジュール全体を差し替えると `score.ts` の import 解決が絡むので、**`inventory.ts` の `buildInventory` を spy** する。

```ts
import { vi } from 'vitest';
import * as inventory from '../src/scoring/inventory.js';

describe('computeScore memoizes the registry projection per config', () => {
  it('builds the inventory once for repeated calls with the same config object', () => {
    const spy = vi.spyOn(inventory, 'buildInventory');
    try {
      const config = defineConfig({});
      const results: Result[] = [/* copy the small worked-example set used above */];
      computeScore(results, config);
      computeScore(results, config);
      computeScore(results.slice(0, 1), config, { applyCriticalCap: false });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('rebuilds for a different config object and for an explicit rules list', () => {
    const spy = vi.spyOn(inventory, 'buildInventory');
    try {
      const a = defineConfig({});
      const b = defineConfig({ rules: { 'seo/title-presence': 'off' } });
      computeScore([], a);
      computeScore([], b);
      computeScore([], a, { rules: [] });
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });
});
```

ESM の名前空間 import に対する `vi.spyOn` は、`score.ts` が `import { buildInventory } from './inventory.js'` で**ライブバインディング**を使っているので効く(vitest はモジュールを変換してエクスポートを getter にする)。効かない場合(呼び出し回数が常に 0)は STOP。

**Verify**: `pnpm --filter @svelte-vitals/core run test -- score` → 1 つ目が **fail**(3 回呼ばれる)。2 つ目は 3 回で pass(現状も毎回作るため)。

### Step 3: `WeakMap` でメモ化する

`packages/core/src/scoring/score.ts` の `computeScore` 直前に追加し、冒頭の 3 行を置き換える。

```ts
interface RegistryProjection {
  inventory: Map<PairKey, number>;
  pairOf: Map<string, PairKey>;
}

// Keyed on the `config` object's identity, then on the rules array's identity: every in-tree
// caller passes the same `config` object for a whole run (`withFailedRulesOff` returns a fresh
// object when it changes anything, the same one when it doesn't), and nothing mutates a Config
// in place. `buildJsonReport` alone calls this ~7 times per route; the projection depends on
// neither `results` nor `applyCriticalCap`, so a per-call rebuild was ~95% of report-building time.
const projections = new WeakMap<Config, WeakMap<readonly Rule[], RegistryProjection>>();

function projectRegistry(config: Config, rulesList: readonly Rule[]): RegistryProjection {
  let byRules = projections.get(config);
  if (!byRules) projections.set(config, (byRules = new WeakMap()));
  let projection = byRules.get(rulesList);
  if (!projection) {
    // `selectRules` applied here, not just inside `buildInventory`, so `pairOf` and the inventory see
    // the same filtered list — an injected rule that config turns `off` must vanish from both, not map
    // to a pair in one and contribute nothing in the other.
    const rules = selectRules([...rulesList], config);
    projection = { inventory: buildInventory(config, rules), pairOf: ruleScopes(rules) };
    byRules.set(rulesList, projection);
  }
  return projection;
}
```

```ts
export function computeScore(results: Result[], config: Config, options: ScoreOptions = {}): ScoreResult {
  const routeResults = results.filter((r) => r.route !== undefined);
  const projectResults = results.filter((r) => r.route === undefined);
  const { inventory, pairOf } = projectRegistry(config, options.rules ?? allRules);
```

`allRules` はモジュール定数なので、`options.rules` 省略時のキーは常に同じ配列オブジェクト。`Rule` 型の import が `score.ts` に既にあることを確認する(`:2` に `import type { Rule }` あり)。

**Verify**: `pnpm --filter @svelte-vitals/core run test` → all pass(Step 2 の両ケース含む)。`pnpm typecheck` → exit 0。

### Step 4: バイト同一性と効果を計測する

```bash
pnpm build
node packages/cli/dist/bin.js examples/kitchen-sink --reporter json > /tmp/sv-066-after.json
cmp /tmp/sv-066-before.json /tmp/sv-066-after.json && echo IDENTICAL
```

`IDENTICAL` が出ること。出なければ STOP(`version` フィールド以外の差分はスコア意味論の変化を意味する。`version` が変わっている場合は同じビルドで before を取り直す)。

効果の計測(scratchpad に置く一時スクリプト、コミットしない):

```js
// /tmp/sv-066-probe.mjs — run with: node /tmp/sv-066-probe.mjs
import { buildJsonReport } from '<repo>/packages/core/dist/internal.js';
import { defineConfig } from '<repo>/packages/core/dist/index.js';
const config = defineConfig({});
const results = [];
for (let i = 0; i < 1681; i++) {
  for (let j = 0; j < 18; j++) {
    results.push({
      id: 'seo/title-presence',
      category: 'seo',
      severity: 'critical',
      route: `/r${i}`,
      detection: { presence: j % 3 ? 'own' : 'none', value: j % 3 ? 'static' : 'absent' },
      message: 'm'
    });
  }
}
const t0 = performance.now();
buildJsonReport(results, config, { version: '0' });
console.log('buildJsonReport ms:', (performance.now() - t0).toFixed(1));
```

`buildJsonReport` の export 名と引数は `packages/core/src/reporter/json.ts` の実際のシグネチャに合わせる(`formatJsonReport` が文字列版、`buildJsonReport` がオブジェクト版)。変更前(`git stash`)と変更後で 3 回ずつ走らせ、中央値を changeset と PR に記録する。監査時の数字(180 ms → 数 ms 台)と桁が合わなければ STOP。

### Step 5: changeset を書き、最終検証

`.changeset/` に新規ファイル(例 `score-registry-memo.md`)。

```md
---
'@svelte-vitals/core': patch
---

Memoize the rule-registry projection (`selectRules` → `buildInventory` / `ruleScopes`) that `computeScore` rebuilt on every call. Per-route scoring in the JSON report and the dashboard snapshot no longer pays a 105-rule filter and two Map builds per call; report output is byte-identical (verified against the kitchen-sink gallery). Measured: <before> ms → <after> ms for `buildJsonReport` over a synthetic 1,681-route result set.
```

`<before>` / `<after>` は Step 4 の中央値で埋める。

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。

## Test plan

- 新規: 呼び出し回数 2 ケース(同一 config で 1 回、別 config / 別 rules で作り直す)。
- 既存: `score.test.ts` / `health.test.ts` / `json-report.test.ts` / kitchen-sink e2e が無変更で通ること。
- バイト同一性(Step 4)。
- 判別性: Step 3 を revert すると Step 2 の 1 つ目が赤に戻る。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `cmp` による before/after JSON のバイト同一性を確認済み(PR 本文に記載)
- [ ] `grep -n "new WeakMap<Config" packages/core/src/scoring/score.ts` が 1 行ヒット
- [ ] `grep -rn "config\.\(rules\|weights\|treatDynamicAs\|failOn\|overrides\) = " packages/core/src packages/cli/src packages/vite/src` が空(Config の in-place 変更なし)
- [ ] changeset に before / after の ms を記載
- [ ] `plans/README.md` の 066 行を更新済み

## Maintenance notes

- キャッシュキーはオブジェクト同一性。将来 `Config` を in-place で変更するコードを書くと、古い射影が返る。上の grep を CI に入れるほどではないが、レビューで見る。
- `withFailedRulesOff` が新しいオブジェクトを返す設計(`config-apply.ts:41-49`)がこのメモ化の前提。同関数を「同じオブジェクトを変更して返す」形に変えてはならない。
- `WeakMap` なので config オブジェクトが GC されれば射影も消える。長寿命プロセス(dev dashboard)でも config は 1 つなのでリークしない。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない。
- Step 2 の spy が `buildInventory` の呼び出しを捕まえない(常に 0 回)。
- Step 4 で before / after の JSON が一致しない(`version` 以外)。
- Step 4 の効果が監査時の桁(2 桁 ms 以上の削減)と合わない。
- `Config` を in-place で変更する箇所が grep で見つかる。
