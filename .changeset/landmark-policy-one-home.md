---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Move the landmark-resolution and classic-script-type policies into core as a single implementation. The CLI's source provider and the Vite plugin's rendered provider now apply the same decision procedure instead of maintaining mirrored copies. Three narrow detection fixes land with the unification: mixed-case landmark tags (`<heaDer>`) are now matched case-insensitively like the rendered document, a `<svelte:element this="…">` with a literal tag now contributes its landmark instead of only demoting its children, and script-`type` matching now follows the HTML spec's ASCII-whitespace rules — a whitespace-only or U+00A0-wrapped `type` is a data block, no longer flagged as render-blocking.
