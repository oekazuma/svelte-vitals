# Plan 030: ドキュメント/ワークスペースの陳腐化した記載を修正する(3件まとめ)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3341587..HEAD -- README.md CONTRIBUTING.md pnpm-workspace.yaml docs/demo/package.json`
> 差分があれば下記「Current state」の抜粋と実ファイルを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(ドキュメント文言 + ワークスペース設定のみ、実行コードへの変更なし)
- **Depends on**: none
- **Category**: docs / dx
- **Planned at**: commit `3341587`, 2026-07-13

## Why this matters

監査で見つかった3件の独立した「陳腐化」を、いずれも1行〜数行のトリビアルな修正である
ため1本のプランにまとめる:

1. **README.md が reporter を5種と誤記**(実際は7種)。`html`/`md` という差別化機能
   (CI に貼れる自己完結 HTML レポート、PR コメント向け Markdown レポート)が
   README の Features 一覧から欠落しており、プロジェクトを評価する最初の入口で
   実力を過小に見せている。
2. **CONTRIBUTING.md の pnpm バージョン記載が2リリース分陳腐化**。
   `package.json` の `packageManager` を見よと自ら指示しているのに、その隣に古い数字
   を書いている。
3. **`docs/demo/package.json` が pnpm workspace の対象外**かつ `catalog:` を使わず
   バージョンをハードコードしている。catalog のバージョンアップがこの demo にだけ
   反映されず、気づかれないまま陳腐化するリスクがある。

## Current state

### 1. README.md の reporter 一覧

`README.md:36`:

```md
- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, and `github`. The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
```

実際の reporter は7種(`packages/cli/src/reporter-resolve.ts` の `ReporterName` 型、
`docs/src/content/docs/guides/reporters.md` が明記): `console`, `json`, `agent`,
`sarif`, `github`, `md`, `html`。

### 2. CONTRIBUTING.md の pnpm バージョン

`CONTRIBUTING.md:8`:

```md
- pnpm `11.9.0` (see `packageManager` in [`package.json`](./package.json))
```

`package.json:38`:

```json
  "packageManager": "pnpm@11.11.0",
```

### 3. `docs/demo` のワークスペース所属 + catalog

`pnpm-workspace.yaml:1-3`:

```yaml
packages:
  - 'docs/'
  - 'packages/*'
```

`docs/demo/package.json`(全文):

```json
{
  "name": "svelte-vitals-demo",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@sveltejs/kit": "^2.69.2",
    "svelte": "^5.56.4"
  }
}
```

`pnpm-workspace.yaml` の `catalog:` ブロックには既に同じバージョンが定義済み:
`@sveltejs/kit: ^2.69.2`、`svelte: ^5.56.4`。`docs/'` という glob は `docs/` 直下に
`package.json` を持つパッケージ(= docs サイト自身)にはマッチするが、
`docs/demo`(ネストしたサブディレクトリ)にはマッチしない
(`pnpm -r list --depth -1` で `docs/demo` が一覧に出ないことを確認済み)。

## Commands you will need

| Purpose             | Command                                     | Expected on success                   |
| ------------------- | ------------------------------------------- | ------------------------------------- |
| ワークスペース確認  | `pnpm -r list --depth -1`                   | `docs/demo` が一覧に出る              |
| lockfile 整合性確認 | `pnpm install`                              | exit 0、lockfile 更新が妥当であること |
| 全体ビルド/テスト   | `pnpm build && pnpm typecheck && pnpm test` | exit 0 / all pass                     |
| lint                | `pnpm lint`                                 | exit 0                                |

## Scope

**In scope**:

- `README.md`(reporter 一覧の1行)
- `CONTRIBUTING.md`(pnpm バージョンの1行)
- `pnpm-workspace.yaml`(`packages` glob に `docs/demo` を追加)
- `docs/demo/package.json`(ハードコードされた2つのバージョンを `catalog:` に置換)

**Out of scope**:

- README のその他の記述(reporter 以外の Features 項目は変更不要)。
- `docs/demo` 配下のソースコード(デモの中身自体は触らない — ワークスペース設定と
  依存バージョンの参照方法のみ)。
- `docs/` サイト本体(Astro Starlight)の設定。

## Git workflow

- Branch: `advisor/030-docs-and-workspace-quick-fixes`
- コミットは論理的に分けてよい(例: `docs: list all seven reporters in the README` /
  `docs: fix the stale pnpm version in CONTRIBUTING.md` /
  `chore: bring docs/demo into the pnpm workspace and use the catalog`)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: README.md の reporter 一覧を修正する

`README.md:36` の該当行を、7種すべてを列挙する形に書き換える。既存の
`agent`/`github` の auto-select についての一文は維持し、`md`/`html` についても
簡潔な一言(何のためのフォーマットか)を加える。例(文面は既存のトーンに合わせて
調整してよい):

```md
- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, `github`, `md` (a plain Markdown report), and `html` (a self-contained, shareable report). The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
```

**Verify**: `grep -c '`console`, `json`, `agent`' README.md` が1件、かつ `grep -c '`md`' README.md`
と `grep -c '`html`'` README.md` がともに1件以上であること(目視でも確認)。

### Step 2: CONTRIBUTING.md の pnpm バージョンを修正する

`CONTRIBUTING.md:8` を `package.json` の現在値に合わせる:

```md
- pnpm `11.11.0` (see `packageManager` in [`package.json`](./package.json))
```

将来また陳腐化しないよう、固定の数字ではなく `packageManager` を見よという指示を
より強調した文面(例: 「the exact version pinned in `packageManager` — run
`corepack use` to match it automatically」)にしてもよいが、必須ではない。数字を
更新するだけでも Done criteria は満たす。

**Verify**: `grep "pnpm \`11.11.0\`" CONTRIBUTING.md`がヒットすること
(実際の`package.json` の値と手動で突き合わせる — ハードコードするなら正しい値を)。

### Step 3: `docs/demo` を pnpm workspace に含める

`pnpm-workspace.yaml` の `packages` リストに `docs/demo` を追加する:

```yaml
packages:
  - 'docs/'
  - 'docs/demo'
  - 'packages/*'
```

**Verify**: `pnpm -r list --depth -1` の出力に `svelte-vitals-demo` が含まれること。

### Step 4: `docs/demo/package.json` のバージョンを catalog 参照に変更する

```json
{
  "name": "svelte-vitals-demo",
  "private": true,
  "type": "module",
  "devDependencies": {
    "@sveltejs/kit": "catalog:",
    "svelte": "catalog:"
  }
}
```

**Verify**: `pnpm install` を実行し、exit 0 であること。`pnpm-lock.yaml` に
`docs/demo` の importer エントリが追加され、`@sveltejs/kit`/`svelte` が catalog の
バージョンで解決されていることを確認する。

### Step 5: 全体検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0 /
all pass(`docs/demo` がワークスペースに入ったことで他パッケージのビルド/テストに
悪影響が出ないことを確認する。`docs/demo` 自体には `build`/`typecheck`/`test`
スクリプトがないため、`pnpm -r` はこのパッケージをスキップするはずだが、念のため
警告やエラーが出ないことを確認する)。

## Test plan

このプランは設定/ドキュメントの修正であり、vitest の新規テストは追加しない。
検証は Step 1〜5 の各コマンドの実行結果がすべてである。

## Done criteria

- [ ] README.md が7種類のreporterを正しく列挙している
- [ ] CONTRIBUTING.md の pnpm バージョンが `package.json` の `packageManager` と一致
- [ ] `pnpm -r list --depth -1` に `svelte-vitals-demo` が含まれる
- [ ] `docs/demo/package.json` が `catalog:` を使っている(ハードコードされた
      semver 文字列が残っていない)
- [ ] `pnpm install` が exit 0(lockfile が正しく更新されている)
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0 / all pass
- [ ] `plans/README.md` の該当行を更新済み

## STOP conditions

- `docs/demo` をワークスペースに追加したことで `pnpm install` が既存の依存解決を
  壊す(想定外の peer 依存衝突など)場合、原因を調査して報告する — 無理に
  `--no-strict-peer-dependencies` 等で握りつぶさない。
- `docs/demo` に実は既存の何らかの CI/ビルドプロセスが依存している(ワークスペース
  外であることを前提にした特別な扱いがある)ことが分かった場合、その依存関係を
  確認してから進める。

## Maintenance notes

- 今後 catalog のバージョンをバンプする Renovate PR は、自動的に `docs/demo` にも
  反映されるようになる(このプランの主眼)。
- README の reporter 一覧に新しい reporter が追加された場合、このプランが直した
  「6種類目・7種類目が抜ける」問題が再発しないよう、reporter を追加するプランでは
  README も併せて更新することを徹底する。
