---
'svelte-vitals': patch
---

fix: restore the terminal cursor when the analysis spinner stops. `--no-animation` runs (and error paths that lead into interactive prompts) previously left the cursor hidden until the process exited.
