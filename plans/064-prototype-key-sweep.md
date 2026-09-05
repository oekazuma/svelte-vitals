# Plan 064: core の `Object.prototype` キー索引の残り 3 サイトをふさぐ(JSON-LD `@type` でルール脱落、rule options の無言受理、placement 値読み)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/core/src/rules/seo/json-ld-required-props.ts packages/core/src/rules/seo/jsonld-engine.ts packages/core/src/rule-options.ts packages/core/src/rules/architecture/reserved-name-placement.ts packages/core/test/seo-jsonld-rules.test.ts packages/core/test/rule-options.test.ts packages/core/test/reserved-name-placement.test.ts packages/core/test/html-spec.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category    | Planned at                                                                   |
| -------- | ------ | ---- | ---------- | ----------- | ---------------------------------------------------------------------------- |
| P1       | S      | LOW  | none       | correctness | commit `13aa7ad0`(= `origin/main` `d3828d9e` と同内容のファイル)、2026-09-03 |

## Why this matters

PR #615(計画 055)は `HTML_SPEC` の索引を `Object.hasOwn` で守った。同じクラスのハザードが core にあと 3 サイト残っており、うち 1 つは**解析対象のページ内容**から到達できる。

1. **`seo/json-ld-required-props` がプロジェクト全体で脱落し、スコアが上がる。** `REQUIRED_PROPS[t]` の `t` はページの JSON-LD の `@type` 文字列そのもの。`"@type": "constructor"`(または `toString` / `valueOf` / `hasOwnProperty`)があると `Object.prototype.constructor`(関数)が返り、`!required` を素通りして `missingRequiredProps` の `row.all` が `undefined` になり `.filter` で throw する。`runRules` はルール単位で catch するので、**そのルールは当該ルートだけでなく全ルートで結果ゼロ**になり、`withFailedRulesOff` が重みを分母から外して **Health が上がる**。監査時に built `dist` で再現済み(`failedRules: [{ id: 'seo/json-ld-required-props', message: 'Cannot read properties of undefined (reading \'filter\')' }]`)。
2. **rule options の unknown-key 検証に穴がある。** `validateRuleOptions` と `resolveRuleOptions` の `spec[key]` は config ファイル由来のキーで索引する。`options: { constructor: { a: 'b' } }` のように `Object.prototype` のメンバー名をキーにすると `!s` が偽になり、`unknown option` エラーが出ないまま無言で受理され(検証)、あるいは map 型としてマージされる(解決)。AGENTS.md が「typo で config が無言で inert になるのを防ぐ」と定義した境界の穴。値がオブジェクトでない場合は `x.constructor must be an object of string → non-empty string` という**誤ったメッセージ**になる。同ファイルの `isMentionedAnywhere`(90-98 行)は同じ理由で `Object.hasOwn` を使っており、そのポリシーを未適用の 2 サイトに広げるだけ。
3. **`architecture/reserved-name-placement` の値読みが未ガード。** 055 のレビュー副産物(README の 260828-REV-01)として記録済みで未着手。存在チェック(145-147 行)は `Object.hasOwn` だが、その後の値読み `placements[name]` / `capUnits[name]` / `anyUnits[name]`(181-183 行、205-207 行)は生索引。`capitalisedUnitPlacements: { constructor: 'src/lib/**' }` だけを宣言したプロジェクトに `constructor` という名前のディレクトリがあると、`placements['constructor']` が `Object.prototype.constructor` を返し `globsOf(Function)` → `splitNames` で throw。監査時に再現済み(`value.split is not a function or its return value is not iterable`)。

3 つとも修正は `Object.hasOwn` ガード 1 行ずつ。テストは #615 が `packages/core/test/html-spec.test.ts:65-78` に置いた形式に倣う。

**changeset で主張してよいこと・いけないこと**(レビューで REJECT される主張を避ける): 1 は「ページ内容から到達可能なクラッシュ、ルール脱落、スコア上振れ」まで言ってよい。2 は「`constructor` 等の名前のオプションキーが無言で受理される、または誤ったメッセージになる」までであり、**`__proto__` によるプロトタイプ汚染は主張しない**。config は JS/TS モジュールとして評価されるので、オブジェクトリテラルの `__proto__:` は prototype をセットするだけで `Object.entries` のキーには現れない(到達不能)。3 は「特定の名前のディレクトリと片側だけの placement 設定の組み合わせでルールがクラッシュする」まで。

## Current state

- `packages/core/src/rules/seo/json-ld-required-props.ts:11-24`(全文の要部):

  ```ts
  problem: (nodes) => {
    let hasKnownType = false;
    for (const node of nodes) {
      for (const t of typeOf(node)) {
        const required = REQUIRED_PROPS[t];
        if (!required) continue; // unknown/custom type, or a type Google requires nothing from → not flagged
        hasKnownType = true;
        const missing = missingRequiredProps(node, required);
        if (missing.length > 0) return `${t} JSON-LD is missing required ${missing.join(', ')}`;
      }
    }
    // No known types found → no signal (rule is not applicable)
    return hasKnownType ? undefined : false;
  };
  ```

- `packages/core/src/rules/seo/jsonld-engine.ts:196-210` — `REQUIRED_PROPS: RequiredPropsByType`(open index signature、7 エントリの通常オブジェクト)。`:218-224` の `missingRequiredProps(node, row)` は `Array.isArray(row) ? row : row.all` を `.filter` する。`typeOf(node)`(`:34-39`)は `@type` の文字列または文字列配列をそのまま返す。

- `packages/core/src/rule-options.ts:131-137`(`resolveRuleOptions` のマージループ):

  ```ts
  for (const [key, value] of Object.entries(layer)) {
    const s = spec[key];
    if (!s) continue; // validation rejects unknown keys up front; ignore defensively
    if (s.kind === 'integer') out[key] = value;
    else if (s.kind === 'string-list') out[key] = [...(out[key] as string[]), ...(value as string[])];
    else out[key] = { ...(out[key] as Record<string, string>), ...(value as Record<string, string>) };
  }
  ```

  `:185-190`(`validateRuleOptions`):

  ```ts
  for (const [key, value] of Object.entries(options)) {
    const s = spec[key];
    if (!s) {
      errors.push(`${ruleId}: unknown option '${key}'. Known options: ${Object.keys(spec).join(', ')}.`);
      continue;
    }
  ```

  `:90-98` の `isMentionedAnywhere` は `Object.hasOwn(config.rules, ruleId)` を使い、その理由を 6 行のコメントで説明している(「open-ended record への presence check はこのリポジトリでは `Object.hasOwn`」)。

- `packages/core/src/rules/architecture/reserved-name-placement.ts:144-147`(存在チェック、ガード済み)と `:179-183` / `:205-207`(値読み、未ガード):

  ```ts
  const name = baseName(dir);
  const inPlacements = Object.hasOwn(placements, name);
  const inCapUnits = Object.hasOwn(capUnits, name);
  const inAnyUnits = Object.hasOwn(anyUnits, name);
  if (!inPlacements && !inCapUnits && !inAnyUnits) continue;
  …
  const resolvedValues: [MapName, string | undefined][] = [
    ['placements', placements[name]],
    ['capitalisedUnitPlacements', capUnits[name]],
    ['anyCaseUnitPlacements', anyUnits[name]]
  ];
  …
  const byPlacement = record('placements', placements[name], true);
  const byCapUnit = record('capitalisedUnitPlacements', capUnits[name], isUnitDir(parent, filesIn));
  const byAnyUnit = record('anyCaseUnitPlacements', anyUnits[name], isAnyCaseUnitDir(parent, filesIn));
  ```

  `:156-158` の `emptyValue(inPlacements, placements[name])` は `present &&` で短絡するので安全。`resolvedValues` と `record` は `value === undefined` で continue / return するが、`Object.prototype.constructor` は `undefined` ではない。

- 既存テストの形式:
  - `packages/core/test/html-spec.test.ts:65-78` — `describe('html-spec: Object.prototype keys are not element data', …)`、`htmlElement('constructor')` が `undefined` になることを pin。
  - `packages/core/test/seo-jsonld-rules.test.ts:1-22` — `headWithJsonLd(raw)` で `ResolvedHead` を作り、`ctx(head)` で `RuleContext` を作り、`fails(await rule.check(ctx(...)))` で penalized な結果を数える。`seo/json-ld-required-props` のケースは 316 行から。
  - `packages/core/test/rule-options.test.ts:92-97` — `validateRuleOptions('r', spec, { maxx: 10 })[0]` が `unknown option 'maxx'` を含むことを確認。`describe('resolveRuleOptions')` は 13 行から。
  - `packages/core/test/reserved-name-placement.test.ts` — ルールを `RuleContext` で直接呼ぶ形式。既存ケースを 1 つコピーして fixture(ディレクトリ名と config)を差し替える。

- リポジトリ規約: `Object.hasOwn(obj, key) ? obj[key] : undefined` の形(`role-candidates.ts:52` と同型)。コードコメントは英語、非自明な WHY のみ。

## Commands you will need

| Purpose    | Command                                                  | Expected on success |
| ---------- | -------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                           | exit 0              |
| Core tests | `pnpm --filter @svelte-vitals/core run test`             | all pass            |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint` | 全て exit 0         |

core のテストは dist に依存しないので、Step 1〜4 は `pnpm --filter @svelte-vitals/core run test` だけで回せる。

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/core/src/rules/seo/json-ld-required-props.ts`
- `packages/core/src/rule-options.ts`
- `packages/core/src/rules/architecture/reserved-name-placement.ts`
- `packages/core/test/seo-jsonld-rules.test.ts`
- `packages/core/test/rule-options.test.ts`
- `packages/core/test/reserved-name-placement.test.ts`
- `.changeset/`(新規 changeset 1 件、`@svelte-vitals/core` の patch)

**Out of scope**(触らない):

- `packages/core/src/rules/seo/jsonld-engine.ts` — `missingRequiredProps` に shape チェックを足すのは二重防御で、呼び出し側を直せば不要。
- `packages/cli/src/pkg-json.ts` の `hasDep`(全呼び出しがリテラル、到達不能)。
- `html-spec/` / `role-candidates.ts` / `casing.ts` / `heavy-import.ts` / `reserved-directory-names.ts` — 監査でガード済みと確認。
- ルール docs(en/ja)— 挙動の変化は「クラッシュ → 未知の型として無視」なので、docs の記述(unknown type は flag しない)はそのまま正しい。

## Git workflow

- Branch: `advisor/064-prototype-key-sweep`(`origin/main` から)
- Conventional commits、例: `fix(core): guard the remaining Object.prototype-keyed lookups (JSON-LD @type, rule options, placement values)`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: JSON-LD の失敗するテストを先に書く(TDD red)

`packages/core/test/seo-jsonld-rules.test.ts` の `seo/json-ld-required-props` の describe(316 行付近)に追加する。

```ts
it('seo/json-ld-required-props treats an Object.prototype-named @type as unknown instead of throwing', async () => {
  for (const type of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    const rs = await seoJsonLdRequiredProps.check(
      ctx(headWithJsonLd(`{"@context":"https://schema.org","@type":"${type}"}`))
    );
    expect(fails(rs)).toHaveLength(0);
  }
  // Same for the array form of @type.
  const rs = await seoJsonLdRequiredProps.check(
    ctx(
      headWithJsonLd(
        '{"@context":"https://schema.org","@type":["constructor","WebSite"],"name":"n","url":"https://e.com/"}'
      )
    )
  );
  expect(fails(rs)).toHaveLength(0);
});
```

`check` が throw する現状では `await` で reject し、テストは fail する。

**Verify**: `pnpm --filter @svelte-vitals/core run test -- seo-jsonld-rules` → 新ケースが **fail**(`Cannot read properties of undefined (reading 'filter')`)。

### Step 2: `REQUIRED_PROPS[t]` をガードする

`packages/core/src/rules/seo/json-ld-required-props.ts:15` を置き換える。

```ts
// `t` is the page's own @type string; an unguarded index would return Object.prototype members
// for names like `constructor` and crash the whole rule (a crashed rule drops out of scoring).
const required = Object.hasOwn(REQUIRED_PROPS, t) ? REQUIRED_PROPS[t] : undefined;
```

**Verify**: `pnpm --filter @svelte-vitals/core run test -- seo-jsonld-rules` → all pass。

### Step 3: rule options の失敗するテストを書き、ガードする(red → green)

`packages/core/test/rule-options.test.ts` の `describe('validateRuleOptions')`(92 行〜)に追加する。

```ts
it('rejects an Object.prototype-named option key as unknown, not as a wrong-typed option', () => {
  for (const key of ['constructor', 'toString', 'hasOwnProperty']) {
    const errors = validateRuleOptions('r', spec, { [key]: { a: 'b' } });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`unknown option '${key}'`);
  }
});
```

`describe('resolveRuleOptions')`(13 行〜)に、既存ケースの `spec` / `config` の作り方に合わせて追加する。

```ts
it('ignores an Object.prototype-named key in a layer instead of merging it in', () => {
  // resolveRuleOptions trusts validation, but the defensive `if (!s) continue` must hold for these names too.
  const resolved =
    resolveRuleOptions(/* same arguments the neighbouring cases use, with a layer { constructor: { z: 'y' } } */);
  expect(Object.hasOwn(resolved, 'constructor')).toBe(false);
});
```

引数の形は同じ describe 内の既存ケース(`resolveRuleOptions(ruleId, spec, config, compiledOverrides?)` 等)をそのままコピーして、layer にだけ `constructor` キーを足す。

**Verify(red)**: `pnpm --filter @svelte-vitals/core run test -- rule-options` → 2 ケースが **fail**(validate 側は `errors` が空、resolve 側は `constructor` が own property になる)。

`packages/core/src/rule-options.ts` の 2 箇所(`:132` と `:186`)を置き換える。

```ts
// Same presence rule as `isMentionedAnywhere` above: an inherited member is not a declared option.
const s = Object.hasOwn(spec, key) ? spec[key] : undefined;
```

**Verify(green)**: `pnpm --filter @svelte-vitals/core run test -- rule-options` → all pass。

### Step 4: reserved-name-placement の失敗するテストを書き、ガードする(red → green)

`packages/core/test/reserved-name-placement.test.ts` に、既存ケースのうち「`capitalisedUnitPlacements` を使うケース」を 1 つコピーし、次の形にする。

- config: `capitalisedUnitPlacements: { constructor: '<既存ケースと同じ glob>' }` のみ(`placements` と `anyCaseUnitPlacements` は宣言しない)。
- sourceFiles: 既存ケースのディレクトリ名を `constructor` に置き換える(例 `src/lib/constructor/index.ts`)。
- 期待: `check` が **resolve する**(throw しない)。findings の有無は問わない。`await expect(rule.check(ctx)).resolves.toBeDefined()` で十分。

**Verify(red)**: `pnpm --filter @svelte-vitals/core run test -- reserved-name-placement` → 新ケースが **fail**(`value.split is not a function …`)。

`packages/core/src/rules/architecture/reserved-name-placement.ts` の値読み 9 箇所(`:156-158`、`:181-183`、`:205-207`)を、存在フラグで守った読み方に変える。144-147 行の直後にヘルパを置く(名前は `Object.prototype` のメンバー名と被らないものにする。`valueOf` は不可)。

```ts
// The presence flags above are `Object.hasOwn`; the value reads must be too, or a name like
// `constructor` declared in one map reads Object.prototype's function out of the other two.
const declaredValue = (map: Record<string, string>, present: boolean): string | undefined =>
  present ? map[name] : undefined;
```

そして `placements[name]` → `declaredValue(placements, inPlacements)`、`capUnits[name]` → `declaredValue(capUnits, inCapUnits)`、`anyUnits[name]` → `declaredValue(anyUnits, inAnyUnits)` に、9 箇所すべてを置き換える(`:156-158` の `emptyValue(...)` 呼び出しは `present &&` で短絡しているので現状でも安全だが、生索引を 1 か所も残さないために同じ形に揃える。挙動は変わらない)。`placements` 等の実際の型名はファイル冒頭の宣言を確認して合わせること。

**Verify(green)**: `pnpm --filter @svelte-vitals/core run test -- reserved-name-placement` → all pass。

### Step 5: changeset を書き、最終検証

`.changeset/` に新規ファイル(例 `prototype-key-sweep.md`)。

```md
---
'@svelte-vitals/core': patch
---

Guard three remaining `Object.prototype`-keyed lookups. A page whose JSON-LD `@type` is a name like `constructor` no longer crashes `seo/json-ld-required-props` (a crashed rule drops out of scoring project-wide, raising Health); a rule option keyed by such a name is now rejected as `unknown option` instead of being accepted silently or reported with the wrong message; and `architecture/reserved-name-placement` no longer throws when a directory named like that is declared in only one of its placement maps.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。

## Test plan

- 新規 3 ケース(Step 1 / 3 / 4)。それぞれ対応する 1 行を revert すると赤に戻ることを一度確認する(判別性)。
- 既存の `seo-jsonld-rules` / `rule-options` / `reserved-name-placement` / `html-spec` のケースが無変更で通ること。
- kitchen-sink の e2e(`pnpm test` に含まれる)が期待件数のまま通ること。3 サイトとも「クラッシュ → 未検出」への変化なので既存の期待件数は動かないはず。動いたら STOP。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `grep -n "Object.hasOwn(REQUIRED_PROPS" packages/core/src/rules/seo/json-ld-required-props.ts` が 1 行ヒット
- [ ] `grep -c "Object.hasOwn(spec, key)" packages/core/src/rule-options.ts` が `2`
- [ ] `grep -nE "(placements|capUnits|anyUnits)\[name\]" packages/core/src/rules/architecture/reserved-name-placement.ts` のヒットが 0 行(ヘルパは引数名 `map` で読むので名前付き map の生索引は残らない)。`grep -c "\[name\]"` は `1`(`declaredValue` ヘルパ内)
- [ ] changeset に `__proto__` / `prototype pollution` の語が**含まれない**
- [ ] `plans/README.md` の 064 行を更新済み(260828-REV-01 を「064 で対応」に書き換え)

## Maintenance notes

- 「ソース由来の文字列で `Record<string, …>` を索引する」箇所を新たに書くときは `Object.hasOwn` ガードが規約。`isMentionedAnywhere`(`rule-options.ts:90-98`)のコメントが正典。
- `REQUIRED_PROPS` を `Map` に変えれば構造的に解決するが、`RequiredPropsByType` 型は `jsonld-engine.ts` の export であり他の JSON-LD ルールからも参照されるので、この計画では触らない。
- Svelte 5.57 自身にも `<constructor>` タグで throw する同型の穴がある(`svelte/src/html-tree-validation.js:68`)。`collectComponentFacts` が catch して `parseFailed` にするので svelte-vitals 側は安全。upstream 報告の候補として README に記録済み。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない。
- Step 1 のテストが修正前に**通る**(既にガードされている、または `typeOf` が変わった)。
- Step 4 で `reserved-name-placement.ts` の値読みが 9 箇所以外にもある(grep で確認して差分があれば報告)。
- kitchen-sink の期待件数が動く。
