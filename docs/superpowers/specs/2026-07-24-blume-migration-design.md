# docs/ を Starlight から blume へ移行する設計

日付: 2026-07-24
ステータス: ドラフト(ユーザー確認待ち)

参考: [oekazuma/svelte-meta-tags#2144](https://github.com/oekazuma/svelte-meta-tags/pull/2144)(同一パターンでの先行移行)、その設計書 `superpowers/specs/2026-07-15-blume-migration-design.md`。

## 目的

`docs/` の Astro + Starlight 製ドキュメントサイトを [blume](https://github.com/haydenbleasel/blume)(v1.1.2 — `minimumReleaseAge` の3日ポリシーにより最新の v1.1.4 はまだ導入できないため)に置き換える。英語 + 日本語の2ロケール構成と GitHub Pages(`/svelte-vitals` サブパス)へのデプロイを維持する。`docs/demo/`(別ワークスペースパッケージ、プロモ用GIF生成アプリ)は対象外、一切変更しない。

## 決定事項

- **アプローチ**: `docs/` ワークスペース内で丸ごと置き換え(1 PR)。
- **コンテンツの物理的な場所は変更しない**: `docs/src/content/docs/` に置いたまま `content.root: 'src/content/docs'` で指定する。svelte-meta-tags 側は `docs/content/` へ移動したが、今回は154ファイル(en 77 + ja 77)と規模が大きく、移動によるリスク・レビュー負荷に見合わない。Blume の Starlight 移行リファレンス自身も「Keep content where it is」を推奨しており、機能的な差はない。これにより **`packages/cli/test/docs-links.test.ts` のパス変更が不要**になる(既存の `docs/src/content/docs/rules` を参照したまま)。
- **URL構造は変更しない**: 現行 Starlight の sidebar は `autogenerate` のみ(Guides, Rules の2グループ、カスタム項目なし)で、ファイルシステム由来のナビゲーションとほぼ1:1に対応する。ルール5カテゴリ(architecture/correctness/performance/security/seo)はネストしたフォルダのまま、blume のファイルシステム由来ナビゲーションが自動でネストしたグループにする想定(`references/starlight.md` の「Folders become groups」)。**redirects は不要**(URL変更なし)。
- **トップページ**: 現行は `template: splash` + `hero`(ワードマークロゴ + タグライン + Get Startedボタン + アニメーションターミナルGIF)。Blume にsplash/heroの直接対応はないため、通常ページとして再構築する(H1をtitleに、tagline文言はH1直下の一段落に、Get Startedリンクは通常のMarkdownリンクに、ターミナルGIF演出のHTML/CSSはそのまま活かしつつ CSS変数だけ Blume 側に置き換え)。
- **changeset**: 不要(docsサイトのみの内部変更のため)。

## コンテンツの実態(調査済み)

- 英語77ページ、日本語77ページ(完全ミラー)。
- Starlight固有コンポーネント使用は最小限: `<Tabs>/<TabItem>` が `guides/configuration.mdx`(ja含む)のみ。`<Aside>`・`<Card>`/`<CardGrid>`・`<Steps>`・`<Badge>`・`<LinkCard>`・`:::` directiveは**リポジトリ全体で使用箇所ゼロ**。
- frontmatterで使われているキーは `title` / `description` / `sidebar.order` / `template` / `hero` のみ(`template`/`hero` は index.mdx だけ)。ほぼそのまま Blume 互換。
- ルールページ(architecture/correctness/performance/security/seoの計62ページ×2言語)はプレーンな見出し+本文+コードブロックのみで、変換作業は実質不要(frontmatterのtitle/descriptionはそのまま通る)。
- **`.mdx`へのリネームは不要** — `:::` directiveや数式・mermaidを使うページが存在しないため、既存の `.md` のままで問題ない。既存の4つの `.mdx`(index.mdx, guides/configuration.mdx、各ja版)はそのまま `.mdx` を維持。

## `blume.config.ts`

```ts
import { defineConfig } from 'blume';

const description =
  'A deterministic SvelteKit code-health scanner — SEO, performance, correctness, security, architecture.';

export default defineConfig({
  title: 'svelte-vitals',
  description,
  content: { root: 'src/content/docs' },
  logo: {
    image: { light: '/logo-mark.svg', dark: '/logo-mark.svg', alt: 'svelte-vitals' }
    // 単色ロゴ1枚のみのため light/dark 同一ファイルを指定(現行もダーク単色ロゴのみ)
  },
  github: { owner: 'oekazuma', repo: 'svelte-vitals', dir: 'docs' },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' }
    ]
  },
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-vitals'
  }
  // redirects: 不要(URL変更なし)
});
```

- favicon: `favicon.svg`/`favicon-32.png`/`favicon-180.png` は `public/` に既にあるためそのまま(config記述は削除)。apple-touch-icon の `head` エントリは blume が favicon から自動生成するため削除・報告。
- `starlight-llms-txt` プラグインは削除(blumeが `llms.txt`/`llms-full.txt` をネイティブ生成)。
- 検索はデフォルトの Orama ローカル検索(設定不要)。

## パッケージと CI

### `docs/package.json`

```json
{
  "name": "docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "blume dev",
    "start": "blume dev",
    "check": "blume check",
    "build": "blume build",
    "preview": "blume preview"
  },
  "dependencies": {
    "blume": "catalog:",
    "typescript": "catalog:"
  }
}
```

- ルート `pnpm-workspace.yaml` の catalog: `@astrojs/check`・`@astrojs/starlight`・`astro`・`starlight-llms-txt`・`sharp` を削除(docs以外での使用なしを確認済み)、`blume: ^1.1.2` を追加。`docs/tsconfig.json` の `extends: "astro/tsconfigs/strict"` はpnpmの厳格な(非hoisting)node_modules構成では解決できない(一度 `astro` を直接devDependencyとして再追加して解決を試みたが、Blumeが内部でバンドルするastroとは別インスタンスの"split install"を生み、`@astrojs/mdx` が誤ったastroコピーにバインドされて `blume build`/`check` 自体が壊れることが判明)ため、`extends` をやめて `astro/tsconfigs/base.json`+`strict.json`相当の compilerOptions を `docs/tsconfig.json` に直接インライン化した。

### `.github/workflows/deploy-docs.yml`

`withastro/action` をやめ、他ワークフローと同じ `setup-node` composite action + 手動 pages デプロイ手順に置き換える(svelte-meta-tags で実績あり):

```yaml
name: Deploy for Docs to GitHub Pages

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout your repository using git
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node
      - name: Build docs
        run: pnpm --filter docs build
      - name: Configure GitHub Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: docs/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0
```

(SHA・バージョンは実際に検証済み。ルートの `setup-node` composite action が Node/pnpmバージョンを解決するため、旧ワークフローの手動 `devEngines`/`packageManager` 抽出ステップは不要になる。)

### 撤去するファイル

`docs/astro.config.mjs`、`docs/src/content.config.ts`、`docs/tsconfig.json`(blume推奨版に置き換え)。`docs/src/assets/logo-mark.svg` → `docs/public/logo-mark.svg` に移動。

## カスタムCSS

`docs/src/styles/theme-image.css`(ダッシュボードのライト/ダーク切り替え画像用)を Blume の `theme.css`(プロジェクトルート自動読み込み)に移植。`data-theme` 属性ベースの切り替えは Blume でも同じ仕組みのはず(実装時に `node_modules/blume/docs` で確認)。`--sl-color-gray-5` 等の Starlight CSS変数は Blume の Tailwind v4 テーマトークンに置き換える。

## トップページの再構築

`template: splash`/`hero` を廃止し、通常ページ化する:

- H1 = 現行 `hero.title` のワードマーク画像(そのまま維持)
- タグライン文をH1直下に配置
- "Get started" ボタン → 通常の Markdown リンク(`references/starlight.md` の `LinkButton`/hero action の変換方針に準拠)
- ターミナルデモGIFの `<div class="demo-terminal">` 演出用HTML/インラインstyleはそのまま活用(Blume の `.mdx` はコンポーネント・生HTML許容)。CSS変数のみ移植先を確認。

## 検証

1. `pnpm --filter docs build` (blume build) が成功。
2. `pnpm --filter docs check` (blume check) が通る。
3. `docs-links.test.ts` は変更なしでパスする想定(パス未変更のため) — 実行して確認。
4. `blume dev` で en/ja 両ロケールの全ページ・サイドバー・言語スイッチャー・検索を目視確認。
5. `pnpm lint` が通る。
6. ルートの `pnpm build`/`pnpm test`/`pnpm typecheck` に影響がないことを確認(catalog変更の影響範囲)。

## リスク・不明点

- ルール5カテゴリのネストしたフォルダが、Blume のファイルシステム由来ナビゲーションで実際に「Rules > SEO > ...」のような2階層のネストしたグループとして描画されるか、実装時に `blume dev` で目視確認が必要(63ページ×2言語という量のため、想定と異なれば `meta.ts` での補正が必要になる可能性)。
- トップページの `demo-terminal` CSS(Starlight CSS変数依存)の移植は目視確認が必要。
