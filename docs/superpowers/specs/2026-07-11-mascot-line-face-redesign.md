# Design: Mascot line-face redesign + pulse-line colorization

**Date:** 2026-07-11
**Status:** Implemented
**Packages:** `svelte-vitals` (CLI) only — no `@svelte-vitals/core` changes
**Supersedes:** `docs/superpowers/specs/2026-07-11-cli-mascot-pixel-fox-redesign.md` (the pixel-art fox, merged in PR #175, including the speech-bubble feature from PR #176).

## Context

The pixel-art fox (PR #175) shipped, but on reflection the project owner regretted the animal-mascot direction entirely — not just the visual execution this time, but the concept itself: "動物なんも関係ないやんって…" (an animal has nothing to do with what this tool is). The replacement is a minimal, abstract "face" — a rounded rectangle with two round eyes and a mouth, provided as a hand-drawn reference image — recolored to Svelte's brand orange, with the mouth (and, at the happiest state, the eyes) changing shape to signal mood. This is a full replacement of every mascot appearance (idle loop, score-reveal reaction, startup greeting), not an addition alongside the fox.

Alongside this, the project owner asked to also improve the existing pulse/heartbeat waveform line (`packages/cli/src/pulse-animation.ts`'s `WAVE_FRAMES`) shown during the score reveal, scoped specifically to color only (not its shape or frame count) — it currently renders in the terminal's default color, uncoordinated with the now-monochrome-orange mascot next to it.

## Mascot redesign

### Visual reference (as approved)

All frames are 4 lines tall, 12 columns wide (`╭` + 10 interior + `╮`), rendered as **pure line art in a single color** (Svelte orange, `#ff3e00`/`rgb(255,62,0)`) — no fills, no second color, no per-cell truecolor mixing. This is a deliberate step back from the fox's half-block pixel-art technique: a flat rectangle with a face doesn't need it, and dropping it removes a meaningful amount of rendering complexity from `mascot.ts`.

```text
Idle (eyes open):        Idle (blink):
╭──────────╮             ╭──────────╮
│  ●    ●  │             │  ─    ─  │
│    ──    │             │    ──    │
╰──────────╯             ╰──────────╯

content (score < 90):     happy (90-99):            ecstatic (100):
╭──────────╮              ╭──────────╮               ╭──────────╮
│  ●    ●  │              │  ●    ●  │               │  ^    ^  │
│    ◡◡    │              │   ◡◡◡◡   │               │  ◡◡◡◡◡   │
╰──────────╯              ╰──────────╯               ╰──────────╯
```

Mood is conveyed almost entirely through mouth width (matching the fox design's established principle that mouth shape is the primary mood signal) plus, at `ecstatic` only, the eyes switching from `●` (open) to `^` (closed/joyful) — no blush or other accent colors this time; the whole point of this redesign is to be minimal. The `ecstatic` state's celebratory feel leans on the **existing, unmodified confetti bonus** (particle rows rendered around the mascot at a perfect 100, already implemented and reviewed in PR #175) rather than adding sparkle characters to the mascot art itself — one visual flourish mechanism, not two.

### Rendering technique

Each state is a literal 4-line string array (no pixel grid, no alphabet-driven cell lookup). Rendering wraps the whole block in one `\x1b[38;2;255;62;0m` (Svelte orange) / `\x1b[0m` pair — there is no background color and no per-character color decision, since every visible character is the same color and the box interior is simply not drawn (spaces), letting the real terminal background show through automatically (no explicit transparency handling needed, unlike the fox's half-block technique, because there's no background fill to manage in the first place).

This removes from `mascot.ts`: `renderPixelGrid`, the `Pixel` type/alphabet, `PIXEL_COLOR`, `EAR_INNER`/`WHITE`/`DARK`/`BLUSH`/`BLUSH_BRIGHT`, `withBlush`, and the `row()` compaction helper. It keeps: `MascotState`, `mascotStateFor`, `mascotFitsWidth` (value changed, see below), `renderMascotReaction`, `renderMascotAnticipating`, `renderMascotIdleFrame`/`IDLE_FRAME_SEQUENCE`, `startMascotSpinner`, and the confetti functions (`renderConfettiFrame`, `confettiRow`, `CONFETTI_COLORS`, `CONFETTI_CHARS`) — confetti still just wraps whatever `mascotBlock` string it's given with a particle row above/below, and doesn't care that the block is now 4 lines instead of 7.

### Width thresholds

The old `MIN_MASCOT_COLUMNS = 40` was sized for a 14-column-wide fox with a generous margin. The new box is 12 columns wide — keeping a 40-column gate would needlessly hide the mascot on plenty of terminals it would actually fit on. New value: **`MIN_MASCOT_COLUMNS = 20`** (a comfortable margin over 12, and still well below any realistic terminal width).

`MIN_BUBBLE_COLUMNS = 55` (in `speech-bubble.ts`) is untouched — the bubble's width depends on message length (up to 30 columns for the longest message), not on the mascot's width, and 12 (new mascot) + 1 (gap) + 30 (bubble) = 43 is still comfortably under 55. No change needed there, and leaving it alone minimizes the diff.

### Speech bubble corner style

`speech-bubble.ts`'s `renderSpeechBubble` currently draws sharp corners (`┌─┐│└─┘`). Since the mascot box is now rounded (`╭─╮│╰─╯`), the bubble's corners change to match:

```ts
export function renderSpeechBubble(text: string): string[] {
  const border = '─'.repeat(text.length + 2);
  return [`╭${border}╮`, `│ ${text} │`, `╰${border}╯`];
}
```

This is the only change to `speech-bubble.ts` — its message pools, random selection, width gating, and composition/greeting-playback logic are all unaffected by the mascot's visual redesign.

## Pulse-line colorization

`WAVE_FRAMES` (`pulse-animation.ts`) — the `────────────╱╲──────────`-style heartbeat line — currently renders in the terminal's default foreground color on every frame; only the `Health: NN/100` text next to it is colored (dim while counting, `scoreColor`-threshold-colored on the final frame). This leaves the wave visually disconnected from the now-monochrome-orange mascot beside it.

Fix, scoped to color only (no change to `WAVE_FRAMES`' shape or `FRAME_COUNT`): apply the same dim-while-counting / solid-on-settle treatment already used for the score text, but with a **fixed Svelte-orange** color rather than the semantic `Palette` threshold colors — matching the same rationale `mascot.ts` already established for its own fixed-identity color (a brand accent isn't a pass/warn/fail signal, so it doesn't go through `Palette`). Concretely:

```ts
const WAVE_ORANGE = '\x1b[38;2;255;62;0m';
const WAVE_ORANGE_DIM = '\x1b[38;2;153;37;0m'; // ~60% of full orange, same dimming ratio as a typical ANSI dim
const RESET = '\x1b[0m';

// per frame:
const waveText = isFinalFrame ? `${WAVE_ORANGE}${wave}${RESET}` : `${WAVE_ORANGE_DIM}${wave}${RESET}`;
```

This touches only the `wave` variable's rendering inside `playScoreAnimation`'s frame loop — `scoreText`'s own coloring (which still uses `Palette`/`scoreColor` for pass/warn/fail semantics on the number) is unchanged.

### Follow-up: the settled frame isn't flat either

After trying the shipped build, the project owner flagged that a fully flat settled line reads as "dead" (the opposite of what a health-check tool's own reveal moment should feel like) — a real vitals monitor showing a flat line means the opposite of healthy. Fixed by replacing `WAVE_FRAMES`'s last entry with a single steady beat marked by a heart at the same peak position frame 0 uses, keeping all six frames the same 24-column width (the settled frame was previously 25, one wider than the rest — fixed as part of this same change).

The first version used the Unicode glyph `♡`, on the reasoning that it (unlike an emoji heart such as ❤️) wouldn't have terminal-dependent double-width rendering. That reasoning was incomplete: a follow-up review (CodeRabbit) found `♡` sits in Unicode's "Ambiguous" East Asian Width class — the same class as the box-drawing characters the mascot/wave already use throughout — which some terminal locale configurations render as 2 columns instead of 1. Verified via Python's `unicodedata.east_asian_width('♡')` → `'A'`. Critically, this wasn't just a latent pre-existing risk shared with the rest of the design (the ╭╮╰╯│─●╱╲ set is _also_ Ambiguous-width): the settled frame originally had exactly one Ambiguous-width glyph (`♡`) where frames 0-4 each have two (`╱╲`), so under wide-Ambiguous rendering the settled frame and the counting frames would drift by a different amount and visibly jump out of alignment at the exact moment the animation settles — the one moment this feature most needs to look clean. Switched to the ASCII heart emoticon `<3` (two Basic Latin characters, confirmed `east_asian_width` `'Na'`/Narrow — unconditionally 1 column in every terminal) as a drop-in replacement for the `╱╲` peak shape, eliminating the drift risk entirely rather than just reducing it.

## Non-goals

- No change to `mascotStateFor`'s score-band logic (still `100` → ecstatic, `90-99` → happy, else → content) — this redesign is presentation-only.
- No change to the greeting/reaction message pools, random selection, or playback timing in `speech-bubble.ts` — only its border-character choice changes.
- No sparkle/accent characters added to the mascot art itself (superseded by relying on the existing confetti bonus, see above).
- No change to `WAVE_FRAMES`' frame count or its counting-up frames' (0-4) shape — only the settled frame's content changed (see "Follow-up" above), and only after landing, not part of the original color-only scope.
