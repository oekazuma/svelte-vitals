# Plan 017: docs サイトから llms.txt を配信する(エージェント可読ドキュメント)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d0c76c9..HEAD -- docs/astro.config.mjs docs/package.json pnpm-workspace.yaml`
> 差分があれば "Current state" の抜粋と実コードを突き合わせ、不一致なら STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW(docs サイトのみ。パッケージのコードに触れない)
- **Depends on**: none
- **Category**: docs / direction
- **Planned at**: commit `d0c76c9`, 2026-07-08

## Why this matters

MCP サーバー(`explain_rule`)を接続済みのエージェントはルール知識に届くが、
**接続していない**エージェント(Web 検索や URL フェッチしかできない環境を含む)からは
ルール docs が HTML でしか取れない。docs サイト(Astro Starlight)に llms.txt
(インデックス)と llms-full.txt(全文 Markdown)を追加すると、任意のエージェントが
1 フェッチでルール全集・ガイド全集を取り込める。コミュニティプラグイン
`starlight-llms-txt` を足すだけで済む見込みで、費用対効果が最も高い改善。

## Current state

- `docs/astro.config.mjs` — Starlight 設定。`starlight({ title, locales: { root: en, ja }, sidebar, … })`
  のみで `plugins` キーは未使用。`site: 'https://oekazuma.github.io/'`、`base: '/svelte-vitals'`。
- `docs/package.json` — dependencies はすべて `"catalog:"` 参照
  (`@astrojs/check`, `@astrojs/starlight`, `astro`, `sharp`, `typescript`)。
- `pnpm-workspace.yaml` — カタログに `'@astrojs/starlight': ^0.41.3` 等の実バージョンが
  ある(**依存の実バージョンはここに書く**のがリポジトリの鉄則)。
- docs コンテンツ: `docs/src/content/docs/`(en)+ `docs/src/content/docs/ja/`(全訳)。
  ルールは `rules/<id>.md` が 49 本 × 2 言語。
- CI: `.github/workflows/ci.yml` の `docs` ジョブが docs をビルドする。ローカル検証は
  `pnpm --filter docs build`。

## Commands you will need

| Purpose    | Command                    | Expected on success       |
| ---------- | -------------------------- | ------------------------- |
| Install    | `pnpm install`             | exit 0                    |
| docs build | `pnpm --filter docs build` | exit 0、`docs/dist/` 生成 |
| docs check | `pnpm --filter docs check` | exit 0                    |
| Lint       | `pnpm lint`                | exit 0                    |

## Scope

**In scope**:

- `pnpm-workspace.yaml`(カタログにプラグインのバージョン追加)
- `docs/package.json`(`"starlight-llms-txt": "catalog:"` 追加)
- `docs/astro.config.mjs`(plugins 配線)
- `pnpm-lock.yaml`(pnpm install の結果として)
- `docs/src/content/docs/index.mdx` と `ja/index.mdx`(任意 — llms.txt への言及 1 行。
  やらなくても Done にはできる)

**Out of scope**:

- `packages/*` すべて(npm 公開物に変更なし → **changeset 不要**)
- docs コンテンツ本文の書き換え
- 自前の llms.txt 生成エンドポイント実装(プラグインが使えない場合は STOP して報告)

## Git workflow

- Branch: `advisor/017-docs-llms-txt`
- Conventional commits、例: `docs: serve llms.txt / llms-full.txt from the docs site`
- PR 本文は英語。**他社ベンチマークツール名をコミット/PR/docs に書かない**(リポジトリ規約)。
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: プラグインの互換性を確認して追加

1. `npm view starlight-llms-txt peerDependencies versions --json` を実行し、
   `@astrojs/starlight` `^0.41`(カタログの現行値)と互換の最新バージョンを特定する。
   互換版が無ければ **STOP**(報告に `npm view` の出力を含める)。
2. `pnpm-workspace.yaml` のカタログにアルファベット順で
   `'starlight-llms-txt': ^<確認した版>` を追加。
3. `docs/package.json` の dependencies に `"starlight-llms-txt": "catalog:"` を追加。
4. `pnpm install` を実行。

**Verify**: `pnpm install` → exit 0、lockfile に starlight-llms-txt が入る

### Step 2: astro.config.mjs に配線

```js
import starlightLlmsTxt from 'starlight-llms-txt';
// …
starlight({
  title: 'svelte-vitals',
  // …既存設定は不変…
  plugins: [
    starlightLlmsTxt({
      projectName: 'svelte-vitals',
      description:
        'A deterministic SvelteKit code-health scanner — SEO, performance, correctness, security, architecture.'
    })
  ]
});
```

プラグインのオプション名は README(`npm view starlight-llms-txt homepage` で場所を確認)
に従うこと — 上記 `projectName`/`description` が実オプション名と違う場合は README を正とする。
多言語サイトなので、プラグインにロケール除外オプションがあれば **ja を除外して en のみ**
を全文に含める(llms-full.txt が二言語で倍膨れするのを防ぐ)。無ければそのままで良い。

**Verify**: `pnpm --filter docs build` → exit 0

### Step 3: 生成物を検証

```sh
ls docs/dist/llms.txt docs/dist/llms-full.txt
head -20 docs/dist/llms.txt
grep -c "SEO001" docs/dist/llms-full.txt
```

- `llms.txt` に site+base(`https://oekazuma.github.io/svelte-vitals/…`)の絶対 URL で
  ガイドとルールの一覧が並ぶこと。相対 URL や base 抜け(`/guides/…` 直下)になって
  いたら設定を見直す(プラグインの `base` 対応を README で確認)。
- `llms-full.txt` にルール本文(SEO001 など)が含まれること。

**Verify**: 上記 3 コマンドが期待どおり(llms.txt 内の URL に `/svelte-vitals/` が含まれる)

### Step 4: 仕上げ

- `pnpm --filter docs check && pnpm lint` を通す。
- docs のみの変更なので changeset は**作らない**(AGENTS.md の規約どおり)。

**Verify**: `pnpm --filter docs check && pnpm lint` → exit 0

## Test plan

docs サイトに自動テストは無い。Step 3 のビルド生成物検証が実質のテスト。
CI の `docs` ジョブ(build)が回帰ゲート。

## Done criteria

- [ ] `pnpm --filter docs build` exit 0、`docs/dist/llms.txt` と `docs/dist/llms-full.txt` が生成される
- [ ] llms.txt 内の URL が `https://oekazuma.github.io/svelte-vitals/` 配下
- [ ] llms-full.txt にルール本文(`SEO001` で grep ヒット)が含まれる
- [ ] バージョンは pnpm-workspace.yaml のカタログにあり、docs/package.json は `catalog:` 参照
- [ ] `pnpm lint` exit 0、changeset は無し
- [ ] `plans/README.md` の 017 行を更新

## STOP conditions

- `starlight-llms-txt` に `@astrojs/starlight ^0.41` 互換版が無い(自前実装に切り替えず報告)。
- プラグインが `base` 付きサイトで壊れた URL を吐き、オプションで直せない。
- Starlight 本体のバージョンを上げないと動かない(Renovate 管轄の判断になるため報告)。

## Maintenance notes

- Renovate がカタログの `@astrojs/starlight` を上げた際、`starlight-llms-txt` の peer 互換を
  CI の docs ビルドが検知する(落ちたらプラグイン側の更新を待つ判断が要る)。
- 将来 Plan 016(エージェントスキル)や README から `llms.txt` の URL を案内すると相乗効果がある。
- ルール docs の構成を変える(ディレクトリ移動など)と llms.txt の並びも変わる — 意図した
  変化かをレビューで確認。
