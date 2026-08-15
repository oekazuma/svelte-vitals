<script lang="ts">
  let { user } = $props();

  function rename(name: string) {
    user.name = name; // correctness/prop-mutation: user isn't declared $bindable
  }
</script>

<button onclick={() => rename('Renamed')}>Rename {user.name}</button>
