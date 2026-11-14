---
'svelte-vitals': patch
---

`svelte-vitals ci install` and `ci upgrade` now pin `oekazuma/svelte-vitals-action` at v0.15.2, which attaches annotations to the right file when the step's `path` is a subdirectory of the repository. Its bundled analyzer moves to `svelte-vitals` 0.56.0, whose analysis matches the 0.55.5 that v0.15.0 bundled, so findings do not change. Run `svelte-vitals ci upgrade` to move an existing workflow.
