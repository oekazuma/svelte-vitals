---
'svelte-vitals': patch
---

`a11y/permitted-contents` now describes a `<video>` or `<audio>` that has `src` by the content model the spec gives it then. A media element nested in `<video src>` is reported with "`<video>` admits only `<track>`", where the message used to list `<source>` too, which a media element with `src` does not admit. Which children are reported is unchanged.
