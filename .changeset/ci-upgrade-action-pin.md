---
'svelte-vitals': minor
---

Add `svelte-vitals ci upgrade`: rewrites only the pinned `@svelte-vitals/action` reference line(s) in an existing generated workflow to the pin bundled with the CLI, leaving everything else (other pins like `actions/checkout`, custom triggers/steps) untouched. Use `ci install --force` if you want to regenerate the whole file instead.
