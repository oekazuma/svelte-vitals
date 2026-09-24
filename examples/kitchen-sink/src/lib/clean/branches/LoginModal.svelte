<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();
</script>

<svelte:head>
  <title>Log in</title>
</svelte:head>

<dialog open aria-labelledby="login-title">
  <h2 id="login-title">Log in</h2>
  <p>Comments are open to signed-in readers.</p>
  <button type="button" onclick={onclose}>Close</button>
</dialog>
