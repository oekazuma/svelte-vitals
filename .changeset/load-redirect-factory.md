---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A page whose `load` an imported factory builds (`export const load = createRedirect(…)`) is read as never rendering when the function the factory returns redirects or errors on every call, and a guard that returns a redirect (`if (!user) return redirect(…)`) no longer stops a `load` from being read as always redirecting. Route-level checks skip such pages, as they already did for a `load` that redirects in its own body.
