<script lang="ts">
  type History = { clear(): Promise<void> };

  let { history }: { history: History } = $props();
  let cleared = $state(false);

  // An awaited clear() is the client's own API, not a Set or Map mutation of the prop.
  async function reset() {
    await history.clear();
    cleared = true;
  }
</script>

<button type="button" onclick={reset}>{cleared ? 'History cleared' : 'Clear history'}</button>
