# Plan 032: `ci upgrade` が YAML アンカー付き `uses:` 行を扱えるようにする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- packages/cli/src/ci/upgrade.ts packages/cli/test/ci/upgrade.test.ts`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(正規表現1箇所の拡張 + テスト追加。既存のマッチ対象は変わらず、
  マッチ範囲が広がるだけ)
- **Depends on**: none
- **Category**: bug / tests
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

`svelte-vitals ci upgrade` は生成済みワークフローの `uses: oekazuma/svelte-vitals/packages/action@<ref>`
行だけを外科的に書き換える。現在の正規表現 `ACTION_USES_LINE` は `uses:\s*` の直後に
リテラルのパッケージパスが**そのまま**続くことを前提にしており、YAML のアンカー構文
(`uses: &vitals_action oekazuma/svelte-vitals/packages/action@<ref>`)を使って複数
ジョブで同じピンを共有しているワークフローでは、この行にマッチしない。

実際に確認した挙動: このアンカー付き行が唯一の `@svelte-vitals/action` 参照だった
場合、`replaced === 0` になったあと `hasAnyReference` の判定も同じ正規表現を使うため
false になり、`upgradeActionPin` は `{ status: 'no-reference' }` を返す —
`packages/cli/src/ci/cli.ts:108-111` はこれを「ワークフローに参照が存在しない」という
エラーメッセージ(`svelte-vitals: no @svelte-vitals/action reference found in
...`、exit 2)として扱う。ユーザーは実際にはアンカーで正しく参照しているにも関わらず、
`ci upgrade` が使えないという誤った診断を受け取る。

修正方針: YAML のアンカー(`&name`)はキーの値ノード全体に付けられるものであり、
同じアンカーを参照する `*name` エイリアス行は、実行時に YAML パーサーがアンカー側の
値をそのまま展開する。つまり **アンカー定義行の値だけを書き換えれば、それを参照する
すべての `*name` エイリアス行も自動的に新しい値になる**(このツールはテキスト単位の
書き換えであり、エイリアス行自体のテキストを書き換える必要はない)。したがって、
このプランの修正は「アンカー定義行にもマッチするよう正規表現を拡張する」だけで、
アンカーを使ったワークフロー全体が正しく更新される。

## Current state

`packages/cli/src/ci/upgrade.ts:16-17`(現在の正規表現、全文中の該当部分):

```ts
const ACTION_USES_LINE =
  /^(?<indent>\s*-\s*uses:\s*oekazuma\/svelte-vitals\/packages\/action@)(?<ref>[^\s#]+)(?<comment>\s*#.*)?$/;
```

このパターンでは以下の行にマッチしない:

```yaml
      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # @svelte-vitals/action@1.0.0
```

`upgradeActionPin` の全文は既に把握済み(24-57行目)—
`lines.map(...)` で各行に対して正規表現をテストし、マッチした行だけ `indent + sha +
comment` で再構築する。`indent` グループが `uses:` からパッケージパス直前までを丸ごと
キャプチャしているため、このグループの定義を広げるだけで再構築ロジック自体は変更不要。

`packages/cli/src/ci/cli.ts:108-111`(このバグが表面化する箇所):

```ts
  if (outcome.status === 'no-reference') {
    io.errorLog(`svelte-vitals: no @svelte-vitals/action reference found in ${WORKFLOW_PATH}.`);
    return 2;
  }
```

## Commands you will need

| Purpose   | Command                                              | Expected on success |
| --------- | ------------------------------------------------------ | -------------------- |
| Tests     | `pnpm --filter svelte-vitals test`                    | all pass              |
| Typecheck | `pnpm --filter svelte-vitals typecheck`               | exit 0                |
| Lint      | `pnpm lint`                                             | exit 0                |

## Scope

**In scope**:

- `packages/cli/src/ci/upgrade.ts`(`ACTION_USES_LINE` 正規表現の拡張のみ)
- `packages/cli/test/ci/upgrade.test.ts`(新規テストケース追加)

**Out of scope**:

- `*alias` のみでアンカー定義自体が別ファイル/別箇所になく解決できないような壊れた
  YAML の扱い(そもそも invalid な YAML であり、このツールの責務外)。
- `packages/cli/src/ci/workflow.ts`(生成されるワークフローのテンプレート自体は
  アンカーを使わない — このプランは「ユーザーが手で YAML アンカーに書き換えた
  ワークフロー」を後から `ci upgrade` するケースへの対応)。
- `ACTION_USES_LINE` 以外の正規表現・ロジック。

## Git workflow

- Branch: `advisor/032-ci-upgrade-yaml-anchor-support`
- コミット: `fix(cli): let ci upgrade rewrite YAML-anchored uses: lines`(英語、
  1コミットでよい)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 正規表現を拡張する

`packages/cli/src/ci/upgrade.ts` の `ACTION_USES_LINE` を、`uses:\s*` とリテラル
パッケージパスの間に任意の `&anchor-name\s+` を許容するよう変更する:

```ts
// Matches lines like (indentation, an optional YAML anchor `&name`, and the trailing
// version comment, are all optional so a user's hand-edited workflow still matches):
//   - uses: oekazuma/svelte-vitals/packages/action@<ref>
//   - uses: oekazuma/svelte-vitals/packages/action@<ref> # @svelte-vitals/action@1.2.3
//   - uses: &vitals_action oekazuma/svelte-vitals/packages/action@<ref> # @svelte-vitals/action@1.2.3
// An anchor definition's value is shared by every `*name` alias line elsewhere in the
// file (YAML semantics) — rewriting only the anchor line's ref is sufficient; alias
// lines need no separate rewrite.
const ACTION_USES_LINE =
  /^(?<indent>\s*-\s*uses:\s*(?:&\S+\s+)?oekazuma\/svelte-vitals\/packages\/action@)(?<ref>[^\s#]+)(?<comment>\s*#.*)?$/;
```

`indent` グループが `&anchor-name ` を含めて丸ごとキャプチャするため、
`upgradeActionPin` 内の再構築ロジック(`${indent}${sha} # @svelte-vitals/action@${version}${eol}`)
は変更不要 — アンカー名がそのまま保持される。

**Verify**: `pnpm --filter svelte-vitals typecheck` → exit 0(正規表現の変更のみで
型に影響はないはずだが、念のため確認)。

### Step 2: テストを追加する

`packages/cli/test/ci/upgrade.test.ts` に以下のケースを追加する(既存のテストの
末尾、`describe('upgradeActionPin', ...)` ブロック内):

```ts
  it('rewrites an anchor-defined uses: line, preserving the anchor name', () => {
    const content = [
      'jobs:',
      '  a:',
      '    steps:',
      `      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@${OLD_SHA} # @svelte-vitals/action@1.0.0`,
      '  b:',
      '    steps:',
      '      - uses: *vitals_action'
    ].join('\n');

    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.replaced).toBe(1);
    expect(outcome.from).toBe('1.0.0');
    expect(outcome.content).toContain(
      `      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`
    );
    // The alias line itself has no literal ref to rewrite — a YAML parser resolves it
    // to the anchor's (now-updated) value at parse time, so it's correctly left as-is.
    expect(outcome.content).toContain('      - uses: *vitals_action');
  });

  it('rewrites an anchor-defined uses: line with no trailing comment', () => {
    const content = `      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@${OLD_SHA}`;
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome.status).toBe('upgraded');
    expect(outcome.from).toBe(OLD_SHA.slice(0, 7));
    expect(outcome.content).toBe(
      `      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`
    );
  });

  it('reports up-to-date for an anchor-defined line already pinned to the current sha', () => {
    const content = `      - uses: &vitals_action oekazuma/svelte-vitals/packages/action@${NEW_SHA} # @svelte-vitals/action@2.0.0`;
    const outcome = upgradeActionPin(content, NEW_SHA, '2.0.0');

    expect(outcome).toEqual({ status: 'up-to-date' });
  });
```

**Verify**: `pnpm --filter svelte-vitals test` → all pass、既存の全ケース(CRLF・
matrix・actions/checkout 非干渉など)も引き続き green であること。

### Step 3: 全体検証

**Verify**: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals test && pnpm lint`
→ 全て exit 0 / all pass。

## Test plan

- 新規: アンカー定義行の書き換え(コメントあり/なし)、`*alias` 行が触れられず
  残ること、既に最新 SHA にピンされたアンカー行での `up-to-date` 判定 —
  上記3ケース。
- 既存: `upgrade.test.ts` の全12ケース(CRLF・matrix・actions/checkout 非干渉含む)
  が変更後も green であること。
- 検証: `pnpm --filter svelte-vitals test` → all pass。

## Done criteria

- [ ] `ACTION_USES_LINE` がアンカー付き `uses:` 行にマッチする
- [ ] 新規3テストケースが green
- [ ] 既存の `upgrade.test.ts` 全ケースが変更後も green
- [ ] `pnpm --filter svelte-vitals typecheck` が exit 0
- [ ] `pnpm lint` が exit 0
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- 正規表現の変更によって既存テスト(特に `actions/checkout` の行を誤ってマッチしない
  ことを確認するテスト)が壊れた場合、`(?:&\S+\s+)?` の非捕捉グループの範囲を見直し、
  それでも解決しなければ STOP。
- テスト追加後、検証コマンドが修正1回を挟んで2回失敗した場合。

## Maintenance notes

- 今後 `ACTION_USES_LINE` をさらに拡張する場合(例: 複数行にまたがる YAML flow
  styleなど)は、まず実際にそのような手書きワークフローが issue や PR で報告されて
  から対応する — 今回のアンカー対応は「YAML の一般的な機能」という広く使われる
  パターンへの対応であり、それ以上の speculative な拡張はスコープ外。
- `packages/cli/src/ci/workflow.ts`(生成テンプレート側)は引き続きアンカーを使わない
  シンプルな形を維持してよい — アンカーはユーザーが自分のワークフローを手で最適化
  した結果として現れるものであり、生成側で導入する必要はない。
