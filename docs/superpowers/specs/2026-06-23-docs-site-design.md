# Design: Documentation site (Starlight) — toward 1.0

Roadmap toward `1.0` (the "great documentation" pillar of the product thesis). Build a Starlight docs site that mirrors the maintainer's other library **svelte-meta-tags**, and fix the currently-dead `docsUrl` links that every SEO/PERF finding emits.

(Approved earlier in this session; recreated after the original spec branch was discarded during a base-branch fix. Reflects current `main`, where the Accessibility category has already been removed — so there is no a11y content.)

## Goal

Give svelte-vitals a real documentation home and make every finding's `docsUrl` resolve to a real page. Mirror svelte-meta-tags' proven setup: **Starlight** in a top-level `docs/` workspace, **bilingual (en + ja)**, deployed to **GitHub Pages** at `https://oekazuma.github.io/svelte-vitals/`.

## Reference (svelte-meta-tags, to mirror)

- Top-level `docs/` workspace package (`{ "name": "docs", "private": true, "type": "module" }`), scripts `dev/start/check/build/preview/astro`, deps `@astrojs/check`, `@astrojs/starlight`, `astro`, `sharp`, `typescript` (all `catalog:`).
- `pnpm-workspace.yaml` includes `docs/` in the packages list.
- `docs/astro.config.mjs`: Starlight with `site: 'https://oekazuma.github.io/'`, `base: '/svelte-vitals'`, `locales: { root: { label: 'English', lang: 'en' }, ja: { label: '日本語', lang: 'ja' } }`, a logo, a GitHub social link, and an `autogenerate`-per-directory `sidebar` with `translations` labels.
- `docs/src/`: `content.config.ts`, `content/` (Starlight docs collection), `styles/`, `assets/`.
- Deploy: `.github/workflows/deploy-docs.yml` (build Astro → deploy to GitHub Pages).

> At implementation time, fetch svelte-meta-tags' exact `astro`/`@astrojs/starlight`/`@astrojs/check`/`sharp` catalog versions, its `astro.config.mjs`, `content.config.ts`, and `deploy-docs.yml`, and copy the structure, adapting names/labels to svelte-vitals.

## Site stack & placement

- New top-level **`docs/`** workspace package; add `docs/` to the `pnpm-workspace.yaml` `packages:` list; add the Astro/Starlight deps to the workspace `catalog:`.
- **Bilingual** en (root) + ja, via Starlight `locales`.
- Scripts: `dev/check/build/preview` only — deliberately **no `test`/`typecheck` script**, so the existing `pnpm -r test` / `pnpm -r typecheck` gates skip `docs` (pnpm `-r` runs a script only where defined). The docs package is `private` → excluded from `check:publish` (publint/attw).
- `site: 'https://oekazuma.github.io/'`, `base: '/svelte-vitals'`.

## Code change: fix `docsUrl` to the Pages base

Every SEO/PERF finding links to `https://svelte-vitals.dev/rules/<id>` today (a dead custom domain). Two definitions exist — `packages/core/src/rule.ts` (`docsUrlFor`) and `packages/core/src/reporter/shared.ts` — plus the SARIF `informationUri` in `packages/core/src/reporter/sarif.ts`.

- Point them at the GitHub Pages base: `https://oekazuma.github.io/svelte-vitals/rules/<slug>`; `informationUri` → `https://oekazuma.github.io/svelte-vitals`.
- **Lowercase the slug**: `docsUrlFor(id) = \`https://oekazuma.github.io/svelte-vitals/rules/${id.toLowerCase()}\``, so `/rules/seo001` — Starlight-idiomatic routing, avoids filename/route case-sensitivity issues.
- **Deduplicate**: `rule.ts` and `shared.ts` repeat the `/rules/${id}` string — consolidate to a single shared base/helper so the host appears once. (Confirm at implementation which is canonical; have the reporter import the core helper.)
- This changes published output (finding `docsUrl`, SARIF `informationUri`) → changeset (`@svelte-vitals/core` + `svelte-vitals` patch).

## Content scope (en + ja)

- **Rule reference** (`docs/src/content/docs/{,ja/}rules/`): one page per rule whose finding uses our `docsUrl` — **SEO001–SEO009** and **PERF001–PERF002** (11 rules). Each page: what the rule checks, why it matters (seed from the rule's `rationale`), how to fix (the rule's `recommendation` + `fix.snippet`), and severity. The slug must match the (lowercased) `docsUrl` id, e.g. `rules/seo001`.
- **No a11y content** — the Accessibility category was removed; the docs cover SEO + Performance + the Health Report only.
- **Guides** (shipped features only): Getting Started/Install, CLI usage & exit codes, Plugin mode (`@svelte-vitals/vite`), Dev overlay, MCP server, Reporters (console/json/agent/sarif/github), Health Report (`--min-health`, weights). **No Config guide** (the config file is a later roadmap item, not yet built).
- Home/landing page describing svelte-vitals (SEO + Performance focus).

## Deploy & CI

- `.github/workflows/deploy-docs.yml`: build the Astro site and deploy to GitHub Pages (mirror svelte-meta-tags). Enabling Pages for the repo is a maintainer step (noted in the plan).
- CI (`ci.yml`): add a docs job/step running `pnpm --filter docs check` and `pnpm --filter docs build` so docs breakage is caught (it won't run under the existing `-r typecheck`/`-r test` since docs has no such scripts).
- README: add a link to the docs site.

## Testing / verification

- `pnpm --filter docs check` and `pnpm --filter docs build` succeed.
- **Link integrity**: a check (test or a small script) that every rule id whose finding emits a `docsUrl` (SEO001–009, PERF001–002) has a corresponding `rules/<slug>` page — so no finding links to a 404. Run it against `allRules` filtered to the categories that use `docsUrlFor` (seo + performance).
- Existing core/cli tests updated for the new `docsUrl` host/slug (any test asserting `https://svelte-vitals.dev/rules/SEO00x` → new Pages URL, lowercased).

## Roadmap / release

- README roadmap: note the docs site shipped; keep the path to `1.0` (HTML/visual report, deeper Performance, config file) as upcoming.
- Changeset: `@svelte-vitals/core` + `svelte-vitals` **patch** (the `docsUrl`/`informationUri` change). `docs` is private (unpublished) — not in the changeset.

## Non-goals / follow-ups

- HTML/visual (Lighthouse-like) report — the next 1.0 pillar (separate spec).
- Deeper static Performance rules — separate spec.
- Config file + `--weights` — separate spec; the Config guide waits for it.
- Custom domain (`svelte-vitals.dev`) — out of scope; GitHub Pages subpath for now (a CNAME can be added later, which would then require revisiting the `base`/`docsUrl`).
- Auto-generating rule pages from the rule catalog — hand-written Markdown for now (bilingual translation is manual anyway); revisit if the rule set grows.
