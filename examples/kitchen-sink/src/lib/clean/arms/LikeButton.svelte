<script lang="ts">
  function createCounter() {
    let count = $state.raw(0);
    return {
      get count() {
        return count;
      },
      increment() {
        count += 1;
      }
    };
  }

  const likes = createCounter();
</script>

<button type="button" onclick={likes.increment}>Like ({likes.count})</button>
