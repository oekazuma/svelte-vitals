---
'svelte-vitals': patch
---

Read the head tags of a component placed in an `{#if}` arm that opens only once a script `let` declared `false` (`let ready = $state(false)`) is set to `true` inside `onMount`, `$effect` or `$effect.pre` as rendered only in the browser: they count on a route with `ssr = false`, and no longer on a server-rendered route, whose HTML has none. Such a route can now report a missing `<title>`, description, canonical, Open Graph or JSON-LD that the component used to supply, and a title or description length is judged on the tags the server renders.
