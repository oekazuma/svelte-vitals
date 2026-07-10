# Design: Demo GIF on the docs homepage

**Date:** 2026-07-10
**Status:** Proposed
**Packages:** `docs` only (no `packages/*` code changes)

## Goal

The docs homepage (`docs/src/content/docs/index.mdx` and its `ja/` counterpart)
is currently text-only: a wordmark, a one-line tagline, and a "Get started"
button. It doesn't show the tool actually running. Similarly-shaped static
code-health CLIs make their landing pages more compelling by showing a real
terminal recording of the tool in action. This design adds a looping demo GIF
to the Hero section of both locales, showing the pulse-line Health-score
animation (`packages/cli/src/pulse-animation.ts`, shipped in
`feat/console-reporter-compact-animated`) settling into a final score,
followed by the five category score lines.

## Non-goals

- No CI automation to regenerate the GIF on every release. It's a hand-curated
  marketing asset, regenerated manually when the animation or console output
  visually changes — the same maintenance model as `spinner.ts`/`color.ts`
  (hand-rolled, not automated).
- No full walkthrough of grouped/capped console output, `--by-route`, or any
  other reporter. The GIF is scoped to the pulse animation + score reveal
  moment only.
- No change to `packages/core` or `packages/cli` source. This is a docs-only
  asset addition.

## Demo fixture

A small, self-contained SvelteKit-shaped project at `docs/demo/` — enough
files for `svelte-vitals` static analysis to run against (a `package.json`
declaring `@sveltejs/kit`, `src/routes/+layout.svelte`, and a handful of
`+page.svelte` routes). It is **not** a pnpm workspace member: the workspace
glob in `pnpm-workspace.yaml` is the literal `'docs/'` (no wildcard), so a
nested `docs/demo/package.json` is invisible to pnpm, exactly like the
existing nested fixtures under `packages/cli/test/fixtures/*/package.json`.

The fixture is deliberately seeded with a light mix of findings across all
five categories (SEO, Performance, Correctness, Security, Architecture) so
that after the animation settles, all five category score lines print —
demonstrating the tool's breadth without needing to show the grouped-findings
body itself. Findings are tuned so the final Health score lands in the
90–96 band, rendering in the `scoreColor` green band (see
`packages/core/src/reporter/console.ts`'s `scoreColor` thresholds: ≥90 green).
A high score reads as "polished, real project" rather than either a
manufactured failure showcase (low score) or a suspiciously perfect 100.

## Recording pipeline

- **Tool:** [vhs](https://github.com/charmbracelet/vhs) (Charm), a
  terminal-session-to-GIF recorder driven by a `.tape` script. It runs the
  command in a real pty, so svelte-vitals' own TTY/color detection
  (`colorEnabled`, `scoreAnimationEnabled`) behaves exactly as it would for a
  real user — no special-casing needed to force the animation on.
- **Script:** `docs/demo/demo.tape`, committed to the repo so the GIF is
  reproducible. It builds the local CLI, runs it against `docs/demo/`, and
  captures the session: prompt → (near-instant analysis on a tiny fixture) →
  the 1.2s pulse animation → Health score settles → five category score lines
  print statically → a 2–3s hold on the final frame (so a viewer watching the
  GIF loop can read the result before it restarts).
- **Appearance:** a dark terminal theme, sized and font-scaled to sit
  comfortably in the Hero section at the site's default content width. Dark
  regardless of the docs site's light/dark toggle — it's an embedded image,
  not theme-aware, the same way a terminal screenshot in a GitHub README stays
  fixed regardless of GitHub's theme.
- **Output:** `docs/public/demo.gif`, alongside the existing
  `wordmark.svg`/`favicon*` assets in that folder.

## Placement

Both `docs/src/content/docs/index.mdx` and `docs/src/content/docs/ja/index.mdx`
gain a `hero.image.html` entry — Starlight's native hero-media slot, rendered
in its own dedicated position (beside the title/tagline/actions column on
desktop, stacked above it on narrow viewports), not a third raw-HTML hack
squeezed into an unrelated frontmatter field. `image.html` is a raw-HTML
passthrough (`Hero.astro` renders it via `set:html` into a `.hero-html` div)
rather than Starlight's `image.file`/`image.dark`+`image.light` fields, which
route through Astro's `astro:assets` `<Image>` component — that pipeline runs
local images through Sharp for optimization, and Sharp only preserves the
first frame of an animated GIF, which would silently flatten our animation
into a still frame. `image.html` bypasses that pipeline entirely (a plain
`<img>` tag pointed at the public asset), the same reasoning that already
keeps the wordmark in `hero.title` as raw HTML instead of a processed image.
Because the GIF is language-neutral (terminal output strings are in English
regardless of locale, consistent with today's tool behavior), the same
`docs/public/demo.gif` file is referenced from both locale pages — no
separate ja-specific recording.

## Maintenance

`demo.tape` is the source of truth; `demo.gif` is a build artifact of running
`vhs docs/demo/demo.tape` locally and committing the result. There is no CI
step that verifies the GIF is "fresh" (unlike `packages/action/dist/`, which
CI does verify) — a stale GIF is a cosmetic issue, not a correctness one, and
automating video regeneration in CI is disproportionate to the benefit for a
marketing asset that changes rarely.
