# svelte-vitals

[![npm](https://img.shields.io/npm/v/svelte-vitals)](https://www.npmjs.com/package/svelte-vitals)
[![MIT](https://img.shields.io/npm/l/svelte-vitals)](https://opensource.org/licenses/MIT)

> **A SvelteKit SEO checker — not a runtime Web Vitals reporter.**
> Diagnose your project's SEO health by statically analyzing your source code, before it ships. No browser, no build server, no headless Chrome.
>
> **ESM-only** (Node 18+). Ships ES modules only; `require()` is unsupported by design.

```bash
npx svelte-vitals
```

> [!NOTE]
> **Early development.** Currently ships static-mode analysis and the first SEO rule (`<title>` presence). More rules, scoring, and a build-time plugin are on the roadmap. Output may change before `1.0`.

## Usage

Run inside any SvelteKit project:

```bash
npx svelte-vitals          # analyze the current directory
npx svelte-vitals ./apps/web   # or a specific path
```

```
Svelte Vitals  ·  SEO (static mode)

Critical (1)
────────────────────────
✗ SEO001  Missing <title>
            /none
            src/routes/none/+page.svelte

Passed (3)

↯ = set dynamically (verified at runtime).
```

By default, console output groups failures by rule (top 5 per severity, each with one example location and an "…and N more" count) and collapses the Passed section to a bare count, so large projects don't flood the terminal. Pass `--verbose` to see every finding uncapped and ungrouped, with each passed item listed individually. On an interactive, color-capable terminal the Health score plays a short reveal animation; pass `--no-animation` to disable it.

### Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | No failing findings                                             |
| `1`  | A critical finding is present                                   |
| `2`  | Execution error (not a SvelteKit project, internal error, etc.) |

Useful as a CI gate.

### Agent-native output

`svelte-vitals --reporter agent` emits a Markdown remediation document an AI coding agent can act on directly: each failing finding lists its location, a concrete fix (with a code snippet), and an acceptance check.

It is selected **automatically** when run inside a known AI-agent harness (e.g. Claude Code sets `CLAUDECODE`). Force it anywhere with `SVELTE_VITALS_REPORTER=agent`, or override with `--reporter console|json`. When auto-selected (not requested explicitly), a one-line hint is printed to stderr explaining how to override, so a human running it in an agent terminal isn't surprised by the Markdown output.

## How it works

svelte-vitals resolves the effective `<head>` of every route by walking the layout chain (`+layout.svelte` → … → `+page.svelte`) and parsing `<svelte:head>` with `svelte/compiler`.

A dynamic title such as `<title>{data.title}</title>` — the most common, correct SvelteKit pattern — is **never** flagged as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is penalized.

See the [project README](https://github.com/oekazuma/svelte-vitals#readme) for the full picture and roadmap.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
