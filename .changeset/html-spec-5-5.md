---
'@svelte-vitals/core': patch
---

`a11y/permitted-contents` now reads its content models from `@markuplint/html-spec` 5.5.0, which follows the current HTML standard:

- A `<style>` that is the first element child of a parent expecting flow content is no longer reported, because HTML now allows it there. A `<style>` is still reported when an element outside any block comes before it in the same parent. When the only elements before it sit inside `{#if}`, `{#each}` or another block, or a component or `{@html}` in the parent may render ahead of it, the rule cannot tell and stays silent.
- `<footer>` inside `<address>` is now reported.
- `<template>` inside a `<colgroup>` without `span`, and `<script>` or `<template>` inside `<thead>`, `<tbody>` or `<tfoot>`, are no longer reported. A finding inside a table section now reads "admits only `<tr>` and script-supporting elements".
