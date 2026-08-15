<script lang="ts">
  let { children } = $props();
</script>

<div class="card">{@render children?.()}</div>
