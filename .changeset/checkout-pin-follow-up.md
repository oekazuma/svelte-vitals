---
'svelte-vitals': patch
---

`ci install`'s generated workflow now pins `actions/checkout` to a commit SHA with a same-line version comment (`actions/checkout@<sha> # v7.0.0`), matching this repo's own convention, instead of a floating `@v4` tag.
