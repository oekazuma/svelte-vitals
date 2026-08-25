<script lang="ts">
  import PropMutator from './PropMutator.svelte';
  import StaleDerivedCard from './StaleDerivedCard.svelte';

  // correctness/each-key + correctness/each-index-key: two shapes of the same list.
  let listItems = $state(['Alpha', 'Beta', 'Gamma']);

  // correctness/effect-as-derived: only assigns a $state, should be $derived instead.
  let total = $state(0);
  $effect(() => {
    total = listItems.length;
  });

  // correctness/effect-as-onmount: reads no reactive value, belongs in onMount.
  $effect(() => {
    document.title = 'Correctness gallery';
  });

  // correctness/unmutated-state: never reassigned, mutated, bound, or passed on.
  let untouchedState = $state('never changes');

  // correctness/nonreactive-builtin-state: a plain Set, mutated in a handler.
  let tags = $state(new Set(['a', 'b']));
  function addTag(tag: string) {
    tags.add(tag);
  }

  // correctness/checkable-bind-value
  let subscribed = $state(false);

  // correctness/prop-mutation, passed to PropMutator.svelte
  let user = $state({ name: 'Ada' });
</script>

<h1>Correctness defects</h1>

<ul>
  {#each listItems as item}
    <li>{item}</li>
  {/each}
</ul>

<ol>
  {#each listItems as item, i (i)}
    <li>{item}</li>
  {/each}
</ol>

<p>Total: {total}</p>
<p>{untouchedState}</p>

<button onclick={() => addTag('c')}>Add tag</button>
<p>{[...tags].join(', ')}</p>

<label>
  <input type="checkbox" bind:value={subscribed} />
  Subscribe
</label>

<!-- correctness/autoplay-muted: audible autoplay is blocked, so this never starts playing. -->
<video autoplay src="/hero.mp4"></video>

<PropMutator {user} />
<StaleDerivedCard type="danger" />
