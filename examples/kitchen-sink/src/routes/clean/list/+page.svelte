<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/ListPage.svelte';

  interface ListItem {
    id: string;
    title: string;
    description: string;
    image: string;
    alt: string;
    loading: 'eager' | 'lazy';
  }

  const items: ListItem[] = [
    {
      id: 'standing-desk',
      title: 'Standing desk',
      description: 'Adjustable height, oak finish.',
      image: '/products/standing-desk.jpg',
      alt: 'Oak standing desk raised to sitting height',
      loading: 'eager'
    },
    {
      id: 'desk-lamp',
      title: 'Desk lamp',
      description: 'Dimmable LED with USB-C charging.',
      image: '/products/desk-lamp.jpg',
      alt: 'Black desk lamp with a flexible arm',
      loading: 'lazy'
    },
    {
      id: 'monitor-arm',
      title: 'Monitor arm',
      description: 'Single-arm mount with a gas spring.',
      image: '/products/monitor-arm.jpg',
      alt: 'Silver monitor arm mounted to a desk edge',
      loading: 'lazy'
    }
  ];
</script>

<svelte:head>
  <title>Clean canary: list — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A keyed product list with images, alt text, and dimensions — the false-positive patterns list rendering used to trigger, now clean."
  />
  <link rel="canonical" href="https://example.com/clean/list" />
  <meta property="og:title" content="Clean canary: list — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A keyed product list with images, alt text, and dimensions — the false-positive patterns list rendering used to trigger, now clean."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/list" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Product list</h1>
<p>A keyed list where each item carries a stable identifier used as the loop key.</p>

<ul>
  {#each items as item (item.id)}
    <li>
      <img
        src={item.image}
        srcset={`${item.image} 1x`}
        alt={item.alt}
        width="320"
        height="240"
        loading={item.loading}
      />
      <strong>{item.title}</strong>
      <p>{item.description}</p>
    </li>
  {/each}
</ul>
