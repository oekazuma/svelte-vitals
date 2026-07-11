# Design: CLI mascot pixel-art fox redesign

**Date:** 2026-07-11
**Status:** Implemented
**Packages:** `svelte-vitals` (CLI) only — no `@svelte-vitals/core` changes

## Context

`docs/superpowers/specs/2026-07-10-cli-mascot-animation-design.md` shipped a
thin-line ASCII-art mascot with five emotional states
(ecstatic/happy/content/discouraged/alarmed) in PR #172. Once running for
real, the project owner judged the line art too unsettling to ship as the
CLI's marketing-facing centerpiece: "マスコットが不気味すぎますねw ...
Claude Codeのマスコットみたいに密度があってかわいいキャラがいいですね" (too
creepy; wants something dense and cute like Claude Code's own mascot, not
"mediocre ASCII art"). This design replaces the rendering technique and
scales the state set back down.

## Rendering technique: half-block pixel art

Line art was replaced with a fox sprite rendered using the terminal
half-block technique: the `▀` (upper half block) character packs two
logical pixel rows into one printed row, with independently set 24-bit
truecolor ANSI foreground (top pixel) and background (bottom pixel) codes.
No new dependency — this is plain ANSI escape sequences
(`\x1b[38;2;R;G;Bm` / `\x1b[48;2;R;G;Bm}`), same "earn its place" bar as the
original design's library decision, just resolved as "hand-rolling wins"
this time since the technique itself is a handful of lines.

**Per-cell transparency.** An early prototype hardcoded a fill color for
"empty" pixels, tuned to look right against one specific `vhs` recording's
background theme — that would render as a visible mismatched box on any
real terminal with a different (especially light) background. Fixed in
`renderPixelGrid` (`packages/cli/src/mascot.ts`) by choosing per cell: `▀`
with an explicit default background when only the bottom pixel is
transparent, `▄` with an explicit default background when only the top
pixel is transparent, a plain space + reset when both are transparent, and
the standard `▀` (fg=top, bg=bottom) when both are opaque. Verified against
a `vhs` recording with a deliberately unusual bright-green terminal
background — no artifact box.

## Visual design

Iterated with the project owner through several rounds (dog → fox, a
user-provided reference sprite, ear/cheek/mouth proportion passes), then
handed to a `fable`-model subagent for further refinement per the owner's
explicit instruction ("よくはなりましたが、もっとよくできそうです。Fableに頼
んでもいいよ" — Fable for design iteration, Sonnet for implementation). The
approved mood-signaling strategy: mouth shape is the primary signal;
blush is a secondary accent, applied only for the two positive states.

## Scope simplification: five states → three

The original design's `discouraged`/`alarmed` states (and the
`hasCritical` override in `mascotStateFor`) needed the most redesign
iteration to get the frown shape looking intentional rather than
accidental — and once that was finally right, the project owner cut both
states from scope entirely: "OKです。ただし、discouraged と alarmedは使用し
なくてOKです。そこまでバリエーション増やさなくてもいいので" (don't need that
many variations). Confirmed via a follow-up choice to also simplify the
decision logic itself, not just hide the states visually.

`mascotStateFor(score: number): MascotState` (`'ecstatic' | 'happy' |
'content'`) now takes only the score — no `hasCritical` parameter, no
critical-finding override:

- `100` → `ecstatic`
- `90–99` → `happy`
- everything else (including a low score with critical findings present) →
  `content`

This is a genuine behavior change from the merged PR #172: a critical
finding no longer forces a distinct "alarmed" reaction. The mascot's role
is narrowed to "reacts to the numeric score," not "also signals
finding severity" — severity is already fully conveyed by the report body
above it and the process exit code, so the mascot lost no unique
information by dropping the override.

## `Palette` decoupling

The pixel-art sprite uses its own fixed RGB palette
(`packages/cli/src/mascot.ts`), not `@svelte-vitals/core`'s `Palette`
abstraction used elsewhere in the CLI for text coloring. A filled pixel
sprite has no meaningful "no-color" fallback — dropping ANSI would leave
meaningless block characters, not readable text — so there was nothing for
a `Palette` parameter to abstract over. This is safe because every call
site (`startMascotSpinner`, and the score-reveal path in
`pulse-animation.ts`) only ever renders the mascot once color is already
confirmed enabled (`spinnerEnabled`/`scoreAnimationEnabled` both require
`colorEnabled(...)`) — the mascot itself is never reached otherwise.
`ScoreAnimationOptions` also lost its `hasCritical` field as a result.

## Non-goals

- Re-recording the docs homepage demo GIF (PR #174) to show the new fox —
  known follow-up, explicitly deferred by the project owner until raised
  again.
- Any change to `@svelte-vitals/core` — this is entirely a CLI-package
  presentation change.
