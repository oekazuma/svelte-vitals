<!-- `STEPS` is a constant list from this directory's own index module, imported as '.'. -->
<script lang="ts">
  import { STEPS } from '.';
</script>

<ol>
  {#each STEPS as step}
    <li>{step}</li>
  {/each}
</ol>
