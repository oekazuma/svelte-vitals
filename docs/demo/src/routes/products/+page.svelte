<script>
  const products = ['Mug', 'T-shirt', 'Sticker'];
  let inStockCount = $state(0);
  $effect(() => {
    inStockCount = products.length;
  });
</script>

<svelte:head>
  <title>Products | Demo Store — Mugs, Shirts, and Stickers</title>
  <meta
    name="description"
    content="Browse Demo Store's current lineup: ceramic mugs, printed t-shirts, and vinyl stickers."
  />
  <link rel="canonical" href="https://example.com/products" />
  <meta property="og:title" content="Demo Store Products — Mugs, Shirts, and Stickers" />
  <meta
    property="og:description"
    content="Browse Demo Store's current lineup: ceramic mugs, printed t-shirts, and vinyl stickers."
  />
  <meta property="og:image" content="https://example.com/og-products.png" />
  <meta property="og:url" content="https://example.com/products" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Demo Store Products"
    }
  </script>
</svelte:head>

<h1>Products ({inStockCount} in stock)</h1>
<ul>
  {#each products as product}
    <li>{product}</li>
  {/each}
</ul>
