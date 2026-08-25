---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add two a11y rules for focus-hijacking global attributes.

`a11y/no-accesskey` flags any element carrying an `accesskey` attribute — the actual shortcut combination varies by browser and OS, is undiscoverable, and conflicts with screen reader and browser keyboard bindings. Unlike most attribute rules, an expression-valued `accesskey` is also flagged: presence is the problem, the value never matters.

`a11y/no-autofocus` flags a literal `autofocus` attribute unless the element is a `<dialog>`, or sits inside a `<dialog>` or a popover container in the same component template — their focusing steps run on show, not at page load, so autofocus there is the correct tool. Expression-valued `autofocus` is unknowable and passes. The dialog/popover carve-out cannot see through component boundaries, so an autofocus inside a component rendered into a dialog is a known false positive — the docs page names the inline-suppression escape hatch.
