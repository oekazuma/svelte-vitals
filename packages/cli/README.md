# svelte-vitals

[![npm](https://img.shields.io/npm/v/svelte-vitals)](https://www.npmjs.com/package/svelte-vitals)
[![MIT](https://img.shields.io/npm/l/svelte-vitals)](https://opensource.org/licenses/MIT)

> **Your SvelteKit app's code health, checked before it ships. Statically, no browser.**
> Scores SEO, Performance, Correctness, Security, Architecture, and Accessibility by reading your source code.
>
> **ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.

```bash
npx svelte-vitals@latest
```

> [!WARNING]
> **Pre-1.0.** APIs, rule IDs, scoring, and output formats can change at any time, including breaking changes between minor releases.

## Usage

Run inside any SvelteKit project:

```bash
npx svelte-vitals@latest              # analyze the current directory
npx svelte-vitals@latest ./apps/web   # or a specific path
```

```
Svelte Vitals  ·  static mode

Health: 76/100
SEO Score: 51/100   (route avg 61 · site −10)
Architecture Score: 100/100   (route avg 100)

Critical (1)
────────────────────────
✗ seo/title-presence  Missing <title>
            /
            src/routes/+page.svelte

Warnings (10)
────────────────────────
✗ seo/canonical-url  Missing <link rel="canonical">
            /
            src/routes/+page.svelte
            …and 1 more
…and 1 more rule affected — run with --verbose to see all

Passed (11)
────────────────────────

↯ = set dynamically (verified at runtime).
```

By default, console output groups failures by rule (top 5 per severity, each with one example location and an "…and N more" count) and collapses the Passed section to a bare count, so large projects don't flood the terminal. Pass `--verbose` to see every finding uncapped and ungrouped, with each passed item listed individually. On an interactive, color-capable terminal the Health score plays a short reveal animation; pass `--no-animation` to disable it.

On an interactive terminal wide enough for the mascot (20+ columns), a small line-art face appears alongside both the analysis spinner and the Health-score reveal, reacting to the score (a perfect 100 gets a confetti flourish). On a wider terminal still (55+ columns) it also greets you with a short line in a speech bubble at startup, and again with a matching reaction line at the score reveal. `--no-animation` disables all of it, falling back to the plain spinner and plain score animation.

### Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | No failing findings                                                         |
| `1`  | Critical finding present, or `--fail-on` / `--min-health` threshold reached |
| `2`  | Execution error (not a SvelteKit project, internal error, etc.)             |

Useful as a CI gate.

### Reporters

`--reporter <fmt>` selects the output format: `console` (default), `json`, `agent`, `sarif`, `github`, `html` (self-contained, `--out-file`), and `md` (compact, for PR comments/job summaries). `agent` auto-selects inside known AI-agent harnesses (e.g. Claude Code); `github` auto-selects under GitHub Actions.

### Ramping up on an existing project

`--diff [ref]` / `--staged` scope findings to changed/staged files; `--baseline <ref>` scopes to findings that are genuinely new versus a ref; `--update-suppressions` records today's findings once so only newly-introduced issues gate the build afterward. `--rules`/`--ignore`/`--category` select which rules run, `--weights` reweights the combined Health score, and `--min-health`/`--score` gate or print just the number. A `svelte-vitals.config.{mjs,js,ts}` file (scaffolded via `svelte-vitals install --client config-file`) can set any of these once instead of repeating flags.

### `svelte-vitals install`

An interactive wizard that wires up the [Vite plugin](https://www.npmjs.com/package/@svelte-vitals/vite)'s live dashboard, Agent Skills (`/svelte-vitals`, `/improve-svelte`) for Claude Code, Codex, and Cursor, a `svelte-vitals.config` file, and a GitHub Actions CI workflow — grouped by category in the picker so it's clear what each target is for:

```bash
npx svelte-vitals@latest install
```

### `svelte-vitals docs` / `svelte-vitals explain`

Both read out of the CLI itself, so the answer always matches the installed version and needs no network — the thing an AI agent otherwise guesses at or fetches from a page describing a different release.

```bash
npx svelte-vitals@latest docs list             # every bundled topic, with a one-line description
npx svelte-vitals@latest docs show scoping
npx svelte-vitals@latest explain --list        # every rule, by category
npx svelte-vitals@latest explain performance/heavy-import
```

`explain <rule-id>` prints that rule's rationale, docs link, fix template, and — for a configurable rule — every option's default, bounds, and how a configured value merges with the built-in default: the detail needed to decide whether a finding is a defect or a threshold disagreement. `docs list` and both forms of `explain` take `--json`; `docs show` prints the topic as Markdown.

### CI integration

`svelte-vitals ci install` scaffolds a GitHub Actions workflow around `@svelte-vitals/action` — inline PR annotations, a job summary, and a sticky PR comment, no YAML to hand-write. The same workflow is also a selectable `ci-workflow` target inside `svelte-vitals install`, so it can be set up in the same pass as everything else. See [CI integration](https://oekazuma.github.io/svelte-vitals/guides/ci/).

### Agent-native output

`svelte-vitals --reporter agent` emits a Markdown remediation document an AI coding agent can act on directly: each failing finding lists its location, a concrete fix (with a code snippet), and an acceptance check.

It is selected **automatically** when run inside a known AI-agent harness (e.g. Claude Code sets `CLAUDECODE`). Force it anywhere with `SVELTE_VITALS_REPORTER=agent`, or override with `--reporter console|json`. When auto-selected (not requested explicitly), a one-line hint is printed to stderr explaining how to override, so a human running it in an agent terminal isn't surprised by the Markdown output.

## How it works

svelte-vitals resolves the effective `<head>` of every route by walking the layout chain (`+layout.svelte` → … → `+page.svelte`) and parsing `<svelte:head>` with `svelte/compiler`.

A dynamic title such as `<title>{data.title}</title>` — the most common, correct SvelteKit pattern — is **never** flagged as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is penalized.

See the [full documentation](https://oekazuma.github.io/svelte-vitals/) for every flag, rule, and reporter, or the [project README](https://github.com/oekazuma/svelte-vitals#readme) for the full picture and roadmap.

## License

[MIT](https://github.com/oekazuma/svelte-vitals/blob/main/LICENSE.md) © [Kazuma Oe](https://github.com/oekazuma)
