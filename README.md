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

📖 **[Documentation](https://oekazuma.github.io/svelte-vitals/)**

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

## Features

Full guides live in the [documentation](https://oekazuma.github.io/svelte-vitals/).

- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, and `github`. The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **GitHub integration** — zero-config inline PR annotations, plus SARIF upload for persistent code-scanning alerts in the Security tab. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **Dev overlay** — request-driven SEO feedback as you navigate in `dev`, checking each route's **rendered** `<head>` so dynamic routes are seen with real values. → [Dev overlay](https://oekazuma.github.io/svelte-vitals/guides/dev-overlay/)
- **Plugin mode** (`@svelte-vitals/vite`) — build-time analysis of the prerendered `<head>`; library-agnostic and exact. → [Plugin mode](https://oekazuma.github.io/svelte-vitals/guides/plugin-mode/)
- **MCP server** (`@svelte-vitals/mcp`) — `analyze` and `explain_rule` tools for an agent's tool loop. → [MCP server](https://oekazuma.github.io/svelte-vitals/guides/mcp/)
- **Health Report** — a single weighted Health score over the present categories; gate CI with `--min-health`. → [Health Report](https://oekazuma.github.io/svelte-vitals/guides/health-report/)

## Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | No failing findings                                             |
| `1`  | A critical finding is present                                   |
| `2`  | Execution error (not a SvelteKit project, internal error, etc.) |

This makes svelte-vitals usable as a CI gate. See the [CLI guide](https://oekazuma.github.io/svelte-vitals/guides/cli/) for every flag.

## How it works

svelte-vitals resolves the **effective `<head>`** of every route — walking the layout chain (`+layout.svelte` → … → `+page.svelte`) and parsing `<svelte:head>` with the official `svelte/compiler`. Its design goal is **no false negatives**: a dynamic title like `<title>{data.title}</title>` (the correct SvelteKit pattern) is **never** flagged as missing — it passes with a `↯` marker, and only genuinely missing or empty metadata is penalized.

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
- **Health Report** — a single weighted **Health** score over the present category scores (equal weights by default) — SEO, plus Performance when the project has images — shown as the headline in every reporter and the MCP `analyze` output; gate CI on it with `--min-health`.
- **Documentation site** — bilingual (en / ja) rule reference and guides at [oekazuma.github.io/svelte-vitals](https://oekazuma.github.io/svelte-vitals/).

**Upcoming**

- **Toward `1.0`** — a config file, a visual (Lighthouse-like) report, deeper static Performance checks, and polish. The Upgrade/deprecation category was dropped (covered by official Svelte tooling — the compiler, the Svelte MCP, and `sv migrate`).

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
