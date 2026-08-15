<script lang="ts">
  let { children } = $props();
</script>

<!--
  Every /gallery/a11y/* route composes through this <main>. landmarks/+page.svelte adds
  a second landmark set (a11y/duplicate-landmark, a11y/top-level-landmark) — the other
  sibling routes deliberately add no landmarks of their own so they stay single-main.
-->
<main id="a11y-shell">
  {@render children()}
</main>
