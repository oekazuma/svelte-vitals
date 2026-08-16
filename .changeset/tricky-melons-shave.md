---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

Fix analysis aborting on any project that writes its component styles in a CSS dialect.

Svelte parses a `<style>` body as CSS whatever its `lang` attribute says, so a single
`<style lang="scss">` block made a component unparseable — and one unparseable route file
fails the whole run with exit 2. Projects using SCSS, Less, or Stylus could not be analyzed
at all. Style bodies with a `lang` attribute are now blanked before parsing, preserving every
byte offset so reported lines are unchanged; nothing in the analysis reads CSS. Genuinely
malformed components still fail as before.

The rewrite is a retry, not a preprocessing step: a component that parses is never touched, so
only sources that are already a hard failure can reach it.
