<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/wordmark-dark.svg">
    <img src="./assets/wordmark-light.svg" alt="svelte-vitals" height="56">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/oekazuma/svelte-vitals/actions/workflows/ci.yml"><img src="https://github.com/oekazuma/svelte-vitals/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://www.npmjs.com/package/svelte-vitals"><img src="https://img.shields.io/npm/v/svelte-vitals" alt="npm"></a>
  <a href="https://www.npmjs.com/package/svelte-vitals"><img src="https://img.shields.io/npm/dt/svelte-vitals.svg" alt="download"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/npm/l/svelte-vitals" alt="MIT"></a>
</p>

> **A static code-health checker for SvelteKit — not a runtime Web Vitals reporter.**
> svelte-vitals **statically analyzes your source code** — resolved `<head>` metadata and component bodies — across five categories (SEO, Performance, Correctness, Security, Architecture), before it ever ships. No browser, no build server, no headless Chrome.

```bash
npx svelte-vitals
```

📖 **[Documentation](https://oekazuma.github.io/svelte-vitals/)**

> [!WARNING]
> **Pre-1.0 — not recommended for production use yet.** Development is moving fast and aggressively, driven at the maintainer's discretion until `1.0`: APIs, rule IDs, scoring, and output formats can change at any time, including breaking changes between minor releases. Relying on it in critical pipelines is discouraged until `1.0`.

## Why

If ESLint checks the syntax of your **code**, svelte-vitals checks the health of your **application** — is it SEO-sound, fast, correct, secure, and well-architected — from source, before anything renders.

|                                     | Looks at                                               | When                  | Needs a browser |
| ----------------------------------- | ------------------------------------------------------ | --------------------- | --------------- |
| Lighthouse / unlighthouse           | Rendered result (DOM, real metrics)                    | After deploy          | Yes             |
| eslint-plugin-svelte / svelte-check | Syntax, types, some a11y                               | While coding          | No              |
| **svelte-vitals**                   | Head metadata + component source (5 categories, below) | Before / during build | **No**          |

It is **not** a Lighthouse replacement — it is an **upstream check** that catches breakage in CI or on a PR, long before anything reaches production. And despite the name, it does **not** measure runtime Core Web Vitals (LCP / CLS / INP).

## Categories

| Category         | Checks                                                                                                                 | Rules |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| **SEO**          | Effective `<head>` per route — title, description, canonical, OG/Twitter, JSON-LD, headings, hreflang, sitemap/robots… | 30    |
| **Performance**  | `<img>` dimensions/loading/LCP, render-blocking scripts, resource hints, heavy/namespace imports                       | 10    |
| **Correctness**  | Unkeyed `{#each}`, `$effect` misused to derive state or as `onMount`, unmutated `$state`                               | 4     |
| **Security**     | `{@html}` raw render (XSS surface), literal `javascript:` URLs                                                         | 2     |
| **Architecture** | Oversized components, excessive prop count ("god components")                                                          | 2     |

Every category is scored independently and rolled into a single weighted **Health** score (see [Health Report](https://oekazuma.github.io/svelte-vitals/guides/health-report/)). SEO and Performance run against every route's resolved head/DOM usage; Correctness, Security, and Architecture run against every `.svelte` component body.

## Usage

Requires **Node.js 22.13+**.

Run it inside any SvelteKit project:

```bash
npx svelte-vitals          # analyze the current directory
npx svelte-vitals ./apps/web   # or a specific path
```

Example output:

```
Svelte Vitals  ·  static mode

Health: 90/100
SEO Score: 79/100   (route avg 96 · capped at 79: critical present)
Performance Score: 95/100   (route avg 95)
Correctness Score: 95/100   (route avg 95)

Critical (1)
────────────────────────
✗ SEO001  Missing <title>
            /none
            src/routes/none/+page.svelte

Warnings (2)
────────────────────────
✗ PERF001  Missing <img> width/height
            /blog
            src/routes/blog/+page.svelte:42
✗ CORRECT001  {#each} block has no key
            src/lib/List.svelte
            src/lib/List.svelte:5

Passed (3)
────────────────────────
✓ SEO001  <title>  /blog
✓ SEO001  <title>  ↯ dynamic  /dynamic
✓ SEO001  <title>  /static

↯ = set dynamically (verified at runtime).
```

Only categories with findings appear — a project with no images and no component-level issues shows just a SEO score.

## Features

Full guides live in the [documentation](https://oekazuma.github.io/svelte-vitals/).

- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, and `github`. The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **GitHub integration** — zero-config inline PR annotations, plus SARIF upload for persistent code-scanning alerts in the Security tab. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **Dev overlay** — request-driven SEO/Performance feedback as you navigate in `dev`, checking each route's **rendered** `<head>` so dynamic routes are seen with real values. → [Dev overlay](https://oekazuma.github.io/svelte-vitals/guides/dev-overlay/)
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

svelte-vitals runs two static passes, both via the official `svelte/compiler` — no rendering involved:

- **Route pass** (SEO, Performance) — resolves the **effective `<head>`** of every route by walking the layout chain (`+layout.svelte` → … → `+page.svelte`) and parsing `<svelte:head>`, plus each route's `<img>` usage. Its design goal is **no false negatives**: a dynamic title like `<title>{data.title}</title>` (the correct SvelteKit pattern) is **never** flagged as missing — it passes with a `↯` marker, and only genuinely missing or empty metadata is penalized.
- **Component pass** (Correctness, Security, Architecture) — reads every `.svelte` file under `src/` into a component-facts channel (each block, `$effect`/`$state` usage, `{@html}`, prop count, line count…) and runs rules against it directly, independent of routing.

## Packages

| Package                                  | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`svelte-vitals`](./packages/cli)        | CLI + static mode (`npx svelte-vitals`)                     |
| [`@svelte-vitals/core`](./packages/core) | Runtime-agnostic core: types, rule engine, scorer, reporter |
| [`@svelte-vitals/vite`](./packages/vite) | Plugin mode (build-time): analyzes the prerendered `<head>` |
| [`@svelte-vitals/mcp`](./packages/mcp)   | MCP server: run analysis inside an agent's tool loop        |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and the release process.

## License

[MIT](./LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
