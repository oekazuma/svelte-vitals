# Design: Mascot speech bubble

**Date:** 2026-07-11
**Status:** Proposed
**Packages:** `svelte-vitals` (CLI) only — no `@svelte-vitals/core` changes
**Depends on:** `docs/superpowers/specs/2026-07-11-cli-mascot-pixel-fox-redesign.md` (unmerged, PR #175) — this branch stacks on `feat/mascot-pixel-fox`.

## Goal

Give the pixel-art fox mascot a short line of speech in a bordered box next
to it, at two moments: once at CLI startup (a greeting) and once at the
Health-score reveal (a reaction comment matching the score band). The
project owner's own framing: "吹き出して喋るようにしてもいいですね！
Welcome Svelte Vitals！とかいろんなバリエーションで" — a talking speech
bubble with several message variations.

## Where it appears (and where it doesn't)

Two moments only:

1. **Startup greeting** — shown once, before analysis begins, for a fixed
   hold duration regardless of how fast analysis actually finishes.
2. **Score reveal** — shown alongside the existing reaction pose, riding
   the same hold window `playScoreAnimation` already uses
   (`REACTION_HOLD_MS`, 500ms in real playback).

Explicitly **not** shown during the analysis-phase idle loop
(`startMascotSpinner`): the project owner ruled this out directly —
analysis can finish fast enough that a message would flash by unreadably
("解析中は早く終わる場合だと読めない文字が一瞬出ることになるからいらないと
思う"). The idle loop is unchanged by this design.

## Message selection

Random, not fixed or deterministic-by-score — confirmed as the project
owner's preference over a single fixed line per state. Each display picks
one message uniformly at random from the relevant pool:

- **Greeting pool** — one shared pool, shown at startup (score isn't known
  yet, so no state-based split here):
  ```
  Welcome to Svelte Vitals!
  Let's check your project!
  Ready when you are!
  Hi there! Let's dig in.
  ```
- **Reaction pools** — one pool per `MascotState`, so the message tone
  matches the fox's expression:
  - `ecstatic`: `Perfect score!` / `Flawless!` / `You nailed it!`
  - `happy`: `Nice work!` / `Looking great!` / `Almost perfect!`
  - `content`: `Keep going!` / `Room to grow!` / `Let's improve this!`

All messages are English (matches the existing spinner copy, `README.md`,
and the original mascot design's explicit marketing intent — shareable
screenshots/clips aimed at a global audience, not localized CLI chrome)
and kept to ≤26 characters so the bubble stays compact.

## Rendering

New file `packages/cli/src/speech-bubble.ts`, kept separate from
`mascot.ts` (pixel-art rendering) — one clear responsibility each.

```ts
function renderSpeechBubble(text: string): string[] {
  // Unicode box-drawing border (┌─┐│└─┘), sized to `text.length + 2`
  // interior padding. Returns exactly 3 lines: top border, "│ text │",
  // bottom border.
}

function withSpeechBubble(mascotBlock: string, bubbleLines: string[]): string {
  // Zips mascotBlock's lines (always 7, uniform 14-cell visible width —
  // see mascot.ts's renderPixelGrid) with bubbleLines to their right,
  // separated by one space. bubbleLines (3 lines) is vertically centered
  // against the 7 mascot lines: 2 blank-padded lines above, 3 bubble
  // lines, 2 blank-padded lines below.
}
```

Bubble width is dynamic per message (`text.length + 2` interior + 2 border
columns), not a fixed constant — each display is a static, non-animating
render, so there's no visual "jump" to avoid between frames the way there
would be in an animated sequence.

**Width gating.** A new `bubbleFitsWidth(columns): boolean` sits above the
existing `mascotFitsWidth` (40 columns) — the fox itself doesn't need the
extra space, but the fox+bubble combination does. Worst case (longest
message "Welcome to Svelte Vitals!", 26 chars): 14 (fox) + 1 (gap) + 30
(26 + 2 padding + 2 border) = 45 columns. `MIN_BUBBLE_COLUMNS = 55` gives
comfortable margin. Below that threshold, the bubble is skipped and the
fox renders alone (existing behavior, unchanged) — the mascot doesn't
disappear just because the bubble doesn't fit.

**Randomness injection.** Message pickers accept an optional
`random?: () => number` (default `Math.random`), so tests can inject a
fixed value and assert deterministically which message was chosen:

```ts
function pickMessage(pool: readonly string[], random: () => number = Math.random): string {
  return pool[Math.floor(random() * pool.length)]!;
}
```

## Integration points

- **`mascot.ts`**: no changes — `speech-bubble.ts` composes on top of its
  existing exports (`renderMascotReaction`, `renderMascotAnticipating`'s
  idle-open pose reused for the greeting frame).
- **`pulse-animation.ts`**: on the final frame, if `bubbleFitsWidth`, wrap
  the reaction block with a randomly-picked message from
  `REACTION_MESSAGES[state]` via `withSpeechBubble` before rendering. No
  change to frame timing — rides the existing hold window.
- **`index.ts`**: new one-shot greeting step before `startMascotSpinner`
  is called — reuses `spinnerEnabled`'s result and stderr stream (no new
  gating function). Holds for a fixed duration via `log-update`, then
  clears, then proceeds to the (unchanged, bubble-free) idle spinner.

## Testing

- `speech-bubble.test.ts` (new): `renderSpeechBubble` border/line-count/
  content correctness; `withSpeechBubble` line-count and width
  consistency against a real `renderMascotReaction` output;
  `bubbleFitsWidth` boundary; `pickMessage` determinism with an injected
  `random`.
- `pulse-animation.test.ts`: extend the final-frame assertions to check a
  reaction message appears in the last write when width allows, and is
  absent below `MIN_BUBBLE_COLUMNS`.
- `run.test.ts` / `index.ts`-level test (wherever the existing spinner
  start-up is exercised): assert the greeting renders once, holds, then
  clears before the idle loop's first tick.

## Non-goals

- A literal comic-style bubble with a tail pointing at the fox (rejected
  in favor of the simpler side-by-side box, the project owner's explicit
  pick).
- Bubble text during the idle analysis loop (explicitly ruled out — see
  "Where it appears").
- Localized (ja) message variants — English only, matching existing CLI
  copy conventions.
- Re-recording docs demo GIFs — separate, already-tracked follow-up
  (PR #174), unaffected by this change.
