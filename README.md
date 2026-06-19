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

> [!NOTE]
> **Early development.** The CLI currently ships the static-mode foundation and the first SEO rule (`<title>` presence). More rules, scoring, and the build-time plugin are on the [roadmap](#roadmap). APIs and output may change before `1.0`.

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

Override with `--reporter console|json` (or `SVELTE_VITALS_REPORTER`) if you want different output in CI.

**Code scanning (Security tab).** Emit SARIF and upload it to surface findings as persistent code-scanning alerts:

```yaml
- run: npx svelte-vitals --reporter sarif > svelte-vitals.sarif
  continue-on-error: true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: svelte-vitals.sarif
```

`--reporter sarif` writes SARIF 2.1.0 to stdout; redirect it to a file for upload.

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

## Roadmap

The project advances along two axes: **mode maturity** and **category coverage**.

- **v0.1 — Static mode / SEO** _(current)_ — zero-config `npx svelte-vitals`, all routes analyzed shallowly.
- **v0.2 — Plugin mode** (`@svelte-vitals/vite`) — piggybacks on `vite build` and analyzes the prerendered HTML's `<head>`. Library-agnostic and exact; the real value for polished sites.
- **v0.3 — Dev overlay** — warn in-place while developing via `transformPageChunk`.
- **v0.4+ — Performance, Accessibility, Upgrade** categories, culminating in a combined Health Report.

See the design document for the full vision.

## Packages

| Package                                  | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`svelte-vitals`](./packages/cli)        | CLI + static mode (`npx svelte-vitals`)                     |
| [`@svelte-vitals/core`](./packages/core) | Runtime-agnostic core: types, rule engine, scorer, reporter |
| [`@svelte-vitals/vite`](./packages/vite) | Plugin mode (build-time). Stub — lands in v0.2              |

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
