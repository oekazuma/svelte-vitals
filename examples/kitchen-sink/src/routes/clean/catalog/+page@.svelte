<!-- The Open Graph and Twitter tags come from {#each} over an object. `@` resets to the root layout,
     so no layout <main> wraps the hero: a <header> inside <section> is no banner, and the <aside> in it is top-level. -->
<script lang="ts">
  import * as easing from 'svelte/easing';
  import Shelves from '$lib/clean/catalog/Shelves.svelte';
  import JsonLd from '$lib/clean/jsonld/CatalogPage.svelte';

  const description = 'A small product catalog whose social tags come from an object, with a picture and shelves.';
  const og = {
    'og:title': 'Catalog canary — svelte-vitals kitchen sink',
    'og:description': description,
    'og:image': 'https://example.com/og.png',
    'og:url': 'https://example.com/clean/catalog'
  };
  const twitter = { 'twitter:card': 'summary_large_image' };

  const EASINGS = ['linear', 'cubicOut'];
  const curve = [0, 0.5, 1].map((t) => easing.cubicOut(t).toFixed(2));
</script>

<svelte:head>
  <title>Catalog canary — svelte-vitals kitchen sink</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="https://example.com/clean/catalog" />
  {#each Object.entries(og) as [property, content] (property)}
    <meta {property} {content} />
  {/each}
  {#each Object.entries(twitter) as [name, content] (name)}
    <meta {name} {content} />
  {/each}
</svelte:head>

<JsonLd />

<section>
  <header>
    <h1>Catalog canary</h1>
    <aside aria-label="Opening hours">Open daily, 9:00–18:00.</aside>
  </header>
</section>

<main>
  <picture>
    <source
      srcset="/img/catalog-640.avif 640w, /img/catalog-1280.avif 1280w"
      sizes="(min-width: 40rem) 40rem, 100vw"
      type="image/avif"
    />
    <img src="/img/catalog.jpg" alt="Shelves of tea, coffee and cocoa" width="1280" height="720" loading="eager" />
  </picture>

  <section>
    <header>
      <h2>Shelves</h2>
    </header>
    <Shelves />
  </section>

  <section>
    <h2>Animation</h2>
    <p>Cubic-out samples: {curve.join(', ')}.</p>
    <ul aria-label="Easing presets">
      {#each EASINGS as easing}
        <li>{easing}</li>
      {/each}
    </ul>
  </section>
</main>
