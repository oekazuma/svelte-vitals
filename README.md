# svelte-vitals

[![CI](https://github.com/oekazuma/svelte-vitals/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/oekazuma/svelte-vitals/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/svelte-vitals)](https://www.npmjs.com/package/svelte-vitals)
[![download](https://img.shields.io/npm/dt/svelte-vitals.svg)](https://www.npmjs.com/package/svelte-vitals)
[![MIT](https://img.shields.io/npm/l/svelte-vitals)](https://opensource.org/licenses/MIT)

> **A SvelteKit SEO checker — not a runtime Web Vitals reporter.**
> svelte-vitals diagnoses your project's SEO health by **statically analyzing your source code**, before it ever ships. No browser, no build server, no headless Chrome.

```bash
npx svelte-vitals
```

> [!WARNING]
> **Pre-1.0 — not recommended for production use yet.** Development is moving fast and aggressively, driven at the maintainer's discretion until `1.0`: APIs, rule IDs, scoring, and output formats can change at any time, including breaking changes between minor releases. Relying on it in critical pipelines is discouraged until `1.0`.
>
> See the [roadmap](#roadmap) for what's available and what's planned.

## Why

If ESLint checks the quality of your **code**, svelte-vitals checks the quality of your **application** — specifically, whether your routes are SEO-sound.

|                                     | Looks at                            | When                  | Needs a browser |
| ----------------------------------- | ----------------------------------- | --------------------- | --------------- |
| Lighthouse / unlighthouse           | Rendered result (DOM, real metrics) | After deploy          | Yes             |
| eslint-plugin-svelte / svelte-check | Syntax, types, some a11y            | While coding          | No              |
| **svelte-vitals**                   | How your head metadata is written   | Before / during build | **No**          |

It is **not** a Lighthouse replacement — it is an **upstream check** that catches SEO breakage in CI or on a PR, long before anything reaches production. And despite the name, it does **not** measure runtime Core Web Vitals (LCP / CLS / INP).

## Usage

Run it inside any SvelteKit project:

```bash
npx svelte-vitals          # analyze the current directory
npx svelte-vitals ./apps/web   # or a specific path
```

Example output:

```
Svelte Vitals  ·  SEO (static mode)

Critical (1)
────────────────────────
✗ SEO001  Missing <title>
            /none
            src/routes/none/+page.svelte

Passed (3)
────────────────────────
✓ SEO001  <title>  /blog
✓ SEO001  <title>  ↯ dynamic  /dynamic
✓ SEO001  <title>  /static

↯ = set dynamically (verified at runtime).
```

### Agent-native output

`svelte-vitals --reporter agent` emits a Markdown remediation document an AI coding agent can act on directly: each failing finding lists its location, a concrete fix (with a code snippet), and an acceptance check.

It is selected **automatically** when run inside a known AI-agent harness (e.g. Claude Code sets `CLAUDECODE`). Force it anywhere with `SVELTE_VITALS_REPORTER=agent`, or override with `--reporter console|json`. When auto-selected (not requested explicitly), a one-line hint is printed to stderr explaining how to override, so a human running it in an agent terminal isn't surprised by the Markdown output.

### GitHub integration

**Inline PR annotations (zero config).** Under GitHub Actions, svelte-vitals auto-selects the `github` reporter, emitting workflow commands that GitHub turns into inline annotations on the PR diff and in the workflow run's annotations:

```yaml
- run: npx svelte-vitals
```

Override with `--reporter console|json|sarif` (or `SVELTE_VITALS_REPORTER`) if you want different output in CI.

**Code scanning (Security tab).** Emit SARIF and upload it to surface findings as persistent code-scanning alerts. The upload action needs `security-events: write`, so grant it at the job (or workflow) level:

```yaml
jobs:
  seo:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - run: npx svelte-vitals --reporter sarif > svelte-vitals.sarif
        continue-on-error: true
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: svelte-vitals.sarif
```

`--reporter sarif` writes SARIF 2.1.0 to stdout; redirect it to a file for upload.

> [!NOTE]
> Code scanning only displays results that carry a file location, so project-scoped checks that aren't tied to a route file (`robots.txt`, `sitemap`, `<html lang>`) don't appear as alerts in the Security tab. They are still reported by the `github`, `console`, and `json` reporters — keep one of those in your pipeline if you rely on those checks.

### Dev overlay (request-driven)

Get SEO feedback while developing: add the dev handle to `src/hooks.server.ts` and svelte-vitals analyzes each page's **rendered** `<head>` as you navigate, printing warnings for the current route to your dev-server terminal. It sees real values, so dynamic routes (`{data.title}`) are checked against what actually renders.

```ts
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';

export const handle = sequence(svelteVitalsHandle());
```

It runs in `dev` only (a no-op in production builds) and never modifies the response — it only reads the rendered HTML. Coverage follows navigation: a route is checked when you visit it, and re-warned only when its findings change.

`svelteVitalsHandle` accepts a focused subset of the plugin options — `metaComponents` and per-rule `rules` overrides (e.g. `svelteVitalsHandle({ rules: { SEO008: 'off' } })`). Analysis errors are swallowed so a tool bug never breaks a request; set the `SVELTE_VITALS_DEBUG` env var to surface them in the terminal while debugging.

### Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | No failing findings                                             |
| `1`  | A critical finding is present                                   |
| `2`  | Execution error (not a SvelteKit project, internal error, etc.) |

This makes svelte-vitals usable as a CI gate.

## How it works

svelte-vitals resolves the **effective `<head>`** of every route by walking the layout chain (`+layout.svelte` → … → `+page.svelte`) and parsing `<svelte:head>` with the official `svelte/compiler`.

The key design goal is **no false negatives**. SvelteKit metadata is usually dynamic, so each tag is detected on two independent axes:

- **presence** — `own` (set by the route), `inherited` (from a parent layout), or `none`
- **value** — `static` (a literal), `dynamic` (`{data.title}` — value known only at runtime), or `absent` (present but empty)

A dynamic title such as `<title>{data.title}</title>` — the most common and correct SvelteKit pattern — is **never** flagged as missing. It passes with a `↯` marker instead. Only genuinely missing (`none`) or empty (`absent`) metadata is penalized.

### Known limitations

- **Layout breakouts are not resolved** ([#12](https://github.com/oekazuma/svelte-vitals/issues/12)). The static-mode resolver walks the full `+layout.svelte` chain and does not yet account for SvelteKit's layout reset/breakout files (`+page@.svelte`, `+page@segment.svelte`, `+layout@.svelte`). A route that breaks out of its layout chain may therefore be composed against the wrong set of layouts (or skipped). This is rare in practice; until proper breakout resolution lands, scope the run to the routes you trust with `--route`, or check the affected pages in **plugin mode** (`@svelte-vitals/vite`), which inspects the real prerendered HTML and is unaffected.

## Roadmap

The project advances along two axes: **mode maturity** and **category coverage**. SEO is the first category; more follow.

**Shipped**

- **Static mode (CLI)** — zero-config `npx svelte-vitals`: resolves each route's effective `<head>`, runs SEO001–SEO009, scores per route and site-wide, and gates CI via exit codes.
- **Plugin mode** (`@svelte-vitals/vite`) — piggybacks on `vite build` and analyzes the prerendered HTML's `<head>`. Library-agnostic and exact; the real value for polished sites.
- **Agent & CI integration** — `console`, `json`, `agent` (Markdown remediation), `sarif` (GitHub code scanning), and `github` (inline PR annotations) reporters. The `agent` reporter auto-selects under AI-agent harnesses; `github` under GitHub Actions.
- **Dev overlay** (`@svelte-vitals/vite`) — warns in-place while developing via `transformPageChunk`, so dynamic routes are seen with real values as pages are visited.
- **MCP server** (`@svelte-vitals/mcp`) — exposes `analyze` and `explain_rule` tools over stdio so an agent can run analysis in its tool loop and receive structured, fixable findings.
- **Performance checks** (`0.4`) — static `<img>` analysis: `width`/`height` (CLS) and a `loading` advisory, scored as a separate Performance category alongside SEO.
- **Accessibility checks** (`0.5`) — aggregates the Svelte compiler's `a11y_*` warnings (alt text, label association, ARIA, …) into a scored Accessibility category.

**Upcoming**

- **More categories** ([#10](https://github.com/oekazuma/svelte-vitals/issues/10)) — Upgrade checks, then a combined weighted Health Report — landing across `0.x` ahead of the `1.0` polish.

See the design document for the full vision.

## Packages

| Package                                  | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`svelte-vitals`](./packages/cli)        | CLI + static mode (`npx svelte-vitals`)                     |
| [`@svelte-vitals/core`](./packages/core) | Runtime-agnostic core: types, rule engine, scorer, reporter |
| [`@svelte-vitals/vite`](./packages/vite) | Plugin mode (build-time): analyzes the prerendered `<head>` |
| [`@svelte-vitals/mcp`](./packages/mcp)   | MCP server: run analysis inside an agent's tool loop        |

## Development

This is a pnpm-workspaces monorepo (TypeScript / ESM).

```bash
pnpm install
pnpm build       # build all packages (tsup)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # prettier --check + eslint
```

Releases are managed with [Changesets](https://github.com/changesets/changesets): run `pnpm changeset` to describe your change, then merging to `main` opens a release PR.

## License

[MIT](./LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
