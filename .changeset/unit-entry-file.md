---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
'@svelte-vitals/mcp': minor
---

New rule `architecture/unit-entry-file`: a directory you have declared to be a unit must contain a
file named after it — `Card/` without `Card.svelte`, `getFoo/` without `getFoo.ts`. It is **inert
until configured**, so nothing changes for projects that do not set it.

Declare units by position with `units` (directory glob → the entry file's extension), by name with
`pascalCaseUnits` (root glob → extension, applying to every directory under it whose name begins with
an uppercase letter), and declare what is never a unit with `exclude`. Both identification styles
exist because a camelCase directory may be a unit or a grouping — only position tells them apart —
while a PascalCase unit nests to arbitrary depth, where no path glob reaches it.

A filename-pattern check cannot express this: a file that does not exist has no path to validate. For
the same reason, a declaration that matches no directory at all is reported, so a glob typo cannot
leave the rule silently checking nothing — and so is a declaration whose every match is removed by
`exclude`, with the message saying which of the two it was.
