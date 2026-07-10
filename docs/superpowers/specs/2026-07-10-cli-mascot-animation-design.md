# Design: CLI mascot animation

**Date:** 2026-07-10
**Status:** Proposed
**Packages:** `svelte-vitals` (CLI) only — no `@svelte-vitals/core` changes

## Goal

Give svelte-vitals' CLI a small animated mascot character that appears (1)
during analysis, replacing the braille spinner, and (2) at the Health-score
reveal, reacting with an expression tied to the result. This is explicitly a
marketing-driven feature, not a pure-UX one: the strategic reasoning (from
the project owner) is that most developers won't keep using the CLI
long-term, so the CLI's real value is as an attention-grabbing first
impression — something a developer screenshots or records and posts to
social media (X/Twitter in particular). Every design choice below is
weighed against "does this make the score-reveal moment more shareable as a
short video clip," not against minimalism or raw performance being the
overriding concern (though neither is abandoned — see Non-goals).

## Prior art consulted

- `packages/cli/src/spinner.ts` — hand-rolled braille spinner, stderr-only,
  gated by `spinnerEnabled` (`packages/cli/src/index.ts`).
- `packages/cli/src/pulse-animation.ts` — hand-rolled pulse/heartbeat
  waveform animation that plays the Health-score reveal on stdout, gated by
  `scoreAnimationEnabled`. Introduced in
  `docs/superpowers/specs/2026-07-10-console-reporter-compact-and-animated-design.md`,
  which established the redraw technique (`\r` + ANSI cursor-up) and the
  TTY/CI/agent/`--no-color`/`--no-animation` gating this design reuses
  rather than reinvents.
- `docs/superpowers/specs/2026-07-10-docs-homepage-demo-gif-design.md` —
  established that the CLI's console output is already treated as a
  marketing asset (a `vhs`-recorded GIF on the docs homepage). This design
  continues that trajectory but for the CLI's own runtime behavior rather
  than a docs-site asset.

Unlike both prior designs, this feature is **not** constrained to zero new
dependencies — the project owner explicitly relaxed that constraint for this
feature, on the condition that any dependency earn its place on a quality
basis ("ライブラリは手段なので、使った方が完成度が高いなら調査して良いものを使って
欲しいですし、使わずとも作れるのであれば依存関係は少ない方がいいでしょう" — a
library is a means to an end: use one if it demonstrably raises quality,
stay dependency-free if hand-rolling reaches the same quality). See
"Library decision" below for how that bar was applied.

## Library decision

Candidates researched: `log-update` (sindresorhus), `chalk-animation`,
`cli-confetti`, and heavier TUI toolkits (`ink`, `terminal-kit`,
`cfonts`/`boxen`).

- **`chalk-animation`** and **`cli-confetti`** were rejected: both are
  low-download, narrowly-scoped packages whose abstractions (whole-string
  text effects; a standalone full-screen confetti display) don't fit
  composing a hand-authored multi-line mascot with its own per-frame state
  — using either would mean fighting the library's model rather than being
  helped by it. No clear quality win over hand-authoring, so per the
  project owner's bar, they're out.
- **`ink`/`terminal-kit`/`cfonts`/`boxen`** were rejected: raw-mode/renderer
  machinery and abstraction weight disproportionate to a decorative
  mascot, and no quality benefit specific to this feature that a smaller
  tool doesn't already provide.
- **`log-update`** (sindresorhus, ~15M weekly downloads, ESM, ships as a
  dependency of widely-used CLIs like `ora`/`listr2`) is adopted for the
  **redraw mechanism only**. The concrete quality gap it closes: today's
  hand-rolled redraw in `pulse-animation.ts` overwrites a fixed line count
  via `\x1b[2A`, which silently corrupts if any line wraps at the
  terminal's actual column width. That risk was tolerable at 2 lines; the
  mascot pushes the redrawn block to roughly 6–8 lines (mascot body, wave,
  and score, plus confetti frames), and a narrow terminal — exactly the
  kind someone might use to capture a phone-shaped recording for social
  video — is where this would visibly break. `log-update` tracks actual
  rendered height including wraps and repaints correctly; that's a
  specific, testable, narrow-terminal correctness improvement, not general
  convenience.
- **Everything else about the mascot — the ASCII/Unicode art, the five
  reaction poses, the idle loop, the confetti particles — stays
  hand-authored data**, in the same spirit as `pulse-animation.ts`'s
  `WAVE_FRAMES`: literal frame strings, no library involved in generating
  or interpreting them. `log-update` only replaces the "how do I repaint
  these already-decided lines" primitive.

## Visual design

- A small multi-line (roughly 4–5 lines tall, ~10–16 columns wide)
  Unicode/ASCII-art mascot. Exact glyph content is authored during
  implementation (matching how `WAVE_FRAMES`' literal strings were
  hand-tuned, not derived from a spec-level ASCII sketch); this design
  fixes the _constraints_ (size envelope, color rules, states), not the
  literal characters.
- **Body color:** Svelte's brand orange (`#ff3e00`, matching
  `packages/core/src/reporter/html.ts`'s `--accent`), constant across every
  state — the mascot is recognizable as "the svelte-vitals character" in
  any pose, which matters for a screenshot/video to read as branded content
  at a glance.
- **Face/eyes color:** varies by state, reusing the console reporter's
  existing `scoreColor` semantics (green/yellow/red) via the CLI's existing
  `Palette` — the body stays constant while the face is what visibly
  communicates mood, so viewers unfamiliar with the tool immediately read
  "something changed" between the idle and reveal moments.
- No literal reproduction of Svelte's official logo mark — an original
  character, not a mascot-ified version of Svelte's own flame/S logo.

## Reaction states

Determined by final Health score and whether any `critical`-severity
finding is present. A structural fact from `packages/core/src/scoring/score.ts`
simplifies this: `CRITICAL_CAP = 79` means a critical finding always caps
the score at ≤79, so "critical present" and "score ≥ 90" can never occur
together — the state table below has no unreachable/contradictory branch.

Evaluated top to bottom; first match wins:

| #   | Condition                    | State                       | Notes                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Any critical finding present | **Alarmed / concerned**     | Checked first, defensively — real (score, hasCritical) pairs never actually reach this branch above Health 79 (`CRITICAL_CAP` in `packages/core/src/scoring/score.ts` caps any score with a critical finding at ≤79), but checking it first means the mascot can never celebrate a critical finding even given an inconsistent input. |
| 2   | Health === 100               | **Ecstatic**                | + confetti bonus (see below). Only reachable with no critical finding, by construction.                                                                                                                                                                                                                                               |
| 3   | Health ≥ 90 (and < 100)      | **Happy / proud**           | Only reachable with no critical finding, by construction.                                                                                                                                                                                                                                                                             |
| 4   | Health 70–89, no critical    | **Content / neutral smile** |                                                                                                                                                                                                                                                                                                                                       |
| 5   | Health < 70, no critical     | **Discouraged**             |                                                                                                                                                                                                                                                                                                                                       |

### 100/100 bonus: confetti

The project owner's own suggestion: a perfect score gets an extra flourish
— a short burst of hand-authored Unicode confetti particles (reusing the
existing `Palette` colors; no RNG, so frames are deterministic and
reproducible in both tests and repeated recordings) layered around the
mascot after its pose settles. This is scoped as a **bonus for exactly
Health === 100** only, not a generalized "high score" effect — reserving it
for the rarest, most screenshot-worthy outcome is what makes it land as
special rather than diluting it across the whole 90–99 band. Kept in scope
(not deferred) because it's cheap relative to the states work already being
built and it's the single most likely "someone posts this" moment.

## Behavior

### Analysis phase (replaces the spinner)

- Gated by the existing `spinnerEnabled` conditions unchanged
  (`packages/cli/src/index.ts`: console reporter, stderr TTY, not an
  auto-detected agent/CI shell), **plus** the new `--no-animation` flag,
  which this feature is the first to make the spinner itself responsive to.
  When disabled by any of these, the CLI falls back to the existing braille
  spinner (`spinner.ts`, untouched) — disabling the mascot never removes
  the progress indicator entirely, it only downgrades it.
- While enabled: a small idle loop (2–4 frames — e.g. a blink/breathe
  cycle), looping indefinitely for as long as analysis takes, at roughly a
  1-second full-cycle pace. The existing status text (e.g. `Analyzing…`)
  continues to render alongside it, same as today.
- Same stream (stderr) and same "no-op when disabled" contract as
  `spinner.ts` today.

### Score-reveal phase (extends the pulse animation)

- Gated by the existing `scoreAnimationEnabled` conditions unchanged
  (console reporter, stdout TTY, not agent/CI, color enabled, not
  `--no-animation`). No new flag is introduced for this phase — it reuses
  `--no-animation` exactly as `pulse-animation.ts` already does.
- The existing pulse waveform (`WAVE_FRAMES`) and score count-up are kept
  as-is. While the score counts up, the mascot shows a neutral
  "anticipating" pose. On the final frame — when the wave line settles flat
  and the score locks in — the mascot snaps to the reaction state from the
  table above in the same instant. This single cut (neutral → reaction) is
  the deliberate "payoff" beat: a sudden, legible pose change reads clearly
  even in a short, low-frame-rate social video clip, which a gradual
  transition would not.
- After the cut, the settled pose holds briefly before the CLI continues
  printing the (static) category score lines below, so a viewer/recording
  has time to register the expression.

### Narrow-terminal fallback

If `stream.columns` is unavailable or below a minimum width (~40 columns —
narrower than the mascot's widest line plus margin), the mascot layer is
skipped entirely and the CLI falls back to today's pulse-only animation
(waveform + counting score, no character). The animation itself is never
disabled by width — only the mascot art specifically is.

## Timing budget

Deliberately tight, since the design goal is a clip a viewer would actually
watch to the end rather than skip:

- Pulse settle + score lock-in: unchanged from today, ~1s (existing 6
  frames × 200ms).
- Pose hold after the reveal cut: +~0.5s.
- Confetti bonus (Health === 100 only): +~0.8–1s on top of the above.
- **Total: ~1.5s for the ordinary case, ~2.5s worst case (perfect score)** —
  short enough to sit comfortably inside a social clip without padding.

The analysis-phase idle loop has no fixed budget — it runs for however long
real analysis takes, same as the spinner does today.

## New / changed files

- `packages/cli/src/mascot.ts` (new) — mascot frame data (idle loop, the
  five reaction poses, confetti particle frames), the pure state-selection
  function `(score: number, hasCritical: boolean) => MascotState`, and the
  `log-update`-based render loop for both the analysis-phase and
  score-reveal-phase call sites.
- `packages/cli/src/spinner.ts` — unchanged; kept as the fallback when the
  mascot idle loop is disabled (by non-TTY, CI/agent, or `--no-animation`).
- `packages/cli/src/pulse-animation.ts` — extended to hand off to the
  mascot's reaction-state render on its final frame, rather than settling
  on plain text; `WAVE_FRAMES` and the count-up logic are otherwise
  unchanged.
- `packages/cli/src/index.ts` — thread `--no-animation` into the
  spinner-vs-mascot choice at the analysis call site (today it only gates
  the score-reveal animation).
- `packages/cli/src/bin.ts` — no new flags to parse; `--no-animation`
  already exists and simply gains a second effect.
- `packages/cli/package.json` — new dependency `"log-update": "catalog:"`.
- `pnpm-workspace.yaml` — add `log-update` to the shared `catalog:` block.
  Every dependency in this monorepo (including single-package runtime
  dependencies, e.g. `tinyglobby`/`@clack/prompts` in `packages/cli`) is
  already catalog-pinned with no exceptions, so this follows existing
  convention rather than setting a new one.

## Naming / branding stance

The mascot is deliberately **unnamed** in all official CLI output, code
identifiers, and documentation. This is an explicit strategic choice, not
an oversight: the project owner's reasoning is "こういうのはユーザーが勝手に
つけていくものです" — a name imposed top-down forecloses the organic
naming/adoption a community might otherwise do on its own (the way
recognizable product mascots often become known by fan-given nicknames).
Code identifiers use the functional term `mascot` (file name, type name
`MascotState`, etc.); no user-facing string anywhere introduces a proper
noun for the character.

## Non-goals

- Reactions tuned to per-category (SEO/Performance/etc.) trends — rejected
  during design discussion as more state/pose surface than the payoff
  justifies (YAGNI).
- Any change to json/html/md/github/sarif/agent reporters — console
  reporter and CLI runtime behavior only.
- Automating social sharing itself (e.g. auto-generating or auto-posting a
  clip) — this design only makes the _moment_ worth capturing; capturing
  and posting stays a manual, human action.
- A dedicated flag to disable only the mascot while keeping the rest of the
  animation — `--no-animation` remains the single on/off switch, matching
  `pulse-animation.ts`'s existing precedent of one flag controlling
  everything decorative.
- **Re-recording the docs homepage demo GIF** (`docs/demo/demo.tape` →
  `docs/public/demo.gif`, from
  `docs/superpowers/specs/2026-07-10-docs-homepage-demo-gif-design.md`) to
  show the new mascot. The project owner has asked for this, but explicitly
  as separate follow-up work once the mascot ships, not part of this
  implementation — noted here so it isn't lost, not planned in detail.
- Reduced-motion signaling beyond the existing TTY/CI/`NO_COLOR`/agent
  gates, `--no-animation`, and the new narrow-terminal width fallback —
  same stance as `pulse-animation.ts`'s design (no terminal equivalent of
  `prefers-reduced-motion` to detect automatically).

## Testing

- **State selection:** unit tests for the pure `mascotStateFor(score, hasCritical)`
  function covering every boundary the table implies — 79/80, 89/90,
  99/100, and critical-present vs. absent at each of those boundaries.
- **Frame content:** not snapshot-tested, matching the project's existing
  stance for `pulse-animation.ts`/`spinner.ts` — verified by manual check
  in a real terminal before shipping. Tests instead assert that the final
  rendered output contains the correct score and (indirectly, via a
  distinguishing marker in test-injected frame data or the exported state
  value) the correct state, not the literal art.
- **Gating:** the extended `spinnerEnabled` (now also consulted for
  mascot-vs-braille) and unchanged `scoreAnimationEnabled` get the same
  per-condition test coverage they already have today (non-TTY, CI/agent
  env, `NO_COLOR`/`--no-color`, `--no-animation`, non-console reporter).
- **Narrow-terminal fallback:** unit test that a sub-40-column
  `stream.columns` value falls back to the pulse-only render.
- **Timing:** matches `pulse-animation.ts`'s existing convention of
  injected/fake frame delays rather than real sleeps in tests.

## Release

`svelte-vitals` (CLI) only, **minor** — new runtime behavior and a new
dependency, backward compatible (`--no-animation` already existed; its
scope simply widens). `@svelte-vitals/core` is untouched. Requires a
changeset per `AGENTS.md`.

## Documentation

Update `packages/cli/README.md` and the CLI guide under
`docs/src/content/docs/` (en + ja) to describe the mascot's two
appearances, the reaction states, the 100/100 confetti bonus, and that
`--no-animation` disables it (falling back to the plain spinner and
plain pulse animation respectively).
