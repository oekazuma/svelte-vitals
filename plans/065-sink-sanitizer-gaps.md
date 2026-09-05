# Plan 065: 解析対象由来の文字列が素通りする 2 つの出力シンクを塞ぐ(`@clack/prompts` の `terminalSafe` 未適用、SARIF `artifactLocation.uri` の未エンコード)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/cli/src/install/cli.ts packages/cli/src/gunshi/analyze.ts packages/core/src/reporter/sarif.ts packages/cli/test/install/cli.test.ts packages/core/test/sarif-report.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                                                                   |
| -------- | ------ | ---- | ---------- | -------- | ---------------------------------------------------------------------------- |
| P1       | S      | LOW  | none       | security | commit `13aa7ad0`(= `origin/main` `d3828d9e` と同内容のファイル)、2026-09-03 |

## Why this matters

2 つとも「解析対象リポジトリ由来の文字列を、そのシンクの文法で無害化せずに出力している」クラスで、同クラスは PR #617 / #618 / #623 で他のシンクについて閉じてきた。残っているのがこの 2 つ。

### A. `@clack/prompts` の対話プロンプト

CLI の端末出力は `terminalSafe`(`packages/core/src/reporter/sanitize.ts`、C0/C1/OSC/CSI を剥がす)を境界にしている。`cli-io.ts:17`、`bin.ts:16`、`install/cli.ts:26-27`(`log` / `errorLog`)、`frame-writer.ts:71` などが全てラップ済み。**例外が `@clack/prompts` に渡す文字列**で、次の 3 サイトが未適用である。

1. `packages/cli/src/install/cli.ts:54` の `selectAppPrompt` — `options: apps.map((a) => ({ value: a, label: a }))`。`apps` は `discoverApps` がファイルシステムから拾った**ディレクトリ名そのまま**。
2. `packages/cli/src/install/cli.ts:80` の `confirm` — `message: \`Apply this plan?\n${planText}\``。`planText`は`install/index.ts`の`rowLine`が`r.path` と(manual 行では)`r.snippet` を連結したもの。
3. `packages/cli/src/gunshi/analyze.ts:27` の `selectApp` — 1 と同じ `selectAppPrompt` を、`install` ではない通常解析の monorepo ピッカーで呼ぶ。

POSIX のディレクトリ名はほぼ任意のバイトを許すので、エスケープシーケンスを含む名前のディレクトリを持つリポジトリで `svelte-vitals`(monorepo)や `svelte-vitals install` を対話実行すると、端末タイトルの書き換え・カーソル移動・「yes」と答えようとしているプロンプト文の上書きがそのまま起きる。1 は `selectAppPrompt` の中で一度サニタイズすれば 3 も直る。**`value` はサニタイズしない**(選択結果として返す実パスが化けるため)。`label` と `message` だけを対象にする。

### B. SARIF の `artifactLocation.uri`

`packages/core/src/reporter/sarif.ts:58` は `artifactLocation: { uri: r.location }` と生のパスを入れる。SARIF 2.1.0 の `uri` は URI reference なので、`#` はフラグメント、`%` はパーセントエスケープとして解釈され、空白や非 ASCII(日本語のファイル名はこのプロジェクトが他所で明示的に扱っている)は不正になる。GitHub code scanning はアラートを誤ったファイルに付けるか、アップロードを拒否する。どちらも**静かに finding が security タブから消える**失敗になる。他のレポーターは自分の文法で `location` を無害化している(`github.ts:28` の `escapeProp`、`markdown.ts:118` の `escapeCell`)ので、SARIF だけが例外。

`partialFingerprints`(`sarif.ts:51`)には**触らない**。その文字列の形式を変えると GitHub 上で既存ユーザー全員のアラート同一性がリセットされる。

## Current state

- `packages/cli/src/install/cli.ts:1-6`(import): `import * as p from '@clack/prompts';` と `import { terminalSafe } from '@svelte-vitals/core/internal';` が既にある。

- `packages/cli/src/install/cli.ts:49-56`:

  ```ts
  /** Single-select app picker via @clack/prompts — shared with bin.ts's monorepo analyzer picker. Returns null when cancelled. */
  export async function selectAppPrompt(apps: string[], message: string): Promise<string | null> {
    const res = await p.select({
      message,
      options: apps.map((a) => ({ value: a, label: a })),
      initialValue: apps[0]
    });
    return p.isCancel(res) ? null : (res as string);
  }
  ```

- `packages/cli/src/install/cli.ts:77-82`:

  ```ts
  confirm: async (planText: string) => {
    const res = await p.confirm({ message: `Apply this plan?\n${planText}` });
    return p.isCancel(res) ? false : Boolean(res);
  };
  ```

- `packages/cli/src/gunshi/analyze.ts:25-28`: `selectApp(apps)` → `selectAppPrompt(apps, 'Multiple SvelteKit apps found — which one should svelte-vitals analyze?')`。`message` は定数。

- `packages/cli/test/install/cli.test.ts:18-45` — `realIO().log / errorLog` が `console.log` / `console.error` を `vi.spyOn` して、`'a\x1b]0;evil\x07b'` が `'ab'` になることと `\n` / `\t` が保存されることを pin している。`@clack/prompts` のモックはこのファイルにはない(`vi.mock('@clack/prompts', …)` を新設する)。

- `packages/core/src/reporter/sarif.ts:45-62`:

  ```ts
  const result: SarifResult = {
    ruleId: r.id,
    ruleIndex: ruleIndex.get(r.id)!,
    level: severityToSarifLevel(effectiveSeverity(r, config)),
    message: { text: messageText(r) },
    partialFingerprints: {
      'svelteVitals/v1': `${r.id}:${r.route ?? 'project'}${r.line !== undefined ? `:${r.location ?? ''}:${r.line}` : ''}`
    }
  };
  if (r.location) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: { uri: r.location },
          ...(r.line !== undefined ? { region: { startLine: r.line } } : {})
        }
      }
    ];
  ```

- `packages/core/test/sarif-report.test.ts:68-72` — `uri` が `'src/routes/none/+page.svelte'` であることを assert(エンコード不要な文字だけ)。`results` フィクスチャは 7-20 行。

- `terminalSafe` の性質(`packages/core/test/sanitize.test.ts` で pin 済み): `\n` と `\t` は保存、ESC / C1 / OSC / CSI は除去。

## Commands you will need

| Purpose    | Command                                                  | Expected on success |
| ---------- | -------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                           | exit 0              |
| Core tests | `pnpm --filter @svelte-vitals/core run test`             | all pass            |
| CLI tests  | `pnpm build && pnpm --filter svelte-vitals run test`     | all pass            |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint` | 全て exit 0         |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/cli/src/install/cli.ts`(`selectAppPrompt` の `label`、`confirm` の `message`)
- `packages/cli/test/install/prompts.test.ts`(新規。`@clack/prompts` のモジュールモックを他のケースから隔離するため)
- `packages/core/src/reporter/sarif.ts`(`uri` のエンコード)
- `packages/core/test/sarif-report.test.ts`(テスト追加)
- `.changeset/`(新規 changeset 1 件、`svelte-vitals` と `@svelte-vitals/core` の patch)

**Out of scope**(触らない):

- `packages/cli/src/gunshi/analyze.ts` — `selectAppPrompt` 内で直るので変更不要。
- `partialFingerprints` の形式。
- `packages/core/src/reporter/agent.ts:55` の固定フェンス(既知、現状到達不能)。
- `@clack/prompts` の `groupMultiselect`(`install/cli.ts:60-75`)— `label` / `hint` は svelte-vitals 自身の定数(`SelectableOption`)なので対象外。

## Git workflow

- Branch: `advisor/065-sink-sanitizer-gaps`(`origin/main` から)
- Conventional commits、例: `fix(cli,core): sanitize prompt labels with terminalSafe and URI-encode SARIF artifact locations`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: プロンプト側の失敗するテストを書く(TDD red)

`@clack/prompts` のモジュールレベルのモックは同じファイルの全ケースに効くので、`install/cli.test.ts`(`runInstallCliGunshi` を実行するケースを含む)には足さず、**新規ファイル** `packages/cli/test/install/prompts.test.ts` を作る。先頭でモックを宣言する(vitest はモックを hoist する)。

```ts
const { selectSpy, confirmSpy } = vi.hoisted(() => ({
  selectSpy: vi.fn(async (opts: { options: { value: string; label: string }[] }) => opts.options[0]!.value),
  confirmSpy: vi.fn(async () => true)
}));
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clack/prompts')>();
  return { ...actual, select: selectSpy, confirm: confirmSpy, isCancel: () => false };
});
```

`import { selectAppPrompt, clackPrompts } from '../../src/install/cli.js';` を置き、describe を書く。

```ts
describe('clack prompt strings are terminalSafe', () => {
  const escaped = 'apps/\x1b]0;evil\x07web';

  it('selectAppPrompt sanitizes labels but returns the raw directory name as the value', async () => {
    const picked = await selectAppPrompt([escaped, 'apps/api'], 'pick');
    const opts = selectSpy.mock.calls[0]![0].options;
    expect(opts[0]!.label).toBe('apps/web');
    expect(opts[0]!.value).toBe(escaped);
    expect(picked).toBe(escaped);
  });

  it('confirm sanitizes the plan text and keeps its newlines', async () => {
    await clackPrompts().confirm('row 1\n' + escaped + '\nrow 3');
    const message = (confirmSpy.mock.calls[0]![0] as { message: string }).message;
    expect(message).toBe('Apply this plan?\nrow 1\napps/web\nrow 3');
  });
});
```

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test -- install/prompts` → 2 ケースが **fail**(`label` と `message` にエスケープが残る)。`install/cli.test.ts` の既存ケースは無変更で pass。

### Step 2: `label` と `message` を `terminalSafe` でラップする

`packages/cli/src/install/cli.ts` の 2 箇所を変える。

```ts
// `apps` are directory names straight off the filesystem: sanitize what clack renders, never
// the `value` — that is the path the caller goes on to use.
options: apps.map((a) => ({ value: a, label: terminalSafe(a) })),
```

```ts
// planText carries analyzed-repo paths and manual-row snippets; same boundary as log/errorLog above.
const res = await p.confirm({ message: `Apply this plan?\n${terminalSafe(planText)}` });
```

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test` → all pass。

### Step 3: SARIF 側の失敗するテストを書く(TDD red)

`packages/core/test/sarif-report.test.ts` に追加する。既存の `results` フィクスチャの 1 件目をコピーして `location` を差し替えたローカル配列を使う。

```ts
it('URI-encodes artifactLocation.uri per path segment, keeping the separators', () => {
  const tricky: Result[] = [{ ...results[0]!, location: 'src/routes/a b/#tag/100%/ページ/+page.svelte' }];
  const run = JSON.parse(formatSarifReport(tricky, config, { version: '0.0.0' })).runs[0];
  expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
    'src/routes/a%20b/%23tag/100%25/%E3%83%9A%E3%83%BC%E3%82%B8/+page.svelte'
  );
  // The fingerprint keeps the raw path: changing its format would reset alert identity on GitHub.
  expect(run.results[0].partialFingerprints['svelteVitals/v1']).toBe('seo/title-presence:/none');
});
```

`results[0]` に `line` があるかを確認し、ある場合はフィンガープリントの期待値を既存の 76 行のケースに合わせる(`line` があれば `:${location}:${line}` が付く。**生の `location`** のまま)。

**Verify**: `pnpm --filter @svelte-vitals/core run test -- sarif-report` → 新ケースが **fail**(`uri` が生のまま)。

### Step 4: `uri` をセグメントごとにエンコードする

`packages/core/src/reporter/sarif.ts` にヘルパを足し、58 行で使う。

```ts
/**
 * SARIF `artifactLocation.uri` is a URI reference: `#`, `?`, `%`, spaces and non-ASCII in a raw
 * path would be read as fragment/query/escape/invalid and mis-attribute (or drop) the alert in
 * code scanning. `encodeURI` keeps `/` and `+` (both legal in a path, and `+page.svelte` is every
 * SvelteKit route) but leaves `#` and `?` alone, so those two are encoded explicitly.
 */
function toArtifactUri(location: string): string {
  return encodeURI(location).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
```

```ts
artifactLocation: { uri: toArtifactUri(r.location) },
```

`encodeURIComponent` を使わないのは、`+` を `%2B` にすると全 SvelteKit ユーザーの SARIF 出力が変わり、`%2B` を decode しない consumer で誤帰属するため。監査時の実測(Node 24): 上の関数は `src/routes/a b/#tag/100%/ページ/+page.svelte` を Step 3 の期待値どおりに変換し、`src/routes/none/+page.svelte` は**そのまま**返す。

**Verify**: `pnpm --filter @svelte-vitals/core run test -- sarif-report` → all pass(68-72 行の既存ケース `src/routes/none/+page.svelte` は無変更のまま通る)。

### Step 5: changeset を書き、最終検証

`.changeset/` に新規ファイル(例 `sink-sanitizer-gaps.md`)。

```md
---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

Sanitize the two remaining output sinks that carried analyzed-repo strings raw. The interactive app picker and the install plan confirmation now pass directory names and plan text through `terminalSafe` before `@clack/prompts` renders them (the selected value is still the raw path). The SARIF reporter now URI-encodes `artifactLocation.uri`, so a path with `#`, `?`, `%`, spaces or non-ASCII characters attaches the alert to the right file in code scanning; plain ASCII paths such as `src/routes/+page.svelte` are unchanged. `partialFingerprints` are unchanged, so existing alert identities are preserved.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。

## Test plan

- 新規: プロンプト 2 ケース(`label` は無害化・`value` は生のまま、`message` は無害化かつ改行保持)、SARIF 1 ケース(エンコード + フィンガープリント不変)。
- 既存: `sarif-report.test.ts` の `uri` 期待値(`src/routes/none/+page.svelte`)は無変更で通ること。
- 判別性: Step 2 / Step 4 をそれぞれ revert して対応ケースだけが赤になることを確認する。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `grep -c "terminalSafe(" packages/cli/src/install/cli.ts` が `6`(既存 4: log / errorLog / runCommand の 2 つ、追加 2: label / planText)
- [ ] `grep -n "toArtifactUri" packages/core/src/reporter/sarif.ts` が定義 1 + 使用 1 の 2 行
- [ ] `git diff origin/main -- packages/core/src/reporter/sarif.ts | grep partialFingerprints` が空(フィンガープリント行に差分なし)
- [ ] `plans/README.md` の 065 行を更新済み

## Maintenance notes

- `@clack/prompts` に渡す文字列を新たに増やすときは、解析対象由来かどうかを見て `terminalSafe` を通す。`value` はサニタイズしない。
- SARIF の `uri` は ASCII の通常パスでは変わらない。`#` / `?` / `%` / 空白 / 非 ASCII を含むパスだけがエンコードされる。`encodeURIComponent` に変えると `+page.svelte` が全ルートで `%2Bpage.svelte` になるので、変えない。
- `partialFingerprints` の形式は互換性の契約。変えるときは新しいキー(`svelteVitals/v2`)を**追加**し、v1 を残す。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない。
- `@clack/prompts` のモックで `select` / `confirm` が呼ばれない(clack の API 形が変わっている)。
- SARIF の既存テストで `uri` 以外の期待値が動く。
