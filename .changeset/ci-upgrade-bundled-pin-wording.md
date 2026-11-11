---
'svelte-vitals': patch
---

`ci upgrade` no longer says "already up to date" when the workflow matches the pin this CLI bundles. That pin can trail the action's latest release, so the line now reads `already on the pin bundled with this CLI (@svelte-vitals/action@x.y.z)`.
