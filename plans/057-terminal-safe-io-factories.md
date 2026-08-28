# Plan 057: CLI の生 console 出力を IO ファクトリで `terminalSafe` 化する(`install` 系と最終 catch の残穴)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 690dd5e4..HEAD -- packages/cli/src/cli-io.ts packages/cli/src/install/cli.ts packages/cli/src/bin.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P1       | S      | LOW  | none       | security | commit `690dd5e4`, 2026-08-28 |

## Why this matters

解析対象リポジトリ由来の文字列(パス、ディレクトリ名、fs エラーメッセージに埋まるパス)は端末エスケープシーケンスを運べるため、PR #465/#473 で console reporter と `run()` の stderr は `terminalSafe` 化された。しかし `install` コマンド一族と `bin.ts` の最終 catch は生の `console.log`/`console.error` のままで、たとえば `svelte-vitals install` をクローンした repo で実行するだけ(解析も config 実行も不要)で、ディレクトリ名に仕込まれた ANSI/OSC がターミナルタイトル書き換え等として届く。修正は呼び出し箇所ごとではなく IO ファクトリ 2 つ+catch 1 箇所で済み、`install`/`docs`/`explain`/`ci`/`complete` が一括で直る。

## Current state

- `packages/cli/src/cli-io.ts`(全 10 行、HEAD の実コード) — 生 console のファクトリ その 1:

  ```ts
  /** Output sink for the read-only subcommands. Narrower than `InstallIO` — no filesystem access. */
  export interface CliIO {
    log(line: string): void;
    errorLog(line: string): void;
  }

  export const consoleIO: CliIO = {
    log: (line) => console.log(line),
    errorLog: (line) => console.error(line)
  };
  ```

  `runCli`(`packages/cli/src/cli.ts:32-35`)のデフォルト io がこれで、`docs`/`explain`/`complete` と最終 catch(`cli.ts:74` 付近の `io.errorLog(...)`)がここを通る。

- `packages/cli/src/install/cli.ts:25-26` — 生 console のファクトリ その 2(`realIO()` 内):

  ```ts
  log: (line) => console.log(line),
  errorLog: (line) => console.error(line),
  ```

  さらに同ファイル `runCommand` 内に生 `console.error` が 2 箇所ある(`${command} failed to start: ${result.error.message}` と `was terminated (${result.signal})`)。`command` は固定マップ由来だが `result.error.message` はパスを含みうるので同様に包む。

- 汚染源の例(このファクトリを通る): `packages/cli/src/install/index.ts:397,408-409` — `discoverApps` がグロブで拾ったディレクトリ名を `io.errorLog` に補間(`detected SvelteKit app at ${apps[0]}` / `multiple SvelteKit apps found: ${apps.join(', ')}`)。同 `:234,265,504` 付近では fs エラーの `err.message`(Node がパスをそのまま埋める)を出力。

- `packages/cli/src/bin.ts:14-17` — プロセス最終 catch も生:

  ```ts
  main().catch((err: unknown) => {
    console.error(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  });
  ```

- `terminalSafe` は core から export 済みで cli から import 実績あり(`packages/core/src/internal.ts:84` の `export { terminalSafe } from './reporter/sanitize.js';`、`packages/cli/src/frame-writer.ts:1` の `import { terminalSafe } from '@svelte-vitals/core/internal';`)。

- 既存の per-call ラッパー(残す): `packages/cli/src/index.ts` の `run()`(~515-519 行)と `applyScope`(~422-424 行)は既に `rawErrorLog` を `terminalSafe` で包んでいる。ファクトリ側を包んでも二重適用は無害(`terminalSafe` は冪等: 除去後の文字列に除去対象は残らない)なので、**この計画では index.ts を触らない**(belt-and-braces として残す方が diff が小さい)。

- `frame-writer.ts` は既に自前で sanitize している(スコープ外、二重化しない)。

## Commands you will need

| Purpose   | Command                                | Expected on success |
| --------- | -------------------------------------- | ------------------- |
| Install   | `pnpm install`                         | exit 0              |
| Build     | `pnpm build`                           | exit 0              |
| CLI tests | `pnpm --filter svelte-vitals run test` | all pass            |
| Full      | `pnpm test && pnpm lint`               | exit 0              |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/cli/src/cli-io.ts`
- `packages/cli/src/install/cli.ts`
- `packages/cli/src/bin.ts`
- `packages/cli/test/` 配下の新規または既存テスト 1 ファイル(サニタイズの回帰テスト)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/cli/src/index.ts` — 既存の per-call `terminalSafe` はそのまま残す(上記の判断を Current state に記載済み)。
- `packages/cli/src/frame-writer.ts` — 既に sanitize 済み。二重化しない。
- `packages/vite/` の console サイト — 別所見(260828-DEBT-14)。
- `terminalSafe` 自体の実装(`packages/core/src/reporter/sanitize.ts`)。

## Git workflow

- Branch: `advisor/057-terminal-safe-io-factories`
- Conventional commits、例: `fix(cli): sanitize install/docs/ci stderr and the last-resort catch with terminalSafe`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `consoleIO` を包む

`packages/cli/src/cli-io.ts` に `import { terminalSafe } from '@svelte-vitals/core/internal';` を追加し、両 sink を `console.log(terminalSafe(line))` / `console.error(terminalSafe(line))` にする。既存 doc コメントに続けて、包む理由の 1 行(英語。例: "Analyzed-repo strings (paths, fs error messages) reach these sinks — same threat model as reporter/sanitize.ts")を添える。

**Verify**: `pnpm --filter svelte-vitals run typecheck` → exit 0

### Step 2: `realIO()` を包む

`packages/cli/src/install/cli.ts` の `log`/`errorLog` を同様に `terminalSafe` で包み、`runCommand` 内の 2 つの `console.error` も `console.error(terminalSafe(...))` にする。

**Verify**: `pnpm --filter svelte-vitals run typecheck` → exit 0

### Step 3: `bin.ts` の最終 catch を包む

`bin.ts` の `main().catch` 内を `console.error(terminalSafe(\`svelte-vitals: ...\`))` にする(import 追加)。

**Verify**: `pnpm --filter svelte-vitals run typecheck` → exit 0

### Step 4: 回帰テストを追加する

`packages/cli/test/` に、`consoleIO` と `realIO()` の sink が制御文字を除去することを直接 assert する小テストを追加する(console をスパイして `"a]0;evilb"` を渡し、出力に `` が含まれないこと+`\n`/`\t` は保存されることを確認)。既存のサニタイズ系テスト(`grep -rln terminalSafe packages/cli/test` で見つかるもの)の書き方に合わせる。

**Verify**: `pnpm build && pnpm --filter svelte-vitals run test` → all pass(新テスト含む)

### Step 5: changeset と最終検証

`pnpm changeset` で `svelte-vitals` patch(英語)。内容例: "Sanitize terminal escape sequences in `install`/`ci`/`docs` output and the CLI's last-resort error path."

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0

## Test plan

- Step 4 の直接テスト(sink 単位、2〜3 assert)。
- 既存の CLI 出力系テストが文字列完全一致で落ちる場合、期待値が制御文字を含んでいたケースのみ更新可(通常の ASCII 出力は不変のはず — 大量に落ちたら STOP)。

## Done criteria

- [ ] `cli-io.ts` / `install/cli.ts` / `bin.ts` の console 呼び出しが全て `terminalSafe` 経由(`grep -n "console\.\(log\|error\)" packages/cli/src/cli-io.ts packages/cli/src/install/cli.ts packages/cli/src/bin.ts` の各ヒット行に `terminalSafe` が含まれる)
- [ ] Step 4 のテストが存在し pass する
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(cli patch、英語)が存在する
- [ ] `plans/README.md` の 057 行を更新済み

## STOP conditions

- "Current state" の抜粋と実コードが不一致。
- `terminalSafe` の適用で既存テストが 5 本以上落ちる(出力契約が想定より広く変わっている — 報告して判断を仰ぐ)。
- clack のプロンプト描画(`install` の対話 UI)が壊れる兆候(clack は自前で ANSI を出すが、それは svelte-vitals 側テンプレート由来であり `io.log` を通らない想定。通っていたら設計前提が崩れているので報告)。

## Maintenance notes

- 新しいサブコマンドの IO は必ず `consoleIO`/`realIO()` を使うこと。生 `console.*` の新設はレビューで弾く(`packages/cli/src` での `console.` 出現は cli-io.ts / install/cli.ts / bin.ts と index.ts のデフォルト sink に限られる状態を保つ)。
- `index.ts` の per-call ラッパーは冗長になったが、外部 API(`run({ errorLog })`)経由の呼び出しには依然必要なので消さないこと。
