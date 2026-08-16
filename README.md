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

<p align="center">Your SvelteKit app's code health, checked before it ships. Statically, no browser.</p>
<p align="center"><sub>SEO · Performance · Correctness · Security · Architecture · Accessibility</sub></p>

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

Six categories — **SEO**, **Performance**, **Correctness**, **Security**, **Architecture**, **Accessibility** — each scored independently and rolled into a single weighted **Health** score. → [Health score](https://oekazuma.github.io/svelte-vitals/guides/health-report/)

## Features

- **Multiple reporters** — `console`, `json`, `agent` (a Markdown remediation document an AI agent can act on directly), `sarif`, `github`, `md` (a plain Markdown report), and `html` (a self-contained, shareable report). The `agent` reporter auto-selects inside AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/)
- **GitHub integration** — zero-config inline PR annotations, plus SARIF upload for persistent code-scanning alerts in the Security tab; `svelte-vitals ci install` scaffolds a full GitHub Actions workflow around `@svelte-vitals/action`, with a job summary and a sticky PR comment. → [Reporters](https://oekazuma.github.io/svelte-vitals/guides/reporters/), [CI integration](https://oekazuma.github.io/svelte-vitals/guides/ci/)
- **Live dashboard** — a searchable, filterable dashboard at `/__svelte-vitals/` during `vite dev`, on by default: whole-project coverage from startup, refined to real rendered values as you browse, with a copy-to-clipboard AI-agent prompt on every finding. → [Live dashboard](https://oekazuma.github.io/svelte-vitals/guides/dev-dashboard/)
- **Plugin mode** (`@svelte-vitals/vite`) — build-time analysis of the prerendered `<head>`; library-agnostic and exact. → [Plugin mode](https://oekazuma.github.io/svelte-vitals/guides/plugin-mode/)
- **Bundled docs** — `svelte-vitals docs list` / `docs show <name>` print the guides from inside the CLI, so they match the installed version and need no network; `svelte-vitals explain --list` / `explain <rule-id>` do the same for the rule set. `docs list` and both forms of `explain` take `--json`; `docs show` prints the topic as Markdown. → [CLI reference](https://oekazuma.github.io/svelte-vitals/guides/cli/)
- **Agent Skills** — `/svelte-vitals` and `/improve-svelte` slash-command skills for Claude Code, Cursor, and Codex: rule knowledge up front, plus a project-wide, evidence-ranked improvement roadmap. → [Agent Skills](https://oekazuma.github.io/svelte-vitals/guides/agent-skills/)

## Packages

Two packages you'll use directly — CLI and Vite plugin — both built on the shared `@svelte-vitals/core` rule engine. → [Choosing a package](https://oekazuma.github.io/svelte-vitals/guides/choosing-a-package/)

## Getting started

→ [Getting started](https://oekazuma.github.io/svelte-vitals/guides/getting-started/) for installation, your first run, and exit codes for CI gating.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and the release process.

## License

[MIT](./LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
