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

<p align="center">A static code-health checker for SvelteKit — SEO, Performance, Correctness, Security, and Architecture, from source. No browser or headless Chrome required. (Not a runtime Web Vitals reporter, despite the name.)</p>

```bash
npx svelte-vitals@latest
```

<p align="center">
  <img src="./docs/public/demo.gif" alt="svelte-vitals running against a SvelteKit project, showing the Health score animate in and settle at a final score" width="700">
</p>

📖 **[Documentation](https://oekazuma.github.io/svelte-vitals/)**

> [!WARNING]
> **Pre-1.0 — not recommended for production use yet.** Development is moving fast and aggressively, driven at the maintainer's discretion until `1.0`: APIs, rule IDs, scoring, and output formats can change at any time, including breaking changes between minor releases. Relying on it in critical pipelines is discouraged until `1.0`.

## Categories

Five categories — **SEO**, **Performance**, **Correctness**, **Security**, **Architecture** — each scored independently and rolled into a single weighted **Health** score. → [Health Report](https://oekazuma.github.io/svelte-vitals/guides/health-report/)

## Features

- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, and `github`. The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **GitHub integration** — zero-config inline PR annotations, plus SARIF upload for persistent code-scanning alerts in the Security tab. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **Live dashboard** — a searchable, filterable dashboard at `/__svelte-vitals/` during `vite dev`, on by default: whole-project coverage from startup, refined to real rendered values as you browse. → [Live dashboard](https://oekazuma.github.io/svelte-vitals/guides/dev-dashboard/)
- **Plugin mode** (`@svelte-vitals/vite`) — build-time analysis of the prerendered `<head>`; library-agnostic and exact. → [Plugin mode](https://oekazuma.github.io/svelte-vitals/guides/plugin-mode/)
- **MCP server** (`@svelte-vitals/mcp`) — `analyze` and `explain_rule` tools for an agent's tool loop. → [MCP server](https://oekazuma.github.io/svelte-vitals/guides/mcp/)

## Packages

Three packages you'll use directly — CLI, Vite plugin, MCP server — all built on the shared `@svelte-vitals/core` rule engine. → [Choosing a package](https://oekazuma.github.io/svelte-vitals/guides/choosing-a-package/)

## Getting started

→ [Getting started](https://oekazuma.github.io/svelte-vitals/guides/getting-started/) for installation, your first run, and exit codes for CI gating.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and the release process.

## License

[MIT](./LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
