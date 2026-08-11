# Japanese --help output — gunshi i18n adoption design

Date: 2026-08-11
Status: Proposal (gunshi utilization item 2, the final item — awaiting maintainer review)
Origin: the gunshi migration plan's recorded follow-on
(`2026-08-10-gunshi-cli-migration-design.md`); approved in principle as part of the utilization
sequence, design details decided here.

## Goal and hard boundary

`--help` (all five surfaces) becomes available in Japanese. **Error messages, warnings, reporter
output, and every other runtime string stay English** — they are characterization-pinned, agents
and CI scripts match on them, and translating them would be a movement across the entire contract
suite for negative user value (CI logs are shared across locales). The boundary is: _help is for
humans reading in their terminal; everything else is machine-adjacent surface._ Recorded here so
the scope doesn't creep review by review.

## Mechanism

- **`@gunshi/plugin-i18n` (0.37.1, exact pin)** supplies the translation machinery; our hybrid
  help builders (generated OPTIONS + curated prose) consume it rather than adopting the renderer
  plugin (the bone decision stands). Two resource kinds:
  1. **Arg descriptions**: a ja resource module per surface mapping arg keys to ja descriptions.
     The en text stays in `args[].description` (single source for en, as today); ja lives in
     `src/gunshi/locales/ja.ts` keyed by surface + arg key. `generate()` is fed the locale's
     descriptions when rendering the OPTIONS block.
  2. **Curated prose**: the hand-written blocks (root header/usage, agent notes, exit codes,
     each sub-command's prose) get ja counterparts in the same locale module, selected by the
     same switch.
- **Locale selection**: `SVELTE_VITALS_LANG=ja` (explicit, documented) or auto-detect from the
  standard env chain (`LC_ALL`/`LC_MESSAGES`/`LANG` matching `ja*`) — explicit beats auto; any
  other value or absence means English. No new flag (help about `--help` flags is a snake eating
  its tail; env-based selection matches how terminals actually localize). Detection is a pure
  function over an injected env — fully testable, no std-env involvement.
- **Fallback**: a missing ja key falls back to the en text at render time (never a blank), and a
  **completeness drift test** fails CI when any declared arg or prose block lacks a ja entry —
  the same pattern that keeps en/ja docs in sync, extended to help resources. Adding a flag
  without its ja line is a red build, not a silent English leak.

## What regenerates downstream

- The docs site's generated flag tables (`gen:cli-reference`, adoption item 4) gain a ja variant
  sourced from the same ja resource module — the ja guide pages then carry ja descriptions
  instead of embedded English tables, closing the note recorded in item 4's addendum.
- Shell completion descriptions (item 1) remain English — completion scripts are
  machine-consumed and the plugin's own description plumbing is the cosmetic wart already
  documented; not in scope.

## Declared movements (changeset: `svelte-vitals` minor)

1. New behavior: `--help` renders in Japanese under `SVELTE_VITALS_LANG=ja` or a `ja*` locale env.
2. English output byte-identical to today when no ja locale applies — pinned by the existing help
   goldens running under the characterization suite's clean env (which carries no locale vars).
   New goldens pin the ja renders per surface.

## Test surface

- Help goldens ×5 surfaces ×2 locales (en set unchanged, ja set new).
- Locale-selection unit cells (explicit wins, `ja_JP.UTF-8` matches, `en_US` doesn't, absence
  doesn't, garbage doesn't).
- Completeness drift test (every arg key + prose block has a ja entry).
- Contract suite untouched — errors are out of scope by design, so nothing there may change.

## Rejected alternatives

- **Renderer-plugin adoption for localized help**: re-opens the bone decision (auto `-h`/`-v`
  injection, validation-error rendering) for no gain — our builders already own the layout.
- **Translating error messages**: breaks the characterization contract and localizes surfaces
  that agents/CI parse; permanently out of scope absent a maintainer decision to version the
  error contract.
- **A `--lang` flag**: adds a flag to every surface for something the environment already
  expresses; env-only keeps argv byte-compatible.
