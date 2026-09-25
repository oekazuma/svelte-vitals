---
'@svelte-vitals/core': patch
---

A page whose `load` redirects by calling a function declared at the top level of the same file, one that itself redirects on every path (for example an OAuth callback's `await runLoginFlow()` inside a `try` whose `catch` rethrows the redirect), is now recognised as never rendering, so the route-level checks such as `seo/title-presence` and `seo/canonical-url` no longer report it. An `async` helper counts only when `load` awaits or returns its call, and a helper that can `return` does not count.
