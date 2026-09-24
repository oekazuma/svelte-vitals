<script module lang="ts">
  export const sectionName = 'Clean canary section';
</script>

<script lang="ts">
  let { children } = $props();
</script>

<header>
  <p>{sectionName}</p>
</header>

<main>
  {@render children()}
</main>

<footer>
  <p>Every route under <code>/clean</code> must produce zero svelte-vitals findings.</p>
</footer>
