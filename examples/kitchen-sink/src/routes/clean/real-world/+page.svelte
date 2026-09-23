<!-- Patterns from real apps that svelte-vitals once misreported; each must stay finding-free. -->
<script module lang="ts">
  // Instance-script imports are hoisted to module scope, so this `alert` is the import, not window.alert.
  export const banner = alert('real-world canary');
</script>

<script lang="ts">
  import alert from '$lib/clean/real-world/notify';
  import LegacyCard from '$lib/clean/real-world/LegacyCard.svelte';
  import JsonLd from '$lib/clean/jsonld/RealWorldPage.svelte';

  let { data } = $props();

  const compact = Object.keys(data.stats).length > 3;

  // Mutated only through the {#each} item below — still a mutation of `settings`.
  let settings = $state([
    { id: 'email', label: 'Email updates', checked: true },
    { id: 'digest', label: 'Weekly digest', checked: false }
  ]);
</script>

<svelte:head>
  {#if compact}
    <title>Real-world canary, compact view — svelte-vitals</title>
    <meta
      name="Description"
      content="Patterns from real SvelteKit apps that svelte-vitals once misreported, shown in the compact layout."
    />
  {:else}
    <title>Real-world canary, full view — svelte-vitals kitchen sink</title>
    <meta
      name="description"
      content="Patterns from real SvelteKit apps that svelte-vitals once misreported, shown in the full layout."
    />
  {/if}
  <link rel="canonical" href="https://example.com/clean/real-world" />
  <meta property="og:title" content="Real-world canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="Patterns from real SvelteKit apps that svelte-vitals once misreported, kept free of findings."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/real-world" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<!-- The layout renders this page inside <main>, so this header is not a banner landmark. -->
<header>
  <h1>Real-world canary</h1>
  <p>{banner}</p>
</header>

<img src="/logo.svg" alt="Kitchen sink logo" width="120" height="40" loading="eager" />

<ul>
  {#each { length: 3 } as _, i (i)}
    <li>Placeholder row {i + 1}</li>
  {/each}
</ul>

<fieldset>
  <legend>Notifications</legend>
  {#each settings as setting (setting.id)}
    <label>
      <input type="checkbox" bind:checked={setting.checked} />
      {setting.label}
    </label>
  {/each}
</fieldset>

<LegacyCard card={{ title: 'Legacy card', opened: 0 }} tags={['a']} />
