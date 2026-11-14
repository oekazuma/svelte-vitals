---
'@svelte-vitals/core': patch
---

`a11y/permitted-contents` now reads its content models from `@markuplint/html-spec` 5.5.0, which follows the current HTML standard:

- A `<style>` that is the first element child of a parent expecting flow content is no longer reported, because HTML now allows it there. A `<style>` that comes after another element is still reported. Where an earlier sibling may not render (it sits inside `{#if}` or `{#each}`, or a component or `{@html}` comes before it), the rule stays silent.
- `<footer>` inside `<address>` is now reported.
- `<template>` inside `<colgroup>`, and `<script>` or `<template>` inside `<thead>`, `<tbody>` or `<tfoot>`, are no longer reported. A finding inside a table section now reads "admits only `<tr>` and script-supporting elements".
