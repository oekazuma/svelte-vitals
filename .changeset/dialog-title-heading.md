---
'svelte-vitals': patch
---

Read bits-ui's `Dialog.Title` and `AlertDialog.Title` as ARIA headings of their `level` (2 without one) in `seo/heading-level-skip`, directly or through a component that wraps them. They render only while the dialog is open, so a title no longer leaves a skip reported on the content inside the dialog, and a closed dialog's title closes no gap on the page. A dialog that jumps from its title to an `<h4>` is now reported.
