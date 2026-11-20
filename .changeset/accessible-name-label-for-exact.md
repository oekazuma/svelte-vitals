---
'svelte-vitals': patch
---

`a11y/accessible-name` now matches a `<label for>` to an `id` exactly, as browsers do. Spaces around either value were trimmed before, so `<label for="go">` was taken to name `<input id=" go " type="image">`, which a browser leaves unlabelled, and the input went unreported.
