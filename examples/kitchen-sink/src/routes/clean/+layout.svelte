<script lang="ts">
  let { children } = $props();
</script>

<header>
  <p>Clean canary section</p>
</header>

<main>
  {@render children()}
</main>

<footer>
  <p>Every route under <code>/clean</code> must produce zero svelte-vitals findings.</p>
</footer>
