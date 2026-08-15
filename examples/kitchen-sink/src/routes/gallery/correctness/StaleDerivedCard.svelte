<script lang="ts">
  let { type } = $props();

  // correctness/stale-prop-derivation: computed once at init, doesn't track `type`.
  let color = type === 'danger' ? 'red' : 'green';
</script>

<p style="color: {color}">Status: {type}</p>
