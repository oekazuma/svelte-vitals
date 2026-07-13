# Plan 024: `svelte-vitals ci upgrade` — 生成済みワークフローの Action ピンだけを安全に更新する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e37dfb4..HEAD -- packages/cli/src/ci`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。
> (Plan 023 が先にマージされていても packages/cli/src/ci は不変のはず — 変わっていたら STOP。)

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW(既存ファイルの対象行のみを置換。`ci install` の挙動は不変)
- **Depends on**: none
- **Category**: dx / direction
- **Planned at**: commit `e37dfb4`, 2026-07-13

## Why this matters

`ci install` が生成するワークフローは `@svelte-vitals/action` を **SHA でピン**する
(サプライチェーン安全のため)。Action がリリースされるたびにピンは陳腐化するが、
現在の更新手段は `ci install --force` = **ファイル全体の再生成**しかなく、ユーザーが
ワークフローに加えたカスタマイズ(トリガー条件、追加 step 等)が消える。
`ci upgrade` は **Action 参照行だけ**を CLI 同梱の最新ピンへ置換する外科的コマンド。

決定済み設計(メンテナーがモデルに設計委任・2026-07-13):

1. ピンの供給源はネットワークではなく **CLI に焼き込まれた値**(`action-pin.generated.js`)。
   最新ピンが欲しければ `npx svelte-vitals@latest ci upgrade` — docs に明記。
2. 置換対象は `uses: oekazuma/svelte-vitals/packages/action@<sha>` にマッチする行**のみ**
   (行末のバージョンコメントごと更新)。複数行あれば全部置換(matrix 構成対応)。
3. `actions/checkout` 等**他のピンは触らない**(Renovate / ユーザー管轄)。
4. ワークフローが無い → exit 2 + `run \`svelte-vitals ci install\` first`の案内。
Action 参照行が無い → exit 2 + その旨(手書きワークフロー等)。
既に最新 →`already up to date (@svelte-vitals/action@X)` で exit 0。
5. `--dry-run` 対応(置換予定の before → after を表示して書かない)。

## Current state

- **ピンの定義**: `packages/cli/src/ci/cli.ts:6` —
  `import { ACTION_SHA, ACTION_VERSION } from './action-pin.generated.js';`
  (生成ファイル。**このファイル自体と生成機構は触らない**)。
- **サブコマンド分岐**: `packages/cli/src/ci/cli.ts:22-33` — `runCiCli(args, io = realIO())`。
  現在 `sub !== 'install'` は即ヘルプ + exit 2。ここに `upgrade` 分岐を足す。
  `CI_HELP`(cli.ts:8-20)に upgrade の Usage/説明を追記。
- **テンプレートの参照行**: `packages/cli/src/ci/workflow.ts:55` —
  `` `      - uses: oekazuma/svelte-vitals/packages/action@${actionSha} # @svelte-vitals/action@${actionVersion}` ``
  この形が置換対象の正。ただし upgrade はインデント・コメント有無に寛容な正規表現で
  マッチさせる(ユーザー編集後も動くこと)。
- **IO**: `InstallIO`(readFile/writeFile/log/errorLog、`realIO()`)を `ci install` と共有。
- **テストの流儀**: `packages/cli/test/ci/cli.test.ts`(メモリ IO 注入)、`workflow.test.ts`。

## Commands you will need

| Purpose   | Command                                                                                                                       | Expected on success |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm --filter "./packages/**" install`(action の依存が入らない場合は 4 パッケージへの --filter 個別指定で可)                 | exit 0              |
| Build     | `pnpm --filter svelte-vitals build`                                                                                           | exit 0              |
| Typecheck | `pnpm --filter svelte-vitals --filter @svelte-vitals/core --filter @svelte-vitals/mcp --filter @svelte-vitals/vite typecheck` | exit 0              |
| Tests     | `pnpm --filter svelte-vitals test`                                                                                            | all pass            |
| Lint      | `pnpm lint`                                                                                                                   | exit 0              |
| Changeset | 手書き(svelte-vitals: minor)                                                                                                  | ファイル生成        |

## Scope

**In scope**:

- `packages/cli/src/ci/upgrade.ts`(新規: 置換ロジック)
- `packages/cli/src/ci/cli.ts`(`upgrade` 分岐 + ヘルプ)
- `packages/cli/src/bin.ts`(トップレベルヘルプの ci 行に upgrade を併記 — 1 行)
- `packages/cli/test/ci/upgrade.test.ts`(新規)、`cli.test.ts`(ケース追加)
- `docs/src/content/docs/guides/ci.md` + `ja/guides/ci.md`(upgrade 節)
- `.changeset/`

**Out of scope**:

- `packages/cli/src/ci/workflow.ts` / `action-pin.generated.js` とその生成機構 — 読むだけ。
- `actions/checkout` 等、`@svelte-vitals/action` 以外のピンの更新。
- ネットワークからの最新バージョン取得。
- `packages/action` そのもの。

## Git workflow

- Branch: `advisor/024-ci-upgrade`
- Conventional commits、例: `feat(cli): add \`ci upgrade\` to refresh the pinned action in an existing workflow`
- PR 本文は英語。push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `packages/cli/src/ci/upgrade.ts`(新規)

```ts
export interface UpgradeOutcome {
  status: 'upgraded' | 'up-to-date' | 'no-reference';
  /** status='upgraded' のとき: 置換後の全文。 */
  content?: string;
  /** 置換した行数と、検出できた旧バージョン(コメントから。無ければ旧 SHA 短縮形)。 */
  replaced?: number;
  from?: string;
}

/**
 * `content` 内の `uses: oekazuma/svelte-vitals/packages/action@<ref>` 行(インデント・
 * 行末コメントは任意)をすべて `@{sha} # @svelte-vitals/action@{version}` 形式に置換する。
 * 対象行が無ければ 'no-reference'、全行がすでに {sha} なら 'up-to-date'。
 */
export function upgradeActionPin(content: string, sha: string, version: string): UpgradeOutcome;
```

- 正規表現の要件: `uses:` の前の任意インデント、`@` 以降は空白/`#` までの任意文字列、
  行末コメントは有無どちらも可。行末の改行スタイルを保持(置換は行内のみ)。
- `from` はマッチ行の `# @svelte-vitals/action@X` コメントから拾う。コメントが無ければ
  旧 ref の先頭 7 文字。複数行で異なる旧値が混在する場合は最初の1つで良い。

**Verify**: 4 パッケージスコープの typecheck → exit 0

### Step 2: `cli.ts` に `upgrade` 分岐

- `sub === 'upgrade'` を追加(mri: `--dry-run` のみ。`--force` は不要 — 対象行しか触らない)。
- フロー: `io.readFile(WORKFLOW_PATH)` →
  無ければ `svelte-vitals: no ${WORKFLOW_PATH} found — run \`svelte-vitals ci install\` first.`で exit 2 →`upgradeActionPin(content, ACTION_SHA, ACTION_VERSION)` →
  - `no-reference`: `svelte-vitals: no @svelte-vitals/action reference found in ${WORKFLOW_PATH}.` exit 2
  - `up-to-date`: `= already up to date (@svelte-vitals/action@${ACTION_VERSION}).` exit 0
  - `upgraded`: `--dry-run` なら before→after の対象行を表示して exit 0、それ以外は書き込み
    `✓ upgraded @svelte-vitals/action: ${from} → ${ACTION_VERSION} (${replaced} line(s)).` exit 0
- `CI_HELP` を更新(Usage に `svelte-vitals ci upgrade [--dry-run]`、説明 1〜2 行 —
  「CLI 同梱のピンを使う。最新にするには `npx svelte-vitals@latest ci upgrade`」)。
- `bin.ts` のトップレベルヘルプの ci 行を
  `svelte-vitals ci <install|upgrade>  …` の形に更新(実ファイルの現行文言に合わせて最小変更)。

**Verify**: `pnpm --filter svelte-vitals build && node packages/cli/dist/bin.js ci upgrade` を
ワークフロー無しの一時ディレクトリで → exit 2 + install 案内

### Step 3: テスト

- `upgrade.test.ts`(ユニット): 置換(コメント付き/無し/インデント差/複数行)、
  up-to-date、no-reference、他の `uses:` 行(actions/checkout 等)が**不変**であること、
  ユーザー追記行が保持されること。
- `cli.test.ts` 追加: upgrade の 4 経路(no file / no-reference / up-to-date / upgraded)+
  dry-run で書かれないこと。`buildWorkflowYaml` の出力を旧 SHA に書き換えた文字列を
  fixture にすると現実的。

**Verify**: `pnpm --filter svelte-vitals test` → all pass

### Step 4: docs + changeset

- `guides/ci.md`(+ja)に「Upgrading the pinned action」節: `ci upgrade` の使い方、
  ピンは CLI 同梱値であること、`ci install --force`(全再生成)との違い。
- changeset: svelte-vitals minor(英語)。

**Verify**: `pnpm --filter svelte-vitals build && 4パッケージ typecheck && pnpm --filter svelte-vitals test && pnpm lint` → すべて exit 0

## Done criteria

- [ ] 上記 verify チェーンすべて exit 0
- [ ] ユニット+CLI テストで 4 経路と「他行不変」「カスタマイズ保持」が固定されている
- [ ] 一時ディレクトリで `ci install` → 生成 YAML の SHA を手で旧値に書き換え → `ci upgrade` で
      その行だけ復元される(実機確認)
- [ ] docs(en/ja)+ changeset が揃っている
- [ ] In scope 外のファイルに変更がない(`git status`)

## STOP conditions

- `action-pin.generated.js` が存在しない/export 名が違う(生成機構が変わった)。
- `runCiCli` の構造が本計画の想定と大きく異なる。
- 検証コマンドが修正 1 回を挟んで 2 回失敗した。

## Maintenance notes

- ピン供給は CLI 焼き込み値のみ(設計判断)。「ネットワークで最新タグを引く」要望が来たら
  オプトインフラグとして別途設計。
- Renovate が生成済みワークフローの SHA を直接更新するユーザーもいる — `ci upgrade` は
  それと競合しない(同じ行を同じ形式に保つ)。
- `install --refresh`(Plan 025 予定)とは別物: あちらはエージェントスキルファイルの再生成。
