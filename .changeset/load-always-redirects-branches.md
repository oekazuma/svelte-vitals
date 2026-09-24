---
'@svelte-vitals/core': patch
---

A page whose `load` redirects on every path through `if`/`else` branches or a `try`/`catch` (the `catch` redirecting, or rethrowing the redirect its `try` threw) is now recognised as never rendering, so the route-level checks such as `seo/title-presence`, `seo/description-presence` and `seo/canonical-url` no longer report it. A redirect under an `if` with no `else` still does not count.
