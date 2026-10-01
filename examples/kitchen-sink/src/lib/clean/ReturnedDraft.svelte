<!-- `make` hands its $state to the caller, which writes it; the kinds come from a module whose name has a dot. -->
<script lang="ts">
  import { KINDS } from '$lib/clean/kinds.model';

  function make(title: string) {
    const live = $state({ title });
    return live;
  }
  const draft = make('');
</script>

<input aria-label="Draft title" value={draft.title} oninput={(e) => (draft.title = e.currentTarget.value)} />
{#each KINDS as kind}
  <span>{kind}</span>
{/each}
