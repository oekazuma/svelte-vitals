---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Move the landmark-resolution and classic-script-type policies into core as a single implementation. The CLI's source provider and the Vite plugin's rendered provider now apply the same decision procedure instead of maintaining mirrored copies; findings do not change.
