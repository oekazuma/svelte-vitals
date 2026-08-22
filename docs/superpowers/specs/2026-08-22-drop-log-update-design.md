# Design: Drop `log-update`, repaint frames in-house

`2026-07-10-cli-mascot-animation-design.md` ("Library decision") adopted `log-update` for one
job: repaint the spinner / greeting / score-animation block without the hand-rolled `\x1b[nA`
redraw corrupting when a line wraps on a narrow terminal. That job is now done by
`packages/cli/src/frame-writer.ts`, and `log-update` leaves the CLI's runtime dependencies.

## Why the library is no longer needed

`log-update` is general: it hard-wraps arbitrary text with `wrap-ansi`, measures East Asian
width with `string-width`, clips to terminal height, and diffs consecutive frames line by line.
The CLI uses none of that generality:

- **Every frame is authored, not user content.** The mascot (12 columns), the wave (24), the
  confetti row (24), the speech bubble (message ≤ 26 chars, bordered) and the status line are
  literal strings in `mascot.ts` / `pulse-animation.ts` / `speech-bubble.ts`. They are built
  from ASCII, box-drawing and braille glyphs — all 1 column wide — and `mascot.ts` already
  rejects fullwidth glyphs for that reason. So a line's rendered height is its code-point count
  (ANSI stripped) divided by `stream.columns`, rounded up. That is the whole width model.
- **Wrapping only happens in a narrow band.** The mascot is gated at 20 columns and the bubble
  at 55; what can still wrap is the 24-column wave below 24 columns and the 15-column score
  line below 15. Counting wrapped rows covers it; splitting the string (as `wrap-ansi` does)
  was never observable.
- **Height clipping is a few lines.** A frame taller than the viewport scrolls, and `\x1b[1A`
  cannot climb past the top row, so the writer drops leading lines until the frame and its
  trailing newline fit — the same rule `log-update` applied.

The pnpm closure cost was 16 packages for that one primitive — the single largest
non-parser subtree in `svelte-vitals`.

## What frame-writer does

`createFrameWriter(stream)` returns `render(frame)` / `render.clear()` / `render.done()`, the
same three calls the three call sites already made. Each render erases the previous frame
(`\x1b[2K` + `\x1b[1A\x1b[2K` × rendered rows + `\x1b[G`), writes the new one plus a trailing
newline, and remembers the new row count; a frame identical to the last one at the same width
is skipped, so the idle loop's repeated faces write nothing. Writes are wrapped in
synchronized-output markers (`\x1b[?2026h/l`) on a TTY so the erase + repaint lands as one
paint. The cursor is hidden on the first TTY render and restored by `clear()` and `done()`
(the next render re-hides it), on `exit`, and on `SIGINT`/`SIGTERM`/`SIGQUIT`/`SIGHUP` (the
handler re-raises the signal when no other listener owns it, so the exit status is unchanged).
ANSI stripping for the width count reuses core's `terminalSafe`.

## Known ceilings

- **1-column glyphs are an invariant, not a convention.** `frame-writer.test.ts` runs every
  animation frame and message through a fake stream and asserts they use only the authored
  glyph families (ASCII, box drawing, braille, `·…●◡`); anything new fails the test until its
  width is decided. Localized (CJK) mascot messages would need a width table — that is the
  point at which a `string-width`-class dependency earns its way back. A partial width table
  is not a safe middle ground: counting ZWJ/VS16 emoji sequences per scalar over-erases, which
  walks the cursor past the frame into the user's earlier output.
- **Ambiguous-width glyphs (`…`, `●`, `─`) count as 1**, the same default `string-width` uses,
  so there is no behaviour change on terminals that render them wide.
- **Changed frames repaint whole, no line diffing.** Identical frames are skipped and
  synchronized output covers the rest on modern terminals; if flicker shows up somewhere,
  diffing unchanged leading lines is the upgrade path.
