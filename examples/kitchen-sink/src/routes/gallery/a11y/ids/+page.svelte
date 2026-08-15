<script lang="ts">
  import DupId from '$lib/a11y/DupId.svelte';
</script>

<h1>Gallery — a11y id defects</h1>

<!-- a11y/id-duplication (cross-file): collides with DupId.svelte's own id="dup-x". -->
<p id="dup-x">Page-level id also named "dup-x".</p>

<DupId />

<!-- a11y/no-missing-id-ref: "ghost-id" is declared nowhere in this route (layout, page, or
     DupId.svelte) nor in app.html's shell (id="shell-root"). This route stays fully resolved
     for the rule to fire: literal ids only, no spreads, no {@html}, no non-$lib components. -->
<label for="ghost-id">Ghost label</label>
