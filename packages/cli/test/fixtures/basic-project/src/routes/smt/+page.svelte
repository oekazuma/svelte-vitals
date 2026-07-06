<script>
  import { JsonLd, MetaTags } from 'svelte-meta-tags';
  let { data } = $props();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'SMT' };
</script>

<MetaTags
  title={data.title}
  description="A page"
  openGraph={{
    type: 'website',
    url: data.url,
    description: data.description,
    images: [{ url: data.image }],
    title: data.title
  }}
  twitter={{ cardType: 'summary_large_image' }}
/>
<JsonLd schema={jsonLd} />
